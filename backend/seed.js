// The template dataset every new account is cloned from.
//
// Before there was a database this lived as `MOCK_*` constants inside
// server.js, and a second copy of the parts the API didn't serve lived in
// `frontend/data/mock.js`. Both are now here, in one place, and they are
// seeded into SQLite once on first boot (see db.js). Nothing reads this file
// at request time.
//
// What changed since: the six hand-written August transactions were the whole
// ledger, so every question that needed a second data point ("is this normal
// for me?", "what did June look like?") had nothing to stand on. This file now
// builds a six-month ledger — 2026-03-01 through the dataset's "today",
// 2026-08-26 — from which the category totals, the trend series and the
// aggregates handed to the model are all *derived*. Nothing is asserted twice.
//
// Two rules govern the generator:
//
//   1. Every number the design already showed is a target, not an output. The
//      monthly totals in `MONTH_TARGETS` reproduce the old TEMPLATE_TRENDS
//      exactly for Jun/Jul/Aug, so the screens, the insight copy and the
//      seeded Ask thread all stay true.
//   2. Generation is deterministic (seeded PRNG). Two boots produce byte-identical
//      rows, so a demo never shifts under you.
//
// Every account provisioned by /api/auth/verify-otp gets its own row-level
// copy of all of this, so two phones signing in no longer share one dataset.

// Bump when the shape or the content of the template changes. db.js reseeds
// the template and re-clones every existing account when this moves, so a
// stale paise.db does not have to be deleted by hand.
export const TEMPLATE_VERSION = 2;

export const TEMPLATE_PROFILE = {
  name: "Aarav Rao",
  initials: "AR",
  age: 23,
};

// The dataset's "now". Not `new Date()` — the insight copy says "today" about
// the 26th, and a fixture that drifts past its own copy reads as a bug.
export const DATASET_TODAY = "2026-08-26";
export const DATASET_MONTH = "2026-08";

// Oldest first. Six months is the shortest window in which a "is this normal
// for me?" question has an honest answer.
export const MONTHS = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

// ---------------------------------------------------------------------------
// Category configuration
//
// Slugs, names and colours are declared; the amounts are derived from the
// ledger further down. Deliberately still five — the Money tab's share bar and
// the design's 31/24/18/14/13 breakdown are built around these five buckets,
// and a sixth would change a screen nobody asked to change.
// ---------------------------------------------------------------------------
export const CATEGORY_META = [
  { slug: "food-delivery", name: "Food & delivery", color: "#b25f3c", budget: 10000 },
  { slug: "rent", name: "Rent", color: "#4b55a6", budget: 9000 },
  { slug: "travel-cabs", name: "Travel & cabs", color: "#3b7a78", budget: 7000 },
  { slug: "subscriptions", name: "Subscriptions", color: "#ad8228", budget: 5500 },
  { slug: "shopping", name: "Shopping", color: "#8b4f76", budget: 6000 },
];

const CATEGORY_NAME = Object.fromEntries(CATEGORY_META.map((c) => [c.slug, c.name]));

// Spend target per category per month, in rupees. Jun/Jul/Aug reproduce the
// old TEMPLATE_TRENDS to the rupee; Mar–May extend the series backwards so the
// August spike has something to be a spike *against*.
const MONTH_TARGETS = {
  "2026-03": { "food-delivery": 5800, rent: 9000, "travel-cabs": 4900, subscriptions: 4942, shopping: 2600 },
  "2026-04": { "food-delivery": 6450, rent: 9000, "travel-cabs": 5150, subscriptions: 4692, shopping: 3750 },
  "2026-05": { "food-delivery": 7100, rent: 9000, "travel-cabs": 5050, subscriptions: 4692, shopping: 2900 },
  "2026-06": { "food-delivery": 6200, rent: 9000, "travel-cabs": 5400, subscriptions: 5340, shopping: 3200 },
  "2026-07": { "food-delivery": 7700, rent: 9000, "travel-cabs": 6100, subscriptions: 5340, shopping: 4100 },
  "2026-08": { "food-delivery": 11900, rent: 9000, "travel-cabs": 6780, subscriptions: 5340, shopping: 5400 },
};

