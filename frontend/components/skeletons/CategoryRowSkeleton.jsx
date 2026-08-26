"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of a "where it went" category row on Money → Insights. The real
 * row is a `.list-row` with an inline `padding: 12px 0` override, reproduced
 * here so the two stack exactly.
 *
 *   .list-row        gap 12 (padding overridden inline to 12px 0)
 *   .swatch          11px, radius 3
 *   .list-row__name  14px/1.2   → 16.8px
 *   .list-row__meta  11.5px/1.3 → 14.95px, margin-top 3
 *   .list-row__amount 14px/1
 *   .list-row__pct   11px/1, margin-top 4
 */

const SWATCH = 11;
const NAME_LINE = 16.8;
const META_LINE = 14.95;
const AMOUNT_LINE = 14;
const PCT_LINE = 11;

const SHAPES = [
  { name: 96, meta: 74, amount: 62 },
  { name: 74, meta: 82, amount: 54 },
  { name: 112, meta: 68, amount: 58 },
  { name: 88, meta: 78, amount: 48 },
  { name: 68, meta: 86, amount: 44 },
];

export default function CategoryRowSkeleton({ index = 0, shimmerDuration }) {
  const shape = SHAPES[index % SHAPES.length];

  return (
    <div className="list-row" style={{ padding: "12px 0" }} aria-hidden="true">
      <Skeleton
        shimmerDuration={shimmerDuration}
        style={{ width: SWATCH, height: SWATCH, borderRadius: 3 }}
      />
      <div className="list-row__body">
        <div className="skel-line-box" style={{ height: NAME_LINE }}>
          <Skeleton
            className="skel--line"
            shimmerDuration={shimmerDuration}
            style={{ width: shape.name, height: 10 }}
          />
        </div>
        <div className="skel-line-box" style={{ height: META_LINE, marginTop: 3 }}>
          <Skeleton
            className="skel--line"
            shimmerDuration={shimmerDuration}
            style={{ width: shape.meta, height: 8 }}
          />
        </div>
      </div>
      <div className="list-row__right">
        <div className="skel-line-box" style={{ height: AMOUNT_LINE, justifyContent: "flex-end" }}>
          <Skeleton
            className="skel--line"
            shimmerDuration={shimmerDuration}
            style={{ width: shape.amount, height: 10 }}
          />
        </div>
        <div
          className="skel-line-box"
          style={{ height: PCT_LINE, marginTop: 4, justifyContent: "flex-end" }}
        >
          <Skeleton
            className="skel--line"
            shimmerDuration={shimmerDuration}
            style={{ width: 26, height: 8 }}
          />
        </div>
      </div>
    </div>
  );
}
