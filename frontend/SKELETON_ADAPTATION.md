# Task: wire the skeleton-loading system into Paise's screens

A skeleton-loading system was ported into this repo from another project and
adapted to Paise's stack (plain JSX, no animation library, plain CSS with the
`styles/tokens.css` palette). The **primitives and two reference silhouettes
are done and are not to be redesigned**. What is missing is the part that
depends on this app's data layout: which screens show a skeleton, for which
data, and what each silhouette looks like.

Do that wiring.

---

## What already exists (read these first)

| File | What it is |
| --- | --- |
| `components/Skeleton.jsx` | `<Skeleton>`, `<SkeletonReveal>`, `<SkeletonSwap>` |
| `styles/skeleton.css` | shimmer + mask-wipe animations, stacking, reduced-motion (already `@import`ed from `styles/app.css`) |
| `components/skeletons/InsightCardSkeleton.jsx` | reference silhouette for `<InsightCard>` |
| `components/skeletons/StatPairSkeleton.jsx` | reference silhouette for `<StatPair>` |

### The pattern in one block

```jsx
import { SkeletonSwap } from "@/components/Skeleton";
import InsightCardSkeleton from "@/components/skeletons/InsightCardSkeleton";

<SkeletonSwap loaded={status === "ready"} skeleton={<InsightCardSkeleton />}>
  <InsightCard {...insight} />
</SkeletonSwap>
```

`SkeletonSwap` stacks both layers in one grid cell, runs a 1.3s mask wipe that
reveals the real content, and keeps the skeleton mounted until that wipe has
finished painting. Use it unless you specifically need `Skeleton` /
`SkeletonReveal` on their own.

---

## Non-negotiable invariants

These are the things that were expensive to get right. Do not "simplify" them.

1. **The skeleton must not unmount at `loaded`.** It unmounts when the wipe
   *finishes* (`SkeletonSwap` already tracks this via `onRevealed`). Dropping it
   at `loaded` leaves a blank gap for the full 1.3s of the wipe. If you hand-roll
   with `SkeletonReveal`, replicate the `revealed` state.
2. **Real content needs an opaque background.** The wipe reveals content
   *over* the skeleton; a transparent card shows the shimmer through it. Every
   Paise card class already sets `--surface` / `--surface-raised` — if you build
   a new wrapper, give it one.
3. **No opacity/blur/transform animation on the revealed content.** The mask's
   alpha ramp *is* the fade. Stacking a second fade on top reads as a double
   animation.
4. **The mask is dropped once open** (`.skel-reveal--done`) — a permanently
   applied CSS mask clips descendants that do their own 3D transforms. Keep it.
5. **The silhouette must match the real layout box-for-box.** Same wrapper
   element, same classes, same padding/gap/margins; only the text is swapped for
   sized bars. Any mismatch shows up as a jump at the moment of reveal — the one
   thing this whole system exists to avoid. See the metric tables in the two
   reference silhouettes; the numbers come from `styles/app.css` (e.g.
   `.h-card` is `21px/1.28` → `26.88px` per line, `.body-text` `13.5px/1.5` →
   `20.25px`). Watch for line-height inherited from `body` and for UA margins on
   `<h2>` (`.h-card` does **not** reset them) — that is why the reference
   silhouette reuses the real `<h2 className="h-card">` rather than a `<div>`.
6. **Silhouettes are `aria-hidden="true"`** and contain no text.
7. **No animation library.** Everything is CSS + one `animationend` listener.
   Do not add `motion`, `framer-motion`, or GSAP for this.
8. **Colors come from tokens.** `--track` for the block, a `--surface`-tinted
   highlight for the sweep. Never a hardcoded grey or a `rgba(255,255,255,…)`
   wash — this app is a light, warm canvas, not a dark UI.

---

## Paise's data layout — what actually loads

`lib/store.jsx` (`usePaise()`) is the only async surface on the client:

```js
const { userData, insights, status, error, money, settings } = usePaise();
```

* `status` — `"loading" | "ready" | "error"`, **covers `userData` only**.
  Fetched once on mount from `GET /api/user-data` (`lib/api.js`).
