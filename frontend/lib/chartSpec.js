// Parsing and validating the charts the assistant asks for.
//
// The model does not draw anything. It appends a fenced block to its answer:
//
//   ```paise-chart
//   {"type":"bar","title":"food · last 6 months","data":[{"label":"JUL","value":7700}]}
//   ```
//
// …and this module turns that into a spec the renderer can trust. Which means
// three jobs, in order:
//
//   1. Split a streaming answer into prose and blocks, without ever showing
//      half-written JSON to the reader.
//   2. Coerce whatever came back into the shape the components expect, or
//      reject it. Every field is bounded: unknown types are dropped, arrays are
//      capped, labels are truncated, values must be finite numbers.
//   3. Decide colour. The model is allowed to name a token, never a hex — an
//      LLM inventing #ff0000 would put a colour on the screen that exists
//      nowhere else in the product.
//
// The output of `parseChart` is either null or an object every renderer in
// ChatChart.jsx can consume without re-checking anything.

// ---------------------------------------------------------------------------
// Palette
//
// Two palettes, because charts use colour for two different jobs.
//
// IDENTITY (donut, breakdown, stacked): the reader is matching a colour to a
// name. When that name is one of the app's own categories the swatch has to be
// the same colour it is on the Money tab, or "the rust one" stops meaning
// anything between screens. Anything else falls back to CATEGORICAL below.
//
// MAGNITUDE over an ordered axis (bar, line, compare, progress): one hue,
// light to dark, position in the series choosing the step. Not value → step:
// that would double-encode bar height as colour and burn the free channel.
// ---------------------------------------------------------------------------

// Named tokens the model may use. Anything else it writes is ignored.
export const COLOR_TOKENS = {
  rust: "#b25f3c",
  indigo: "#4b55a6",
  teal: "#3b7a78",
  gold: "#ad8228",
  plum: "#8b4f76",
  green: "#2f7d58",
  muted: "#a29b8e",
};

// The app's five category hues, ordered so that no two adjacent slots collide
// under deuteranopia or protanopia. This exact sequence was chosen by running
// the palette through the six-check validator: worst adjacent pair ΔE 8.4
// (CVD) and 16.9 (normal vision), both above the floor. Reordering it will
// quietly break that, so don't — add to the end instead.
export const CATEGORICAL = [
  COLOR_TOKENS.teal,
  COLOR_TOKENS.rust,
  COLOR_TOKENS.indigo,
  COLOR_TOKENS.green,
  COLOR_TOKENS.gold,
  COLOR_TOKENS.plum,
];

// Sequential ramp on the brand's rust, light → dark. The Ask sheet's original
// trend card used three steps of this by hand; this is the same idea with
// enough steps for any series length we allow.
export const SEQUENTIAL = [
  "#f0e6dc",
  "#e8dad0",
  "#e0cbbc",
  "#d9b7a2",
  "#cea287",
  "#c4886a",
  "#bb7250",
  "#b25f3c",
];

