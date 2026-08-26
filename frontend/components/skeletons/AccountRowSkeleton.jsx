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
 *   .list-row__aside    12px/1     → 12px
 *   .status-dot         7px circle
 *   .pill-dark--sm      12px/1 + 8px padding → 28px
 *
 * Not every row in these lists is the same row. A connected account carries
 * a meta line and a status dot; an account still waiting on a connection is
 * one line and a Connect button, which is taller than the text beside it.
 * Drawing every row as the two-line kind leaves the silhouette taller than
 * the list it stands in for. Hence `meta` and `aside`.
 */

const NAME_LINE = 16.8;
const META_LINE = 14.95;
const DOT = 7;
const PILL_H = 28;
const ASIDE_LINE = 12;

const SHAPES = [
  { name: 118, meta: 154 },
  { name: 96, meta: 138 },
  { name: 134, meta: 122 },
];

export default function AccountRowSkeleton({
  index = 0,
  settings = false,
  // "meta" — the second line under the name, present only on rows for an
  // account that is already connected.
  meta = true,
  // What sits at the end of the row: the status dot, a Connect button, or a
  // short "N more" note.
  aside = "dot",
  shimmerDuration,
}) {
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
        {meta && (
          <div
            className="skel-line-box"
            style={{ height: META_LINE, marginTop: 3 }}
          >
            <Skeleton
              className="skel--line"
              shimmerDuration={shimmerDuration}
              style={{ width: shape.meta, height: 8 }}
            />
          </div>
        )}
      </div>
      {aside === "dot" && (
        <Skeleton
          className="skel--circle"
          shimmerDuration={shimmerDuration}
          style={{ width: DOT, height: DOT }}
        />
      )}
      {aside === "pill" && (
        <Skeleton
          className="skel--pill"
          shimmerDuration={shimmerDuration}
          style={{ width: 72, height: PILL_H }}
        />
      )}
      {aside === "note" && (
        <span className="skel-line-box" style={{ height: ASIDE_LINE }}>
          <Skeleton
            className="skel--line"
            shimmerDuration={shimmerDuration}
            style={{ width: 46, height: 8 }}
          />
        </span>
      )}
    </div>
  );
}
