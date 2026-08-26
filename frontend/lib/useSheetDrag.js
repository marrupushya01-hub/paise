"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Drag physics for the Ask sheet. Two resting heights ("detents"): `peek` is
// the design's 94dvh, `full` is the whole viewport. Pull the handle up to
// expand, pull it down to collapse, keep pulling to dismiss.
//
// While a finger is down the sheet is driven straight through two custom
// properties instead of React state — one style write per frame, no renders.
// On release the inline values are dropped and CSS transitions the sheet to
// the detent.

const PEEK_RATIO = 0.94;
// How far below the peek edge a release still counts as "put it back".
const DISMISS_DISTANCE = 96;
// px/ms. A flick past this closes regardless of distance travelled.
const FLING = 0.5;
// Slop before a pull inside the thread is read as a drag and not a scroll.
const INTENT = 6;

function capture(e) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // Synthetic or already-released pointers; the window-level up still ends it.
  }
}

export function useSheetDrag({ enabled, onDismiss }) {
  const sheetRef = useRef(null);
  const [detent, setDetent] = useState("peek");
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  // A drag that starts on the grabber still ends in a click; this keeps the
  // release from toggling the detent the gesture just chose.
  const moved = useRef(false);

  const write = useCallback((height, offset) => {
    const el = sheetRef.current;
    if (!el) return;
    if (height == null) el.style.removeProperty("--sheet-h");
    else el.style.setProperty("--sheet-h", `${height}px`);
    if (offset == null) el.style.removeProperty("--drag-y");
    else el.style.setProperty("--drag-y", `${offset}px`);
  }, []);

  // A dismiss mid-gesture keeps the inline offset so the exit animation
  // starts from wherever the finger left the sheet.
  const clear = useCallback(() => write(null, null), [write]);

  useEffect(() => {
    if (!enabled) {
      drag.current = null;
      setDragging(false);
      setDetent("peek");
      clear();
    }
  }, [enabled, clear]);

  const begin = useCallback(
    (e, { downOnly, scroller }) => {
      if (!enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = sheetRef.current;
      if (!el) return;
      if (downOnly && scroller && scroller.scrollTop > 0) return;

      moved.current = false;
      const viewport = window.innerHeight;
      const startH = el.getBoundingClientRect().height;
      drag.current = {
        id: e.pointerId,
        downOnly,
        scroller,
        startY: e.clientY,
        startH,
        peekH: Math.round(viewport * PEEK_RATIO),
        fullH: viewport,
        height: startH,
        offset: 0,
        lastY: e.clientY,
        lastT: e.timeStamp,
        velocity: 0,
        // Handle drags own the pointer immediately; thread drags wait to see
        // whether the gesture is a pull or a scroll.
        active: !downOnly,
      };
      if (!downOnly) {
        capture(e);
        setDragging(true);
      }
    },
    [enabled]
  );

  const move = useCallback(
    (e) => {
      const g = drag.current;
      if (!g || e.pointerId !== g.id) return;

      if (!g.active) {
        const intent = e.clientY - g.startY;
        if (intent < INTENT) return;
        if (g.scroller && g.scroller.scrollTop > 0) {
          drag.current = null;
          return;
        }
        g.active = true;
        g.startY = e.clientY;
        g.startH = sheetRef.current?.getBoundingClientRect().height ?? g.startH;
        capture(e);
        setDragging(true);
        return;
      }

      const dy = e.clientY - g.startY;
      if (Math.abs(dy) > 3) moved.current = true;
      // Pulls that started in the thread only ever collapse, never expand.
      const desired = g.downOnly
        ? Math.min(g.startH - dy, g.startH)
        : g.startH - dy;

      let height;
      let offset = 0;
      if (desired >= g.fullH) {
        height = g.fullH;
      } else if (desired >= g.peekH) {
        height = desired;
      } else {
        height = g.peekH;
        offset = g.peekH - desired;
      }

      g.height = height;
      g.offset = offset;
      write(height, offset);

      const dt = e.timeStamp - g.lastT;
      if (dt > 0) {
        g.velocity = (e.clientY - g.lastY) / dt;
        g.lastY = e.clientY;
        g.lastT = e.timeStamp;
      }
    },
    [write]
  );

  const finish = useCallback(() => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    setDragging(false);
    if (!g.active) return;

    if (g.offset > 0) {
      if (g.offset > DISMISS_DISTANCE || g.velocity > FLING) {
        onDismiss();
        return;
      }
      setDetent("peek");
    } else {
      const span = g.fullH - g.peekH || 1;
      const progress = (g.height - g.peekH) / span;
      const settled =
        g.velocity < -0.25
          ? "full"
          : g.velocity > 0.25
            ? "peek"
            : progress > 0.5
              ? "full"
              : "peek";
      setDetent(settled);
    }
    clear();
  }, [clear, onDismiss]);

  // Safety net: if pointer capture didn't take, the release still lands here.
  useEffect(() => {
    const end = () => finish();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [finish]);

  const handleProps = {
    onPointerDown: (e) => begin(e, { downOnly: false }),
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: finish,
  };

  const threadProps = {
    onPointerDown: (e) =>
      begin(e, { downOnly: true, scroller: e.currentTarget }),
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: finish,
  };

  // The grabber is also a button: tap toggles, arrows step through detents.
  const expand = useCallback(() => setDetent("full"), []);
  const collapse = useCallback(
    () => setDetent((d) => (d === "full" ? "peek" : d)),
    []
  );
  const toggle = useCallback(() => {
    if (moved.current) return;
    setDetent((d) => (d === "full" ? "peek" : "full"));
  }, []);

  return {
    sheetRef,
    detent,
    dragging,
    handleProps,
    threadProps,
    expand,
    collapse,
    toggle,
  };
}
