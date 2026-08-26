"use client";

import { useRouter } from "next/navigation";
import { PROFILE } from "@/data/mock";

// Sticky page header. On phone it carries the serif wordmark (Home) or the
// screen name, plus the avatar shortcut to Settings. On desktop the wordmark
// and avatar live in the sidebar, so only the page title remains.
export default function ScreenHeader({ title, wordmark = false }) {
  const router = useRouter();

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
        {PROFILE.initials}
      </button>
    </header>
  );
}
