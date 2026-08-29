"use client";

import { useEffect, useState } from "react";
import { getSpendingTrend } from "@/lib/api";
import { monthLabel } from "@/lib/format";
import { usePaise } from "@/lib/store";
import ChatChart from "./ChatChart";

// The Jun/Jul/Aug chart the Ask sheet's seeded thread opens on, fed by
// /api/spending-trend.
//
// It used to draw its own bars. Now it builds the same chart spec the model
// emits and hands it to ChatChart — so the card the design shipped and the
// cards an answer generates are literally the same component, and improving
// one improves both.
export default function TrendCard({ category, title, months = 3 }) {
  const { userData } = usePaise();
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSpendingTrend(category, months)
      .then((data) => {
        if (!cancelled) setTrend(data.trend || []);
      })
      .catch(() => {
        if (!cancelled) setTrend([]);
      });
    return () => {
      cancelled = true;
    };
  }, [category, months]);

  if (!trend || trend.length === 0) return null;

  return (
    <ChatChart
      categories={userData?.categories}
      spec={{
        type: trend.length === 1 ? "stat" : "bar",
        title,
        unit: "inr",
        caption: null,
        data: trend.map((point) => ({ label: monthLabel(point.month), value: point.amount })),
        total: trend.reduce((sum, p) => sum + p.amount, 0),
      }}
    />
  );
}
