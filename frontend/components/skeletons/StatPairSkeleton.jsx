"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of <StatPair /> — the "net worth | safe to spend" two-up.
 * Same rule as InsightCardSkeleton: real classes, placeholder text.
 *
 *   .eyebrow      9.5px/1
 *   .stat__value  23px/1.1  → 25.3px  (21px in --tight → 23.1px), margin-top 7
 *   .stat__note   11.5px/1  → 11.5px, margin-top 6
 */

const LABEL = 9.5;
const NOTE = 11.5;

function Stat({ labelWidth, valueWidth, tight, note = true, shimmerDuration }) {
  return (
    <span className="stat">
      <Skeleton
        className="skel--line"
        shimmerDuration={shimmerDuration}
        style={{ width: labelWidth, height: LABEL }}
      />
      <span
        className="skel-line-box"
        style={{ height: tight ? 23.1 : 25.3, marginTop: 7 }}
      >
        <Skeleton
          className="skel--line"
          shimmerDuration={shimmerDuration}
          style={{ width: valueWidth, height: 16 }}
        />
      </span>
      {note && (
        <Skeleton
          className="skel--line"
          shimmerDuration={shimmerDuration}
          style={{ width: 92, height: NOTE, marginTop: 6 }}
        />
      )}
    </span>
  );
}

export default function StatPairSkeleton({ tight = false, notes = true, shimmerDuration }) {
  return (
    <div
      className={`stat-card${tight ? " stat-card--tight" : ""}`}
      aria-hidden="true"
    >
      <Stat
        labelWidth={54}
        valueWidth={104}
        tight={tight}
        note={notes}
        shimmerDuration={shimmerDuration}
      />
      <span className="stat__rule" />
      <Stat
        labelWidth={72}
        valueWidth={82}
        tight={tight}
        note={notes}
        shimmerDuration={shimmerDuration}
      />
    </div>
  );
}
