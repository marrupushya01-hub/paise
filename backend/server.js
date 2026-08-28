// Paise backend
//
// Express API behind the Paise client: net worth, cash flow, category
// insights, portfolio, and "Ask Paise" against a locally hosted model.
//
// Security posture:
//   - phone + one-time-code sign-in; opaque 256-bit session tokens, stored
//     only as HMACs (auth.js)
//   - SQLite-backed per-account data; every read is scoped by session user id
//     and there is no route that can return another account's rows (db.js)
//   - server-enforced privacy mode: masked figures are never serialised, so
//     devtools cannot see through the mask
//   - helmet() for standard security headers
//   - strict CORS allowlist (env-configured, no wildcard by default)
//   - 10kb JSON body limit
//   - four rate limiters: general, auth, OTP issuance, and the AI endpoint
//   - no-store caching on anything that returns financial data
//   - generic error responses (details only ever go to the server log)
//
// Still a prototype: there is no SMS gateway (see auth.js on OTP delivery),
// no TLS termination of its own, and the dataset every new account starts
// from is the seeded fixture in seed.js. See README.md.

// Load .env before any process.env reads.
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import morgan from "morgan";
import os from "node:os";

import {
  AUTH_CONFIG,
  createSession,
  normalisePhone,
  requestOtp,
  resolveSession,
  revokeAllSessions,
  revokeSession,
  sweepExpired,
  verifyOtp,
} from "./auth.js";
import {
  dismissInsight,
  getDismissed,
  getModelSnapshot,
  getPortfolio,
  getProfile,
  getScreenInsights,
  getSettings,
  getSpendingTrend,
  getSubscriptions,
  getTrendSlugs,
  getUserData,
  restoreInsight,
  saveSettings,
  seededNow,
  stats,
} from "./db.js";

const PORT = Number(process.env.PORT) || 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// A hotspot hands out a different address every session, so pinning the
// phone's origin in ALLOWED_ORIGINS means editing .env before every demo.
// With ALLOW_LAN_ORIGINS=true, any private-range IPv4 origin is accepted on
// top of the allowlist. Only for a LAN demo — turn it off the moment this
// server is reachable from the internet, a tunnel included.
const ALLOW_LAN_ORIGINS = process.env.ALLOW_LAN_ORIGINS === "true";
// /api/ask runs against a locally hosted Ollama model — no API key, no
// per-token cost, and it keeps the financial snapshot on this machine.
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
// Prompts larger than the context window do not truncate — they wedge the
// Ollama runner at 100% CPU and every later request queues behind it. The
// snapshot below is ~1KB, so 8192 is generous, but keep them in step if the
// context ever grows.
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 8192;
// An 8B model on CPU answers in tens of seconds, not the ~2s a hosted API
// takes. Anything under a minute here just turns slow answers into 502s.
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 120000;

const SYSTEM_PROMPT =
  "You are Paise, a concise personal-finance assistant. Answer using only the " +
  "financial context provided by the app. Keep answers short and direct. " +
  "Never invent numbers that weren't given to you. Every amount is in Indian " +
  "rupees — write them with a rupee sign, never a dollar sign.";

// The three private IPv4 ranges (RFC 1918). Deliberately no 169.254.0.0/16
// and no IPv6 — a phone on a hotspot always lands in one of these.
const PRIVATE_IPV4 =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

function isLanOrigin(origin) {
  if (!ALLOW_LAN_ORIGINS) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return url.protocol === "http:" && PRIVATE_IPV4.test(url.hostname);
}

// Every non-loopback IPv4 this machine answers on, so the startup banner can
// print the exact URL to type into a phone. The interface name comes along
// because a VPN (WARP, Tailscale) also shows up here with an address no
// phone on your hotspot can route to — you want the wifi adapter's line.
function lanAddresses() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, ifaces]) =>
    (ifaces || [])
      .filter((iface) => iface.family === "IPv4" && !iface.internal)
      .map((iface) => ({ name, address: iface.address }))
  );
}

const app = express();

// Behind a proxy (Render, Fly, nginx, etc.) this makes req.ip and the
// rate limiter see the real client IP instead of the proxy's.
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// Request logging (dev-only style; swap to "combined" for production)
// ---------------------------------------------------------------------------
app.use(morgan("dev"));

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    // This server only ever returns JSON, so a page-oriented CSP isn't
    // relevant here — turn it off rather than ship a misleading one.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);

