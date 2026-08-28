"use client";

import { usePathname, useRouter } from "next/navigation";
import { usePaise } from "@/lib/store";

const ITEMS = [
  { to: "/", label: "Home", glyph: "home", match: ["/", "/empty"] },
  { to: "/money", label: "Money", glyph: "money", match: ["/money"] },
  { to: "/invest", label: "Invest", glyph: "invest", match: ["/invest"] },
];

// Desktop navigation. Replaces the bottom tab bar above 900px — same
// destinations, same glyphs, so nothing has to be relearned between sizes.
export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { openAsk, profile } = usePaise();

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar__wordmark">Paise</div>

      <div className="sidebar__nav">
        {ITEMS.map((item) => {
          const active = item.match.includes(pathname);
          return (
            <button
              key={item.to}
              type="button"
              className={`sidebar__item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => router.push(item.to)}
            >
              <span className={`sidebar__glyph sidebar__glyph--${item.glyph}`} />
              {item.label}
            </button>
          );
        })}

        <button type="button" className="sidebar__ask" onClick={openAsk}>
          <span className="sidebar__glyph sidebar__glyph--ask" />
          Ask Paise
        </button>
      </div>

      <button
        type="button"
        className={`sidebar__footer${pathname === "/settings" ? " is-active" : ""}`}
        aria-current={pathname === "/settings" ? "page" : undefined}
        onClick={() => router.push("/settings")}
      >
        <span className="sidebar__avatar">{profile?.initials ?? ""}</span>
        <span>
          <span className="sidebar__name">{profile?.name ?? "Your account"}</span>
          <span className="sidebar__role">Settings</span>
        </span>
      </button>
    </nav>
  );
}