// Food splits Fri–Sun against Mon–Thu. These are the two numbers the whole
// "weekends are the story" narrative rests on: August weekend food is ₹8,100,
// and August weekdays come in ₹600 *under* July's ₹4,400.
const FOOD_WEEKEND_TARGET = {
  "2026-03": 2300,
  "2026-04": 2700,
  "2026-05": 3100,
  "2026-06": 2500,
  "2026-07": 3300,
  "2026-08": 8100,
};

// ---------------------------------------------------------------------------
// Deterministic pseudo-randomness
//
// mulberry32: 32-bit state, one multiply-xorshift round. Not cryptographic and
// not trying to be — it exists so the same fixture comes out of every boot.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x50414953); // "PAIS"

const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);

// ---------------------------------------------------------------------------
// Calendar helpers
//
// Dates are handled as plain "YYYY-MM-DD" strings and only ever converted to a
// Date at UTC midnight, so the +05:30 the rows carry never shifts a day.
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dayOfWeek(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
}

// The product's definition of a weekend, and the one the insight copy uses:
// Friday counts, because Friday night is where the delivery orders are.
const isWeekend = (iso) => [0, 5, 6].includes(dayOfWeek(iso));

// Every day of `ym` up to and including the dataset's today.
function monthDays(ym) {
  const last = ym === DATASET_MONTH ? Number(DATASET_TODAY.slice(-2)) : daysInMonth(ym);
  return Array.from({ length: last }, (_, i) => `${ym}-${pad(i + 1)}`);
}

function shortDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

// "2026-08-26" + 21:12 → "2026-08-26T21:12:00+05:30". IST is the only zone in
// this dataset, so it is written in rather than computed.
const at = (iso, hh, mm) => `${iso}T${pad(hh)}:${pad(mm)}:00+05:30`;

// ---------------------------------------------------------------------------
// Merchants
// ---------------------------------------------------------------------------
const MERCHANT_COLOR = {
  Zomato: "#b25f3c",
  Swiggy: "#c2603a",
  Blinkit: "#ad8228",
  Zepto: "#8b4f76",
  "Swiggy Instamart": "#c07a3f",
  Uber: "#3b3733",
  Ola: "#4b55a6",
  Rapido: "#ad8228",
  Amazon: "#8a6b2f",
  Myntra: "#8b4f76",
  Flipkart: "#4b55a6",
  "Cult.fit": "#4b55a6",
  "Spotify Duo": "#3b7a78",
  Netflix: "#a8342f",
  Prime: "#3b7a78",
};

// weight is a rough relative frequency, band is the plausible ticket size.
const FOOD_MERCHANTS = [
  { name: "Swiggy", weight: 5, band: [220, 780] },
  { name: "Zomato", weight: 5, band: [240, 820] },
  { name: "Blinkit", weight: 3, band: [380, 1200] },
  { name: "Zepto", weight: 2, band: [260, 900] },
  { name: "Swiggy Instamart", weight: 2, band: [300, 950] },
  { name: "Third Wave Coffee", weight: 2, band: [180, 460] },
  { name: "Rameshwaram Cafe", weight: 2, band: [140, 380] },
  { name: "Domino's", weight: 1, band: [340, 720] },
  { name: "Behrouz Biryani", weight: 1, band: [420, 900] },
  { name: "Chai Point", weight: 2, band: [90, 240] },
  { name: "Leon Grill", weight: 1, band: [300, 640] },
  { name: "Bakingo", weight: 1, band: [240, 700] },
];

const TRAVEL_MERCHANTS = [
  { name: "Uber", weight: 5, band: [120, 480] },
  { name: "Ola", weight: 3, band: [110, 440] },
  { name: "Rapido", weight: 4, band: [45, 160] },
  { name: "Namma Yatri", weight: 2, band: [80, 260] },
  { name: "Metro Recharge", weight: 2, band: [200, 500] },
  { name: "HP Petrol", weight: 1, band: [500, 1200] },
  { name: "IRCTC", weight: 1, band: [420, 1400] },
];

