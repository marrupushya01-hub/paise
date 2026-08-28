// Design content that is not account data.
//
// Everything that describes a user's money — transactions and their detail
// copy, holdings, SIPs, goals, the profile, category colours, the Money and
// Invest insight cards — used to live here as hardcoded constants and now
// comes from the API, out of SQLite, scoped to the signed-in account. See
// backend/seed.js for the template those rows are cloned from.
//
// What is left is the two things that are genuinely part of the design rather
// than the data: the editorial feature card, and the seeded exchange the Ask
// sheet opens on so the conversation has a shape before the first question.

export const FEATURE = {
  tag: "PHOTO — DAWN OVER THE CITY · 1170×708",
  tagShort: "PHOTO — DAWN OVER THE CITY · 1170×630",
  title: "Your salary, finally explained",
  sub: "A 4-minute read on where the 30% you never see actually goes.",
};

// Seeded exchange from the design. Live answers stream in below it.
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
