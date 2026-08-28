// The template dataset every new account is cloned from.
//
// Before there was a database this lived as `MOCK_*` constants inside
// server.js, and a second copy of the parts the API didn't serve lived in
// `frontend/data/mock.js`. Both are now here, in one place, and they are
// seeded into SQLite once on first boot (see db.js). Nothing reads this file
// at request time.
//
// Every account provisioned by /api/auth/verify-otp gets its own row-level
// copy of all of this, so two phones signing in no longer share one dataset.

export const TEMPLATE_PROFILE = {
  name: "Aarav Rao",
  initials: "AR",
  age: 23,
};

export const TEMPLATE_SNAPSHOT = {
  netWorth: 842600,
  netWorthChangeThisMonth: 18400,
  safeToSpend: 6300,
  safeToSpendUntil: "2026-08-31",
  spentThisMonth: 38420,
  monthlyBudget: 42000,
  spentVsLastMonth: 4200,
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

export const TEMPLATE_CATEGORIES = [
  { slug: "food-delivery", name: "Food & delivery", amount: 11900, payments: 64, pct: 31, color: "#b25f3c" },
  { slug: "rent", name: "Rent", amount: 9000, payments: 1, pct: 24, color: "#4b55a6" },
  { slug: "travel-cabs", name: "Travel & cabs", amount: 6780, payments: 22, pct: 18, color: "#3b7a78" },
  { slug: "subscriptions", name: "Subscriptions", amount: 5340, payments: 7, pct: 14, color: "#ad8228" },
  { slug: "shopping", name: "Shopping", amount: 5400, payments: 9, pct: 13, color: "#8b4f76" },
];

// The list rows and their expanded detail, which used to be two structures in
// two repos keyed by merchant name. One row each now.
export const TEMPLATE_TRANSACTIONS = [
  {
    merchant: "Zomato",
    amount: -486,
    date: "2026-08-26T21:12:00+05:30",
    method: "UPI",
    initial: "Z",
    color: "#b25f3c",
    meta: "Today, 9:12 pm · UPI",
    category: "Food & delivery",
    account: "HDFC ••4021",
    note: "Your 11th food order this week. Average order ₹740 — this one was under it.",
  },
  {
    merchant: "Aditya",
    amount: 1200,
    date: "2026-08-26T14:40:00+05:30",
    method: "split dinner",
    initial: "A",
    color: "#2f7d58",
    meta: "Today, 2:40 pm · split dinner",
    category: "Transfer in",
    account: "UPI · aditya@okhdfc",
    note: "Settles Saturday's dinner. Aditya still owes ₹340 from the 18th.",
  },
  {
    merchant: "Blinkit",
    amount: -1142,
    date: "2026-08-25T20:24:00+05:30",
    method: "UPI",
    initial: "B",
    color: "#ad8228",
    meta: "Yesterday, 8:24 pm · UPI",
    category: "Groceries",
    account: "HDFC ••4021",
    note: "Third Blinkit order in five days. Together they cost more than one big weekly shop.",
  },
  {
    merchant: "Cult.fit",
    amount: -1299,
    date: "2026-08-24T00:00:00+05:30",
    method: "autopay",
    initial: "C",
    color: "#4b55a6",
    meta: "24 Aug · autopay",
    category: "Subscriptions",
    account: "HDFC ••4021 · autopay",
    note: "Last gym check-in was 11 July. Six weeks, ₹2,598 paid.",
  },
  {
    merchant: "Uber",
    amount: -212,
    date: "2026-08-24T00:00:00+05:30",
    method: "HDFC card",
    initial: "U",
    color: "#3b3733",
    meta: "24 Aug · HDFC card",
    category: "Travel & cabs",
    account: "HDFC Millennia ••7788",
    note: "Airport-adjacent. Tag it to travel if it was the Goa trip.",
  },
  {
    merchant: "Spotify Duo",
    amount: -149,
    date: "2026-08-23T00:00:00+05:30",
    method: "autopay",
    initial: "S",
    color: "#3b7a78",
    meta: "23 Aug · autopay",
    category: "Subscriptions",
    account: "HDFC ••4021 · autopay",
    note: "Duo plan, one listener. Individual is ₹119.",
  },
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
// charges, not generated commentary.
export const TEMPLATE_SUBSCRIPTIONS = [
  { name: "Cult.fit", amount: 1299, cadence: "monthly", forgotten: true },
  { name: "Spotify Duo", amount: 149, cadence: "monthly", forgotten: true },
  { name: "Prime", amount: 399, cadence: "monthly", forgotten: true },
  { name: "HDFC Bank Locker", amount: 250, cadence: "quarterly", forgotten: false },
];

// Backs the small trend chart in the Ask sheet (Jun/Jul/Aug bars). Keyed by
// the same slug as `TEMPLATE_CATEGORIES`.
export const TEMPLATE_TRENDS = {
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
