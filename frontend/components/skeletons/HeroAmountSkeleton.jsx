"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of the Money screen's net-worth block: eyebrow, hero figure with
 * its HIDE toggle, and the delta row underneath. Real classes throughout so
 * the margins between the three come from styles/app.css:
 *
 *   .eyebrow            9.5px/1
 *   .hero-amount        margin-top 9, baseline-aligned
 *   .hero-amount__value 34px/1
 *   .delta-row          margin-top 8, gap 7
 *   .delta-chip         11px/1 + 4px padding → 19px tall
 *   .delta-note         12.5px/1
 */

const LABEL = 9.5;
const VALUE_LINE = 34;
const CHIP_H = 19;
const NOTE = 12.5;

export default function HeroAmountSkeleton({ shimmerDuration }) {
  return (
    <section aria-hidden="true">
      <Skeleton
        className="skel--line"
        shimmerDuration={shimmerDuration}
        style={{ width: 58, height: LABEL }}
      />
      <div className="hero-amount">
        <span className="skel-line-box" style={{ height: VALUE_LINE }}>
          <Skeleton
            className="skel--line"
            shimmerDuration={shimmerDuration}
            style={{ width: 196, height: 24 }}
          />
        </span>
      </div>
      <div className="delta-row">
        <Skeleton
          className="skel--pill"
          shimmerDuration={shimmerDuration}
          style={{ width: 48, height: CHIP_H }}
        />
        <Skeleton
          className="skel--line"
          shimmerDuration={shimmerDuration}
          style={{ width: 128, height: NOTE }}
        />
      </div>
    </section>
  );
}
