// Paise backend prototype
// A small Express API that serves the mock data referenced by the
// wireframes (net worth, cash flow, category insights, "Ask Paise").
//
// Security posture for a fintech-flavored demo:
//   - helmet() for standard security headers
//   - strict CORS allowlist (env-configured, no wildcard by default)
//   - JSON body size limit
//   - rate limiting (general + a stricter one for the AI endpoint)
//   - optional x-api-key gate for the data/AI routes (PAISE_API_KEY)
//   - no-store caching on anything that returns financial data
//   - generic error responses (details only ever go to the server log)
//
// This is still a prototype: there's no real auth/session/user model,
// no database, and the "AI" endpoint is a stub unless you supply your
// own ANTHROPIC_API_KEY. See README-backend.md before using this for
// anything beyond a local demo.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const PORT = Number(process.env.PORT) || 4000;
const API_KEY = process.env.PAISE_API_KEY || null;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!API_KEY) {
  console.warn(
    "[paise] PAISE_API_KEY is not set — /api routes are running in OPEN demo mode. " +
      "Set PAISE_API_KEY in your environment (see .env.example) before sharing this server."
  );
}

const app = express();

// Behind a proxy (Render, Fly, nginx, etc.) this makes req.ip and the
// rate limiter see the real client IP instead of the proxy's.
app.set("trust proxy", 1);

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
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "x-api-key"],
    maxAge: 600,
  })
);

// ---------------------------------------------------------------------------
// Body parsing — small limit, this API never needs large payloads
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "10kb" }));

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
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
  next();
});

// ---------------------------------------------------------------------------
// Optional API key gate
// ---------------------------------------------------------------------------
function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // open demo mode
  const provided = req.get("x-api-key");
  if (provided && provided === API_KEY) return next();
  return res.status(401).json({ error: "Missing or invalid x-api-key." });
}

// ---------------------------------------------------------------------------
// Mock data (mirrors the numbers used in the wireframes)
// ---------------------------------------------------------------------------
const MOCK_USER_DATA = {
  netWorth: 842600,
  netWorthChangeThisMonth: 18400,
  safeToSpend: 6300,
  safeToSpendUntil: "2026-08-31",
  spentThisMonth: 38420,
  monthlyBudget: 42000,
  spentVsLastMonth: 4200,

  // Net-worth milestone projection shown on the Money tab's progress bar
  // ("today · 23", "₹10L · 24", "₹50L · 31", "₹1Cr · 38"). `progressPct`
  // is the fill toward the *next* unreached milestone. In a real system
  // this comes from a projection model (income, savings rate, growth
  // assumptions) — this is static mock data standing in for that.
  netWorthMilestones: {
    currentAge: 23,
    progressPct: 34,
    milestones: [
      { label: "₹10L", amount: 1000000, projectedAge: 24 },
      { label: "₹50L", amount: 5000000, projectedAge: 31 },
      { label: "₹1Cr", amount: 10000000, projectedAge: 38 },
    ],
  },

  // Distinct from `safeToSpend` — this is the Money tab's "at this burn
  // rate" end-of-month forecast card, not the day-to-day home-screen number.
  monthEndForecast: {
    remaining: 8400,
    until: "2026-08-31",
    basis: "burn_rate",
  },

  categories: [
    { slug: "food-delivery", name: "Food & delivery", amount: 11900, payments: 64, pct: 31 },
    { slug: "rent", name: "Rent", amount: 9000, payments: 1, pct: 24 },
    { slug: "travel-cabs", name: "Travel & cabs", amount: 6780, payments: 22, pct: 18 },
    { slug: "subscriptions", name: "Subscriptions", amount: 5340, payments: 7, pct: 14 },
    { slug: "shopping", name: "Shopping", amount: 5400, payments: 9, pct: 13 },
  ],

  recentTransactions: [
    { merchant: "Zomato", amount: -486, date: "2026-08-26T21:12:00+05:30", method: "UPI" },
    { merchant: "Aditya", amount: 1200, date: "2026-08-26T14:40:00+05:30", method: "split dinner" },
    { merchant: "Blinkit", amount: -1142, date: "2026-08-25T20:24:00+05:30", method: "UPI" },
    { merchant: "Cult.fit", amount: -1299, date: "2026-08-24T00:00:00+05:30", method: "autopay" },
    { merchant: "Uber", amount: -212, date: "2026-08-24T00:00:00+05:30", method: "HDFC card" },
    { merchant: "Spotify Duo", amount: -149, date: "2026-08-23T00:00:00+05:30", method: "autopay" },
  ],

  connectedAccounts: [
    { name: "Bank & UPI", provider: "HDFC", status: "connected", syncedAgo: "2m" },
    { name: "Mutual funds", provider: "Zerodha Coin", status: "connected", syncedAgo: "1h" },
    { name: "Credit cards", provider: null, status: "not_connected" },
    { name: "Fixed deposits", provider: null, status: "not_connected" },
    { name: "Insurance", provider: null, status: "not_connected" },
    { name: "NPS", provider: null, status: "not_connected" },
  ],
};

