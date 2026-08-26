"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of a connected-account row. Two callers, same row:
 * Money's side column (`.list-row`) and Settings (`.list-row--settings`),
 * which differ only in vertical padding.
 *
 *   .list-row           padding 11px 0, gap 12
 *   .list-row--settings padding 12px 0
 *   .list-row__name     14px/1.2   → 16.8px
 *   .list-row__meta     11.5px/1.3 → 14.95px, margin-top 3
 *   .status-dot         7px circle
 */

const NAME_LINE = 16.8;
const META_LINE = 14.95;
const DOT = 7;

const SHAPES = [
  { name: 118, meta: 154 },
  { name: 96, meta: 138 },
  { name: 134, meta: 122 },
];

export default function AccountRowSkeleton({ index = 0, settings = false, shimmerDuration }) {
  const shape = SHAPES[index % SHAPES.length];

  return (
    <div
      className={`list-row${settings ? " list-row--settings" : ""}`}
      aria-hidden="true"
    >
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
      <Skeleton
        className="skel--circle"
        shimmerDuration={shimmerDuration}
        style={{ width: DOT, height: DOT }}
      />
    </div>
  );
}
