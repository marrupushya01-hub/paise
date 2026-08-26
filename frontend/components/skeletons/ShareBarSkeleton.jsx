"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of <ShareBar /> — the proportional strip above a breakdown.
 * Same wrapper class, so the 3px gaps and the rounded outer ends come from
 * styles/app.css; only the segment colours become placeholder blocks.
 *
 *   .share-bar  11px tall, gap 3
 *
 * The shares are arbitrary but uneven on purpose: five equal blocks read as
 * a progress bar rather than as a breakdown. The end caps are set inline
 * because the stylesheet rounds `.share-bar > div` and a <Skeleton> is a
 * <span>.
 */

const SHARES = [34, 22, 18, 14, 12];

export default function ShareBarSkeleton({ shimmerDuration }) {
  const last = SHARES.length - 1;

  return (
    <div className="share-bar" aria-hidden="true">
      {SHARES.map((share, i) => (
        <Skeleton
          key={i}
          shimmerDuration={shimmerDuration}
          style={{
            flex: share,
            borderRadius:
              i === 0 ? "6px 0 0 6px" : i === last ? "0 6px 6px 0" : 0,
          }}
        />
      ))}
    </div>
  );
}
