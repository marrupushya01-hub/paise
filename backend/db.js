// SQLite persistence for Paise.
//
// Everything the API serves lives in a real database on disk — one file,
// `PAISE_DB_PATH` (default `backend/paise.db`), driven by Node's built-in
// `node:sqlite`. No external service, no ORM, no migration tool: the schema is
// created if absent, and the template dataset in seed.js is loaded exactly
// once, under the reserved user id 0.
//
// Every account provisioned by a verified OTP gets its own copy of that
// template (`provisionUser`), so the dataset is per-user rather than one
// global object shared by every caller. Reads are always scoped by user id —
// there is no query in this file that can return another account's rows.
//
// Writes go through prepared statements only. No SQL string in this file is
// ever built by concatenating a request value.

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEMPLATE_ACCOUNTS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_GOALS,
  TEMPLATE_HOLDINGS,
  TEMPLATE_INVEST_INSIGHTS,
  TEMPLATE_MILESTONES,
  TEMPLATE_MONEY_INSIGHTS,
  TEMPLATE_PORTFOLIO,
  TEMPLATE_PROFILE,
  TEMPLATE_SIPS,
  TEMPLATE_SNAPSHOT,
  TEMPLATE_SUBSCRIPTIONS,
  TEMPLATE_TRANSACTIONS,
  TEMPLATE_TRENDS,
} from "./seed.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Reserved owner id for the pristine template rows. No session can ever
// resolve to it — `sessions.user_id` is a foreign key into `users`, and there
// is no `users` row with id 0.
export const TEMPLATE_USER_ID = 0;

const DB_PATH = process.env.PAISE_DB_PATH || path.join(HERE, "paise.db");

export const db = new DatabaseSync(DB_PATH);

// WAL keeps a reader from blocking on the writer, and the foreign keys are the
// reason deleting a user takes their whole dataset with them.
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phone       TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  initials    TEXT    NOT NULL,
  age         INTEGER,
  created_at  TEXT    NOT NULL,
  last_login  TEXT
);

-- Only the SHA-256 of a session token is stored, so a copy of this file does
-- not hand anyone a usable session.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Same for one-time codes: hashed, single-use, expiring, attempt-capped.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id          TEXT PRIMARY KEY,
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_challenges(phone);

CREATE TABLE IF NOT EXISTS settings (
  user_id      INTEGER PRIMARY KEY,
  privacy_mode INTEGER NOT NULL DEFAULT 0,
  tone         TEXT    NOT NULL DEFAULT 'Direct'
);

