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
  DATASET_MONTH,
  DATASET_TODAY,
  MONTHS,
  TEMPLATE_ACCOUNTS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_GOALS,
  TEMPLATE_HOLDINGS,
  TEMPLATE_INVEST_INSIGHTS,
  TEMPLATE_MILESTONES,
  TEMPLATE_MONEY_INSIGHTS,
  TEMPLATE_NET_WORTH_HISTORY,
  TEMPLATE_PORTFOLIO,
  TEMPLATE_PROFILE,
  TEMPLATE_SIPS,
  TEMPLATE_SNAPSHOT,
  TEMPLATE_SUBSCRIPTIONS,
  TEMPLATE_TRANSACTIONS,
  TEMPLATE_TRENDS,
  TEMPLATE_VERSION,
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
  budget   INTEGER NOT NULL DEFAULT 0,
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
  slug        TEXT,
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

-- Month-end net worth, so the assistant can answer "how fast is this growing?"
-- with a series rather than a single figure.
CREATE TABLE IF NOT EXISTS net_worth_history (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  month    TEXT    NOT NULL,
  value    INTEGER NOT NULL,
  invested INTEGER NOT NULL,
  cash     INTEGER NOT NULL,
  UNIQUE (user_id, month)
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

// `CREATE TABLE IF NOT EXISTS` adds new tables to an existing file but never
// new columns, so a database written by an older build is missing them. One
// ALTER per addition, guarded by the table's own column list.
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}