// ---------------------------------------------------------------------------
// CORS — explicit allowlist, no wildcard
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin(origin, callback) {
      // Allow tools like curl/Postman (no Origin header) and any
      // explicitly allowlisted browser origin.
      if (!origin || ALLOWED_ORIGINS.includes(origin) || isLanOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

// ---------------------------------------------------------------------------
// Body parsing — small limit, this API never needs large payloads
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "10kb" }));

// ---------------------------------------------------------------------------
// Rate limiting
//
// Signed-in traffic is counted per session rather than per IP: every phone on
// one hotspot shares a NAT address, so an IP-only budget would have the first
// device to load the app exhaust it for the room.
// ---------------------------------------------------------------------------
function rateKey(req) {
  const token = bearer(req);
  // ipKeyGenerator normalises IPv6 to a /64 so one address cannot mint a
  // fresh budget per interface identifier.
  return token ? `s:${token.slice(0, 24)}` : `ip:${ipKeyGenerator(req.ip)}`;
}

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: rateKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Codes cost nothing to request and everything to brute-force, so issuance is
// the tightest budget in the server.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many codes requested. Try again in a few minutes." },
});

// Per-challenge attempts are already capped in auth.js; this caps how fast a
// single address can burn through fresh challenges.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Try again in a few minutes." },
});

const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: rateKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests to Ask Paise. Please wait a moment." },
});

app.use("/api", generalLimiter);

// ---------------------------------------------------------------------------
// Never let financial data get cached anywhere along the way
// ---------------------------------------------------------------------------
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Origin, Authorization");
  next();
});

// ---------------------------------------------------------------------------
// Session gate
// ---------------------------------------------------------------------------
function bearer(req) {
  const header = req.get("authorization") || "";
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim();
}

function requireSession(req, res, next) {
  const token = bearer(req);
  const session = token ? resolveSession(token) : null;
  if (!session) {
    return res.status(401).json({ error: "Sign in to continue.", code: "no_session" });
  }
  req.session = session;
  req.userId = session.userId;
  next();
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post("/api/auth/request-otp", otpRequestLimiter, (req, res) => {
  const phone = normalisePhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
  }

  const { challengeId, code, expiresAt, ttlMs } = requestOtp(phone);
  console.log(
    `[paise] OTP for +91${phone}: ${code}  (challenge ${challengeId}, valid ${Math.round(
      ttlMs / 1000
    )}s)`
  );

  const body = { challengeId, expiresAt, expiresInMs: ttlMs, delivery: AUTH_CONFIG.delivery };
  // Demo delivery. There is no SMS gateway, so with OTP_DELIVERY=response the
  // code comes back in the body — the only way an unattended phone on a
  // hotspot can sign itself in. Never leave this on off your own machine.
  if (AUTH_CONFIG.delivery === "response") body.devCode = code;
  res.json(body);
});

app.post("/api/auth/verify-otp", otpVerifyLimiter, (req, res) => {
  const { challengeId, code } = req.body || {};
  const result = verifyOtp(challengeId, code);

  if (!result.ok) {
    // Every failure reads the same from outside apart from the two states the
    // user has to be able to act on: an expired code and a locked challenge.
    if (result.reason === "expired") {
      return res.status(410).json({ error: "That code has expired. Request a new one.", code: "expired" });
    }
    if (result.reason === "locked") {
      return res.status(429).json({ error: "Too many wrong codes. Request a new one.", code: "locked" });
    }
    return res.status(401).json({
      error: "That code isn't right.",
      code: "invalid",
      attemptsLeft: result.attemptsLeft,
    });
  }

  const { token, expiresAt } = createSession(result.user.id, req.get("user-agent"));
  res.json({
    token,
    expiresAt,
    isNewAccount: result.created,
    profile: getProfile(result.user.id),
  });
});

app.get("/api/auth/me", requireSession, (req, res) => {
  res.json({
    profile: getProfile(req.userId),
    settings: getSettings(req.userId),
    expiresAt: req.session.expiresAt,
  });
});

app.post("/api/auth/logout", requireSession, (req, res) => {
  revokeSession(bearer(req));
  res.json({ ok: true });
});

// "Sign out everywhere" — the one thing a shared secret could never offer.
app.post("/api/auth/logout-all", requireSession, (req, res) => {
  const revoked = revokeAllSessions(req.userId);
  res.json({ ok: true, revoked });
});

