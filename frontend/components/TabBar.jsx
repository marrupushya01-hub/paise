"use client";

import { usePathname, useRouter } from "next/navigation";
import { usePaise } from "@/lib/store";

const ITEMS = [
  { to: "/", label: "Home", glyph: "home", match: ["/", "/empty"] },
  { to: "/money", label: "Money", glyph: "money", match: ["/money"] },
  { to: "/invest", label: "Invest", glyph: "invest", match: ["/invest"] },
];

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { openAsk } = usePaise();

  return (
    <nav className="tabbar">
      <div className="tabbar__inner">
        {ITEMS.map((item) => {
          const active = item.match.includes(pathname);
          return (
            <button
              key={item.to}
              type="button"
              className={`tabbar__item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => router.push(item.to)}
            >
              <span className={`tabbar__glyph tabbar__glyph--${item.glyph}`} />
              {item.label}
            </button>
          );
        })}
        <button type="button" className="tabbar__item tabbar__item--ask" onClick={openAsk}>
          <span className="tabbar__glyph tabbar__glyph--ask" />
          Ask
        </button>
      </div>
    </nav>
  );
}
