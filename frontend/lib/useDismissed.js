"use client";

import { useCallback, useMemo } from "react";
import { usePaise } from "@/lib/store";

// "Not now" on an assistant card used to do nothing, then dismissed the card
// for the session. It now dismisses it for the account: the id goes to
// /api/dismissed and the server filters that card out of every later response,
// on every device. A refresh no longer brings back a card you closed.
export function useDismissed() {
  const { dismissedIds, dismiss } = usePaise();

  const keep = useCallback(
    (list) => list.filter((item) => !dismissedIds.has(item.id)),
    [dismissedIds]
  );

  return useMemo(() => ({ dismiss, keep }), [dismiss, keep]);
}
