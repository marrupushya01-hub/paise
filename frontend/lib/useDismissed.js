"use client";

import { useCallback, useMemo, useState } from "react";

// "Not now" on an assistant card used to do nothing. It dismisses the card
// for the session instead — the one thing that label can honestly mean in a
// read-only app.
export function useDismissed() {
  const [ids, setIds] = useState(() => new Set());

  const dismiss = useCallback((id) => {
    setIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const keep = useCallback((list) => list.filter((item) => !ids.has(item.id)), [ids]);

  return useMemo(() => ({ dismiss, keep }), [dismiss, keep]);
}