// ---------------------------------------------------------------------------
// Insight copy — tone-conditioned, generated rather than stored
// ---------------------------------------------------------------------------
function buildInsights(tone) {
  const direct = tone !== "Warm";
  return [
    {
      id: "food-weekend",
      date: "2026-08-26",
      headline: "Food is up ₹4,200 this month.",
      body: direct
        ? "₹8,100 of it landed on Fri–Sun. Weekdays are actually down ₹600."
        : "Most of it — about ₹8,100 — landed on weekends. Your weekdays actually got a little cheaper.",
      actions: ["Show me", "Not now"],
    },
    {
      id: "duplicate-charges",
      date: "2026-08-24",
      headline: "Three apps charged you twice.",
      body: direct
        ? "Cult, Spotify and Prime. ₹1,847 gone before you noticed."
        : "Cult, Spotify and Prime each billed twice, ₹1,847 in total. Easy to miss.",
      actions: ["Show the charges"],
    },
    {
      id: "sip-vs-fd",
      date: "2026-08-22",
      headline: "Your SIP is beating your FDs.",
      body: direct
        ? "₹5,000/mo in Parag Parikh Flexi, 6.4% ahead of your FDs since March."
        : "Your ₹5,000 monthly SIP in Parag Parikh Flexi is running 6.4% ahead of your FDs since March.",
      actions: ["Explain this SIP"],
    },
  ];
}

// ---------------------------------------------------------------------------
// Privacy mode, enforced here rather than at render
//
// "Hide balances" used to be a CSS-level truth: the full figures were sent and
// the client drew dots over them, so devtools saw straight through it. Now the
// masked fields are dropped before the response is serialised — the number is
// not in the payload at all.
// ---------------------------------------------------------------------------
function maskUserData(data) {
  return {
    ...data,
    netWorth: null,
    netWorthChangeThisMonth: null,
    safeToSpend: null,
    spentThisMonth: null,
    spentVsLastMonth: null,
    monthlyBudget: null,
    moneyIn: data.moneyIn ? { ...data.moneyIn, amount: null } : null,
    monthEndForecast: data.monthEndForecast
      ? { ...data.monthEndForecast, remaining: null }
      : null,
    // Merchants identify spending as surely as the amounts do.
    recentTransactions: data.recentTransactions.map((t) => ({
      ...t,
      merchant: "•••",
      amount: null,
      detail: t.detail
        ? { ...t.detail, initial: "•", account: "•••", note: null, meta: t.detail.meta }
        : null,
    })),
    categories: data.categories.map((c) => ({ ...c, amount: null, pct: null })),
  };
}

function maskPortfolio(bundle) {
  return {
    portfolio: {
      ...bundle.portfolio,
      value: null,
      gained: null,
      invested: null,
      sipMonthly: null,
    },
    holdings: bundle.holdings.map((h) => ({ ...h, value: null })),
    sips: bundle.sips,
    goals: bundle.goals.map((g) => ({ ...g, value: null })),
  };
}

// `?privacy=` lets a caller ask for masking explicitly; with it absent the
// account's stored setting decides. The setting is the durable one — flipping
// "Hide balances" on a laptop hides them on the phone too.
function privacyRequested(req) {
  if (req.query.privacy === "true") return true;
  if (req.query.privacy === "false") return false;
  return getSettings(req.userId).privacyMode;
}

// ---------------------------------------------------------------------------
// Data routes
// ---------------------------------------------------------------------------

app.get("/health", (req, res) => {
  const s = stats();
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    accounts: s.users,
    activeSessions: s.sessions,
    otpDelivery: AUTH_CONFIG.delivery,
    authSecret: AUTH_CONFIG.secretSource,
  });
});

app.get("/api/user-data", requireSession, (req, res) => {
  const data = getUserData(req.userId);
  if (!data) return res.status(404).json({ error: "No data for this account." });
  res.json(privacyRequested(req) ? maskUserData(data) : data);
});

app.get("/api/insights", requireSession, (req, res) => {
  const stored = getSettings(req.userId).tone;
  const tone = req.query.tone === "Warm" ? "Warm" : req.query.tone === "Direct" ? "Direct" : stored;
  const dismissed = new Set(getDismissed(req.userId));
  res.json({
    tone,
    insights: buildInsights(tone).filter((c) => !dismissed.has(c.id)),
  });
});

