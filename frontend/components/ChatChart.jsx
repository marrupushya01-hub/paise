"use client";

import { useId, useMemo, useState } from "react";
import { CATEGORICAL, identityMap, isTimeAxis, ramp, SEQUENTIAL } from "@/lib/chartSpec";
import { rupees } from "@/lib/format";

// The eight chart presets Ask Paise can put in an answer.
//
// The model picks a preset and hands over data (lib/chartSpec.js validates
// both); everything about how it looks is decided here. That split is the whole
// point: the assistant is never in a position to put a colour, a size or a
// piece of markup on the screen.
//
// Three rules run through all eight, and they are why these read quiet rather
// than like a spreadsheet:
//
//   - Thin marks, no gridlines, no chart junk. A column is capped at 24px and
//     the leftover band is air. Separation between touching fills is a 2px gap
//     in the surface colour, never a stroke.
//   - Label selectively. The point the answer is about gets its value on the
//     mark; the rest are in the tooltip and the values table. A number on every
//     bar is noise nobody reads.
//   - Colour by job. An ordered series (months, days) gets one hue stepped
//     light to dark by *position*; a set of named things gets the category's
//     own colour from the rest of the app, and always a text label beside it,
//     so identity never rests on hue alone.
//
// Every card carries a <details> table of its own numbers, so no value is
// reachable only by hovering.

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function fmt(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (unit === "pct") return `${Math.round(value * 10) / 10}%`;
  if (unit === "count") return INR.format(Math.round(value));
  return rupees(value);
}

