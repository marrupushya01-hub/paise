"use client";

import { useEffect, useState } from "react";
import { getSpendingTrend } from "@/lib/api";
import { monthLabel, rupees } from "@/lib/format";

const BAR_MAX = 62; // px, matches the design's tallest bar
const BAR_FILLS = ["#e8ddd3", "#d9b7a2", "#b25f3c"];

// The little Jun/Jul/Aug chart inside the Ask sheet, fed by
// /api/spending-trend.
export default function TrendCard({ category, title }) {
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSpendingTrend(category, 3)
      .then((data) => {
        if (!cancelled) setTrend(data.trend || []);
      })
      .catch(() => {
        if (!cancelled) setTrend([]);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (!trend || trend.length === 0) return null;

  const max = Math.max(...trend.map((t) => t.amount));
  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  const change = previous ? ((latest.amount - previous.amount) / previous.amount) * 100 : null;

  return (
    <div className="trend-card">
      <div className="eyebrow">{title}</div>
      <div className="trend-card__chart">
        {trend.map((point, i) => (
          <div
            key={point.month}
            className={`trend-bar${i === trend.length - 1 ? " is-current" : ""}`}
          >
            <div
              className="trend-bar__fill"
              style={{
                height: `${Math.max(Math.round((point.amount / max) * BAR_MAX), 12)}px`,
                background: BAR_FILLS[i] || BAR_FILLS[BAR_FILLS.length - 1],
              }}
            />
            <div className="trend-bar__label">{monthLabel(point.month)}</div>
          </div>
        ))}
        <div className="spacer" />
        <div className="trend-card__total">
          <div className="trend-card__total-value">{rupees(latest.amount)}</div>
          {change !== null && (
            <div className="trend-card__total-delta">
              {change >= 0 ? "+" : "−"}
              {Math.abs(Math.round(change))}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