ensureColumn("categories", "budget", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("transactions", "slug", "TEXT");

// ---------------------------------------------------------------------------
// Seeding the template rows
//
// The template is written once and then left alone — until seed.js declares a
// new TEMPLATE_VERSION, at which point every data row in the file is dropped
// and rebuilt. Accounts, sessions, settings and dismissals survive that, so a
// dataset change does not sign anybody out or hand them back a card they
// already dismissed.
// ---------------------------------------------------------------------------

// Every table that holds cloned per-user data, in an order that could be
// deleted from safely if these ever gained foreign keys between them.
const DATA_TABLES = [
  "snapshots",
  "milestones",
  "categories",
  "transactions",
  "accounts",
  "subscriptions",
  "spending_trends",
  "net_worth_history",
  "portfolios",
  "holdings",
  "sips",
  "goals",
  "screen_insights",
];

function writeTemplateRows() {
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
    "INSERT INTO categories (user_id, slug, name, amount, payments, pct, color, budget, sort) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  TEMPLATE_CATEGORIES.forEach((c, i) =>
    insCategory.run(u, c.slug, c.name, c.amount, c.payments, c.pct, c.color, c.budget ?? 0, i)
  );

  const insTx = db.prepare(
    `INSERT INTO transactions
       (user_id, merchant, amount, occurred_at, method, initial, color, meta, category, slug, account, note, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  TEMPLATE_TRANSACTIONS.forEach((t, i) =>
    insTx.run(
      u, t.merchant, t.amount, t.date, t.method,
      t.initial, t.color, t.meta, t.category, t.slug ?? null, t.account, t.note, i
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

  const insNetWorth = db.prepare(
    "INSERT INTO net_worth_history (user_id, month, value, invested, cash) VALUES (?,?,?,?,?)"
  );
  TEMPLATE_NET_WORTH_HISTORY.forEach((h) =>
    insNetWorth.run(u, h.month, h.value, h.invested, h.cash)
  );

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

}

// Returns "fresh" on a first boot, "migrated" when the template version moved
// and every account was rebuilt on the new dataset, or null when nothing had
// to happen. server.js prints it in the startup banner.
function seedTemplate() {
  const stored = db.prepare("SELECT value FROM meta WHERE key = 'template_version'").get();
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'template_seeded'").get();
  const version = stored ? Number(stored.value) : null;

  if (seeded && version === TEMPLATE_VERSION) return null;

  const userIds = db.prepare("SELECT id FROM users").all().map((r) => r.id);

  db.exec("BEGIN");
  try {
    for (const table of DATA_TABLES) db.exec(`DELETE FROM ${table}`);
    writeTemplateRows();
    // Existing accounts are rebuilt on the new template rather than left on a
    // dataset that no longer matches the code reading it.
    for (const id of userIds) for (const stmt of CLONE_STATEMENTS) stmt.run(id, TEMPLATE_USER_ID);

    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('template_seeded', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(nowIso());
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('template_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(String(TEMPLATE_VERSION));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return seeded ? "migrated" : "fresh";
}

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
  `INSERT INTO categories (user_id, slug, name, amount, payments, pct, color, budget, sort)
     SELECT ?, slug, name, amount, payments, pct, color, budget, sort FROM categories WHERE user_id = ?`,
  `INSERT INTO transactions (user_id, merchant, amount, occurred_at, method, initial, color, meta, category, slug, account, note, sort)
     SELECT ?, merchant, amount, occurred_at, method, initial, color, meta, category, slug, account, note, sort FROM transactions WHERE user_id = ?`,
  `INSERT INTO accounts (user_id, name, provider, status, synced_ago, sort)
     SELECT ?, name, provider, status, synced_ago, sort FROM accounts WHERE user_id = ?`,
  `INSERT INTO subscriptions (user_id, name, amount, cadence, forgotten, sort)
     SELECT ?, name, amount, cadence, forgotten, sort FROM subscriptions WHERE user_id = ?`,
  `INSERT INTO spending_trends (user_id, slug, month, amount)
     SELECT ?, slug, month, amount FROM spending_trends WHERE user_id = ?`,
  `INSERT INTO net_worth_history (user_id, month, value, invested, cash)
     SELECT ?, month, value, invested, cash FROM net_worth_history WHERE user_id = ?`,
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

// Runs after CLONE_STATEMENTS is initialised, because a version bump re-clones
// every existing account through it.
export const seededNow = seedTemplate();

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
    .prepare(
      "SELECT slug, name, amount, payments, pct, color, budget FROM categories WHERE user_id = ? ORDER BY sort"
    )
    .all(userId);

  // The ledger is six months deep now, so "recent" has to mean recent — the
  // Money tab renders this list in full and does not paginate.
  const recentTransactions = listTransactions(userId, { limit: RECENT_TX_LIMIT });

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

// How many rows /api/user-data carries. The full ledger is served by
// /api/transactions instead.
const RECENT_TX_LIMIT = 12;

function mapTransaction(t) {
  return {
    merchant: t.merchant,
    amount: t.amount,
    date: t.occurred_at,
    method: t.method,
    category: t.category,
    slug: t.slug,
    // The expanded row's copy. Used to live in frontend/data/mock.js.
    detail: {
      initial: t.initial,
      color: t.color,
      meta: t.meta,
      category: t.category,
      account: t.account,
      note: t.note,
    },
  };
}

// `sort` is written newest-first by the seeder, so it doubles as the display
// order and as "most recent" without a date comparison.
//
// The filters are bound values on a fixed statement shape — the `WHERE`
// clauses are chosen by which arguments are present, never assembled from
// them. `month` is matched against the first seven characters of the stored
// timestamp, which is why the ISO form is stored rather than an epoch.
export function listTransactions(
  userId,
  { month = null, slug = null, direction = null, limit = 50, offset = 0 } = {}
) {
  const capped = Math.min(Math.max(Number(limit) || 0, 1), 500);
  const skip = Math.max(Number(offset) || 0, 0);
  return db
    .prepare(
      `SELECT merchant, amount, occurred_at, method, initial, color, meta, category, slug, account, note
         FROM transactions
        WHERE user_id = ?
          AND (? IS NULL OR substr(occurred_at, 1, 7) = ?)
          AND (? IS NULL OR slug = ?)
          AND (? IS NULL OR (? = 'in' AND amount > 0) OR (? = 'out' AND amount < 0))
        ORDER BY sort
        LIMIT ? OFFSET ?`
    )
    .all(userId, month, month, slug, slug, direction, direction, direction, capped, skip)
    .map(mapTransaction);
}

export function countTransactions(userId, { month = null, slug = null, direction = null } = {}) {
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM transactions
        WHERE user_id = ?
          AND (? IS NULL OR substr(occurred_at, 1, 7) = ?)
          AND (? IS NULL OR slug = ?)
          AND (? IS NULL OR (? = 'in' AND amount > 0) OR (? = 'out' AND amount < 0))`
    )
    .get(userId, month, month, slug, slug, direction, direction, direction).n;
}

