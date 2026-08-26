"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InsightCard from "@/components/InsightCard";
import AppShell from "@/components/AppShell";
import ScreenHeader from "@/components/ScreenHeader";
import ShareBar from "@/components/ShareBar";
import StatPair from "@/components/StatPair";
import { SkeletonGroup, SkeletonSwap } from "@/components/Skeleton";
import AccountRowSkeleton from "@/components/skeletons/AccountRowSkeleton";
import CategoryRowSkeleton from "@/components/skeletons/CategoryRowSkeleton";
import HeroAmountSkeleton from "@/components/skeletons/HeroAmountSkeleton";
import MilestonesSkeleton from "@/components/skeletons/MilestonesSkeleton";
import ShareBarSkeleton from "@/components/skeletons/ShareBarSkeleton";
import StatPairSkeleton from "@/components/skeletons/StatPairSkeleton";
import TxRowSkeleton from "@/components/skeletons/TxRowSkeleton";
import {
  CATEGORY_COLORS,
  MONEY_IN,
  MONEY_INSIGHTS,
  TX_DETAIL,
} from "@/data/mock";
import { pct, shortDate, signedRupees } from "@/lib/format";
import { useDismissed } from "@/lib/useDismissed";
import { useMinDuration } from "@/lib/useMinDuration";
import { usePaise } from "@/lib/store";

// Rows to draw while the fetch is in flight, per list.
//
// These are *resting* counts, deliberately short of what the payload
// usually carries. A list's height belongs to its data, and none of it is
// known yet — so rather than hardcode a guess that happens to match today's
// payload and silently breaks when it returns eight transactions instead of
// six, the silhouette shows a short representative list and the settle
// grows it into the real one. The shape resolving is the point: it reads as
// the section taking its size, and it is correct for any count.
//
// Sections whose height the design fixes (the hero figure, the milestones
// bar, the figure pairs) draw themselves exactly and never settle.
const TX_ROWS_RESTING = 4;
const CATEGORY_ROWS_RESTING = 3;

// The account list is three kinds of row, not one repeated: a connected
// account (meta line + status dot), each of the first two still waiting
// (one line + Connect button), and a summary row for whatever is left. The
// resting silhouette shows the first three of those.
const ACCOUNT_SHAPES_RESTING = [
  { meta: true, aside: "dot" },
  { meta: true, aside: "dot" },
  { meta: false, aside: "pill" },
];

// Sections reveal in reading order rather than all on the same frame. Same
// step as Home, so the two screens read as one app. The settle that precedes
// them is shared across the whole screen (see <SkeletonGroup> below), so a
// section that has to resize can't jump the queue.
const REVEAL_STEP = 110;
const REVEAL = {
  hero: 0,
  milestones: REVEAL_STEP,
  figures: REVEAL_STEP * 2,
  list: REVEAL_STEP * 3,
  side: REVEAL_STEP * 4,
};

// A list that pulses in lockstep reads as one object; the jitter keeps the
// rows reading as rows.
const shimmer = (i) => 1.4 + i * 0.08;

// "64 payments" / "1 payment" / "7 autopays", matching the design's copy.
function paymentsLabel(category) {
  const noun = category.slug === "subscriptions" ? "autopay" : "payment";
  return `${category.payments} ${noun}${category.payments === 1 ? "" : "s"}`;
}

function monthName(iso, offset = 0) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString("en-IN", { month: "long" });
}

export default function Money({ initialTab = "flow" }) {
  const [tab, setTab] = useState(initialTab);
  const { userData, settings, status, togglePrivacyMode, money, openAsk } =
    usePaise();
  // `!== "loading"` so a failed fetch drops the skeleton instead of
  // shimmering behind an error that never resolves.
  const ready = useMinDuration(status !== "loading");

  const hidden = settings.privacyMode;
  const change = userData?.netWorthChangeThisMonth ?? 0;
  const previousNetWorth = (userData?.netWorth ?? 0) - change;
  const changePct = previousNetWorth ? (change / previousNetWorth) * 100 : 0;

  return (
    <AppShell tabBar>
      <ScreenHeader title="Money" />

      {/* One settle for the whole screen, then a single top-down reveal:
          without the shared clock the lists, which have the most shape to
          correct, start their wipe after the sections above them have
          finished theirs. */}
      <SkeletonGroup>
        <div className="screen-body">
          <SkeletonSwap
            loaded={ready}
            delay={REVEAL.hero}
            skeleton={<HeroAmountSkeleton />}
          >
            <section>
              <div className="eyebrow">net worth</div>
              <div className="hero-amount">
                <div className="hero-amount__value">
                  {userData ? money(userData.netWorth) : "— — —"}
                </div>
                <button
                  type="button"
                  className="hero-amount__toggle"
                  onClick={togglePrivacyMode}
                >
                  {hidden ? "SHOW" : "HIDE"}
                </button>
              </div>
              <div className="delta-row">
                <span
                  className={`delta-chip${changePct < 0 ? " delta-chip--down" : ""}`}
                >
                  {pct(changePct)}
                </span>
                <span className="delta-note">{money(change)} this month</span>
              </div>
            </section>
          </SkeletonSwap>

          <SkeletonSwap
            loaded={ready}
            delay={REVEAL.milestones}
            skeleton={<MilestonesSkeleton />}
          >
            <Milestones milestones={userData?.netWorthMilestones} />
          </SkeletonSwap>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "flow"}
              className={`tab${tab === "flow" ? " is-active" : ""}`}
              onClick={() => setTab("flow")}
            >
              Cash flow
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "insights"}
              className={`tab${tab === "insights" ? " is-active" : ""}`}
              onClick={() => setTab("insights")}
            >
              Insights
            </button>
          </div>

          {tab === "flow" ? (
            <CashFlow
              userData={userData}
              money={money}
              hidden={hidden}
              openAsk={openAsk}
              ready={ready}
            />
          ) : (
            <Insights
              userData={userData}
              money={money}
              openAsk={openAsk}
              ready={ready}
            />
          )}
        </div>
      </SkeletonGroup>
    </AppShell>
  );
}

