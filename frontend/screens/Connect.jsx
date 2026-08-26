"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";

const SOURCES = [
  {
    id: "bank",
    name: "Bank & UPI",
    meta: "HDFC · connected",
    connected: true,
    glyph: "glyph-square",
  },
  {
    id: "cards",
    name: "Credit cards",
    meta: "Finds the card you're using wrong",
    glyph: "glyph-card",
  },
  {
    id: "funds",
    name: "Mutual funds & SIPs",
    meta: "Zerodha Coin, Groww, Kuvera",
    glyph: "glyph-diamond",
  },
  {
    id: "fd",
    name: "Fixed deposits · NPS",
    meta: "So net worth is the real number",
    glyph: "glyph-circle",
  },
];

export default function Connect() {
  const router = useRouter();
  // Connecting is a consent handshake with the account aggregator, which
  // this prototype doesn't run. The row still has to answer the tap, so it
  // marks itself connected the way it will when the handshake lands.
  const [connectedIds, setConnectedIds] = useState(
    () => new Set(SOURCES.filter((s) => s.connected).map((s) => s.id)),
  );

  return (
    <AuthLayout>
      <div className="stack-screen connect-screen">
        <button
          type="button"
          className="back-btn"
          aria-label="Back"
          onClick={() => router.push("/profile")}
        >
          ‹
        </button>

        <div className="steps">
          <span className="is-done" />
          <span className="is-done" />
          <span className="is-done" />
        </div>

        <div className="connect-screen__intro">
          <div className="eyebrow" style={{ marginTop: 16 }}>
            step 3 of 3
          </div>
          <h1 className="h-display" style={{ marginTop: 12 }}>
            Connect your money.
          </h1>
          <p
            className="body-text"
            style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10 }}
          >
            Read-only, through an RBI-licensed account aggregator. Connect one
            thing now and add the rest later.
          </p>
        </div>

        <div className="connect-list">
          {SOURCES.map((source) => {
            const connected = connectedIds.has(source.id);
            return (
              <div
                key={source.id}
                className={`connect-row${connected ? " connect-row--connected" : ""}`}
              >
                <span className="connect-row__icon">
                  <span className={source.glyph} />
                </span>
                <span className="connect-row__body">
                  <span className="connect-row__name">{source.name}</span>
                  <span
                    className={`connect-row__meta${connected ? " connect-row__meta--on" : ""}`}
                  >
                    {connected && !source.connected ? "connected" : source.meta}
                  </span>
                </span>
                {connected ? (
                  <span className="check-dot">✓</span>
                ) : (
                  <button
                    type="button"
                    className="pill-dark pill-dark--connect"
                    onClick={() =>
                      setConnectedIds((current) =>
                        new Set(current).add(source.id),
                      )
                    }
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: 22 }}
          onClick={() => router.push("/")}
        >
          Done — take me in
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 10 }}
          onClick={() => router.push("/empty")}
        >
          Skip for now
        </button>
        <div className="spacer" />
      </div>
    </AuthLayout>
  );
}