CREATE TABLE IF NOT EXISTS dismissed_insights (
  user_id      INTEGER NOT NULL,
  insight_id   TEXT NOT NULL,
  dismissed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, insight_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
  user_id                     INTEGER PRIMARY KEY,
  net_worth                   INTEGER NOT NULL,
  net_worth_change_this_month INTEGER NOT NULL,
  safe_to_spend               INTEGER NOT NULL,
  safe_to_spend_until         TEXT    NOT NULL,
  spent_this_month            INTEGER NOT NULL,
  monthly_budget              INTEGER NOT NULL,
  spent_vs_last_month         INTEGER NOT NULL,
  money_in_amount             INTEGER NOT NULL,
  money_in_note               TEXT    NOT NULL,
  forecast_remaining          INTEGER NOT NULL,
  forecast_until              TEXT    NOT NULL,
  forecast_basis              TEXT    NOT NULL,
  milestone_current_age       INTEGER NOT NULL,
  milestone_progress_pct      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  label         TEXT    NOT NULL,
  amount        INTEGER NOT NULL,
  projected_age INTEGER NOT NULL,
  sort          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON milestones(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  slug     TEXT    NOT NULL,
  name     TEXT    NOT NULL,
  amount   INTEGER NOT NULL,
  payments INTEGER NOT NULL,
  pct      INTEGER NOT NULL,
  color    TEXT    NOT NULL,
  sort     INTEGER NOT NULL,
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  merchant    TEXT    NOT NULL,
  amount      INTEGER NOT NULL,
  occurred_at TEXT    NOT NULL,
  method      TEXT    NOT NULL,
  initial     TEXT,
  color       TEXT,
  meta        TEXT,
  category    TEXT,
  account     TEXT,
  note        TEXT,
  sort        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

CREATE TABLE IF NOT EXISTS accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  provider   TEXT,
  status     TEXT    NOT NULL,
  synced_ago TEXT,
  sort       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  name      TEXT    NOT NULL,
  amount    INTEGER NOT NULL,
  cadence   TEXT    NOT NULL,
  forgotten INTEGER NOT NULL,
  sort      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS spending_trends (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  slug     TEXT    NOT NULL,
  month    TEXT    NOT NULL,
  amount   INTEGER NOT NULL,
  UNIQUE (user_id, slug, month)
);

CREATE TABLE IF NOT EXISTS portfolios (
  user_id        INTEGER PRIMARY KEY,
  value          INTEGER NOT NULL,
  return_pct     REAL    NOT NULL,
  gained         INTEGER NOT NULL,
  invested       INTEGER NOT NULL,
  sip_monthly    INTEGER NOT NULL,
  next_debit     TEXT    NOT NULL,
  idle_cash_rate TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS holdings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  meta       TEXT    NOT NULL,
  value      INTEGER NOT NULL,
  return_pct REAL    NOT NULL,
  flat       INTEGER NOT NULL,
  share      INTEGER NOT NULL,
  color      TEXT    NOT NULL,
  sort       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);

CREATE TABLE IF NOT EXISTS sips (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name    TEXT    NOT NULL,
  meta    TEXT    NOT NULL,
  color   TEXT    NOT NULL,
  sort    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sips_user ON sips(user_id);

CREATE TABLE IF NOT EXISTS goals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  name             TEXT    NOT NULL,
  value            INTEGER,
  tracks_net_worth INTEGER NOT NULL,
  pct              INTEGER NOT NULL,
  color            TEXT    NOT NULL,
  note             TEXT    NOT NULL,
  sort             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

CREATE TABLE IF NOT EXISTS screen_insights (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  screen   TEXT    NOT NULL,
  slug     TEXT    NOT NULL,
  date     TEXT    NOT NULL,
  headline TEXT    NOT NULL,
  body     TEXT    NOT NULL,
  actions  TEXT    NOT NULL,
  sort     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_screen_insights_user ON screen_insights(user_id, screen);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// One-time seed of the template rows
// ---------------------------------------------------------------------------

function seedTemplate() {
  const already = db
    .prepare("SELECT value FROM meta WHERE key = 'template_seeded'")
    .get();
  if (already) return false;

  const u = TEMPLATE_USER_ID;

  db.prepare(
    `INSERT INTO snapshots (
       user_id, net_worth, net_worth_change_this_month, safe_to_spend,
       safe_to_spend_until, spent_this_month, monthly_budget, spent_vs_last_month,
       money_in_amount, money_in_note, forecast_remaining, forecast_until,
       forecast_basis, milestone_current_age, milestone_progress_pct
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    u,
    TEMPLATE_SNAPSHOT.netWorth,
    TEMPLATE_SNAPSHOT.netWorthChangeThisMonth,
    TEMPLATE_SNAPSHOT.safeToSpend,
    TEMPLATE_SNAPSHOT.safeToSpendUntil,
    TEMPLATE_SNAPSHOT.spentThisMonth,
    TEMPLATE_SNAPSHOT.monthlyBudget,
    TEMPLATE_SNAPSHOT.spentVsLastMonth,
    TEMPLATE_SNAPSHOT.moneyInAmount,
    TEMPLATE_SNAPSHOT.moneyInNote,
    TEMPLATE_SNAPSHOT.forecastRemaining,
    TEMPLATE_SNAPSHOT.forecastUntil,
    TEMPLATE_SNAPSHOT.forecastBasis,
    TEMPLATE_SNAPSHOT.milestoneCurrentAge,
    TEMPLATE_SNAPSHOT.milestoneProgressPct
  );

  const insMilestone = db.prepare(
    "INSERT INTO milestones (user_id, label, amount, projected_age, sort) VALUES (?,?,?,?,?)"
  );
  TEMPLATE_MILESTONES.forEach((m, i) =>
    insMilestone.run(u, m.label, m.amount, m.projectedAge, i)
  );

  const insCategory = db.prepare(
    "INSERT INTO categories (user_id, slug, name, amount, payments, pct, color, sort) VALUES (?,?,?,?,?,?,?,?)"
  );
  TEMPLATE_CATEGORIES.forEach((c, i) =>
    insCategory.run(u, c.slug, c.name, c.amount, c.payments, c.pct, c.color, i)
  );

  const insTx = db.prepare(
    `INSERT INTO transactions
       (user_id, merchant, amount, occurred_at, method, initial, color, meta, category, account, note, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  TEMPLATE_TRANSACTIONS.forEach((t, i) =>
    insTx.run(
      u, t.merchant, t.amount, t.date, t.method,
      t.initial, t.color, t.meta, t.category, t.account, t.note, i
    )
  );

  const insAccount = db.prepare(
    "INSERT INTO accounts (user_id, name, provider, status, synced_ago, sort) VALUES (?,?,?,?,?,?)"
  );
  TEMPLATE_ACCOUNTS.forEach((a, i) =>
    insAccount.run(u, a.name, a.provider, a.status, a.syncedAgo, i)
  );

  const insSub = db.prepare(
    "INSERT INTO subscriptions (user_id, name, amount, cadence, forgotten, sort) VALUES (?,?,?,?,?,?)"
  );
  TEMPLATE_SUBSCRIPTIONS.forEach((s, i) =>
    insSub.run(u, s.name, s.amount, s.cadence, s.forgotten ? 1 : 0, i)
  );

  const insTrend = db.prepare(
    "INSERT INTO spending_trends (user_id, slug, month, amount) VALUES (?,?,?,?)"
  );
  for (const [slug, points] of Object.entries(TEMPLATE_TRENDS)) {
    for (const p of points) insTrend.run(u, slug, p.month, p.amount);
  }

  db.prepare(
    `INSERT INTO portfolios
       (user_id, value, return_pct, gained, invested, sip_monthly, next_debit, idle_cash_rate)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    u,
    TEMPLATE_PORTFOLIO.value,
    TEMPLATE_PORTFOLIO.returnPct,
    TEMPLATE_PORTFOLIO.gained,
    TEMPLATE_PORTFOLIO.invested,
    TEMPLATE_PORTFOLIO.sipMonthly,
    TEMPLATE_PORTFOLIO.nextDebit,
    TEMPLATE_PORTFOLIO.idleCashRate
  );

  const insHolding = db.prepare(
    `INSERT INTO holdings (user_id, name, meta, value, return_pct, flat, share, color, sort)
     VALUES (?,?,?,?,?,?,?,?,?)`
  );
  TEMPLATE_HOLDINGS.forEach((h, i) =>
    insHolding.run(u, h.name, h.meta, h.value, h.returnPct, h.flat ? 1 : 0, h.share, h.color, i)
  );

  const insSip = db.prepare(
    "INSERT INTO sips (user_id, name, meta, color, sort) VALUES (?,?,?,?,?)"
  );
  TEMPLATE_SIPS.forEach((s, i) => insSip.run(u, s.name, s.meta, s.color, i));

  const insGoal = db.prepare(
    `INSERT INTO goals (user_id, name, value, tracks_net_worth, pct, color, note, sort)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  TEMPLATE_GOALS.forEach((g, i) =>
    insGoal.run(u, g.name, g.value, g.tracksNetWorth ? 1 : 0, g.pct, g.color, g.note, i)
  );

  const insScreenInsight = db.prepare(
    `INSERT INTO screen_insights (user_id, screen, slug, date, headline, body, actions, sort)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  TEMPLATE_MONEY_INSIGHTS.forEach((c, i) =>
    insScreenInsight.run(u, "money", c.id, c.date, c.headline, c.body, JSON.stringify(c.actions), i)
  );
  TEMPLATE_INVEST_INSIGHTS.forEach((c, i) =>
    insScreenInsight.run(u, "invest", c.id, c.date, c.headline, c.body, JSON.stringify(c.actions), i)
  );

  db.prepare("INSERT INTO meta (key, value) VALUES ('template_seeded', ?)").run(nowIso());
  return true;
}

export const seededNow = seedTemplate();

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// Copy every template row into a fresh owner id. Listed explicitly rather than
// looped over `sqlite_master` so adding a table is a deliberate decision about
// whether it is per-user data.
const CLONE_STATEMENTS = [
  `INSERT INTO snapshots SELECT ?, net_worth, net_worth_change_this_month, safe_to_spend,
     safe_to_spend_until, spent_this_month, monthly_budget, spent_vs_last_month,
     money_in_amount, money_in_note, forecast_remaining, forecast_until, forecast_basis,
     milestone_current_age, milestone_progress_pct FROM snapshots WHERE user_id = ?`,
  `INSERT INTO milestones (user_id, label, amount, projected_age, sort)
     SELECT ?, label, amount, projected_age, sort FROM milestones WHERE user_id = ?`,
  `INSERT INTO categories (user_id, slug, name, amount, payments, pct, color, sort)
     SELECT ?, slug, name, amount, payments, pct, color, sort FROM categories WHERE user_id = ?`,
  `INSERT INTO transactions (user_id, merchant, amount, occurred_at, method, initial, color, meta, category, account, note, sort)
     SELECT ?, merchant, amount, occurred_at, method, initial, color, meta, category, account, note, sort FROM transactions WHERE user_id = ?`,
  `INSERT INTO accounts (user_id, name, provider, status, synced_ago, sort)
     SELECT ?, name, provider, status, synced_ago, sort FROM accounts WHERE user_id = ?`,
  `INSERT INTO subscriptions (user_id, name, amount, cadence, forgotten, sort)
     SELECT ?, name, amount, cadence, forgotten, sort FROM subscriptions WHERE user_id = ?`,
  `INSERT INTO spending_trends (user_id, slug, month, amount)
     SELECT ?, slug, month, amount FROM spending_trends WHERE user_id = ?`,
  `INSERT INTO portfolios SELECT ?, value, return_pct, gained, invested, sip_monthly, next_debit, idle_cash_rate FROM portfolios WHERE user_id = ?`,
  `INSERT INTO holdings (user_id, name, meta, value, return_pct, flat, share, color, sort)
     SELECT ?, name, meta, value, return_pct, flat, share, color, sort FROM holdings WHERE user_id = ?`,
  `INSERT INTO sips (user_id, name, meta, color, sort)
     SELECT ?, name, meta, color, sort FROM sips WHERE user_id = ?`,
  `INSERT INTO goals (user_id, name, value, tracks_net_worth, pct, color, note, sort)
     SELECT ?, name, value, tracks_net_worth, pct, color, note, sort FROM goals WHERE user_id = ?`,
  `INSERT INTO screen_insights (user_id, screen, slug, date, headline, body, actions, sort)
     SELECT ?, screen, slug, date, headline, body, actions, sort FROM screen_insights WHERE user_id = ?`,
].map((sql) => db.prepare(sql));

export function findUserByPhone(phone) {
  return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) ?? null;
}

// Create the account if this is a first sign-in, and give it its own copy of
// the template dataset. Wrapped in a transaction so a half-cloned account can
// never be observed.
export function provisionUser(phone) {
  const existing = findUserByPhone(phone);
  if (existing) {
    db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(nowIso(), existing.id);
    return { user: existing, created: false };
  }

  db.exec("BEGIN");
  try {
    const info = db
      .prepare(
        "INSERT INTO users (phone, name, initials, age, created_at, last_login) VALUES (?,?,?,?,?,?)"
      )
      .run(
        phone,
        TEMPLATE_PROFILE.name,
        TEMPLATE_PROFILE.initials,
        TEMPLATE_PROFILE.age,
        nowIso(),
        nowIso()
      );
    const id = Number(info.lastInsertRowid);
    for (const stmt of CLONE_STATEMENTS) stmt.run(id, TEMPLATE_USER_ID);
    db.prepare("INSERT INTO settings (user_id, privacy_mode, tone) VALUES (?, 0, 'Direct')").run(id);
    db.exec("COMMIT");
    return { user: db.prepare("SELECT * FROM users WHERE id = ?").get(id), created: true };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reads — every one of these is scoped by user id
// ---------------------------------------------------------------------------

export function getProfile(userId) {
  const row = db
    .prepare("SELECT name, initials, phone, age FROM users WHERE id = ?")
    .get(userId);
  if (!row) return null;
  // The number is shown back to the signed-in owner, formatted the way the
  // design writes it.
  const digits = row.phone.replace(/\D/g, "").slice(-10);
  return {
    name: row.name,
    initials: row.initials,
    age: row.age,
    phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
  };
}

export function getUserData(userId) {
  const s = db.prepare("SELECT * FROM snapshots WHERE user_id = ?").get(userId);
  if (!s) return null;

  const milestones = db
    .prepare("SELECT label, amount, projected_age FROM milestones WHERE user_id = ? ORDER BY sort")
    .all(userId)
    .map((m) => ({ label: m.label, amount: m.amount, projectedAge: m.projected_age }));

  const categories = db
    .prepare("SELECT slug, name, amount, payments, pct, color FROM categories WHERE user_id = ? ORDER BY sort")
    .all(userId);

  const recentTransactions = db
    .prepare(
      `SELECT merchant, amount, occurred_at, method, initial, color, meta, category, account, note
         FROM transactions WHERE user_id = ? ORDER BY sort`
    )
    .all(userId)
    .map((t) => ({
      merchant: t.merchant,
      amount: t.amount,
      date: t.occurred_at,
      method: t.method,
      // The expanded row's copy. Used to live in frontend/data/mock.js.
      detail: {
        initial: t.initial,
        color: t.color,
        meta: t.meta,
        category: t.category,
        account: t.account,
        note: t.note,
      },
    }));

  const connectedAccounts = db
    .prepare("SELECT name, provider, status, synced_ago FROM accounts WHERE user_id = ? ORDER BY sort")
    .all(userId)
    .map((a) => ({
      name: a.name,
      provider: a.provider,
      status: a.status,
      syncedAgo: a.synced_ago,
    }));

  return {
    netWorth: s.net_worth,
    netWorthChangeThisMonth: s.net_worth_change_this_month,
    netWorthMilestones: {
      currentAge: s.milestone_current_age,
      progressPct: s.milestone_progress_pct,
      milestones,
    },
    safeToSpend: s.safe_to_spend,
    safeToSpendUntil: s.safe_to_spend_until,
    spentThisMonth: s.spent_this_month,
    monthlyBudget: s.monthly_budget,
    spentVsLastMonth: s.spent_vs_last_month,
    moneyIn: { amount: s.money_in_amount, note: s.money_in_note },
    monthEndForecast: {
      remaining: s.forecast_remaining,
      until: s.forecast_until,
      basis: s.forecast_basis,
    },
    categories,
    recentTransactions,
    connectedAccounts,
  };
}

export function getSubscriptions(userId, { onlyForgotten = false } = {}) {
  const rows = onlyForgotten
    ? db
        .prepare(
          "SELECT name, amount, cadence, forgotten FROM subscriptions WHERE user_id = ? AND forgotten = 1 ORDER BY sort"
        )
        .all(userId)
    : db
        .prepare("SELECT name, amount, cadence, forgotten FROM subscriptions WHERE user_id = ? ORDER BY sort")
        .all(userId);
  return rows.map((r) => ({ ...r, forgotten: Boolean(r.forgotten) }));
}

export function getTrendSlugs(userId) {
  return db
    .prepare("SELECT DISTINCT slug FROM spending_trends WHERE user_id = ? ORDER BY slug")
    .all(userId)
    .map((r) => r.slug);
}

export function getSpendingTrend(userId, slug, months) {
  const rows = db
    .prepare("SELECT month, amount FROM spending_trends WHERE user_id = ? AND slug = ? ORDER BY month")
    .all(userId, slug);
  return rows.slice(Math.max(rows.length - months, 0));
}

export function getPortfolio(userId) {
  const p = db.prepare("SELECT * FROM portfolios WHERE user_id = ?").get(userId);
  if (!p) return null;

  const holdings = db
    .prepare(
      "SELECT name, meta, value, return_pct, flat, share, color FROM holdings WHERE user_id = ? ORDER BY sort"
    )
    .all(userId)
    .map((h) => ({
      name: h.name,
      meta: h.meta,
      value: h.value,
      returnPct: h.return_pct,
      flat: Boolean(h.flat),
      share: h.share,
      color: h.color,
    }));

  const sips = db
    .prepare("SELECT name, meta, color FROM sips WHERE user_id = ? ORDER BY sort")
    .all(userId);

  const goals = db
    .prepare(
      "SELECT name, value, tracks_net_worth, pct, color, note FROM goals WHERE user_id = ? ORDER BY sort"
    )
    .all(userId)
    .map((g) => ({
      name: g.name,
      value: g.value,
      tracksNetWorth: Boolean(g.tracks_net_worth),
      pct: g.pct,
      color: g.color,
      note: g.note,
    }));

  return {
    portfolio: {
      value: p.value,
      returnPct: p.return_pct,
      gained: p.gained,
      invested: p.invested,
      sipMonthly: p.sip_monthly,
      nextDebit: p.next_debit,
      idleCashRate: p.idle_cash_rate,
    },
    holdings,
    sips,
    goals,
  };
}

export function getScreenInsights(userId, screen) {
  return db
    .prepare(
      "SELECT slug, date, headline, body, actions FROM screen_insights WHERE user_id = ? AND screen = ? ORDER BY sort"
    )
    .all(userId, screen)
    .map((r) => ({
      id: r.slug,
      date: r.date,
      headline: r.headline,
      body: r.body,
      actions: JSON.parse(r.actions),
    }));
}

// ---------------------------------------------------------------------------
// Per-user state the app writes back
// ---------------------------------------------------------------------------

export function getSettings(userId) {
  const row = db.prepare("SELECT privacy_mode, tone FROM settings WHERE user_id = ?").get(userId);
  if (!row) return { privacyMode: false, tone: "Direct" };
  return { privacyMode: Boolean(row.privacy_mode), tone: row.tone };
}

export function saveSettings(userId, { privacyMode, tone }) {
  const current = getSettings(userId);
  const next = {
    privacyMode: typeof privacyMode === "boolean" ? privacyMode : current.privacyMode,
    tone: tone === "Warm" || tone === "Direct" ? tone : current.tone,
  };
  db.prepare(
    `INSERT INTO settings (user_id, privacy_mode, tone) VALUES (?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET privacy_mode = excluded.privacy_mode, tone = excluded.tone`
  ).run(userId, next.privacyMode ? 1 : 0, next.tone);
  return next;
}

export function getDismissed(userId) {
  return db
    .prepare("SELECT insight_id FROM dismissed_insights WHERE user_id = ?")
    .all(userId)
    .map((r) => r.insight_id);
}

export function dismissInsight(userId, insightId) {
  db.prepare(
    `INSERT INTO dismissed_insights (user_id, insight_id, dismissed_at) VALUES (?,?,?)
       ON CONFLICT(user_id, insight_id) DO NOTHING`
  ).run(userId, insightId, nowIso());
}

export function restoreInsight(userId, insightId) {
  db.prepare("DELETE FROM dismissed_insights WHERE user_id = ? AND insight_id = ?").run(
    userId,
    insightId
  );
}

// The lean projection handed to the model. Assembled from the database, never
// from the request, and deliberately smaller than the full snapshot.
export function getModelSnapshot(userId) {
  const data = getUserData(userId);
  if (!data) return null;
  return {
    netWorth: data.netWorth,
    safeToSpend: data.safeToSpend,
    safeToSpendUntil: data.safeToSpendUntil,
    spentThisMonth: data.spentThisMonth,
    monthlyBudget: data.monthlyBudget,
    spentVsLastMonth: data.spentVsLastMonth,
    monthEndForecast: data.monthEndForecast,
    topCategories: data.categories.map((c) => ({
      name: c.name,
      amount: c.amount,
      pct: c.pct,
    })),
    subscriptions: getSubscriptions(userId).map((s) => ({
      name: s.name,
      amount: s.amount,
      cadence: s.cadence,
    })),
  };
}

export function stats() {
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const sessions = db
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?")
    .get(nowIso()).n;
  return { users, sessions, path: DB_PATH };
}
