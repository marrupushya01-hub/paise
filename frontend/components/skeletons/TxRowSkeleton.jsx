"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of one row in Money's "recent" list. The real row is a
 * `.tx > .tx__button`; the button carries the padding, so the placeholder
 * reuses a plain span with the same class rather than a nested <button>.
 *
 *   .tx__button  padding 12px 0, gap 12
 *   .tx__avatar  36px circle
 *   .tx__name    14px/1.2   → 16.8px
 *   .tx__meta    11.5px/1.3 → 14.95px, margin-top 3
 *   .tx__amount  14px/1
 */

const AVATAR = 36;
const NAME_LINE = 16.8;
const META_LINE = 14.95;
const AMOUNT_LINE = 14;

// Merchant names and amounts vary, so the bars do too — a column of
// identical widths reads as a loading bar, not as a list of transactions.
const SHAPES = [
  { name: 104, meta: 132, amount: 62 },
  { name: 78, meta: 118, amount: 54 },
  { name: 122, meta: 96, amount: 70 },
  { name: 92, meta: 126, amount: 58 },
];

export default function TxRowSkeleton({ index = 0, shimmerDuration }) {
  const shape = SHAPES[index % SHAPES.length];

  return (
    <div className="tx" aria-hidden="true">
      <span className="tx__button" style={{ cursor: "default" }}>
        <Skeleton
          className="skel--circle"
          shimmerDuration={shimmerDuration}
          style={{ width: AVATAR, height: AVATAR }}
        />
        <span className="tx__body">
          <span className="skel-line-box" style={{ height: NAME_LINE }}>
            <Skeleton
              className="skel--line"
              shimmerDuration={shimmerDuration}
              style={{ width: shape.name, height: 10 }}
            />
          </span>
          <span className="skel-line-box" style={{ height: META_LINE, marginTop: 3 }}>
            <Skeleton
              className="skel--line"
              shimmerDuration={shimmerDuration}
              style={{ width: shape.meta, height: 8 }}
            />
          </span>
        </span>
        <span className="skel-line-box" style={{ height: AMOUNT_LINE }}>
          <Skeleton
            className="skel--line"
            shimmerDuration={shimmerDuration}
            style={{ width: shape.amount, height: 10 }}
          />
        </span>
      </span>
    </div>
  );
}