// n steps of the ramp, always ending on the darkest. A two-point series should
// read light → accent, not two mid tones.
export function ramp(n) {
  if (n <= 1) return [SEQUENTIAL[SEQUENTIAL.length - 1]];
  const last = SEQUENTIAL.length - 1;
  // Bias the first step away from the very lightest for short series, so a
  // three-bar chart still reads as three distinct tones on a warm surface.
  const first = n <= 3 ? 1 : 0;
  return Array.from({ length: n }, (_, i) =>
    SEQUENTIAL[first + Math.round((i / (n - 1)) * (last - first))]
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

// A colour the model asked for, if it is one we recognise. `null` otherwise —
// the caller then falls back to whichever palette its form uses.
export function resolveToken(value) {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (COLOR_TOKENS[key]) return COLOR_TOKENS[key];
  // A hex is accepted only if it is one of ours. The model is told not to
  // write hexes at all; this is the belt to that braces.
  if (HEX.test(key) && Object.values(COLOR_TOKENS).includes(key)) return key;
  return null;
}

// Category name → the colour that category wears everywhere else in the app.
// Built from the live account data, so a renamed or recoloured category
// follows automatically.
export function identityMap(categories = []) {
  const map = new Map();
  for (const c of categories) {
    if (c?.name && c?.color) map.set(c.name.trim().toLowerCase(), c.color);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Is this axis ordered in time?
//
// A bar chart of Jun/Jul/Aug and a bar chart of Food/Travel/Shopping are the
// same shape and mean different things. On the first, "the last bar, and how
// it moved from the one before" is the headline. On the second it is nonsense:
// Subscriptions does not come after Shopping, so a delta between them reads as
// a −100% crash that never happened.
//
// Nothing in the spec says which one it is, so it is inferred from the labels.
// Months, ISO year-months, day numbers and week markers are ordered; a
// category or merchant name is not. Deliberately strict — an unrecognised
// label makes the whole axis categorical, and the cost of that is a missing
// figure rather than a wrong one.
// ---------------------------------------------------------------------------
const MONTH_WORD = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(\s*'?\d{2,4})?$/i;
const YEAR_MONTH = /^\d{4}-\d{1,2}$/;
const DAY_NUMBER = /^\d{1,2}$/;
const DAY_MONTH = /^\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/i;
const WEEK_LABEL = /^(w|wk|week)\s*\d{1,2}$/i;

export function isTimeAxis(data) {
  if (!Array.isArray(data) || data.length < 2) return false;
  return data.every((point) => {
    const label = String(point?.label ?? "").trim();
    if (!label) return false;
    return (
      MONTH_WORD.test(label) ||
      YEAR_MONTH.test(label) ||
      DAY_MONTH.test(label) ||
      DAY_NUMBER.test(label) ||
      WEEK_LABEL.test(label)
    );
  });
}

// ---------------------------------------------------------------------------
// Splitting a (possibly half-written) answer
// ---------------------------------------------------------------------------

// Opening fences we accept. `paise-chart` is what the prompt asks for; the
// other two are what a model reaches for when it forgets, and the payload is
// identical either way, so there is no reason to punish the reader for it.
const FENCE_OPEN = /```[ \t]*(paise-chart|chart|json)[ \t]*\r?\n/i;

// Prose and charts, in the order they were written.
//
// While the answer is still streaming the last block may have an opening fence
// and no closing one. That tail is never rendered as text — half a JSON object
// on screen looks like the app broke — it becomes a `pending` segment the
// renderer can show as a placeholder.
export function splitAnswer(text) {
  const segments = [];
  let rest = typeof text === "string" ? text : "";
  let guard = 0;

  while (rest && guard < 12) {
    guard += 1;
    const open = rest.match(FENCE_OPEN);
    if (!open) break;

    const before = rest.slice(0, open.index);
    const after = rest.slice(open.index + open[0].length);
    const close = after.indexOf("```");

    if (before.trim()) segments.push({ kind: "text", text: before.trim() });

    if (close === -1) {
      // Still arriving.
      segments.push({ kind: "pending" });
      return segments;
    }

    const spec = parseChart(after.slice(0, close));
    if (spec) segments.push({ kind: "chart", spec });
    // Models close the fence with four backticks often enough to matter, and
    // the leftovers would otherwise be rendered as the first characters of the
    // next paragraph.
    rest = after.slice(close + 3).replace(/^`+/, "");
  }

  if (rest.trim()) segments.push({ kind: "text", text: rest.trim() });
  return segments;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TYPES = new Set(["bar", "line", "donut", "stacked", "breakdown", "compare", "progress", "stat"]);

// Per-form caps. Donut is the tight one on purpose: part-to-whole stops being
// readable at a glance past six slices.
const MAX_POINTS = { donut: 6, stat: 3, compare: 2, stacked: 8, default: 8 };
const MAX_PARTS = 5;

const LABEL_MAX = 18;

function str(value, max) {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function num(value) {
  const n = typeof value === "string" ? Number(value.replace(/[₹,\s]/g, "")) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function parsePoint(raw) {
  if (!raw || typeof raw !== "object") return null;
  const label = str(raw.label ?? raw.name ?? raw.key, LABEL_MAX);
  if (!label) return null;

  const point = { label, color: resolveToken(raw.color) };

  if (Array.isArray(raw.parts)) {
    point.parts = raw.parts
      .slice(0, MAX_PARTS)
      .map((p) => {
        const name = str(p?.label ?? p?.name, LABEL_MAX);
        const value = num(p?.value);
        return name && value !== null && value >= 0
          ? { label: name, value, color: resolveToken(p?.color) }
          : null;
      })
      .filter(Boolean);
    if (point.parts.length === 0) return null;
    point.value = point.parts.reduce((sum, p) => sum + p.value, 0);
    return point;
  }

  const value = num(raw.value ?? raw.amount);
  if (value === null) return null;
  point.value = value;

  const target = num(raw.target);
  if (target !== null && target > 0) point.target = target;
  const delta = num(raw.delta);
  if (delta !== null) point.delta = delta;
  const note = str(raw.note, 40);
  if (note) point.note = note;

  return point;
}

// The whole block, or null. Null is not an error state worth showing anybody —
// the prose still answers the question, so a malformed chart just doesn't
// appear.
export function parseChart(source) {
  let raw;
  try {
    raw = JSON.parse(String(source).trim());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  let type = String(raw.type || "").trim().toLowerCase();
  if (!TYPES.has(type)) return null;

  const points = (Array.isArray(raw.data) ? raw.data : []).map(parsePoint).filter(Boolean);
  if (points.length === 0) return null;

  // A stacked chart whose points carry no parts is just a bar chart that said
  // the wrong word.
  if (type === "stacked" && !points.some((p) => p.parts)) type = "bar";
  // …and the reverse: parts on a form that cannot show them.
  if (type !== "stacked") for (const p of points) delete p.parts;

  // Form corrections. Each of these is a chart that is technically drawable
  // and reads badly, so it is redrawn as the thing it should have been:
  // a one-bar bar chart and a two-slice donut are both really a figure.
  if (points.length === 1 && (type === "bar" || type === "line" || type === "donut")) type = "stat";
  if (type === "donut" && points.length === 2) type = "breakdown";
  if (type === "compare" && points.length !== 2) type = points.length > 4 ? "breakdown" : "bar";
  if (type === "line" && points.length < 3) type = "bar";
  if (type === "progress" && !points.some((p) => p.target)) type = "breakdown";

  const cap = MAX_POINTS[type] ?? MAX_POINTS.default;
  const data = points.slice(0, cap);

  // Nothing to draw. A chart of six zeroes is a rectangle.
  if (type !== "stat" && data.every((p) => p.value === 0)) return null;
  // Negative magnitudes have no honest bar length. The prose keeps the number.
  if (type !== "stat" && type !== "line" && data.some((p) => p.value < 0)) return null;

  const unit = ["inr", "pct", "count"].includes(raw.unit) ? raw.unit : "inr";

  return {
    type,
    title: str(raw.title, 64),
    caption: str(raw.caption, 96),
    unit,
    data,
    // Every chart ships a table twin, so no value is reachable by hover alone.
    total: data.reduce((sum, p) => sum + p.value, 0),
  };
}