const SHOPPING_MERCHANTS = [
  { name: "Amazon", weight: 5, band: [280, 2400] },
  { name: "Myntra", weight: 3, band: [600, 2600] },
  { name: "Flipkart", weight: 2, band: [350, 2200] },
  { name: "Decathlon", weight: 1, band: [700, 2400] },
  { name: "Nykaa", weight: 1, band: [350, 1400] },
  { name: "Croma", weight: 1, band: [900, 3200] },
  { name: "Bata", weight: 1, band: [800, 2200] },
];

function weightedPick(pool) {
  const total = pool.reduce((sum, m) => sum + m.weight, 0);
  let r = rand() * total;
  for (const m of pool) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------------------
// Recurring charges
//
// `day` is the day of the month the mandate hits. Cult, Spotify Duo and Prime
// are the three the Money tab calls "forgotten" — ₹1,847 a month between them,
// which is the number the insight card quotes.
// ---------------------------------------------------------------------------
const RECURRING = [
  { name: "Jio Fiber", amount: 1499, day: 5, cadence: "monthly", forgotten: false },
  { name: "Cult.fit", amount: 1299, day: 24, cadence: "monthly", forgotten: true },
  { name: "Netflix", amount: 649, day: 8, cadence: "monthly", forgotten: false },
  { name: "Prime", amount: 399, day: 12, cadence: "monthly", forgotten: true },
  { name: "Zomato Gold", amount: 249, day: 15, cadence: "monthly", forgotten: false },
  { name: "Spotify Duo", amount: 149, day: 23, cadence: "monthly", forgotten: true },
  // Quarterly, so it lands in March and June only inside this window.
  { name: "HDFC Bank Locker", amount: 250, day: 18, cadence: "quarterly", forgotten: false, months: ["2026-03", "2026-06"] },
];

const RECURRING_MONTHLY_TOTAL = RECURRING.filter((r) => r.cadence === "monthly").reduce(
  (sum, r) => sum + r.amount,
  0
);

// Whatever the subscriptions target has left over after the mandates. Real
// enough: one-off store charges are what makes that line move month to month.
const ONE_OFF_STORES = ["Google Play", "Apple App Store", "Steam", "Notion", "Google One"];

// ---------------------------------------------------------------------------
// Amount fitting
//
// Generate plausible shapes, then bend them to hit the month's target exactly.
// Scaling first and repairing the rounding drift on the largest row keeps the
// distribution believable while the total stays to the rupee.
// ---------------------------------------------------------------------------
function fitToTotal(values, target) {
  const raw = values.reduce((a, b) => a + b, 0);
  if (raw === 0 || values.length === 0) return values;
  const scaled = values.map((v) => Math.max(Math.round((v / raw) * target), 20));
  const drift = target - scaled.reduce((a, b) => a + b, 0);
  let fixAt = 0;
  for (let i = 1; i < scaled.length; i += 1) if (scaled[i] > scaled[fixAt]) fixAt = i;
  scaled[fixAt] += drift;
  return scaled;
}

// ---------------------------------------------------------------------------
// Hand-written rows
//
// The six transactions the design shipped with, kept verbatim — their detail
// copy is written prose, not generated, and every one of them is quoted
// somewhere in the app. The generator treats their amounts as already spent
// against the month's target rather than adding to it.
// ---------------------------------------------------------------------------
const PINNED = [
  {
    merchant: "Zomato",
    amount: -486,
    date: at("2026-08-26", 21, 12),
    method: "UPI",
    initial: "Z",
    color: "#b25f3c",
    meta: "Today, 9:12 pm · UPI",
    category: "Food & delivery",
    slug: "food-delivery",
    account: "HDFC ••4021",
    note: "Your 11th food order this week. Average order ₹740 — this one was under it.",
  },
  {
    merchant: "Aditya",
    amount: 1200,
    date: at("2026-08-26", 14, 40),
    method: "split dinner",
    initial: "A",
    color: "#2f7d58",
    meta: "Today, 2:40 pm · split dinner",
    category: "Transfer in",
    slug: null,
    account: "UPI · aditya@okhdfc",
    note: "Settles Saturday's dinner. Aditya still owes ₹340 from the 18th.",
  },
  {
    merchant: "Blinkit",
    amount: -1142,
    date: at("2026-08-25", 20, 24),
    method: "UPI",
    initial: "B",
    color: "#ad8228",
    meta: "Yesterday, 8:24 pm · UPI",
    category: "Food & delivery",
    slug: "food-delivery",
    account: "HDFC ••4021",
    note: "Third Blinkit order in five days. Together they cost more than one big weekly shop.",
  },
  {
    merchant: "Cult.fit",
    amount: -1299,
    date: at("2026-08-24", 0, 0),
    method: "autopay",
    initial: "C",
    color: "#4b55a6",
    meta: "24 Aug · autopay",
    category: "Subscriptions",
    slug: "subscriptions",
    account: "HDFC ••4021 · autopay",
    note: "Last gym check-in was 11 July. Six weeks, ₹2,598 paid.",
    recurring: "Cult.fit",
  },
  {
    merchant: "Uber",
    amount: -212,
    date: at("2026-08-24", 9, 15),
    method: "HDFC card",
    initial: "U",
    color: "#3b3733",
    meta: "24 Aug · HDFC card",
    category: "Travel & cabs",
    slug: "travel-cabs",
    account: "HDFC Millennia ••7788",
    note: "Airport-adjacent. Tag it to travel if it was the Goa trip.",
  },
  {
    merchant: "Spotify Duo",
    amount: -149,
    date: at("2026-08-23", 0, 0),
    method: "autopay",
    initial: "S",
    color: "#3b7a78",
    meta: "23 Aug · autopay",
    category: "Subscriptions",
    slug: "subscriptions",
    account: "HDFC ••4021 · autopay",
    note: "Duo plan, one listener. Individual is ₹119.",
    recurring: "Spotify Duo",
  },
];

// The two earlier Blinkit orders the 25 Aug note refers to ("third in five
// days"). Pinned so the copy is checkable rather than decorative.
const PINNED_FOOD_WEEKEND = [
  { date: "2026-08-21", merchant: "Blinkit", amount: 968, hour: 22, minute: 6 },
  { date: "2026-08-23", merchant: "Blinkit", amount: 734, hour: 13, minute: 41 },
];

// ---------------------------------------------------------------------------
// Ledger generation
// ---------------------------------------------------------------------------

const ACCOUNT_UPI = "HDFC ••4021";
const ACCOUNT_CARD = "HDFC Millennia ••7788";

function row({ merchant, amount, date, hour, minute, method, slug, account, note, meta, initial, color }) {
  const day = date;
  return {
    merchant,
    amount, // negative for spend, positive for money in
    date: at(day, hour, minute),
    method,
    initial: initial ?? merchant[0].toUpperCase(),
    color: color ?? MERCHANT_COLOR[merchant] ?? (slug ? CATEGORY_META.find((c) => c.slug === slug)?.color : "#3b3733"),
    meta: meta ?? `${shortDate(day)} · ${method}`,
    category: slug ? CATEGORY_NAME[slug] : "Other",
    slug,
    account: account ?? ACCOUNT_UPI,
    note,
  };
}

// Food: weekend and weekday budgets are filled separately so the split the
// insight copy quotes survives the scaling pass.
function generateFood(ym, spentAlready) {
  const days = monthDays(ym);
  const weekendDays = days.filter(isWeekend);
  const weekdayDays = days.filter((d) => !isWeekend(d));

  const pinnedWeekend = ym === DATASET_MONTH ? PINNED_FOOD_WEEKEND : [];
  const pinnedWeekendTotal = pinnedWeekend.reduce((s, p) => s + p.amount, 0);

  const weekendTarget = FOOD_WEEKEND_TARGET[ym] - pinnedWeekendTotal;
  const weekdayTarget = MONTH_TARGETS[ym]["food-delivery"] - FOOD_WEEKEND_TARGET[ym] - spentAlready;

  const build = (pool, target, orders, hours) => {
    if (target <= 0 || orders <= 0) return [];
    const picks = Array.from({ length: orders }, () => {
      const day = pick(pool);
      const m = weightedPick(FOOD_MERCHANTS);
      return { day, m, raw: between(m.band[0], m.band[1]) };
    });
    const amounts = fitToTotal(picks.map((p) => p.raw), target);
    return picks.map((p, i) =>
      row({
        merchant: p.m.name,
        amount: -amounts[i],
        date: p.day,
        hour: hours[0] + Math.floor(rand() * (hours[1] - hours[0])),
        minute: Math.floor(rand() * 60),
        method: "UPI",
        slug: "food-delivery",
        note: `${p.m.name} on a ${isWeekend(p.day) ? "weekend" : "weekday"}. Paid by UPI from ${ACCOUNT_UPI}.`,
      })
    );
  };

  // Weekends are few, large and late; weekdays are many, small and spread.
  const weekendOrders = Math.max(weekendDays.length - pinnedWeekend.length, 1);
  const weekdayOrders = Math.max(Math.round(weekdayDays.length * 0.55), 1);

  return [
    ...pinnedWeekend.map((p) =>
      row({
        merchant: p.merchant,
        amount: -p.amount,
        date: p.date,
        hour: p.hour,
        minute: p.minute,
        method: "UPI",
        slug: "food-delivery",
        note: `${p.merchant} order. One of three in five days.`,
      })
    ),
    ...build(weekendDays, weekendTarget, weekendOrders, [19, 23]),
    ...build(weekdayDays, weekdayTarget, weekdayOrders, [12, 21]),
  ];
}

function generateSimple(ym, slug, pool, spentAlready, count, opts = {}) {
  const target = MONTH_TARGETS[ym][slug] - spentAlready;
  if (target <= 0) return [];
  const days = monthDays(ym);
  const picks = Array.from({ length: count }, () => {
    const m = weightedPick(pool);
    return { day: pick(days), m, raw: between(m.band[0], m.band[1]) };
  });
  const amounts = fitToTotal(picks.map((p) => p.raw), target);
  return picks.map((p, i) =>
    row({
      merchant: p.m.name,
      amount: -amounts[i],
      date: p.day,
      hour: opts.hours ? opts.hours[0] + Math.floor(rand() * (opts.hours[1] - opts.hours[0])) : 10 + Math.floor(rand() * 11),
      minute: Math.floor(rand() * 60),
      method: opts.method ?? "UPI",
      account: opts.account,
      slug,
      note: opts.note ? opts.note(p.m.name) : `${p.m.name}. ${CATEGORY_NAME[slug]}.`,
    })
  );
}

function generateSubscriptions(ym, pinnedNames) {
  const rows = [];
  const last = ym === DATASET_MONTH ? Number(DATASET_TODAY.slice(-2)) : daysInMonth(ym);

  for (const r of RECURRING) {
    if (r.months && !r.months.includes(ym)) continue;
    if (r.day > last) continue;
    if (pinnedNames.has(r.name)) continue; // already in PINNED for this month
    rows.push(
      row({
        merchant: r.name,
        amount: -r.amount,
        date: `${ym}-${pad(r.day)}`,
        hour: 0,
        minute: 0,
        method: "autopay",
        slug: "subscriptions",
        account: `${ACCOUNT_UPI} · autopay`,
        note: `${r.cadence === "quarterly" ? "Quarterly" : "Monthly"} mandate, ₹${r.amount}. Debited automatically.`,
      })
    );
  }

  const mandated = RECURRING.filter(
    (r) => (!r.months || r.months.includes(ym)) && r.day <= last
  ).reduce((s, r) => s + r.amount, 0);

  // One-off store charges absorb the difference between the mandates and the
  // month's subscriptions target.
  let remainder = MONTH_TARGETS[ym].subscriptions - mandated;
  const oneOffs = remainder > 700 ? 2 : remainder > 0 ? 1 : 0;
  if (oneOffs > 0) {
    const raws = Array.from({ length: oneOffs }, () => between(120, 900));
    const amounts = fitToTotal(raws, remainder);
    amounts.forEach((amount, i) => {
      const store = ONE_OFF_STORES[(i + MONTHS.indexOf(ym)) % ONE_OFF_STORES.length];
      rows.push(
        row({
          merchant: store,
          amount: -amount,
          date: `${ym}-${pad(6 + i * 9)}`,
          hour: 11 + i,
          minute: Math.floor(rand() * 60),
          method: "HDFC card",
          slug: "subscriptions",
          account: ACCOUNT_CARD,
          note: `One-off ${store} charge. Not a recurring mandate.`,
        })
      );
    });
  }

  return rows;
}

function generateIncome(ym) {
  const rows = [
    row({
      merchant: "Salary · Nutanix",
      amount: 52000,
      date: `${ym}-01`,
      hour: 9,
      minute: 30,
      method: "NEFT",
      slug: null,
      initial: "S",
      color: "#2f7d58",
      note: `Monthly salary credit for ${MONTH_SHORT[Number(ym.slice(5)) - 1]}.`,
    }),
  ];
  // A split settled by a friend, most months. August's is pinned (Aditya).
  if (ym !== DATASET_MONTH) {
    rows.push(
      row({
        merchant: pick(["Aditya", "Nikhil", "Sara", "Ishaan"]),
        amount: Math.round(between(400, 1600) / 10) * 10,
        date: `${ym}-${pad(9 + Math.floor(rand() * 14))}`,
        hour: 14,
        minute: Math.floor(rand() * 60),
        method: "split dinner",
        slug: null,
        color: "#2f7d58",
        note: "Settles a shared bill. Money in, not income.",
      })
    );
  }
  return rows;
}

function generateMonth(ym) {
  const pinnedThisMonth = ym === DATASET_MONTH ? PINNED : [];
  const spentBySlug = {};
  for (const p of pinnedThisMonth) {
    if (p.amount < 0 && p.slug) spentBySlug[p.slug] = (spentBySlug[p.slug] || 0) + -p.amount;
  }
  const pinnedRecurring = new Set(pinnedThisMonth.map((p) => p.recurring).filter(Boolean));

  const rent = row({
    merchant: "Rent · Ashwin Nair",
    amount: -MONTH_TARGETS[ym].rent,
    date: `${ym}-03`,
    hour: 10,
    minute: 5,
    method: "NEFT",
    slug: "rent",
    initial: "R",
    note: "Monthly rent, paid on the 3rd. Unchanged for six months.",
  });

  return [
    ...pinnedThisMonth,
    rent,
    ...generateFood(ym, spentBySlug["food-delivery"] || 0),
    ...generateSimple(ym, "travel-cabs", TRAVEL_MERCHANTS, spentBySlug["travel-cabs"] || 0, 13, {
      hours: [8, 22],
    }),
    ...generateSimple(ym, "shopping", SHOPPING_MERCHANTS, spentBySlug.shopping || 0, 4, {
      method: "HDFC card",
      account: ACCOUNT_CARD,
      hours: [11, 23],
      note: (name) => `${name} order. Card, not UPI — it shows up on the statement, not the passbook.`,
    }),
    ...generateSubscriptions(ym, pinnedRecurring),
    ...generateIncome(ym),
  ];
}

// Newest first — `sort` is the order the Money tab renders in, and the six
// hand-written rows have to stay at the top of it.
export const TEMPLATE_TRANSACTIONS = MONTHS.flatMap(generateMonth).sort((a, b) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0
);

// ---------------------------------------------------------------------------
// Everything below is derived from the ledger above
// ---------------------------------------------------------------------------

const spendRows = TEMPLATE_TRANSACTIONS.filter((t) => t.amount < 0 && t.slug);
const monthOf = (t) => t.date.slice(0, 7);

function sumWhere(fn) {
  return spendRows.filter(fn).reduce((s, t) => s + -t.amount, 0);
}

const monthTotal = Object.fromEntries(
  MONTHS.map((ym) => [ym, sumWhere((t) => monthOf(t) === ym)])
);

const thisMonthTotal = monthTotal[DATASET_MONTH];
const lastMonth = MONTHS[MONTHS.length - 2];

export const TEMPLATE_CATEGORIES = CATEGORY_META.map((c) => {
  const rows = spendRows.filter((t) => t.slug === c.slug && monthOf(t) === DATASET_MONTH);
  const amount = rows.reduce((s, t) => s + -t.amount, 0);
  return {
    slug: c.slug,
    name: c.name,
    amount,
    payments: rows.length,
    pct: Math.round((amount / thisMonthTotal) * 100),
    color: c.color,
    budget: c.budget,
  };
}).sort((a, b) => b.amount - a.amount);

// Backs the small trend chart in the Ask sheet and /api/spending-trend. Six
// points per category now, not three — a three-point series cannot answer
// "is this a trend or a bad month?".
export const TEMPLATE_TRENDS = Object.fromEntries(
  CATEGORY_META.map((c) => [
    c.slug,
    MONTHS.map((ym) => ({
      month: ym,
      amount: sumWhere((t) => t.slug === c.slug && monthOf(t) === ym),
    })),
  ])
);

// The "total spend" series, keyed under a reserved slug so /api/spending-trend
// can serve it alongside the real categories.
TEMPLATE_TRENDS.all = MONTHS.map((ym) => ({ month: ym, amount: monthTotal[ym] }));

export const TEMPLATE_SNAPSHOT = {
  netWorth: 842600,
  netWorthChangeThisMonth: 18400,
  safeToSpend: 6300,
  safeToSpendUntil: "2026-08-31",
  spentThisMonth: thisMonthTotal,
  monthlyBudget: 42000,
  // Derived, so the Money tab's "+x% vs Jul" is the ledger's own arithmetic
  // rather than a second, drifting assertion of it.
  spentVsLastMonth: thisMonthTotal - monthTotal[lastMonth],
  moneyInAmount: 52000,
  moneyInNote: "salary · 1 Aug",
  // The Money tab's "at this burn rate" end-of-month card. Deliberately a
  // different number from safeToSpend — do not collapse them.
  forecastRemaining: 8400,
  forecastUntil: "2026-08-31",
  forecastBasis: "burn_rate",
  // Net-worth milestone projection behind the Money tab's progress bar.
  // `progressPct` is the fill toward the next unreached milestone.
  milestoneCurrentAge: 23,
  milestoneProgressPct: 34,
};

export const TEMPLATE_MILESTONES = [
  { label: "₹10L", amount: 1000000, projectedAge: 24 },
  { label: "₹50L", amount: 5000000, projectedAge: 31 },
  { label: "₹1Cr", amount: 10000000, projectedAge: 38 },
];

// Month-end net worth, so "how fast is this growing?" has a line to draw.
// Ends on TEMPLATE_SNAPSHOT.netWorth, and August's step is its stated change.
export const TEMPLATE_NET_WORTH_HISTORY = [
  { month: "2026-03", value: 764500, invested: 268000, cash: 121500 },
  { month: "2026-04", value: 783200, invested: 279400, cash: 118900 },
  { month: "2026-05", value: 799400, invested: 288100, cash: 124200 },
  { month: "2026-06", value: 810300, invested: 294600, cash: 119700 },
  { month: "2026-07", value: 824200, invested: 299500, cash: 126400 },
  { month: "2026-08", value: 842600, invested: 302000, cash: 131900 },
];

export const TEMPLATE_ACCOUNTS = [
  { name: "Bank & UPI", provider: "HDFC", status: "connected", syncedAgo: "2m" },
  { name: "Mutual funds", provider: "Zerodha Coin", status: "connected", syncedAgo: "1h" },
  { name: "Credit cards", provider: null, status: "not_connected", syncedAgo: null },
  { name: "Fixed deposits", provider: null, status: "not_connected", syncedAgo: null },
  { name: "Insurance", provider: null, status: "not_connected", syncedAgo: null },
  { name: "NPS", provider: null, status: "not_connected", syncedAgo: null },
];

// Backs the "3 subscriptions you forgot" card on the Money tab. Structurally
// distinct from the tone-based insight cards — a detected list of recurring
// charges, not generated commentary. Derived from RECURRING so the mandates in
// the ledger and the list on the screen cannot disagree.
export const TEMPLATE_SUBSCRIPTIONS = RECURRING.map((r) => ({
  name: r.name,
  amount: r.amount,
  cadence: r.cadence,
  forgotten: Boolean(r.forgotten),
})).sort((a, b) => b.amount - a.amount);

export const TEMPLATE_BUDGETS = CATEGORY_META.map((c) => ({ slug: c.slug, amount: c.budget }));

export const TEMPLATE_PORTFOLIO = {
  value: 344900,
  returnPct: 14.2,
  gained: 42900,
  invested: 302000,
  sipMonthly: 8000,
  nextDebit: "1 Sep",
  idleCashRate: "3%",
};

export const TEMPLATE_HOLDINGS = [
  {
    name: "Parag Parikh Flexi Cap",
    meta: "SIP ₹5,000 · since Mar 2024",
    value: 142400,
    returnPct: 18.2,
    flat: false,
    share: 42,
    color: "#2f7d58",
  },
  {
    name: "UTI Nifty 50 Index",
    meta: "SIP ₹3,000 · since Jan 2024",
    value: 86200,
    returnPct: 12.6,
    flat: false,
    share: 25,
    color: "#4b55a6",
  },
  {
    name: "HDFC Fixed Deposit",
    meta: "Matures Feb 2027 · 7.1%",
    value: 75000,
    returnPct: 7.1,
    flat: true,
    share: 22,
    color: "#3b7a78",
  },
  {
    name: "Quant Small Cap",
    meta: "Lumpsum ₹40,000 · Jun 2024",
    value: 41300,
    returnPct: -3.4,
    flat: false,
    share: 12,
    color: "#8b4f76",
  },
];

export const TEMPLATE_SIPS = [
  { name: "Parag Parikh Flexi Cap", meta: "₹5,000 · 29 instalments", color: "#2f7d58" },
  { name: "UTI Nifty 50 Index", meta: "₹3,000 · 31 instalments", color: "#4b55a6" },
];

export const TEMPLATE_GOALS = [
  {
    name: "₹1 crore",
    // Tracks live net worth, so the value is filled in at render time.
    value: null,
    tracksNetWorth: true,
    pct: 8,
    color: "#2f7d58",
    note: "On this pace: age 38. Add ₹4,000/mo to make it 35.",
  },
  {
    name: "House down payment",
    value: 210000,
    tracksNetWorth: false,
    pct: 28,
    color: "#4b55a6",
    note: "₹7.5L target · Dec 2029",
  },
  {
    name: "Emergency fund",
    value: 152000,
    tracksNetWorth: false,
    pct: 100,
    color: "#2f7d58",
    note: "Six months of expenses. Done — stop adding here.",
  },
];

// Investment-tab assistant cards. Tone-independent, unlike /api/insights.
export const TEMPLATE_INVEST_INSIGHTS = [
  {
    id: "fund-overlap",
    date: "2026-08-22",
    headline: "Two funds, one portfolio.",
    body:
      "Parag Parikh and UTI Nifty hold 41% of the same companies. You're paying an active " +
      "fee for an index you already own.",
    actions: ["Show the overlap"],
  },
  {
    id: "idle-cash",
    date: "2026-08-19",
    headline: "Your idle cash has a job.",
    body:
      "₹8,400 has sat in savings at 3% for four months. A liquid fund would have made ₹190 " +
      "more. Not life-changing — but it's free.",
    actions: ["Explain liquid funds", "Not now"],
  },
];

// Money-tab assistant cards.
export const TEMPLATE_MONEY_INSIGHTS = [
  {
    id: "weekends",
    date: "2026-08-26",
    headline: "Weekends are the whole story.",
    body:
      "₹8,100 of your food spend landed on Fri–Sun. Weekdays are actually down ₹600 from July.",
    actions: ["Show weekends"],
  },
  {
    id: "forgotten-subs",
    date: "2026-08-24",
    headline: "3 subscriptions you forgot.",
    body:
      "Cult ₹1,299/mo · Spotify Duo ₹149/mo · Prime ₹399/mo. ₹1,847 a month for things you " +
      "last opened in July.",
    actions: ["Review all three", "Not now"],
  },
];