function Milestones({ milestones }) {
  if (!milestones) return null;
  const { currentAge, progressPct, milestones: points } = milestones;

  return (
    <section className="milestones">
      <div className="milestone-track">
        <div
          className="milestone-track__fill"
          style={{ width: `${progressPct}%` }}
        />
        <div
          className="milestone-track__knob"
          style={{ left: `${progressPct}%` }}
        />
      </div>
      <div className="milestone-labels">
        <span className="is-now">TODAY · {currentAge}</span>
        {points.map((point) => (
          <span key={point.label}>
            {point.label.toUpperCase()} · {point.projectedAge}
          </span>
        ))}
      </div>
    </section>
  );
}

function CashFlow({ userData, money, hidden, openAsk, ready }) {
  const router = useRouter();
  const [openTx, setOpenTx] = useState(null);

  const transactions = (userData?.recentTransactions || []).map((tx, i) => ({
    ...tx,
    ...(TX_DETAIL[tx.merchant] || {}),
    index: i,
    initial: TX_DETAIL[tx.merchant]?.initial || tx.merchant[0],
    color: TX_DETAIL[tx.merchant]?.color || "#3b3733",
  }));

  const accounts = userData?.connectedAccounts || [];
  const connected = accounts.filter((a) => a.status === "connected");
  const pending = accounts.filter((a) => a.status !== "connected");
  const [firstPending, secondPending, ...restPending] = pending;

  return (
    <div className="split">
      <div className="col-main">
        <SkeletonSwap
          loaded={ready}
          delay={REVEAL.figures}
          skeleton={<StatPairSkeleton tight />}
        >
          <StatPair
            tight
            left={{
              label: "money in",
              value: money(MONEY_IN.amount),
              note: MONEY_IN.note,
              noteTone: "up",
            }}
            right={{
              label: "safe to spend",
              value: userData ? money(userData.safeToSpend) : "— — —",
              note: userData
                ? `till ${shortDate(userData.safeToSpendUntil)}`
                : undefined,
            }}
          />
        </SkeletonSwap>

        <section>
          <div className="section-head">
            <span className="eyebrow">recent</span>
            <span className="spacer" />
            <button type="button" className="section-link" onClick={openAsk}>
              Ask about these ›
            </button>
          </div>

          <SkeletonSwap
            loaded={ready}
            delay={REVEAL.list}
            skeleton={
              <div>
                {Array.from({ length: TX_ROWS_RESTING }, (_, i) => (
                  <TxRowSkeleton
                    key={i}
                    index={i}
                    shimmerDuration={shimmer(i)}
                  />
                ))}
              </div>
            }
          >
            <div>
              {transactions.map((tx) => {
                const isOpen = openTx === tx.index;
                return (
                  <div className="tx" key={`${tx.merchant}-${tx.index}`}>
                    <button
                      type="button"
                      className="tx__button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenTx(isOpen ? null : tx.index)}
                    >
                      <span
                        className="tx__avatar"
                        style={{ background: tx.color }}
                      >
                        {tx.initial}
                      </span>
                      <span className="tx__body">
                        <span className="tx__name">{tx.merchant}</span>
                        <span className="tx__meta">{tx.meta || tx.method}</span>
                      </span>
                      <span
                        className={`tx__amount${tx.amount > 0 ? " tx__amount--credit" : ""}`}
                      >
                        {hidden ? money(tx.amount) : signedRupees(tx.amount)}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="tx__detail">
                        <div className="tx__detail-grid">
                          <span style={{ flex: 1 }}>
                            <span className="tx__detail-label">category</span>
                            <span className="tx__detail-value">
                              <span
                                className="tx__swatch"
                                style={{ background: tx.color }}
                              />
                              {tx.category}
                            </span>
                          </span>
                          <span style={{ flex: 1 }}>
                            <span className="tx__detail-label">paid from</span>
                            <span className="tx__detail-value">
                              {tx.account}
                            </span>
                          </span>
                        </div>
                        <div className="tx__note">{tx.note}</div>
                        <div className="card__actions">
                          <button
                            type="button"
                            className="pill-dark pill-dark--sm"
                            onClick={openAsk}
                          >
                            Ask about this
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SkeletonSwap>
        </section>
      </div>

      <section className="col-side">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          connected
        </div>
        <SkeletonSwap
          loaded={ready}
          delay={REVEAL.side}
          skeleton={
            <div>
              {ACCOUNT_SHAPES_RESTING.map((shape, i) => (
                <AccountRowSkeleton
                  key={i}
                  index={i}
                  {...shape}
                  shimmerDuration={shimmer(i)}
                />
              ))}
            </div>
          }
        >
          <div>
            {connected.map((account) => (
              <div className="list-row" key={account.name}>
                <div className="list-row__body">
                  <div className="list-row__name">{account.name}</div>
                  <div className="list-row__meta">
                    {account.provider} · synced {account.syncedAgo} ago
                  </div>
                </div>
                <span className="status-dot" />
              </div>
            ))}
            {[firstPending, secondPending].filter(Boolean).map((account) => (
              <div className="list-row" key={account.name}>
                <span className="list-row__name" style={{ flex: 1 }}>
                  {account.name}
                </span>
                <button
                  type="button"
                  className="pill-dark pill-dark--sm"
                  onClick={() => router.push("/connect")}
                >
                  Connect
                </button>
              </div>
            ))}
            {restPending.length > 0 && (
              <div className="list-row">
                <span className="list-row__name" style={{ flex: 1 }}>
                  {restPending.map((a) => a.name).join(" · ")}
                </span>
                <span className="list-row__aside">
                  {restPending.length} more
                </span>
              </div>
            )}
          </div>
        </SkeletonSwap>
      </section>
    </div>
  );
}

function Insights({ userData, money, openAsk, ready }) {
  const dismissed = useDismissed();
  const categories = userData?.categories || [];
  const spent = userData?.spentThisMonth ?? 0;
  const budget = userData?.monthlyBudget ?? 0;
  const vsLast = userData?.spentVsLastMonth ?? 0;
  const lastMonth = spent - vsLast;
  const spentPct = lastMonth ? (vsLast / lastMonth) * 100 : 0;
  const until = userData?.safeToSpendUntil;

  return (
    <div className="split">
      <div className="col-main">
        <SkeletonSwap
          loaded={ready}
          delay={REVEAL.figures}
          skeleton={<StatPairSkeleton tight />}
        >
          <StatPair
            tight
            left={{
              label: `spent in ${monthName(until)}`,
              value: userData ? money(spent) : "— — —",
              note: userData
                ? `${spentPct >= 0 ? "+" : "−"}${Math.abs(Math.round(spentPct))}% vs ${monthName(
                    until,
                    -1,
                  )}`
                : undefined,
              noteTone: spentPct >= 0 ? "down" : "up",
            }}
            right={{
              label: "budget left",
              value: userData ? money(budget - spent) : "— — —",
              note: userData ? `of ${money(budget)}` : undefined,
            }}
          />
        </SkeletonSwap>

        <section>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            where it went
          </div>
          <SkeletonSwap
            loaded={ready}
            delay={REVEAL.list}
            skeleton={
              <div>
                <ShareBarSkeleton />
                <div style={{ marginTop: 14 }}>
                  {Array.from({ length: CATEGORY_ROWS_RESTING }, (_, i) => (
                    <CategoryRowSkeleton
                      key={i}
                      index={i}
                      shimmerDuration={shimmer(i)}
                    />
                  ))}
                </div>
              </div>
            }
          >
            <div>
              <ShareBar
                segments={categories.map((c) => ({
                  key: c.slug,
                  share: c.pct,
                  color: CATEGORY_COLORS[c.slug] || "var(--muted-2)",
                }))}
              />
              <div style={{ marginTop: 14 }}>
                {categories.map((category) => (
                  <div
                    className="list-row"
                    style={{ padding: "12px 0" }}
                    key={category.slug}
                  >
                    <span
                      className="swatch"
                      style={{
                        background:
                          CATEGORY_COLORS[category.slug] || "var(--muted-2)",
                      }}
                    />
                    <div className="list-row__body">
                      <div className="list-row__name">{category.name}</div>
                      <div className="list-row__meta">
                        {paymentsLabel(category)}
                      </div>
                    </div>
                    <div className="list-row__right">
                      <div className="list-row__amount">
                        {money(category.amount)}
                      </div>
                      <div className="list-row__pct">{category.pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SkeletonSwap>
        </section>
      </div>

      <div className="col-side">
        {dismissed.keep(MONEY_INSIGHTS).map((insight) => (
          <InsightCard
            key={insight.id}
            date={insight.date}
            headline={insight.headline}
            body={insight.body}
            actions={insight.actions.map((label, i) => ({
              label,
              onClick: i === 0 ? openAsk : () => dismissed.dismiss(insight.id),
            }))}
          />
        ))}
      </div>
    </div>
  );
}
