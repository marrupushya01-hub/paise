// Thin client for the Paise backend (see backend/README.md).
//
// Every call carries the session token from lib/session.js as a bearer
// credential. There is no build-time API key in this bundle any more: a 401
// clears the stored session so the shell can send the user back to sign-in
// rather than shimmering forever behind a request that will never succeed.

import { clearSession, getToken } from "@/lib/session";

const API_PORT = process.env.NEXT_PUBLIC_API_PORT || "4000";

// Default to the host the page was served from, not a hardcoded localhost:
// opening the app at http://<lan-ip>:3000 on a phone has to reach this
// machine's API, not the phone's own loopback. An explicit
// NEXT_PUBLIC_API_BASE_URL always wins.
function apiBase() {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

export class ApiError extends Error {
  constructor(message, { status, code, ...rest } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    Object.assign(this, rest);
  }
}

function headers(extra) {
  const h = { ...extra };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fail(res) {
  const body = await res.json().catch(() => ({}));
  // An expired or revoked session is not a transient error — drop it so the
  // next render routes to sign-in instead of retrying with a dead token.
  if (res.status === 401) clearSession();
  return new ApiError(body.error || `Request failed (${res.status})`, {
    status: res.status,
    code: body.code,
    attemptsLeft: body.attemptsLeft,
  });
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: headers(body === undefined ? undefined : { "content-type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await fail(res);
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function requestOtp(phone) {
  return request("/api/auth/request-otp", { method: "POST", body: { phone } });
}

export function verifyOtp(challengeId, code) {
  return request("/api/auth/verify-otp", { method: "POST", body: { challengeId, code } });
}

export function me() {
  return request("/api/auth/me");
}

export function logout() {
  return request("/api/auth/logout", { method: "POST", body: {} });
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// `privacy` is left off unless it is an explicit override — with it absent the
// server applies the account's stored "Hide balances" setting, which is the
// one that follows the user between devices.
export function getUserData({ privacy } = {}) {
  const q = privacy === undefined ? "" : `?privacy=${privacy ? "true" : "false"}`;
  return request(`/api/user-data${q}`);
}

export function getInsights(tone) {
  return request(`/api/insights?tone=${encodeURIComponent(tone)}`);
}

export function getScreenInsights(screen) {
  return request(`/api/screen-insights?screen=${encodeURIComponent(screen)}`);
}

export function getPortfolio({ privacy } = {}) {
  const q = privacy === undefined ? "" : `?privacy=${privacy ? "true" : "false"}`;
  return request(`/api/portfolio${q}`);
}

export function getProfile() {
  return request("/api/profile");
}

export function getSubscriptions({ forgotten } = {}) {
  return request(`/api/subscriptions${forgotten ? "?forgotten=true" : ""}`);
}

export function getSpendingTrend(category, months = 3) {
  return request(
    `/api/spending-trend?category=${encodeURIComponent(category)}&months=${months}`
  );
}

export function getSettings() {
  return request("/api/settings");
}

export function saveSettings(patch) {
  return request("/api/settings", { method: "PATCH", body: patch });
}

export function getDismissed() {
  return request("/api/dismissed");
}

export function dismissInsight(insightId) {
  return request("/api/dismissed", { method: "POST", body: { insightId } });
}

export function restoreInsight(insightId) {
  return request(`/api/dismissed/${encodeURIComponent(insightId)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Ask Paise
// ---------------------------------------------------------------------------

export function ask(question) {
  return request("/api/ask", { method: "POST", body: { question } });
}

// Streaming variant. An 8B model on CPU takes tens of seconds to finish a
// paragraph and about a second to start one, so the answer is read as it is
// written rather than after it is finished.
//
// `onToken` is called with each fragment; the promise resolves with the whole
// answer. Pass an AbortSignal to stop generation when the sheet closes — the
// server aborts its own upstream request when the connection drops.
export async function askStream(question, { onToken, signal } = {}) {
  const res = await fetch(`${apiBase()}/api/ask`, {
    method: "POST",
    headers: headers({ "content-type": "application/json", Accept: "text/event-stream" }),
    body: JSON.stringify({ question }),
    signal,
  });
  if (!res.ok) throw await fail(res);

  // A server without streaming support (or an error path that answered in
  // JSON) still returns a usable answer — take it rather than failing.
  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    const body = await res.json();
    const answer = body.answer || "";
    if (answer) onToken?.(answer);
    return answer;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  // SSE frames are separated by a blank line; a chunk boundary can land in the
  // middle of one, so only complete frames are parsed and the tail carries on.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      let event = "message";
      const dataLines = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;

      let payload;
      try {
        payload = JSON.parse(dataLines.join("\n"));
      } catch {
        continue;
      }

      if (event === "token" && payload.text) {
        answer += payload.text;
        onToken?.(payload.text);
      } else if (event === "done") {
        answer = payload.answer ?? answer;
      }
    }
  }

  return answer.trim();
}
