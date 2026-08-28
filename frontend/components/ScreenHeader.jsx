"use client";

import { useRouter } from "next/navigation";
import { usePaise } from "@/lib/store";

// Sticky page header. On phone it carries the serif wordmark (Home) or the
// screen name, plus the avatar shortcut to Settings. On desktop the wordmark
// and avatar live in the sidebar, so only the page title remains.
export default function ScreenHeader({ title, wordmark = false }) {
  const router = useRouter();
  const { profile } = usePaise();

  return (
    <header className="screen-header">
      {wordmark && <span className="screen-header__wordmark">Paise</span>}
      <span className={`screen-header__title${wordmark ? " desktop-only" : ""}`}>{title}</span>
      <button
        type="button"
        className="avatar-btn"
        aria-label="Settings"
        onClick={() => router.push("/settings")}
      >
        {profile?.initials ?? ""}
      </button>
    </header>
  );
}
