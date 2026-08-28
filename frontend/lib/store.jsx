"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as api from "@/lib/api";
import { MASK, rupees } from "@/lib/format";
import { clearSession, getSession, setSession } from "@/lib/session";

const PaiseContext = createContext(null);

// Settings are the account's, held on the server. This cache exists so the
// first paint after a reload does not flash the wrong tone or briefly show
// figures the user asked to hide, while /api/auth/me is in flight.
const SETTINGS_CACHE_KEY = "paise.settings";

const DEFAULT_SETTINGS = {
  // "Hide balances" in Settings. Now enforced server-side too: with it on,
  // the masked figures are never serialised into the response at all.
  privacyMode: false,
  // "Tone" in Settings. Drives /api/insights.
  tone: "Direct",
};

function loadCachedSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function PaiseProvider({ children }) {
  const [settings, setSettings] = useState(loadCachedSettings);
  // "unknown" until the stored token has been checked — the shell must not
  // bounce a signed-in user to /login on the first frame after a reload.
  const [auth, setAuth] = useState("unknown"); // unknown | authed | anon
  const [profile, setProfile] = useState(null);

  const [userData, setUserData] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [insights, setInsights] = useState([]);
  const [screenInsights, setScreenInsights] = useState({ money: [], invest: [] });
  const [dismissedIds, setDismissedIds] = useState(() => new Set());

  const [status, setStatus] = useState("loading"); // loading | ready | error
  // Insights have their own flag: an empty array can't tell "still fetching"
  // from "failed", and the skeletons need to know which one it is — including
  // on the refetch a tone change triggers.
  const [insightsStatus, setInsightsStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [askOpen, setAskOpen] = useState(false);

  // Resolve the stored token once on mount. /api/auth/me is the cheapest way
  // to find out whether it is still good, and it returns the account's own
  // settings, which win over the local cache.
  useEffect(() => {
    let cancelled = false;
    if (!getSession()) {
      setAuth("anon");
      setStatus("error");
      return undefined;
    }
    api
      .me()
      .then((data) => {
        if (cancelled) return;
        setProfile(data.profile);
        setSettings((s) => ({ ...s, ...data.settings }));
        setAuth("authed");
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setAuth("anon");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    } catch {
      // Private-mode browsers can throw here; the app works without the cache.
    }
  }, [settings]);

  // Financial data. Refetched when privacy mode flips, because the mask is the
  // server's now — the figures are not in the payload to un-hide client-side.
  // The refetch deliberately does not drop back to "loading": the screen keeps
  // the numbers it has and swaps them, rather than flashing a skeleton at
  // someone who only toggled a switch.
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (auth !== "authed") return undefined;
    let cancelled = false;
    if (!loadedOnce.current) setStatus("loading");

    Promise.all([api.getUserData(), api.getPortfolio()])
      .then(([data, bundle]) => {
        if (cancelled) return;
        setUserData(data);
        setPortfolio(bundle);
        setStatus("ready");
        setError(null);
        loadedOnce.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [auth, settings.privacyMode]);

  // Insight copy changes with tone, so this refetches when the setting flips.
  useEffect(() => {
    if (auth !== "authed") return undefined;
    let cancelled = false;
    setInsightsStatus("loading");
    Promise.all([
      api.getInsights(settings.tone),
      api.getScreenInsights("money"),
      api.getScreenInsights("invest"),
    ])
      .then(([home, money, invest]) => {
        if (cancelled) return;
        setInsights(home.insights || []);
        setScreenInsights({ money: money.insights || [], invest: invest.insights || [] });
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
  }, [auth, settings.tone]);

  useEffect(() => {
    if (auth !== "authed") return undefined;
    let cancelled = false;
    api
      .getDismissed()
      .then(({ dismissed }) => {
        if (!cancelled) setDismissedIds(new Set(dismissed));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Settings are written through to the server, and the local state moves
  // first so a toggle never waits on a round trip to look like it worked.
  const patchSettings = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    api.saveSettings(patch).catch(() => {
      // The server rejected it or is unreachable; the next /api/auth/me will
      // put the account's real setting back.
    });
  }, []);

  // "Not now" outlives the session now — the server remembers it per account.
  const dismiss = useCallback((id) => {
    setDismissedIds((current) => new Set(current).add(id));
    api.dismissInsight(id).catch(() => {});
  }, []);

  const signIn = useCallback((session, nextProfile) => {
    setSession(session);
    if (nextProfile) setProfile(nextProfile);
    loadedOnce.current = false;
    setAuth("authed");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Already expired or unreachable — the local token goes either way.
    }
    clearSession();
    setAuth("anon");
    setProfile(null);
    setUserData(null);
    setPortfolio(null);
    setInsights([]);
    setScreenInsights({ money: [], invest: [] });
    setDismissedIds(new Set());
    loadedOnce.current = false;
  }, []);

  const money = useCallback(
    (value) => (settings.privacyMode ? MASK : rupees(value)),
    [settings.privacyMode]
  );

  const value = useMemo(
    () => ({
      auth,
      profile,
      signIn,
      signOut,
      settings,
      setPrivacyMode: (on) => patchSettings({ privacyMode: on }),
      togglePrivacyMode: () => patchSettings({ privacyMode: !settings.privacyMode }),
      setTone: (tone) => patchSettings({ tone }),
      toggleTone: () => patchSettings({ tone: settings.tone === "Direct" ? "Warm" : "Direct" }),
      userData,
      portfolio,
      insights,
      screenInsights,
      insightsStatus,
      dismissedIds,
      dismiss,
      status,
      error,
      money,
      askOpen,
      openAsk: () => setAskOpen(true),
      closeAsk: () => setAskOpen(false),
    }),
    [
      auth, profile, signIn, signOut, settings, patchSettings, userData, portfolio,
      insights, screenInsights, insightsStatus, dismissedIds, dismiss, status,
      error, money, askOpen,
    ]
  );

  return <PaiseContext.Provider value={value}>{children}</PaiseContext.Provider>;
}

export function usePaise() {
  const ctx = useContext(PaiseContext);
  if (!ctx) throw new Error("usePaise must be used inside <PaiseProvider>");
  return ctx;
}
