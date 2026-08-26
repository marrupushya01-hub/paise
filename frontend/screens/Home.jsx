"use client";

import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Amount from "@/components/Amount";
import Feature from "@/components/Feature";
import InsightCard from "@/components/InsightCard";
import ScreenHeader from "@/components/ScreenHeader";
import StatPair from "@/components/StatPair";
import { SkeletonGroup, SkeletonSwap } from "@/components/Skeleton";
import InsightCardSkeleton from "@/components/skeletons/InsightCardSkeleton";
import StatPairSkeleton from "@/components/skeletons/StatPairSkeleton";
import { cardDate, shortDate } from "@/lib/format";
import { useDismissed } from "@/lib/useDismissed";
import { useMinDuration } from "@/lib/useMinDuration";
import { usePaise } from "@/lib/store";

// Where each assistant card's primary action lands. "ask" opens the
// assistant instead of a route: for the cards that end in a question rather
// than a screen, the answer is the destination.
const ACTION_TARGET = {
  "food-weekend": "/money?tab=insights",
  "duplicate-charges": "/money?tab=insights",
  "sip-vs-fd": "ask",
};

// What the column looks like before the assistant has answered. Three slots
// because that is what the feed returns; the shapes differ per slot because
// the real cards do (the first one is the only one that offers a dismiss),
// and three identical silhouettes read as a loading graphic rather than as
// this screen arriving. If the feed comes back with fewer, the surplus
// silhouettes go at once instead of pretending there was something there.
//
// A card's height is its copy's, which nothing here has seen yet, so these
// rest one body line short of the usual card and settle into whatever the
// assistant actually wrote. See the note in screens/Money.jsx.
const PLACEHOLDER_CARDS = [
  { bodyLines: 1, actionWidths: [116, 88] },
  { bodyLines: 1, actionWidths: [148] },
  { bodyLines: 1, actionWidths: [122] },
];

// The whole column settles to its real height in one move; only the paint is
// sequenced, top-down, so the screen reads as filling in rather than as three
// cards flashing on the same frame.
const FIGURES_DELAY = 0;
const CARD_DELAY = 90;
const CARD_STAGGER = 110;

export default function Home() {
  const router = useRouter();
  const { userData, insights, insightsStatus, status, error, money, openAsk } =
    usePaise();
  const dismissed = useDismissed();

  // `!== "loading"` rather than `=== "ready"`: a failed fetch must drop the
  // skeleton and let the error block through, not shimmer forever.
  const figuresReady = useMinDuration(status !== "loading");
  const insightsReady = useMinDuration(insightsStatus !== "loading");

  // Only reached once the skeleton is gone, so these read as "the fetch came
  // back with nothing", not as "still loading".
  const netWorth = userData ? money(userData.netWorth) : "— — —";
  const safeToSpend = userData ? money(userData.safeToSpend) : "— — —";
  const change = userData?.netWorthChangeThisMonth;

  const visible = dismissed.keep(insights);

  return (
    <AppShell tabBar>
      <ScreenHeader wordmark title="Today" />

      {status === "error" && (
        <div className="load-error">
          Couldn&apos;t reach the Paise backend — {error}. Start it with{" "}
          <code>npm start</code> in <code>backend/</code>.
        </div>
      )}

      {/* One group: the figures band and the cards land on the same fetch,
          so they settle to their real shapes together and only then reveal,
          top-down. */}
      <SkeletonGroup>
        <div className="split">
          <div className="figures-band span-all">
            <SkeletonSwap
              loaded={figuresReady}
              delay={FIGURES_DELAY}
              skeleton={<StatPairSkeleton />}
            >
              <StatPair
                onClick={() => router.push("/money")}
                left={{
                  label: "net worth",
                  value: netWorth,
                  empty: !userData,
                  note: change ? `+${money(change)} this month` : undefined,
                  noteTone: "up",
                }}
                right={{
                  label: "safe to spend",
                  value: safeToSpend,
                  empty: !userData,
                  note: userData
                    ? `till ${shortDate(userData.safeToSpendUntil)}`
                    : undefined,
                }}
              />
            </SkeletonSwap>
          </div>

          <div className="col-main">
            <div className="card-stack">
              {/* Keyed by slot, not by insight id: the swap instance has to
                  survive the moment the data lands, or the silhouette
                  unmounts before it has anything to hand over to. */}
              {(insightsReady ? visible : PLACEHOLDER_CARDS).map((slot, i) => (
                <SkeletonSwap
                  key={i}
                  loaded={insightsReady}
                  delay={CARD_DELAY + i * CARD_STAGGER}
                  skeleton={
                    <InsightCardSkeleton
                      {...(PLACEHOLDER_CARDS[i] || PLACEHOLDER_CARDS.at(-1))}
                      shimmerDuration={1.4 + i * 0.08}
                    />
                  }
                >
                  {insightsReady && (
                    <InsightCard
                      date={cardDate(slot.date)}
                      headline={<Amount text={slot.headline} />}
                      body={slot.body}
                      actions={slot.actions.map((label, j) => ({
                        label,
                        onClick:
                          j === 0
                            ? () => {
                                const target = ACTION_TARGET[slot.id];
                                if (target === "ask") openAsk();
                                else router.push(target || "/money");
                              }
                            : () => dismissed.dismiss(slot.id),
                      }))}
                    />
                  )}
                </SkeletonSwap>
              ))}
            </div>
          </div>

          <div className="col-side">
            <Feature />
          </div>
        </div>
      </SkeletonGroup>
    </AppShell>
  );
}
