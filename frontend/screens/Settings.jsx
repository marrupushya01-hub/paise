"use client";

import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { SkeletonSwap } from "@/components/Skeleton";
import AccountRowSkeleton from "@/components/skeletons/AccountRowSkeleton";
import { PROFILE } from "@/data/mock";
import { useMinDuration } from "@/lib/useMinDuration";
import { usePaise } from "@/lib/store";

// Resting silhouette for the account list — short of what the payload
// usually carries on purpose. How many accounts there are is the data's to
// say, so the shape settles into the real height rather than guessing it.
// See the note in screens/Money.jsx.
const ACCOUNT_SHAPES_RESTING = [
  { meta: true, aside: "dot" },
  { meta: false, aside: "pill" },
];

const TONE_COPY = {
  Direct: "Direct — short, no cushioning",
  Warm: "Warm — gentler, more context",
};

// The design keeps a row of shortcuts into the pre-login flow so the whole
// prototype stays reachable while it's being reviewed.
const FLOW_STATES = [
  { label: "Login", href: "/login" },
  { label: "OTP", href: "/otp" },
  { label: "Profile", href: "/profile" },
  { label: "Connect accounts", href: "/connect" },
  { label: "First-run empty", href: "/empty" },
];

export default function Settings() {
  const router = useRouter();
  const { userData, settings, status, togglePrivacyMode, toggleTone } =
    usePaise();
  const ready = useMinDuration(status !== "loading");

  const accounts = userData?.connectedAccounts || [];
  const connected = accounts.filter((a) => a.status === "connected");
  const pending = accounts.filter((a) => a.status !== "connected");

  return (
    <AppShell>
      <header
        className="screen-header"
        style={{ justifyContent: "flex-start" }}
      >
        <button
          type="button"
          className="back-btn back-btn--sm"
          aria-label="Back"
          onClick={() => router.push("/")}
        >
          ‹
        </button>
        <span className="screen-header__title screen-header__title--sm">
          Settings
        </span>
      </header>

      <div className="settings-body">
        <div className="profile-row">
          <span className="profile-row__avatar">{PROFILE.initials}</span>
          <span style={{ flex: 1 }}>
            <span className="profile-row__name">{PROFILE.name}</span>
            <span className="profile-row__meta">
              {PROFILE.phone} · age {PROFILE.age}
            </span>
          </span>
        </div>

        <section>
          <div className="eyebrow settings-group-label">connected accounts</div>
          <SkeletonSwap
            loaded={ready}
            skeleton={
              <div>
                {ACCOUNT_SHAPES_RESTING.map((shape, i) => (
                  <AccountRowSkeleton
                    key={i}
                    index={i}
                    settings
                    {...shape}
                    shimmerDuration={1.4 + i * 0.08}
                  />
                ))}
              </div>
            }
          >
            <div>
              {connected.map((account) => (
                <div className="list-row list-row--settings" key={account.name}>
                  <div className="list-row__body">
                    <div className="list-row__name">
                      {account.provider
                        ? `${account.provider} · ${account.name}`
                        : account.name}
                    </div>
                    <div className="list-row__meta">
                      Synced {account.syncedAgo} ago · read-only
                    </div>
                  </div>
                  <span className="status-dot" />
                </div>
              ))}
              {pending.length > 0 && (
                <div className="list-row list-row--settings">
                  <span className="list-row__name" style={{ flex: 1 }}>
                    {pending.map((a) => a.name).join(" · ")}
                  </span>
                  <button
                    type="button"
                    className="pill-dark pill-dark--sm"
                    onClick={() => router.push("/connect")}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </SkeletonSwap>
        </section>

        <section>
          <div className="eyebrow settings-group-label">privacy</div>
          <div className="list-row list-row--settings">
            <div className="list-row__body">
              <div className="list-row__name">Hide balances</div>
              <div className="list-row__meta">
                Masks every number until you tap
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.privacyMode}
              aria-label="Hide balances"
              className={`switch${settings.privacyMode ? " is-on" : ""}`}
              onClick={togglePrivacyMode}
            >
              <span className="switch__knob" />
            </button>
          </div>
          <button
            type="button"
            className="row-button"
            onClick={() => router.push("/connect")}
          >
            <span className="list-row__body">
              <span className="list-row__name">Data &amp; consents</span>
              <span className="list-row__meta">
                Read-only, through an account aggregator
              </span>
            </span>
            <span className="chevron">›</span>
          </button>
        </section>

        <section>
          <div className="eyebrow settings-group-label">assistant</div>
          <button type="button" className="row-button" onClick={toggleTone}>
            <span className="list-row__body">
              <span className="list-row__name">Tone</span>
              <span className="list-row__meta">{TONE_COPY[settings.tone]}</span>
            </span>
            <span className="chevron">›</span>
          </button>
          <div className="list-row list-row--settings">
            <div className="list-row__body">
              <div className="list-row__name">Notifications</div>
              <div className="list-row__meta">
                Weekly insight · big spends only
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="eyebrow settings-group-label">
            flow states · for review
          </div>
          <div className="chip-row">
            {FLOW_STATES.map((state) => (
              <button
                key={state.href}
                type="button"
                className="pill-soft pill-soft--sm"
                onClick={() => router.push(state.href)}
              >
                {state.label}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="btn-danger"
          style={{ marginBottom: 8 }}
          onClick={() => router.push("/login")}
        >
          Log out
        </button>
      </div>
    </AppShell>
  );
}