* `userData` — `null` until ready. Shape (see `backend/server.js`
  `MOCK_USER_DATA`):
  `netWorth`, `netWorthChangeThisMonth`, `safeToSpend`, `safeToSpendUntil`,
  `spentThisMonth`, `monthlyBudget`, `spentVsLastMonth`,
  `netWorthMilestones{currentAge, progressPct, milestones[]}`,
  `monthEndForecast{remaining, until, basis}`,
  `categories[{slug, name, amount, payments, pct}]`,
  `recentTransactions[{merchant, amount, date, method}]`,
  `connectedAccounts[{name, provider, status, syncedAgo}]`.
* `insights` — `[]` until `GET /api/insights?tone=` resolves, and **refetched
  whenever `settings.tone` changes**. It has *no* status flag, so an empty array
  currently means both "still loading" and "failed". Add an `insightsStatus`
  (`"loading" | "ready" | "error"`) to the store alongside the existing fetch
  effect and expose it — the insight-card skeletons need it, including on the
  tone-change refetch.
* Everything imported from `@/data/mock` (`PROFILE`, `PORTFOLIO`, `HOLDINGS`,
  `ACTIVE_SIPS`, `GOALS`, `TX_DETAIL`, `MONEY_IN`, `FEATURE`, …) is a **static
  import — it is never loading**. Do not put a skeleton in front of it.

### Screens and what they wait on

| Screen | Waits on | Currently shows while waiting |
| --- | --- | --- |
| `screens/Home.jsx` | `userData` (StatPair), `insights` (card stack) | `"— — —"` placeholder values; an empty card stack |
| `screens/Money.jsx` | `userData` — figures, `categories`, `recentTransactions`, milestone bar | `"— — —"`; empty lists |
| `screens/Invest.jsx` | `userData.monthEndForecast.remaining`, `userData.netWorth`; rest is mock | mixed |
| `screens/Settings.jsx` | `userData.connectedAccounts` | empty account list |
| `screens/Connect.jsx` | account/connection state | — |

---

## What to do

1. **Add `insightsStatus` to `lib/store.jsx`** as described above.
2. **Build one silhouette per real component that can render empty**, in
   `components/skeletons/`, named `<Component>Skeleton.jsx`, following the two
   references exactly in style: real classes, metric constants at the top with a
   comment naming their source in `styles/app.css`. At minimum you will need
   silhouettes for the category rows, the recent-transaction rows, the
   connected-account rows and the milestone/progress bar; audit the screens and
   add whatever else renders empty.
3. **Wire `SkeletonSwap` into the screens** in the table above, driven by
   `status` / `insightsStatus` — not by `userData == null`, which cannot tell
   loading from error apart.
4. **Replace the `"— — —"` fallbacks** that a skeleton now covers. Leave the
   ones that mean privacy-masked (`money()` under `settings.privacyMode` returns
   `MASK`) — that is a different state and must keep working.
5. **Leave the error path alone.** `status === "error"` keeps rendering the
   existing `.load-error` block; never show a skeleton that shimmers forever
   behind a failed fetch.
6. **Repeated rows:** render 3–5 skeleton rows, and pass a per-row
   `shimmerDuration` jitter (e.g. `1.4 + i * 0.08`) so a list does not pulse in
   lockstep.
7. **Guard the flash.** The API is usually localhost, so `status` can flip in
   ~10ms and the skeleton appears as a blink. Add a small shared hook (e.g.
   `lib/useMinDuration.js`) that holds `loaded` false for a floor of ~400ms from
   mount, and drive the swaps through it. One hook, used everywhere — not a
   `setTimeout` copy-pasted into each screen.

## Done when

* Cold-loading any wired screen shows a silhouette that is the same size and
  shape as the content that replaces it — no reflow, no jump, verified by
  throttling the network (or adding a temporary delay in `backend/server.js`).
* Flipping tone in Settings re-skeletons the insight cards rather than blanking
  them.
* Killing the backend still shows the existing error block, with no skeleton
  left shimmering.
* `prefers-reduced-motion: reduce` gives a clean cut with no shimmer loop.
* No new dependency in `frontend/package.json`.
