// Thin client for the Paise backend (see backend/README.md).

const API_PORT = process.env.NEXT_PUBLIC_API_PORT || "4000";
const API_KEY = process.env.NEXT_PUBLIC_PAISE_API_KEY || "";

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

function headers(extra) {
  const h = { ...extra };
  // The backend only requires this when PAISE_API_KEY is set on its side.
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

async function get(path) {
  const res = await fetch(`${apiBase()}${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function getUserData() {
  return get("/api/user-data");
}

export function getInsights(tone) {
  return get(`/api/insights?tone=${encodeURIComponent(tone)}`);
}

export function getSubscriptions({ forgotten } = {}) {
  return get(`/api/subscriptions${forgotten ? "?forgotten=true" : ""}`);
}

export function getSpendingTrend(category, months = 3) {
  return get(
    `/api/spending-trend?category=${encodeURIComponent(category)}&months=${months}`
  );
}

export async function ask(question) {
  const res = await fetch(`${apiBase()}/api/ask`, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify({ question }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
