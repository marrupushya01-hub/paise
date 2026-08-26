"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of <InsightCard />. Reference implementation for the pattern:
 * reuse the real component's own elements and classes (`card`, `card__head`,
 * `h-card`, `body-text`, `card__actions`) so every border, padding, gap and
 * margin comes for free, and only swap the *text* for sized bars. The
 * numbers below are the real type metrics from styles/app.css:
 *
 *   .eyebrow / .card__date  9.5px/1
 *   .h-card                 21px/1.28   → 26.88px per line
 *   .body-text              13.5px/1.5  → 20.25px per line
 *   .pill-dark / .pill-soft 32.5px tall
 *
 * If those change, change them here too. An exact match is still the goal,
 * but it can only ever be approximate for copy this component hasn't seen —
 * `SkeletonSwap` resizes the column to the real box before the wipe runs, so
 * a line's worth of error settles out instead of snapping away at the end.
 */

const HEAD = 9.5;
const HEADLINE_LINE = 26.88;
const BODY_LINE = 20.25;
const PILL_H = 32.5;

// A headline that fills its only line reads as a bar, not as a sentence.
const LAST_HEADLINE_WIDTH = { 1: "78%", 2: "54%", 3: "41%" };

function Line({ lineHeight, width, bar, shimmerDuration }) {
  return (
    <span
      className="skel-line-box"
      style={{ height: lineHeight, width: "100%" }}
    >
      <Skeleton
        className="skel--line"
        shimmerDuration={shimmerDuration}
        style={{ width, height: bar }}
      />
    </span>
  );
}

export default function InsightCardSkeleton({
  // The silhouette is a guess at a card it hasn't seen, so the shape is a
  // prop: the caller knows roughly what this slot usually holds, and the
  // column resizes to the real box before the wipe anyway (see
  // SkeletonSwap). Defaults describe the common assistant card — a headline
  // that fits one line, two lines of body, one primary and one dismiss.
  headlineLines = 1,
  bodyLines = 2,
  actionWidths = [116, 88],
  shimmerDuration,
}) {
  return (
    <article className="card" aria-hidden="true">
      <div className="card__head">
        <Skeleton
          className="skel--circle"
          shimmerDuration={shimmerDuration}
          style={{ width: 8, height: 8 }}
        />
        <Skeleton
          className="skel--line"
          shimmerDuration={shimmerDuration}
          style={{ width: 34, height: HEAD }}
        />
        <span className="spacer" />
        <Skeleton
          className="skel--line"
          shimmerDuration={shimmerDuration}
          style={{ width: 54, height: HEAD }}
        />
      </div>

      {/* Real h2 so its UA block margins (0.83em) are reproduced exactly. */}
      <h2 className="h-card">
        {Array.from({ length: headlineLines }, (_, i) => (
          <Line
            key={i}
            lineHeight={HEADLINE_LINE}
            width={
              i === headlineLines - 1
                ? LAST_HEADLINE_WIDTH[headlineLines]
                : "86%"
            }
            bar={17}
            shimmerDuration={shimmerDuration}
          />
        ))}
      </h2>

      <p className="body-text" style={{ margin: 0 }}>
        {Array.from({ length: bodyLines }, (_, i) => (
          <Line
            key={i}
            lineHeight={BODY_LINE}
            width={i === bodyLines - 1 ? "62%" : "100%"}
            bar={10}
            shimmerDuration={shimmerDuration}
          />
        ))}
      </p>

      {actionWidths.length > 0 && (
        <div className="card__actions">
          {actionWidths.map((width, i) => (
            <Skeleton
              key={i}
              className="skel--pill"
              shimmerDuration={shimmerDuration}
              style={{ width, height: PILL_H }}
            />
          ))}
        </div>
      )}
    </article>
  );
}