// "3 subscriptions you forgot" card, shown on the Money tab. Structurally
// distinct from the tone-based insight cards below — this is a detected
// list of recurring charges, not generated commentary.
const MOCK_SUBSCRIPTIONS = [
  { name: "Cult.fit", amount: 1299, cadence: "monthly", forgotten: true },
  { name: "Spotify Duo", amount: 149, cadence: "monthly", forgotten: true },
  { name: "Prime", amount: 399, cadence: "monthly", forgotten: true },
  { name: "HDFC Bank Locker", amount: 250, cadence: "quarterly", forgotten: false },
];

// Backs the small trend chart in the "Ask Paise" sheet (Jun/Jul/Aug bars).
// Keyed by the same `slug` used in `categories` above.
const MOCK_SPENDING_TRENDS = {
  "food-delivery": [
    { month: "2026-06", amount: 6200 },
    { month: "2026-07", amount: 7700 },
    { month: "2026-08", amount: 11900 },
  ],
  rent: [
    { month: "2026-06", amount: 9000 },
    { month: "2026-07", amount: 9000 },
    { month: "2026-08", amount: 9000 },
  ],
  "travel-cabs": [
    { month: "2026-06", amount: 5400 },
    { month: "2026-07", amount: 6100 },
    { month: "2026-08", amount: 6780 },
  ],
  subscriptions: [
    { month: "2026-06", amount: 5340 },
    { month: "2026-07", amount: 5340 },
    { month: "2026-08", amount: 5340 },
  ],
  shopping: [
    { month: "2026-06", amount: 3200 },
    { month: "2026-07", amount: 4100 },
    { month: "2026-08", amount: 5400 },
  ],
};

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
      actions: ["Cancel a subscription"],
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
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

app.get("/api/user-data", requireApiKey, (req, res) => {
  const privacyMode = req.query.privacy === "true";
  if (!privacyMode) return res.json(MOCK_USER_DATA);

  const masked = { ...MOCK_USER_DATA, netWorth: null, safeToSpend: null, spentThisMonth: null };
  res.json(masked);
});

app.get("/api/insights", requireApiKey, (req, res) => {
  const tone = req.query.tone === "Warm" ? "Warm" : "Direct";
  res.json({ tone, insights: buildInsights(tone) });
});

app.get("/api/subscriptions", requireApiKey, (req, res) => {
  const onlyForgotten = req.query.forgotten === "true";
  const subscriptions = onlyForgotten
    ? MOCK_SUBSCRIPTIONS.filter((s) => s.forgotten)
    : MOCK_SUBSCRIPTIONS;
  res.json({ subscriptions });
});

const KNOWN_CATEGORY_SLUGS = Object.keys(MOCK_SPENDING_TRENDS);

app.get("/api/spending-trend", requireApiKey, (req, res) => {
  const category = req.query.category;
  if (!category || !KNOWN_CATEGORY_SLUGS.includes(category)) {
    return res.status(400).json({
      error: `\`category\` must be one of: ${KNOWN_CATEGORY_SLUGS.join(", ")}`,
    });
  }

  const monthsParam = Number(req.query.months) || 3;
  const months = Math.min(Math.max(monthsParam, 1), 12);
  const fullTrend = MOCK_SPENDING_TRENDS[category];
  const trend = fullTrend.slice(Math.max(fullTrend.length - months, 0));

  res.json({ category, trend });
});

app.post("/api/ask", requireApiKey, askLimiter, async (req, res, next) => {
  try {
    const { question } = req.body || {};

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "`question` is required and must be a non-empty string." });
    }
    if (question.length > 500) {
      return res.status(400).json({ error: "`question` must be 500 characters or fewer." });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      // No key configured — return a canned, clearly-labelled stub so the
      // frontend still has something to render in a local demo.
      return res.json({
        answer:
          "This is a stub response — set ANTHROPIC_API_KEY in your environment " +
          "to have Ask Paise answer using your real financial data.",
        stub: true,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let apiRes;
    try {
      apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 400,
          system:
            "You are Paise, a concise personal-finance assistant. Answer using only the " +
            "financial context provided by the app. Keep answers short and direct. " +
            "Never invent numbers that weren't given to you.",
          messages: [
            {
              role: "user",
              content:
                `User's financial snapshot: ${JSON.stringify(MOCK_USER_DATA)}\n\n` +
                `Detected subscriptions: ${JSON.stringify(MOCK_SUBSCRIPTIONS)}\n\n` +
                `Question: ${question}`,
            },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!apiRes.ok) {
      // Log details server-side only; never forward upstream error bodies
      // (which can contain request echoes) straight to the client.
      console.error("[paise] Anthropic API error", apiRes.status, await apiRes.text());
      return res.status(502).json({ error: "The assistant is temporarily unavailable." });
    }

    const data = await apiRes.json();
    const answer = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    res.json({ answer: answer || "I couldn't come up with an answer to that.", stub: false });
  } catch (err) {
    next(err);
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
  console.error("[paise] unhandled error:", err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => {
  console.log(`[paise] backend listening on http://localhost:${PORT}`);
  console.log(`[paise] allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
