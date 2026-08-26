"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * Skeleton-loading building blocks. Three pieces:
 *
 * 1. <Skeleton />      — a shimmering placeholder block.
 * 2. <SkeletonReveal /> — mask-wipe that reveals real content over a
 *                         skeleton once `loaded` flips true. The mask's
 *                         alpha ramp IS the fade; the content itself gets
 *                         no opacity/blur animation.
 * 3. <SkeletonSwap />   — the two of them stacked, plus the two bits of
 *                         bookkeeping that keep the seam invisible: the
 *                         column is resized to the real content's box
 *                         before the wipe starts, and the silhouette stays
 *                         mounted until the wipe has finished painting
 *                         over it. Use this unless you need the pieces
 *                         separately.
 *
 *   <SkeletonSwap loaded={status === "ready"} skeleton={<InsightCardSkeleton />}>
 *     <InsightCard {...insight} />
 *   </SkeletonSwap>
 *
 * Shape, then reveal. A silhouette is a guess — it cannot know how many
 * lines the real headline will wrap to or how many buttons the card will
 * carry — so `SkeletonSwap` measures both layers the moment the data lands,
 * animates the column from the silhouette's height to the content's, and
 * only then runs the wipe. Without that step whatever the guess got wrong
 * hangs out below the content for the whole wipe and snaps away at the end,
 * which is the one thing this system exists to avoid.
 *
 * Real content needs an opaque background (`--surface` / `--surface-raised`,
 * which every card class already sets) so it occludes the skeleton as the
 * mask opens. All animation lives in styles/skeleton.css — no motion
 * library, and `prefers-reduced-motion` collapses both the settle and the
 * wipe to ~0 while still firing the events that drive the state below.
 */

// Next renders these on the server too, where the layout pass never runs.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Skeleton({ className = "", style, shimmerDuration, ...rest }) {
  return (
    <span
      aria-hidden="true"
      className={`skel ${className}`.trim()}
      style={
        shimmerDuration
          ? { "--skel-shimmer": `${shimmerDuration}s`, ...style }
          : style
      }
      {...rest}
    />
  );
}

export function SkeletonReveal({
  loaded,
  // Mounts the content behind a still-closed mask. `SkeletonSwap` uses this
  // to measure the real box before deciding what to animate the column to;
  // on its own the component doesn't need it.
  armed = false,
  children,
  className = "",
  onRevealed,
  ref,
}) {
  // Mount-time `loaded` skips the wipe entirely (data was already there);
  // only a later flip animates.
  const [phase, setPhase] = useState(() => (loaded ? "shown" : "hidden"));
  const mounted = useRef(false);
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (loaded) onRevealedRef.current?.();
      return;
    }
    setPhase((p) => {
      if (loaded) return p === "shown" ? "shown" : "enter";
      return p === "hidden" ? "hidden" : "exit";
    });
  }, [loaded]);

  if (phase === "hidden" && !armed) return null;

  // Once the wipe finishes the mask is dropped rather than left applied at
  // "fully open" forever: a permanent CSS mask clips anything inside that
  // does its own 3D transform, so it can only be scaffolding for the
  // transition, never a permanent style.
  const phaseClass = {
    hidden: "", // armed: base state, mask closed, nothing painted yet
    enter: "skel-reveal--enter",
    exit: "skel-reveal--exit",
    shown: "skel-reveal--done",
  }[phase];

  return (
    <div
      ref={ref}
      // Mounted but wholly masked while the column resizes around it.
      // Invisible content must not be tabbable or read out.
      inert={phase === "hidden" || undefined}
      className={["skel-reveal", phaseClass, className]
        .filter(Boolean)
        .join(" ")}
      onAnimationEnd={(e) => {
        // Shimmer animations from the children bubble up here too.
        if (e.target !== e.currentTarget) return;
        if (e.animationName === "skel-wipe-in") {
          setPhase("shown");
          onRevealedRef.current?.();
        } else if (e.animationName === "skel-wipe-out") {
          setPhase("hidden");
        }
      }}
    >
      {children}
    </div>
  );
}

const SettleGroupContext = createContext(null);

/**
 * Optional coordinator for a column of <SkeletonSwap>s that land together.
 *
 * Each member measures its own settle, but they all clock their wipe off the
 * slowest one, so the column changes shape as a single move and only then
 * reveals top-down. Without the shared clock a card that had a line's worth
 * of correction to make starts its wipe *after* cards that had none, and the
 * column fills in out of order — which is the opposite of what the stagger
 * is for.
 *
 * A <SkeletonSwap> outside a group settles and reveals on its own clock.
 */
