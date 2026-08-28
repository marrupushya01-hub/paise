"use client";

// Where the session token lives on the client.
//
// It replaces `NEXT_PUBLIC_PAISE_API_KEY`, which was a single shared secret
// compiled into the JavaScript bundle — the same string for every visitor,
// readable by anyone who opened the sources panel, and unrevocable without an
// edit and a redeploy. This is a per-account 256-bit token the server minted
// for one sign-in, that expires, and that "Log out" destroys server-side.
//
// localStorage rather than a cookie because the API is a different origin over
// plain HTTP on a LAN demo, and a cross-site cookie needs `SameSite=None`,
// which browsers only honour with `Secure`. Put this behind TLS and an
// httpOnly cookie becomes the better home — that is the one thing this file
// would change.

const KEY = "paise.session";

let cached = null;
let hydrated = false;
const listeners = new Set();

function read() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    // A token whose expiry has already passed is not worth a round trip.
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSession() {
  if (!hydrated) {
    cached = read();
    hydrated = true;
  }
  return cached;
}

export function getToken() {
  return getSession()?.token ?? null;
}

export function setSession(session) {
  cached = session;
  hydrated = true;
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Private-mode browsers throw here. The session still works for this tab.
  }
  for (const fn of listeners) fn(session);
}

export function clearSession() {
  setSession(null);
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