export function getNetWorthHistory(userId) {
  return db
    .prepare("SELECT month, value, invested, cash FROM net_worth_history WHERE user_id = ? ORDER BY month")
    .all(userId);
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

// ---------------------------------------------------------------------------
// Aggregates
//
// Everything the assistant reasons over is computed here, in SQL, from the
// ledger — not asserted a second time in seed.js. Two consequences worth
// stating: a number the model quotes can always be traced back to rows, and a
// change to the fixture cannot leave the assistant quoting a stale total.
//
// Note the date handling: `occurred_at` is an ISO string with a +05:30 offset,
// which SQLite's date functions will not parse. Both the month key and the
// weekday come from `substr()` on the date portion instead, which is exact.
// ---------------------------------------------------------------------------

// Friday counts as the weekend here, matching the product's own copy —
// strftime('%w') numbers Sunday 0 through Saturday 6.
const WEEKEND_DAYS = "('0','5','6')";

export function getMonthKeys(userId) {
  return db
    .prepare(
      `SELECT DISTINCT substr(occurred_at, 1, 7) AS month FROM transactions
        WHERE user_id = ? ORDER BY month`
    )
    .all(userId)
    .map((r) => r.month);
}

// Spend and money-in per month, spend as a positive number.
export function getMonthlyTotals(userId) {
  return db
    .prepare(
      `SELECT substr(occurred_at, 1, 7) AS month,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spend,
              SUM(CASE WHEN amount > 0 THEN  amount ELSE 0 END) AS income,
              SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END)       AS payments
         FROM transactions
        WHERE user_id = ?
        GROUP BY month
        ORDER BY month`
    )
    .all(userId);
}

// A category × month matrix of spend, as flat rows.
export function getCategoryByMonth(userId) {
  return db
    .prepare(
      `SELECT slug, substr(occurred_at, 1, 7) AS month, SUM(-amount) AS spend, COUNT(*) AS payments
         FROM transactions
        WHERE user_id = ? AND amount < 0 AND slug IS NOT NULL
        GROUP BY slug, month
        ORDER BY slug, month`
    )
    .all(userId);
}

// Fri–Sun against Mon–Thu, per category, for one month. This is the split the
// app's flagship insight is built on, so the assistant gets it directly rather
// than being asked to infer it.
export function getWeekendSplit(userId, month) {
  return db
    .prepare(
      `SELECT slug,
              SUM(CASE WHEN strftime('%w', substr(occurred_at, 1, 10)) IN ${WEEKEND_DAYS} THEN -amount ELSE 0 END) AS weekend,
              SUM(CASE WHEN strftime('%w', substr(occurred_at, 1, 10)) IN ${WEEKEND_DAYS} THEN 0 ELSE -amount END) AS weekday,
              SUM(CASE WHEN strftime('%w', substr(occurred_at, 1, 10)) IN ${WEEKEND_DAYS} THEN 1 ELSE 0 END) AS weekend_payments,
              SUM(CASE WHEN strftime('%w', substr(occurred_at, 1, 10)) IN ${WEEKEND_DAYS} THEN 0 ELSE 1 END) AS weekday_payments
         FROM transactions
        WHERE user_id = ? AND amount < 0 AND slug IS NOT NULL AND substr(occurred_at, 1, 7) = ?
        GROUP BY slug`
    )
    .all(userId, month);
}

export function getTopMerchants(userId, month, limit = 8) {
  return db
    .prepare(
      `SELECT merchant, SUM(-amount) AS spend, COUNT(*) AS payments, MAX(slug) AS slug
         FROM transactions
        WHERE user_id = ? AND amount < 0 AND substr(occurred_at, 1, 7) = ?
        GROUP BY merchant
        ORDER BY spend DESC
        LIMIT ?`
    )
    .all(userId, month, Math.min(Math.max(limit, 1), 25));
}

// One row per day that had spend, for one month.
export function getDailySpend(userId, month) {
  return db
    .prepare(
      `SELECT substr(occurred_at, 1, 10) AS date, SUM(-amount) AS spend
         FROM transactions
        WHERE user_id = ? AND amount < 0 AND substr(occurred_at, 1, 7) = ?
        GROUP BY date
        ORDER BY date`
    )
    .all(userId, month);
}

// ---------------------------------------------------------------------------
// The projection handed to the model
//
// Assembled from the database, never from the request. It is deliberately
// dense rather than pretty: parallel arrays keyed by a single `months` list
// cost roughly half the tokens of an array of objects, and the context window
// is the budget that actually binds. Every series is oldest-first.
// ---------------------------------------------------------------------------
export function getModelSnapshot(userId) {
  const data = getUserData(userId);
  if (!data) return null;

  const months = getMonthKeys(userId);
  const current = months[months.length - 1];
  const previous = months[months.length - 2] ?? null;

  const totals = getMonthlyTotals(userId);
  const byMonth = Object.fromEntries(totals.map((t) => [t.month, t]));

  const catRows = getCategoryByMonth(userId);
  const nameOf = Object.fromEntries(data.categories.map((c) => [c.slug, c.name]));

  // { "Food & delivery": [5800, 6450, ...] } — one entry per month in `months`.
  const categoryByMonth = {};
  for (const slug of Object.keys(nameOf)) {
    categoryByMonth[nameOf[slug]] = months.map(
      (m) => catRows.find((r) => r.slug === slug && r.month === m)?.spend ?? 0
    );
  }

  const splits = Object.fromEntries(getWeekendSplit(userId, current).map((r) => [r.slug, r]));

  // One self-describing row per category, carrying every figure an answer
  // about that category could want — including the divisions.
  //
  // This was three parallel structures keyed by position ([weekend, weekday,
  // weekendCount, weekdayCount] and so on) until an 8B model read the weekend
  // total out of the month-change slot and quoted it as a month change. Named
  // keys cost a few hundred bytes and remove that failure mode entirely. And
  // the quotients are precomputed because a model asked for "11 orders
  // averaging X" will otherwise divide the wrong pair of numbers.
  const categoryDetail = data.categories.map((c) => {
    const series = categoryByMonth[c.name] || [];
    const now = series[series.length - 1] ?? c.amount;
    const before = series.length > 1 ? series[series.length - 2] : null;
    const split = splits[c.slug];
    return {
      name: c.name,
      spend: now,
      pctOfMonth: c.pct,
      payments: c.payments,
      budget: c.budget || null,
      avgPayment: c.payments ? Math.round(now / c.payments) : 0,
      vsLastMonth: before === null ? null : now - before,
      vsLastMonthPct: before ? Math.round(((now - before) / before) * 100) : null,
      sixMonthAvg: series.length
        ? Math.round(series.reduce((a, b) => a + b, 0) / series.length)
        : now,
      weekendSpend: split?.weekend ?? 0,
      weekdaySpend: split?.weekday ?? 0,
      weekendPayments: split?.weekend_payments ?? 0,
      weekdayPayments: split?.weekday_payments ?? 0,
      avgWeekendPayment: split?.weekend_payments
        ? Math.round(split.weekend / split.weekend_payments)
        : 0,
    };
  });

  const daily = getDailySpend(userId, current);
  const netWorthHistory = getNetWorthHistory(userId);
  const portfolio = getPortfolio(userId);

  const thisMonthSpend = byMonth[current]?.spend ?? 0;
  const lastMonthSpend = previous ? byMonth[previous]?.spend ?? 0 : null;

  return {
    // Everything is as of this date. Saying so stops the model reaching for
    // the real calendar, which is years away from the fixture.
    asOf: DATASET_TODAY,
    currency: "INR",
    months,
    legend: {
      categoryByMonth: "spend per month, aligned to `months`, oldest first",
      weekend: "weekend means Friday, Saturday and Sunday",
      dailySpend: "[day-of-month, spend] for the current month",
    },

    spendByMonth: months.map((m) => byMonth[m]?.spend ?? 0),
    incomeByMonth: months.map((m) => byMonth[m]?.income ?? 0),
    categoryByMonth,

    thisMonth: {
      month: current,
      spend: thisMonthSpend,
      budget: data.monthlyBudget,
      // Both spellings, because "budgetLeft: -400" was being read as "₹400
      // left". A boolean cannot be read backwards.
      budgetRemaining: data.monthlyBudget - thisMonthSpend,
      isOverBudget: thisMonthSpend > data.monthlyBudget,
      // A ready-made phrase, because a signed number and a boolean both got
      // read backwards ("₹3,580 over budget" when ₹3,580 was what was left).
      // Handing over the sentence is the only version that survives.
      budgetStatus: `₹${Math.abs(data.monthlyBudget - thisMonthSpend).toLocaleString("en-IN")} ${
        thisMonthSpend > data.monthlyBudget ? "over" : "under"
      } the monthly budget`,
      lastMonthSpend,
      changeVsLastMonth: lastMonthSpend === null ? null : thisMonthSpend - lastMonthSpend,
      income: byMonth[current]?.income ?? 0,
      payments: byMonth[current]?.payments ?? 0,
      safeToSpend: data.safeToSpend,
      safeToSpendUntil: data.safeToSpendUntil,
      forecastRemaining: data.monthEndForecast?.remaining ?? null,
      categories: categoryDetail,
      topMerchants: getTopMerchants(userId, current).map((m) => ({
        name: m.merchant,
        spend: m.spend,
        payments: m.payments,
      })),
      dailySpend: daily.map((d) => [Number(d.date.slice(-2)), d.spend]),
    },

    netWorth: {
      value: data.netWorth,
      changeThisMonth: data.netWorthChangeThisMonth,
      byMonth: netWorthHistory.map((h) => h.value),
    },

    subscriptions: getSubscriptions(userId).map((s) => ({
      name: s.name,
      amount: s.amount,
      cadence: s.cadence,
      forgotten: s.forgotten,
    })),

    portfolio: portfolio && {
      value: portfolio.portfolio.value,
      invested: portfolio.portfolio.invested,
      gained: portfolio.portfolio.gained,
      returnPct: portfolio.portfolio.returnPct,
      sipMonthly: portfolio.portfolio.sipMonthly,
      holdings: portfolio.holdings.map((h) => ({
        name: h.name,
        value: h.value,
        returnPct: h.returnPct,
        share: h.share,
      })),
      goals: portfolio.goals.map((g) => ({
        name: g.name,
        value: g.tracksNetWorth ? data.netWorth : g.value,
        pct: g.pct,
      })),
    },
  };
}

export function stats() {
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const sessions = db
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?")
    .get(nowIso()).n;
  return { users, sessions, path: DB_PATH };
}
