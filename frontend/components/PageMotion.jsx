"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Route transitions. Screens remount on navigation, so there is no old tree
 * to animate out — the incoming screen animates in, and the direction it
 * comes from says what kind of move it was.
 *
 * Two lanes of peer screens. Moving inside a lane slides the way you're
 * going, so Home → Money enters from the right and Money → Home from the
 * left. Leaving a lane (the avatar into Settings) is a push from further
 * out; coming back is a pop from the other side.
 *
 * This wraps screen content only, never the tab bar, sidebar or Ask sheet:
 * an animated `transform` on an ancestor would make their `position: fixed`
 * resolve against this element instead of the viewport.
 */
const LANES = [
  ["/", "/money", "/invest"],
  ["/login", "/otp", "/profile", "/connect", "/empty"],
];

function laneOf(path) {
  for (const lane of LANES) {
    const index = lane.indexOf(path);
    if (index !== -1) return { lane, index };
  }
  return null;
}

function directionFrom(previous, next) {
  if (previous === null || previous === next) return "in";
  const from = laneOf(previous);
  const to = laneOf(next);
  if (from && to && from.lane === to.lane) return to.index > from.index ? "next" : "prev";
  if (!to) return "push"; // into a screen off the map: Settings
  if (!from) return "pop"; // and back out of it
  return "in"; // lane to lane — no shared axis to slide along
}

// Module scope on purpose: this component remounts with every route, so the
// previous path can't live in a ref. Keyed by path so a remount of the same
// route (StrictMode, a re-render of the shell) replays the same direction
// instead of inventing a new one.
let last = { path: null, dir: "in" };

function resolve(path) {
  // Never on the server: module state there is shared between requests, so
  // it would hand one visitor a direction computed from another's route and
  // mismatch what the client renders. A document load is always "in".
  if (typeof window === "undefined") return "in";
  if (last.path === path) return last.dir;
  last = { path, dir: directionFrom(last.path, path) };
  return last.dir;
}

export default function PageMotion({ children }) {
  const pathname = usePathname();
  const [dir] = useState(() => resolve(pathname));

  return (
    <div className="page-motion" data-dir={dir}>
      {children}
    </div>
  );
}
