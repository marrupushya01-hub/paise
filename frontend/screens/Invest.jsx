"use client";

import InsightCard from "@/components/InsightCard";
import AppShell from "@/components/AppShell";
import ScreenHeader from "@/components/ScreenHeader";
import ShareBar from "@/components/ShareBar";
import StatPair from "@/components/StatPair";
import { Skeleton, SkeletonSwap } from "@/components/Skeleton";
import StatPairSkeleton from "@/components/skeletons/StatPairSkeleton";
import {
  ACTIVE_SIPS,
  GOALS,
  HOLDINGS,
  INVEST_INSIGHTS,
  PORTFOLIO,
} from "@/data/mock";
import { pct } from "@/lib/format";
import { useDismissed } from "@/lib/useDismissed";
import { useMinDuration } from "@/lib/useMinDuration";
import { usePaise } from "@/lib/store";

export default function Invest() {
  const { userData, settings, status, togglePrivacyMode, money, openAsk } =
    usePaise();
  const dismissed = useDismissed();
  const hidden = settings.privacyMode;
  const idleCash = userData?.monthEndForecast?.remaining;
  const ready = useMinDuration(status !== "loading");

  return (
    <AppShell tabBar>
      <ScreenHeader title="Invest" />

      <div className="screen-body screen-body--wide">
        <div className="split split--even">
          <section className="col-main">
            <div className="eyebrow">portfolio value</div>
            <div className="hero-amount">
              <div className="hero-amount__value">{money(PORTFOLIO.value)}</div>
              <button
                type="button"
                className="hero-amount__toggle"
                onClick={togglePrivacyMode}
              >
                {hidden ? "SHOW" : "HIDE"}
              </button>
            </div>
            <div className="delta-row">
              <span className="delta-chip">{pct(PORTFOLIO.returnPct)}</span>
              <span className="delta-note">
                {money(PORTFOLIO.gained)} gained on {money(PORTFOLIO.invested)}{" "}
                invested
              </span>
            </div>
          </section>

          <div className="col-side">
            {/* Only "idle cash" waits on the fetch, but the pair is one box —
                skeletoning half of it reads as a broken card. */}
            <SkeletonSwap loaded={ready} skeleton={<StatPairSkeleton tight />}>
              <StatPair
                tight
                left={{
                  label: "invested / mo",
                  value: money(PORTFOLIO.sipMonthly),
                  note: `next debit ${PORTFOLIO.nextDebit}`,
                  noteTone: "up",
                }}
                right={{
                  label: "idle cash",
                  value: idleCash === undefined ? "— — —" : money(idleCash),
                  note: `earning ${PORTFOLIO.idleCashRate}`,
                }}
              />
            </SkeletonSwap>
          </div>
        </div>

        <div className="split">
          <div className="col-main">
            <section>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                holdings
              </div>
              <ShareBar
                segments={HOLDINGS.map((h) => ({
                  key: h.name,
                  share: h.share,
                  color: h.color,
                }))}
              />
              <div style={{ marginTop: 14 }}>
                {HOLDINGS.map((holding) => (
                  <div className="list-row list-row--tall" key={holding.name}>
                    <span
                      className="swatch"
                      style={{ background: holding.color }}
                    />
                    <div className="list-row__body">
                      <div className="list-row__name">{holding.name}</div>
                      <div className="list-row__meta">{holding.meta}</div>
                    </div>
                    <div className="list-row__right">
                      <div className="list-row__amount">
                        {money(holding.value)}
                      </div>
                      <div
                        className={`list-row__return list-row__return--${
                          holding.flat
                            ? "flat"
                            : holding.returnPct >= 0
                              ? "up"
                              : "down"
                        }`}
                      >
                        {pct(holding.returnPct)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                active sips
              </div>
              {ACTIVE_SIPS.map((sip) => (
                <div className="list-row list-row--tall" key={sip.name}>
                  <span className="swatch" style={{ background: sip.color }} />
                  <div className="list-row__body">
                    <div className="list-row__name">{sip.name}</div>
                    <div className="list-row__meta">{sip.meta}</div>
                  </div>
                  <span className="list-row__status">ACTIVE</span>
                </div>
              ))}
            </section>
          </div>

          <section className="col-side">
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              goals
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {GOALS.map((goal) => (
                <div key={goal.name}>
                  <div className="goal__head">
                    <span className="goal__name">{goal.name}</span>
                    {goal.tracksNetWorth ? (
                      <SkeletonSwap
                        loaded={ready}
                        skeleton={
                          <span className="goal__value" aria-hidden="true">
                            <Skeleton
                              className="skel--line"
                              style={{ width: 74, height: 10, display: "inline-block" }}
                            />
                          </span>
                        }
                      >
                        <span className="goal__value">
                          {userData ? money(userData.netWorth) : "— — —"}
                        </span>
                      </SkeletonSwap>
                    ) : (
                      <span className="goal__value">{money(goal.value)}</span>
                    )}
                    <span
                      className={`goal__pct${goal.pct >= 100 ? " goal__pct--done" : ""}`}
                    >
                      {goal.pct}%
                    </span>
                  </div>
                  <div className="goal__track">
                    <div
                      className="goal__fill"
                      style={{ width: `${goal.pct}%`, background: goal.color }}
                    />
                  </div>
                  <div className="goal__note">{goal.note}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="pill-soft"
              style={{ marginTop: 16 }}
              onClick={openAsk}
            >
              Plan a goal
            </button>
          </section>
        </div>

        <div className="insight-row">
          {dismissed.keep(INVEST_INSIGHTS).map((insight) => (
            <InsightCard
              key={insight.id}
              date={insight.date}
              headline={insight.headline}
              body={insight.body}
              actions={insight.actions.map((label, i) => ({
                label,
                onClick:
                  i === 0 ? openAsk : () => dismissed.dismiss(insight.id),
              }))}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
