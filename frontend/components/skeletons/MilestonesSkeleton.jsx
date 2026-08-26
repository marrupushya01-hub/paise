"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Silhouette of the net-worth milestone bar on Money. The track is already
 * `--track` coloured at rest, so the placeholder is the same 7px bar and the
 * four labels below it.
 *
 *   .milestone-track   7px tall, radius 4
 *   .milestone-labels  margin-top 9, space-between
 *   .milestone-labels span 9.5px/1.5 → 14.25px per line
 */

const TRACK_H = 7;
const LABEL_LINE = 14.25;
const LABEL_WIDTHS = [74, 62, 66, 58];

export default function MilestonesSkeleton({ shimmerDuration }) {
  return (
    <section className="milestones" aria-hidden="true">
      <Skeleton
        shimmerDuration={shimmerDuration}
        style={{ height: TRACK_H, borderRadius: 4 }}
      />
      <div className="milestone-labels">
        {LABEL_WIDTHS.map((width, i) => (
          <span key={i} className="skel-line-box" style={{ height: LABEL_LINE }}>
            <Skeleton
              className="skel--line"
              shimmerDuration={shimmerDuration}
              style={{ width, height: 8 }}
            />
          </span>
        ))}
      </div>
    </section>
  );
}
