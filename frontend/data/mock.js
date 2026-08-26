// Content that exists in the Paise design but that the prototype backend
// doesn't serve yet (transaction detail copy, holdings, SIPs, goals).
// Anything the backend *does* serve is fetched — see src/api.js.

export const PROFILE = {
  name: "Aarav Rao",
  initials: "AR",
  phone: "+91 98765 43210",
  age: 23,
};

// Keyed by merchant so backend `recentTransactions` can be enriched in place.
export const TX_DETAIL = {
  Zomato: {
    initial: "Z",
    color: "#b25f3c",
    meta: "Today, 9:12 pm · UPI",
    category: "Food & delivery",
    account: "HDFC ••4021",
    note: "Your 11th food order this week. Average order ₹740 — this one was under it.",
  },
  Aditya: {
    initial: "A",
    color: "#2f7d58",
    meta: "Today, 2:40 pm · split dinner",
    category: "Transfer in",
    account: "UPI · aditya@okhdfc",
    note: "Settles Saturday's dinner. Aditya still owes ₹340 from the 18th.",
  },
  Blinkit: {
    initial: "B",
    color: "#ad8228",
    meta: "Yesterday, 8:24 pm · UPI",
    category: "Groceries",
    account: "HDFC ••4021",
    note: "Third Blinkit order in five days. Together they cost more than one big weekly shop.",
  },
  "Cult.fit": {
    initial: "C",
    color: "#4b55a6",
    meta: "24 Aug · autopay",
    category: "Subscriptions",
    account: "HDFC ••4021 · autopay",
    note: "Last gym check-in was 11 July. Six weeks, ₹2,598 paid.",
  },
  Uber: {
    initial: "U",
    color: "#3b3733",
    meta: "24 Aug · HDFC card",
    category: "Travel & cabs",
    account: "HDFC Millennia ••7788",
    note: "Airport-adjacent. Tag it to travel if it was the Goa trip.",
  },
  "Spotify Duo": {
    initial: "S",
    color: "#3b7a78",
    meta: "23 Aug · autopay",
    category: "Subscriptions",
    account: "HDFC ••4021 · autopay",
    note: "Duo plan, one listener. Individual is ₹119.",
  },
};

export const MONEY_IN = { amount: 52000, note: "salary · 1 Aug" };

export const PORTFOLIO = {
  value: 344900,
  returnPct: 14.2,
  gained: 42900,
  invested: 302000,
  sipMonthly: 8000,
  nextDebit: "1 Sep",
  idleCashRate: "3%",
};

export const HOLDINGS = [
  {
    name: "Parag Parikh Flexi Cap",
    meta: "SIP ₹5,000 · since Mar 2024",
    value: 142400,
    returnPct: 18.2,
    share: 42,
    color: "#2f7d58",
  },
  {
    name: "UTI Nifty 50 Index",
    meta: "SIP ₹3,000 · since Jan 2024",
    value: 86200,
    returnPct: 12.6,
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
    share: 12,
    color: "#8b4f76",
  },
];

export const ACTIVE_SIPS = [
  { name: "Parag Parikh Flexi Cap", meta: "₹5,000 · 29 instalments", color: "#2f7d58" },
  { name: "UTI Nifty 50 Index", meta: "₹3,000 · 31 instalments", color: "#4b55a6" },
];

export const GOALS = [
  {
    name: "₹1 crore",
    // Tracks live net worth, so the value is filled in at render time.
    tracksNetWorth: true,
    pct: 8,
    color: "#2f7d58",
    note: "On this pace: age 38. Add ₹4,000/mo to make it 35.",
  },
  {
    name: "House down payment",
    value: 210000,
    pct: 28,
    color: "#4b55a6",
    note: "₹7.5L target · Dec 2029",
  },
  {
    name: "Emergency fund",
    value: 152000,
    pct: 100,
    color: "#2f7d58",
    note: "Six months of expenses. Done — stop adding here.",
  },
];

export const INVEST_INSIGHTS = [
  {
    id: "fund-overlap",
    date: "22 AUG",
    headline: "Two funds, one portfolio.",
    body:
      "Parag Parikh and UTI Nifty hold 41% of the same companies. You're paying an active " +
      "fee for an index you already own.",
    actions: ["Show the overlap"],
  },
  {
    id: "idle-cash",
    date: "19 AUG",
    headline: "Your idle cash has a job.",
    body:
      "₹8,400 has sat in savings at 3% for four months. A liquid fund would have made ₹190 " +
      "more. Not life-changing — but it's free.",
    actions: ["Explain liquid funds", "Not now"],
  },
];

export const MONEY_INSIGHTS = [
  {
    id: "weekends",
    date: "26 AUG",
    headline: "Weekends are the whole story.",
    body:
      "₹8,100 of your food spend landed on Fri–Sun. Weekdays are actually down ₹600 from July.",
    actions: ["Show weekends"],
  },
  {
    id: "forgotten-subs",
    date: "24 AUG",
    headline: "3 subscriptions you forgot.",
    body:
      "Cult ₹1,299/mo · Spotify Duo ₹149/mo · Prime ₹399/mo. ₹1,847 a month for things you " +
      "last opened in July.",
    actions: ["Review all three", "Not now"],
  },
];

export const CATEGORY_COLORS = {
  "food-delivery": "#b25f3c",
  rent: "#4b55a6",
  "travel-cabs": "#3b7a78",
  subscriptions: "#ad8228",
  shopping: "#8b4f76",
};

export const FEATURE = {
  tag: "PHOTO — DAWN OVER THE CITY · 1170×708",
  tagShort: "PHOTO — DAWN OVER THE CITY · 1170×630",
  title: "Your salary, finally explained",
  sub: "A 4-minute read on where the 30% you never see actually goes.",
};

// Seeded exchange from the design. Live answers are appended below it.
export const ASK_SEED = [
  { role: "user", text: "why did I overspend this month?" },
  {
    role: "paise",
    segments: [
      { text: "You didn't overspend everywhere — just on food. " },
      { text: "₹11,900", accent: true },
      { text: " in August against ₹7,700 in July, and ₹8,100 of it was delivery on Fri–Sun." },
    ],
  },
  { role: "trend", category: "food-delivery" },
  { role: "paise", text: "Rent, travel and your SIP were all normal. Nothing else moved." },
  { role: "user", text: "can I fix it without cutting weekends?" },
  {
    role: "paise",
    text:
      "Probably. Your weekend spend is 11 orders averaging ₹740 — mostly two people, mostly " +
      "late. Cook one of the three weekend dinners and you're back at July's number without " +
      "giving up a single night out.",
  },
  { role: "suggestions", items: ["Set a food budget", "Show the 11 orders"] },
];