export function SkeletonGroup({ children }) {
  const [group] = useState(() => {
    let batch = [];
    let flush = null;
    return {
      claim(settleMs, begin) {
        batch.push({ settleMs, begin });
        // Members claim from their layout effects, all within one commit;
        // a frame later the batch is complete and the longest is known.
        if (flush === null) {
          flush = requestAnimationFrame(() => {
            flush = null;
            const members = batch;
            batch = [];
            const longest = members.reduce(
              (a, m) => Math.max(a, m.settleMs),
              0,
            );
            members.forEach((m) => m.begin(longest));
          });
        }
      },
    };
  });

  return (
    <SettleGroupContext.Provider value={group}>
      {children}
    </SettleGroupContext.Provider>
  );
}

const SETTLE_MS = 360;

export function SkeletonSwap({
  loaded,
  skeleton,
  children,
  className = "",
  // Holds the wipe back after the column has settled. Siblings that land
  // together pass an increasing delay so the column reveals top-down
  // instead of every card flashing on the same frame. The settle itself is
  // never delayed: the layout lands in one move, and only the paint is
  // sequenced.
  delay = 0,
  settleDuration = SETTLE_MS,
}) {
  // Two flags, both downstream of `loaded`:
  //   open     — the column has settled; the wipe may start.
  //   revealed — the wipe has finished painting; the silhouette can go.
  // `loaded` itself arms the content: it mounts behind a closed mask in the
  // same commit, so there is a box to measure on the very next layout pass
  // rather than a frame later. Unmounting the silhouette at `loaded` instead
  // leaves a blank gap for the ~1.3s the wipe takes.
  const [open, setOpen] = useState(() => loaded);
  const [revealed, setRevealed] = useState(() => loaded);

  const stackRef = useRef(null);
  const skeletonRef = useRef(null);
  const contentRef = useRef(null);
  // The settle is a one-shot per load. Without this, a re-run (React's
  // double-invoked effects in development) snaps the column back to the
  // silhouette's height and replays the animation.
  const settled = useRef(loaded);
  const group = useContext(SettleGroupContext);

  useIsomorphicLayoutEffect(() => {
    if (loaded) return;
    settled.current = false;
    setOpen(false);
    setRevealed(false);
  }, [loaded]);

  useIsomorphicLayoutEffect(() => {
    if (!loaded || settled.current) return undefined;
    settled.current = true;

    const stack = stackRef.current;
    const content = contentRef.current;
    if (!stack || !content) {
      setOpen(true);
      return undefined;
    }

    // Both layers keep their natural height (`.skel-stack` aligns to start),
    // so these are the two real boxes rather than the grid row they share.
    const from = skeletonRef.current?.offsetHeight ?? 0;
    const to = content.offsetHeight;

    const reduced = prefersReducedMotion();
    const settleMs = reduced || Math.abs(to - from) < 1 ? 0 : settleDuration;

    // Clamp the column for the whole reveal, not just the settle: the
    // silhouette is usually the taller of the two, and the part the guess
    // got wrong would otherwise sit under the card shimmering away for the
    // length of the wipe.
    stack.style.setProperty("--skel-settle", `${settleMs}ms`);
    stack.dataset.settling = "true";
    stack.style.height = `${from || to}px`;
    // Commits the clamp and the transition together, so only the next
    // assignment animates.
    void stack.offsetHeight;
    stack.style.height = `${to}px`;

    // `settleWindow` is the whole column's settle, not just this stack's:
    // a stack with nothing to resize still waits for the one that has, so
    // the wipes stay in order. Outside a group it is this stack's own.
    // A group answers a frame later, which can land after this effect has
    // been torn down — hence the flag rather than a bare timer handle.
    let alive = true;
    let handle = null;
    const begin = (settleWindow) => {
      if (!alive) return;
      const waitMs = reduced ? 0 : delay + settleWindow;
      if (waitMs === 0) {
        setOpen(true);
        return;
      }
      handle = setTimeout(() => setOpen(true), waitMs);
    };

    if (group) group.claim(settleMs, begin);
    else begin(settleMs);

    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [loaded, delay, settleDuration, group]);

  // Released only once the silhouette is gone, so the height the clamp was
  // holding and the height the content gives are the same number and there
  // is nothing left to jump.
  useIsomorphicLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack || !revealed) return;
    stack.style.height = "";
    stack.style.removeProperty("--skel-settle");
    delete stack.dataset.settling;
  }, [revealed]);

  return (
    <div ref={stackRef} className={`skel-stack ${className}`.trim()}>
      {!revealed && (
        <div ref={skeletonRef} className="skel-stack__layer">
          {skeleton}
        </div>
      )}
      <SkeletonReveal
        ref={contentRef}
        armed={loaded}
        loaded={open}
        onRevealed={() => setRevealed(true)}
      >
        {children}
      </SkeletonReveal>
    </div>
  );
}