// For labels riding a mark, where the full grouped figure would not fit.
function compact(value, unit) {
  if (unit !== "inr") return fmt(value, unit);
  const n = Math.abs(Math.round(value));
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 10000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${INR.format(n)}`;
}

const signedPct = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}%`;

// Growth in spending is bad news and growth in net worth is good news, and a
// chart cannot tell which it is holding. Rising reads as the warning colour,
// which is right for the money questions this assistant actually gets asked.
const deltaColor = (v) => (v > 0 ? "var(--rust)" : v < 0 ? "var(--green)" : "var(--muted-2)");

// ---------------------------------------------------------------------------
// Shared shell
// ---------------------------------------------------------------------------

// One hover/focus channel for every preset. Focus and hover set the same
// state, so a keyboard reader gets exactly what a mouse does.
function useTip() {
  const [tip, setTip] = useState(null);
  const bind = (index, label, value, x) => ({
    tabIndex: 0,
    onMouseEnter: () => setTip({ index, label, value, x }),
    onMouseLeave: () => setTip(null),
    onFocus: () => setTip({ index, label, value, x }),
    onBlur: () => setTip(null),
  });
  return [tip, bind];
}

function ChartCard({ spec, children, aside, legend, tip }) {
  return (
    <figure className="chart">
      {spec.title && <figcaption className="chart__title">{spec.title}</figcaption>}
      <div className="chart__body">
        <div className="chart__plot">
          {tip && (
            <div className="chart__tip" style={{ left: `${tip.x}%` }} role="status">
              <span className="chart__tip-label">{tip.label}</span>
              <span className="chart__tip-value">{tip.value}</span>
            </div>
          )}
          {children}
        </div>
        {aside}
      </div>
      {legend}
      {spec.caption && <p className="chart__caption">{spec.caption}</p>}
      <ValueTable spec={spec} />
    </figure>
  );
}

// The accessible twin. Collapsed by default so it never competes with the
// chart, but it is in the DOM and in the tab order either way.
function ValueTable({ spec }) {
  return (
    <details className="chart__table">
      <summary>values</summary>
      <table>
        <tbody>
          {spec.data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{fmt(point.value, spec.unit)}</td>
              {spec.data.some((p) => p.target) && (
                <td>{point.target ? `of ${fmt(point.target, spec.unit)}` : ""}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// The figure to the right of a time series: the latest value, and how it moved.
function TrendAside({ spec }) {
  const last = spec.data[spec.data.length - 1];
  const prev = spec.data[spec.data.length - 2];
  const change = prev && prev.value ? ((last.value - prev.value) / prev.value) * 100 : null;
  return (
    <div className="chart__aside">
      <div className="chart__aside-value">{fmt(last.value, spec.unit)}</div>
      {change !== null && (
        <div className="chart__aside-delta" style={{ color: deltaColor(change) }}>
          {signedPct(change)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// bar — one ordered series. The last column is the one the answer is about.
// ---------------------------------------------------------------------------
const PLOT_H = 68;

function BarChart({ spec }) {
  const [tip, bind] = useTip();
  const max = Math.max(...spec.data.map((p) => p.value), 1);
  const fills = ramp(spec.data.length);
  // Both the trailing figure and the highlight say "this is the bar the answer
  // is about", and both are only true when the axis runs in time. Across a set
  // of categories the last bar is just whichever one the model listed last —
  // highlighting it points at nothing, and a delta against its neighbour is a
  // change that never happened.
  const timeAxis = isTimeAxis(spec.data);
  const lastIndex = timeAxis ? spec.data.length - 1 : -1;

  return (
    <ChartCard spec={spec} aside={timeAxis ? <TrendAside spec={spec} /> : null} tip={tip}>
      <div className="chart-bars" style={{ height: PLOT_H + 22 }}>
        {spec.data.map((point, i) => (
          <div
            key={point.label}
            className={`chart-bars__col${i === lastIndex ? " is-current" : ""}`}
            role="img"
            aria-label={`${point.label}: ${fmt(point.value, spec.unit)}`}
            {...bind(i, point.label, fmt(point.value, spec.unit), ((i + 0.5) / spec.data.length) * 100)}
          >
            <div
              className="chart-bars__fill"
              style={{
                height: `${Math.max((point.value / max) * PLOT_H, 3)}px`,
                background: point.color || fills[i],
              }}
            />
            <div className="chart-bars__label">{point.label}</div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// line — a denser ordered series. Area wash, 2px stroke, one end marker.
// ---------------------------------------------------------------------------
function LineChart({ spec }) {
  const [tip, bind] = useTip();
  const gid = useId().replace(/:/g, "");
  const W = 300;
  const H = 74;
  const PAD = 6;

  // A line is scaled to its own range, not anchored to zero. Net worth going
  // ₹7.6L → ₹8.4L is a real story that a zero-based axis draws as a flat line.
  // (Bars are the opposite: a bar's length *is* the value, so those stay
  // anchored to a zero baseline.)
  const values = spec.data.map((p) => p.value);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const pad = (high - low || high || 1) * 0.18;
  const max = high + pad;
  const min = Math.max(low - pad, 0);
  const span = max - min || 1;

  const pts = spec.data.map((p, i) => ({
    x: PAD + (i / (spec.data.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((p.value - min) / span) * (H - PAD * 2),
  }));

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x.toFixed(1)} ${H} L${pts[0].x.toFixed(1)} ${H} Z`;
  const end = pts[pts.length - 1];

  // First and last always; a middle tick only when there is room for it.
  const ticks = spec.data.length <= 7 ? spec.data.map((_, i) => i) : [0, Math.floor(spec.data.length / 2), spec.data.length - 1];

  return (
    <ChartCard spec={spec} aside={<TrendAside spec={spec} />} tip={tip}>
      <svg className="chart-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`wash-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b25f3c" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#b25f3c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#wash-${gid})`} />
        <path
          d={path}
          fill="none"
          stroke="#b25f3c"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* 2px ring in the surface colour, so the marker stays legible where
            it sits on top of the stroke. */}
        <circle cx={end.x} cy={end.y} r="4" fill="#b25f3c" stroke="var(--surface)" strokeWidth="2" />
      </svg>

      {/* Hit targets are full-height columns rather than the 8px dots — a dot
          you have to land on dead-centre is not a hover target. */}
      <div className="chart-line__hits">
        {spec.data.map((point, i) => (
          <button
            key={`${point.label}-${i}`}
            type="button"
            className="chart-line__hit"
            aria-label={`${point.label}: ${fmt(point.value, spec.unit)}`}
            {...bind(i, point.label, fmt(point.value, spec.unit), ((i + 0.5) / spec.data.length) * 100)}
          />
        ))}
      </div>

      <div className="chart-line__axis">
        {spec.data.map((point, i) => (
          <span key={`${point.label}-${i}`}>{ticks.includes(i) ? point.label : ""}</span>
        ))}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// donut — how one total splits. Never more than six slices, always with the
// names beside them.
// ---------------------------------------------------------------------------
function DonutChart({ spec, colors }) {
  const [tip, bind] = useTip();
  const R = 46;
  const STROKE = 15;
  const C = 2 * Math.PI * R;
  // The 2px surface gap between touching fills, expressed in arc length.
  const GAP = 3;

  const total = spec.data.reduce((s, p) => s + p.value, 0) || 1;
  let offset = 0;
  const slices = spec.data.map((point, i) => {
    const len = (point.value / total) * C;
    const slice = { point, len, offset, color: colors(point, i) };
    offset += len;
    return slice;
  });

  return (
    <ChartCard
      spec={spec}
      tip={tip}
      legend={
        <ul className="chart-legend">
          {slices.map(({ point, color }) => (
            <li key={point.label}>
              <span className="chart-legend__swatch" style={{ background: color }} />
              <span className="chart-legend__name">{point.label}</span>
              <span className="chart-legend__value">{fmt(point.value, spec.unit)}</span>
              <span className="chart-legend__pct">{Math.round((point.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      }
    >
      <div className="chart-donut">
        <svg viewBox="0 0 120 120" role="img" aria-label={spec.title || "Breakdown"}>
          <g transform="rotate(-90 60 60)">
            {slices.map(({ point, len, offset: o, color }, i) => (
              <circle
                key={point.label}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C - Math.max(len - GAP, 0.5)}`}
                strokeDashoffset={-o}
                {...bind(i, point.label, fmt(point.value, spec.unit), 50)}
              />
            ))}
          </g>
        </svg>
        <div className="chart-donut__centre">
          <div className="chart-donut__total">{compact(total, spec.unit)}</div>
          <div className="chart-donut__caption">total</div>
        </div>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// breakdown — a ranked list. The form the Money tab already uses, so it is the
// one an answer about categories should reach for.
// ---------------------------------------------------------------------------
function BreakdownChart({ spec, colors }) {
  const max = Math.max(...spec.data.map((p) => p.value), 1);
  const total = spec.data.reduce((s, p) => s + p.value, 0) || 1;

  return (
    <ChartCard spec={spec}>
      <ul className="chart-rank">
        {spec.data.map((point, i) => (
          <li key={point.label}>
            <span className="chart-rank__swatch" style={{ background: colors(point, i) }} />
            <span className="chart-rank__name">{point.label}</span>
            <span className="chart-rank__track">
              <span
                className="chart-rank__fill"
                style={{ width: `${Math.max((point.value / max) * 100, 2)}%`, background: colors(point, i) }}
              />
            </span>
            <span className="chart-rank__value">{fmt(point.value, spec.unit)}</span>
            <span className="chart-rank__pct">{Math.round((point.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// compare — exactly two things. Both get their value, because two labels is
// not a flood.
// ---------------------------------------------------------------------------
function CompareChart({ spec }) {
  const [a, b] = spec.data;
  const max = Math.max(a.value, b.value, 1);
  const change = a.value ? ((b.value - a.value) / a.value) * 100 : null;
  const H = 82;

  return (
    <ChartCard spec={spec}>
      <div className="chart-compare">
        {[a, b].map((point, i) => (
          <div key={point.label} className="chart-compare__col">
            <div className="chart-compare__value">{fmt(point.value, spec.unit)}</div>
            <div
              className="chart-compare__fill"
              style={{
                height: `${Math.max((point.value / max) * H, 4)}px`,
                background: point.color || (i === 0 ? SEQUENTIAL[2] : SEQUENTIAL[7]),
              }}
            />
            <div className="chart-compare__label">{point.label}</div>
          </div>
        ))}
        {change !== null && (
          <div className="chart-compare__delta" style={{ color: deltaColor(change) }}>
            {signedPct(change)}
          </div>
        )}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// stacked — composition over time. Two or more series, so a legend is not
// optional.
// ---------------------------------------------------------------------------
function StackedChart({ spec, colors }) {
  const [tip, bind] = useTip();
  const max = Math.max(...spec.data.map((p) => p.value), 1);

  // One colour per part name across every column — identity follows the thing,
  // not its position in a particular stack.
  const names = useMemo(() => {
    const seen = [];
    for (const point of spec.data) {
      for (const part of point.parts || []) if (!seen.includes(part.label)) seen.push(part.label);
    }
    return seen;
  }, [spec]);

  const colorFor = (label) => {
    const i = names.indexOf(label);
    return colors({ label }, i < 0 ? 0 : i);
  };

  return (
    <ChartCard
      spec={spec}
      tip={tip}
      legend={
        <ul className="chart-legend chart-legend--inline">
          {names.map((name) => (
            <li key={name}>
              <span className="chart-legend__swatch" style={{ background: colorFor(name) }} />
              <span className="chart-legend__name">{name}</span>
            </li>
          ))}
        </ul>
      }
    >
      <div className="chart-bars chart-bars--stacked" style={{ height: PLOT_H + 22 }}>
        {spec.data.map((point, i) => (
          <div
            key={point.label}
            className="chart-bars__col"
            role="img"
            aria-label={`${point.label}: ${fmt(point.value, spec.unit)}`}
            {...bind(i, point.label, fmt(point.value, spec.unit), ((i + 0.5) / spec.data.length) * 100)}
          >
            <div className="chart-bars__stack" style={{ height: `${(point.value / max) * PLOT_H}px` }}>
              {(point.parts || []).map((part) => (
                <div
                  key={part.label}
                  className="chart-bars__seg"
                  style={{
                    flexGrow: part.value,
                    background: part.color || colorFor(part.label),
                  }}
                />
              ))}
            </div>
            <div className="chart-bars__label">{point.label}</div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// progress — spend against a budget, or a goal. The fill carries state, so it
// is the one preset that uses status colour rather than the palette.
// ---------------------------------------------------------------------------
function meterColor(pct) {
  if (pct >= 100) return "var(--rust)";
  if (pct >= 90) return "var(--gold)";
  return "var(--green)";
}

function ProgressChart({ spec }) {
  return (
    <ChartCard spec={spec}>
      <ul className="chart-meters">
        {spec.data.map((point) => {
          const target = point.target || point.value || 1;
          const pct = (point.value / target) * 100;
          return (
            <li key={point.label}>
              <div className="chart-meters__head">
                <span className="chart-meters__name">{point.label}</span>
                <span className="chart-meters__value">
                  {fmt(point.value, spec.unit)}
                  <span className="chart-meters__target"> of {fmt(target, spec.unit)}</span>
                  {/* Overshoot rides the value it belongs to. It used to be
                      absolutely positioned above the track's right edge, where
                      it landed on top of the target figure. */}
                  {pct > 100 && (
                    <span className="chart-meters__over">{signedPct(pct - 100)}</span>
                  )}
                </span>
              </div>
              <div
                className="chart-meters__track"
                role="img"
                aria-label={`${point.label}: ${fmt(point.value, spec.unit)} of ${fmt(target, spec.unit)}`}
              >
                <div
                  className="chart-meters__fill"
                  style={{ width: `${Math.min(pct, 100)}%`, background: meterColor(pct) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// stat — when the answer is a figure and drawing it would add nothing.
// ---------------------------------------------------------------------------
function StatChart({ spec }) {
  return (
    <ChartCard spec={spec}>
      <div className="chart-stats">
        {spec.data.map((point) => (
          <div key={point.label} className="chart-stats__tile">
            <div className="chart-stats__label">{point.label}</div>
            <div className="chart-stats__value">{fmt(point.value, spec.unit)}</div>
            {point.delta !== undefined && (
              <div className="chart-stats__delta" style={{ color: deltaColor(point.delta) }}>
                {signedPct(point.delta)}
              </div>
            )}
            {point.note && <div className="chart-stats__note">{point.note}</div>}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------

const RENDERERS = {
  bar: BarChart,
  line: LineChart,
  donut: DonutChart,
  breakdown: BreakdownChart,
  compare: CompareChart,
  stacked: StackedChart,
  progress: ProgressChart,
  stat: StatChart,
};

export default function ChatChart({ spec, categories }) {
  // A slice named "Food & delivery" wears the colour that category wears on
  // every other screen; anything the app does not know falls back to the
  // validated categorical order.
  const identity = useMemo(() => identityMap(categories), [categories]);
  const colors = useMemo(
    () => (point, i) =>
      point.color ||
      identity.get(String(point.label || "").toLowerCase()) ||
      CATEGORICAL[i % CATEGORICAL.length],
    [identity]
  );

  const Renderer = RENDERERS[spec.type];
  if (!Renderer) return null;
  return <Renderer spec={spec} colors={colors} />;
}