// The Money and Invest tabs' own cards. These used to be hardcoded in
// frontend/data/mock.js, which meant "Not now" could not outlive a refresh.
app.get("/api/screen-insights", requireSession, (req, res) => {
  const screen = req.query.screen === "invest" ? "invest" : "money";
  const dismissed = new Set(getDismissed(req.userId));
  res.json({
    screen,
    insights: getScreenInsights(req.userId, screen).filter((c) => !dismissed.has(c.id)),
  });
});

app.get("/api/subscriptions", requireSession, (req, res) => {
  const onlyForgotten = req.query.forgotten === "true";
  res.json({ subscriptions: getSubscriptions(req.userId, { onlyForgotten }) });
});

app.get("/api/spending-trend", requireSession, (req, res) => {
  const known = getTrendSlugs(req.userId);
  const category = req.query.category;
  if (!category || !known.includes(category)) {
    return res.status(400).json({ error: `\`category\` must be one of: ${known.join(", ")}` });
  }
  const monthsParam = Number(req.query.months) || 3;
  const months = Math.min(Math.max(monthsParam, 1), 12);
  res.json({ category, trend: getSpendingTrend(req.userId, category, months) });
});

app.get("/api/portfolio", requireSession, (req, res) => {
  const bundle = getPortfolio(req.userId);
  if (!bundle) return res.status(404).json({ error: "No portfolio for this account." });
  res.json(privacyRequested(req) ? maskPortfolio(bundle) : bundle);
});

app.get("/api/profile", requireSession, (req, res) => {
  res.json({ profile: getProfile(req.userId) });
});

app.get("/api/settings", requireSession, (req, res) => {
  res.json({ settings: getSettings(req.userId) });
});

app.patch("/api/settings", requireSession, (req, res) => {
  const { privacyMode, tone } = req.body || {};
  if (privacyMode !== undefined && typeof privacyMode !== "boolean") {
    return res.status(400).json({ error: "`privacyMode` must be a boolean." });
  }
  if (tone !== undefined && tone !== "Direct" && tone !== "Warm") {
    return res.status(400).json({ error: "`tone` must be \"Direct\" or \"Warm\"." });
  }
  res.json({ settings: saveSettings(req.userId, { privacyMode, tone }) });
});

app.get("/api/dismissed", requireSession, (req, res) => {
  res.json({ dismissed: getDismissed(req.userId) });
});

app.post("/api/dismissed", requireSession, (req, res) => {
  const { insightId } = req.body || {};
  if (typeof insightId !== "string" || !insightId.trim() || insightId.length > 64) {
    return res.status(400).json({ error: "`insightId` is required." });
  }
  dismissInsight(req.userId, insightId.trim());
  res.json({ dismissed: getDismissed(req.userId) });
});

app.delete("/api/dismissed/:insightId", requireSession, (req, res) => {
  restoreInsight(req.userId, req.params.insightId);
  res.json({ dismissed: getDismissed(req.userId) });
});

// ---------------------------------------------------------------------------
// Ask Paise
//
// The single egress point in the system, and it egresses to loopback. The
// snapshot is assembled from this account's rows — never from the request —
// and the question is length-capped before it is embedded in the prompt.
// ---------------------------------------------------------------------------

function ollamaBody(snapshot, question, stream) {
  return JSON.stringify({
    model: OLLAMA_MODEL,
    system: SYSTEM_PROMPT,
    prompt: `User's financial snapshot:\n${JSON.stringify(snapshot)}\n\nQuestion: ${question}`,
    stream,
    // qwen3 and other hybrid-reasoning models spend their entire budget in
    // `thinking` and return an empty `response` unless this is off.
    think: false,
    options: { temperature: 0.1, num_ctx: OLLAMA_NUM_CTX },
  });
}

function readQuestion(req, res) {
  const { question } = req.body || {};
  if (typeof question !== "string" || !question.trim()) {
    res.status(400).json({ error: "`question` is required and must be a non-empty string." });
    return null;
  }
  if (question.length > 500) {
    res.status(400).json({ error: "`question` must be 500 characters or fewer." });
    return null;
  }
  return question.trim();
}

