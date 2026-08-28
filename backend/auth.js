// Phone + one-time-code sign-in, and the session tokens it issues.
//
// What this replaces: the OTP screen used to accept any six digits and the
// only credential in the system was one shared `PAISE_API_KEY` that the
// frontend shipped inside its JavaScript bundle. Now a code is generated
// server-side, hashed before storage, expires, is single-use, and is capped at
// a handful of attempts; a successful verification mints an opaque 256-bit
// session token whose SHA-256 is what the database keeps.
//
// What it is still not: there is no SMS gateway. Delivery is `log` (the code
// is printed to the server console) or `response` (returned in the body so a
// phone on a demo hotspot can sign itself in). Both are stated plainly in
// /health and in the startup banner — neither is a channel, and `response`
// must never be left on anywhere the server is reachable off your own machine.

import crypto from "node:crypto";
import { db, provisionUser } from "./db.js";

const OTP_LENGTH = 6;
const OTP_TTL_MS = Number(process.env.OTP_TTL_MS) || 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 24 * 60 * 60 * 1000;

// `log` prints the code to the server console; `response` also returns it to
// the caller so an unattended demo works. Anything else is treated as `log`.
export const OTP_DELIVERY = process.env.OTP_DELIVERY === "response" ? "response" : "log";

// Pepper for both hashes. Taken from the environment when set; otherwise
// generated once and kept in the database, so sessions survive a restart
// without anyone having to configure a secret for a local demo.
function loadSecret() {
  const fromEnv = process.env.PAISE_AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const existing = db.prepare("SELECT value FROM meta WHERE key = 'auth_secret'").get();
  if (existing) return existing.value;

  const generated = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO meta (key, value) VALUES ('auth_secret', ?)").run(generated);
  return generated;
}

const SECRET = loadSecret();
export const SECRET_SOURCE =
  process.env.PAISE_AUTH_SECRET && process.env.PAISE_AUTH_SECRET.length >= 16
    ? "env"
    : "generated";

const hmac = (value) => crypto.createHmac("sha256", SECRET).update(value).digest("hex");
const nowIso = () => new Date().toISOString();

// Constant-time compare over two hex digests of equal length. Both sides are
// hashes, so the length is fixed and this never leaks by early return.
function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// 10 digits, the way an Indian mobile number is entered. Normalised before it
// is ever used as a lookup key so "+91 98765 43210" and "9876543210" are the
// same account.
export function normalisePhone(input) {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D/g, "");
  const local = digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return local;
}

// ---------------------------------------------------------------------------
// One-time codes
// ---------------------------------------------------------------------------

export function requestOtp(phone) {
  // A new code invalidates every outstanding one for that number, so an old
  // SMS can't be replayed after the user asks for another.
  db.prepare(
    "UPDATE otp_challenges SET consumed_at = ? WHERE phone = ? AND consumed_at IS NULL"
  ).run(nowIso(), phone);

  const id = crypto.randomUUID();
  // randomInt is rejection-sampled, so every code is equally likely — unlike
  // Math.random() * 900000, which is neither uniform nor unpredictable.
  const code = String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  db.prepare(
    "INSERT INTO otp_challenges (id, phone, code_hash, created_at, expires_at, attempts) VALUES (?,?,?,?,?,0)"
  ).run(id, phone, hmac(`${id}:${code}`), nowIso(), expiresAt);

  return { challengeId: id, code, expiresAt, ttlMs: OTP_TTL_MS };
}

// Returns { ok: true, user } or { ok: false, reason }. The reasons are
// deliberately coarse — the caller maps every failure to the same message so a
// wrong code and an unknown challenge are indistinguishable from outside.
export function verifyOtp(challengeId, code) {
  if (typeof challengeId !== "string" || typeof code !== "string") {
    return { ok: false, reason: "invalid" };
  }
  const row = db.prepare("SELECT * FROM otp_challenges WHERE id = ?").get(challengeId);
  if (!row) return { ok: false, reason: "invalid" };
  if (row.consumed_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  const matches = safeEqualHex(hmac(`${challengeId}:${code.trim()}`), row.code_hash);
  if (!matches) {
    db.prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?").run(challengeId);
    const left = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    return { ok: false, reason: left > 0 ? "invalid" : "locked", attemptsLeft: Math.max(left, 0) };
  }

  db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?").run(nowIso(), challengeId);
  const { user, created } = provisionUser(row.phone);
  return { ok: true, user, created };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function createSession(userId, userAgent) {
  // 32 bytes from the CSPRNG. The token is returned once and never stored —
  // the row holds only its HMAC, so a leaked database file is not a set of
  // working sessions.
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?,?,?,?,?,?)"
  ).run(hmac(token), userId, nowIso(), expiresAt, nowIso(), (userAgent || "").slice(0, 200));
  return { token, expiresAt, ttlMs: SESSION_TTL_MS };
}

export function resolveSession(token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const row = db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.phone
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`
    )
    .get(hmac(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hmac(token));
    return null;
  }
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(nowIso(), hmac(token));
  return { userId: row.user_id, phone: row.phone, expiresAt: row.expires_at };
}

export function revokeSession(token) {
  if (typeof token !== "string") return false;
  const info = db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hmac(token));
  return info.changes > 0;
}

export function revokeAllSessions(userId) {
  return db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId).changes;
}

// Expired rows are dead weight and, in the case of a spent challenge, a record
// nobody needs. Swept on an interval rather than lazily so the table does not
// grow for a number that never signs in again.
export function sweepExpired() {
  const now = nowIso();
  const sessions = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now).changes;
  const challenges = db
    .prepare("DELETE FROM otp_challenges WHERE expires_at < ? OR consumed_at IS NOT NULL")
    .run(now).changes;
  return { sessions, challenges };
}

export const AUTH_CONFIG = {
  otpLength: OTP_LENGTH,
  otpTtlMs: OTP_TTL_MS,
  otpMaxAttempts: OTP_MAX_ATTEMPTS,
  sessionTtlMs: SESSION_TTL_MS,
  delivery: OTP_DELIVERY,
  secretSource: SECRET_SOURCE,
};
