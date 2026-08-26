"use client";

import AskSheet from "./AskSheet";
import PageMotion from "./PageMotion";
import { usePaise } from "@/lib/store";

// Pre-login screens have no navigation, so desktop splits them: the promise
// on the left in the canvas colour, the form on the right. Below 900px the
// left panel drops out and the phone screens render exactly as designed.
export default function AuthLayout({ children }) {
  const { askOpen } = usePaise();

  return (
    <div className="app-canvas auth-split">
      <aside className="auth-split__brand desktop-only">
        <div className="auth-split__wordmark">Paise</div>
        <p className="auth-split__line">Your money, finally explained.</p>
        <p className="auth-split__note">
          Connect your accounts once, read-only, through an RBI-licensed account aggregator.
          Paise reads them and tells you what actually changed. It can never move your money.
        </p>
      </aside>
      <div className="auth-split__form">
        <div className="phone">
          <PageMotion>{children}</PageMotion>
        </div>
      </div>
      {askOpen && <AskSheet />}
    </div>
  );
}
