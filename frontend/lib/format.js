// Indian-grouped currency formatting, plus the privacy mask used across
// every screen when "Hide balances" is on.

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const MASK = "₹ • • •";

export function rupees(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "";
  return `${sign}₹${INR.format(Math.abs(Math.round(value)))}`;
}

// Signed, for transaction amounts: −₹486 / +₹1,200.
export function signedRupees(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "+";
  return `${sign}₹${INR.format(Math.abs(Math.round(value)))}`;
}

export function pct(value, { sign = true } = {}) {
  const rounded = Math.round(value * 10) / 10;
  const prefix = sign && rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${prefix}${Math.abs(rounded)}%`;
}

// "2026-08-31" → "31 Aug"
export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}`;
}

// "2026-08-26" → "26 AUG", for the insight-card timestamps.
export function cardDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" }).toUpperCase()}`;
}

// "2026-06" → "JUN"
export function monthLabel(ym) {
  const d = new Date(`${ym}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleString("en-IN", { month: "short" }).toUpperCase();
}
