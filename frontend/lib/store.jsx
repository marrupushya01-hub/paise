"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as api from "@/lib/api";
import { MASK, rupees } from "@/lib/format";

const PaiseContext = createContext(null);

const SETTINGS_KEY = "paise.settings";

const DEFAULT_SETTINGS = {
  // "Hide balances" in Settings → the design's `privacyMode` prop.
  privacyMode: false,
  // "Tone" in Settings → the design's `assistantTone` prop. Drives /api/insights.
  tone: "Direct",
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function PaiseProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);
  const [userData, setUserData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  // Insights have their own flag: an empty array can't tell "still fetching"
  // from "failed", and the skeletons need to know which one it is — including
  // on the refetch a tone change triggers.
  const [insightsStatus, setInsightsStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private-mode browsers can throw here; the app works without persistence.
    }
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    api
      .getUserData()
      .then((data) => {
        if (cancelled) return;
        setUserData(data);
        setStatus("ready");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Insight copy changes with tone, so this refetches when the setting flips.
  useEffect(() => {
    let cancelled = false;
    setInsightsStatus("loading");
    api
      .getInsights(settings.tone)
      .then((data) => {
        if (cancelled) return;
        setInsights(data.insights || []);
        setInsightsStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setInsights([]);
        setInsightsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [settings.tone]);

  const money = useCallback(
    (value) => (settings.privacyMode ? MASK : rupees(value)),
    [settings.privacyMode]
  );

  const value = useMemo(
    () => ({
      settings,
      setPrivacyMode: (on) => setSettings((s) => ({ ...s, privacyMode: on })),
      togglePrivacyMode: () => setSettings((s) => ({ ...s, privacyMode: !s.privacyMode })),
      setTone: (tone) => setSettings((s) => ({ ...s, tone })),
      toggleTone: () =>
        setSettings((s) => ({ ...s, tone: s.tone === "Direct" ? "Warm" : "Direct" })),
      userData,
      insights,
      insightsStatus,
      status,
      error,
      money,
      askOpen,
      openAsk: () => setAskOpen(true),
      closeAsk: () => setAskOpen(false),
    }),
    [settings, userData, insights, insightsStatus, status, error, money, askOpen]
  );

  return <PaiseContext.Provider value={value}>{children}</PaiseContext.Provider>;
}

export function usePaise() {
  const ctx = useContext(PaiseContext);
  if (!ctx) throw new Error("usePaise must be used inside <PaiseProvider>");
  return ctx;
}
