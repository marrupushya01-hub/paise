"use client";

import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Feature from "@/components/Feature";
import ScreenHeader from "@/components/ScreenHeader";
import StatPair from "@/components/StatPair";

// First run with nothing connected: the numbers are honestly blank rather
// than zeroed, and the only call to action is connecting a bank.
export default function EmptyState() {
  const router = useRouter();

  return (
    <AppShell tabBar>
      <ScreenHeader wordmark title="Today" />

      <div className="split">
        <div className="figures-band span-all">
          <StatPair
            left={{ label: "net worth", value: "— — —", empty: true }}
            right={{ label: "safe to spend", value: "— — —", empty: true }}
          />
        </div>

        <div className="col-main">
          <div className="card-stack">
            <article className="card card--dashed">
              <div className="card__head">
                <span className="card__dot card__dot--waiting" />
                <span className="eyebrow">paise · waiting</span>
              </div>
              <h2 className="h-card">Nothing to read yet.</h2>
              <p className="body-text" style={{ margin: 0 }}>
                Connect a bank and the first insight lands in about ninety seconds. Until then
                this screen is honest and empty.
              </p>
              <button
                type="button"
                className="pill-green"
                style={{ marginTop: 2 }}
                onClick={() => router.push("/connect")}
              >
                Connect your bank
              </button>
            </article>

            <article className="card" style={{ gap: 9 }}>
              <div className="eyebrow">while you wait</div>
              <div style={{ font: "500 15px/1.35 var(--sans)" }}>
                What an account aggregator actually sees
              </div>
              <div style={{ font: "400 13px/1.5 var(--sans)", color: "var(--muted-2)" }}>
                2 min read · the short version is: balances and statements, never credentials.
              </div>
            </article>
          </div>
        </div>

        <div className="col-side">
          <Feature short />
        </div>
      </div>
    </AppShell>
  );
}
