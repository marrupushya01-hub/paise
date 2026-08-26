"use client";

import { useEffect, useRef, useState } from "react";

// The API is normally localhost, so `status` can flip in ~10ms and a skeleton
// shows up as a blink. This holds `loaded` false until a floor has passed
// since the screen mounted, so a silhouette is either absent or readable —
// never a flash.
//
// One hook for every swap on a screen: they share a mount time, so they all
// clear the floor on the same frame instead of popping in one by one.
const FLOOR_MS = 400;

export function useMinDuration(loaded, floor = FLOOR_MS) {
  const mountedAt = useRef(null);
  if (mountedAt.current === null) mountedAt.current = Date.now();

  const [floorPassed, setFloorPassed] = useState(
    () => Date.now() - mountedAt.current >= floor
  );

  useEffect(() => {
    if (floorPassed) return undefined;
    const remaining = floor - (Date.now() - mountedAt.current);
    if (remaining <= 0) {
      setFloorPassed(true);
      return undefined;
    }
    const timer = setTimeout(() => setFloorPassed(true), remaining);
    return () => clearTimeout(timer);
  }, [floorPassed, floor]);

  return loaded && floorPassed;
}