app.post("/api/ask", requireSession, askLimiter, async (req, res, next) => {
  const question = readQuestion(req, res);
  if (question === null) return undefined;

  const snapshot = getModelSnapshot(req.userId);
  if (!snapshot) return res.status(404).json({ error: "No data for this account." });

  const wantsStream = (req.get("accept") || "").includes("text/event-stream");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  // A closed tab should stop the generation, not leave the runner busy.
  req.on("close", () => controller.abort());

  try {
    let upstream;
    try {
      upstream = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: ollamaBody(snapshot, question, wantsStream),
        signal: controller.signal,
      });
    } catch (err) {
      // Ollama not running is the single likeliest cause, and it is worth
      // saying out loud in the server log rather than as a generic 500.
      if (err.name === "AbortError") {
        console.error(`[paise] Ollama timed out after ${OLLAMA_TIMEOUT_MS}ms`);
        return res.status(504).json({ error: "The assistant took too long to answer." });
      }
      console.error(`[paise] cannot reach Ollama at ${OLLAMA_URL} —`, err.message);
      return res.status(502).json({ error: "The assistant is temporarily unavailable." });
    }

    if (!upstream.ok) {
      // Log details server-side only; never forward upstream error bodies
      // (which can contain request echoes) straight to the client.
      console.error("[paise] Ollama error", upstream.status, await upstream.text());
      return res.status(502).json({ error: "The assistant is temporarily unavailable." });
    }

    if (!wantsStream) {
      const data = await upstream.json();
      const answer = (data.response || "").trim();
      return res.json({
        answer: answer || "I couldn't come up with an answer to that.",
        stub: false,
      });
    }

    // ---- Server-sent events -------------------------------------------------
    // An 8B model on CPU takes tens of seconds to finish a paragraph but only
    // a second or two to start one. Forwarding Ollama's NDJSON as SSE is the
    // difference between a spinner and an answer arriving as it is written.
    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // nginx and friends buffer event streams into uselessness otherwise.
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const send = (event, payload) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    // Ollama emits one JSON object per line. A chunk boundary can land inside
    // a line, so the tail is carried over rather than parsed.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk;
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }
        if (chunk.response) {
          full += chunk.response;
          send("token", { text: chunk.response });
        }
        if (chunk.done) send("done", { answer: full.trim() });
      }
    }

    if (!full.trim()) send("done", { answer: "I couldn't come up with an answer to that." });
    return res.end();
  } catch (err) {
    if (err.name === "AbortError") {
      if (res.headersSent) return res.end();
      return res.status(504).json({ error: "The assistant took too long to answer." });
    }
    return next(err);
  } finally {
    clearTimeout(timeout);
  }
});

// ---------------------------------------------------------------------------
// 404 + error handling
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  console.error("[paise] unhandled error:", err);
  if (res.headersSent) return res.end();
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

// Expired sessions and spent codes are swept every ten minutes rather than
// left to accumulate for a number that never signs in again.
const sweep = setInterval(() => {
  const { sessions, challenges } = sweepExpired();
  if (sessions || challenges) {
    console.log(`[paise] swept ${sessions} expired session(s), ${challenges} spent code(s)`);
  }
}, 10 * 60 * 1000);
sweep.unref();

// Explicitly bind every interface. Express already defaults to this, but the
// phone on the hotspot reaching this server depends on it, so it is spelled
// out rather than left to a default someone might tighten later.
app.listen(PORT, "0.0.0.0", () => {
  const s = stats();
  console.log(`[paise] backend listening on http://localhost:${PORT}`);
  for (const { name, address } of lanAddresses()) {
    console.log(`[paise]                     http://${address}:${PORT}  (${name})`);
  }
  console.log(`[paise] database: ${s.path}${seededNow ? " (seeded)" : ""} · ${s.users} account(s)`);
  console.log(`[paise] allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  if (ALLOW_LAN_ORIGINS) {
    console.log("[paise] plus any private-range LAN origin (ALLOW_LAN_ORIGINS=true)");
  }
  if (AUTH_CONFIG.delivery === "response") {
    console.warn(
      "[paise] OTP_DELIVERY=response — sign-in codes are returned in the API response. " +
        "Demo only. Set OTP_DELIVERY=log anywhere this server is reachable off this machine."
    );
  } else {
    console.log("[paise] OTP delivery: server log (watch this terminal for sign-in codes)");
  }
  if (AUTH_CONFIG.secretSource === "generated") {
    console.log(
      "[paise] auth secret generated and stored in the database. Set PAISE_AUTH_SECRET to pin it."
    );
  }
});
