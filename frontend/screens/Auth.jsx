"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import * as api from "@/lib/api";

// Step one of a real sign-in. The number goes to /api/auth/request-otp, which
// mints a six-digit code, hashes it, and hands back a challenge id — the only
// thing this screen carries forward. The code itself never touches this
// bundle unless the backend is running in demo delivery.
export default function Auth() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const digits = phone.replace(/\D/g, "");
  const ready = digits.length === 10 && !pending;

  function onChange(e) {
    // Keep it to 10 digits, shown as "98765 43210".
    const next = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(next.length > 5 ? `${next.slice(0, 5)} ${next.slice(5)}` : next);
    setError(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!ready) return;
    setPending(true);
    setError(null);
    try {
      const challenge = await api.requestOtp(digits);
      // The challenge is per-tab and short-lived; sessionStorage is the right
      // shelf for it — a new tab starts a new sign-in.
      sessionStorage.setItem(
        "paise.challenge",
        JSON.stringify({
          challengeId: challenge.challengeId,
          phone: digits,
          expiresAt: challenge.expiresAt,
          // Present only when the backend runs OTP_DELIVERY=response, so a
          // phone on a demo hotspot can sign itself in without the terminal.
          devCode: challenge.devCode ?? null,
        })
      );
      router.push("/otp");
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth" onSubmit={onSubmit}>
        <div className="auth__brand">
          <div className="auth__wordmark">Paise</div>
          <h1 className="auth__headline">Your money, finally explained.</h1>
          <p className="auth__sub">
            Connect your accounts once. Paise reads them and tells you what actually changed.
          </p>
        </div>

        <h1 className="auth__form-title desktop-only">Start with your number.</h1>

        <label className="eyebrow auth__label" htmlFor="phone">
          mobile number
        </label>
        <div className="phone-field">
          <span className="phone-field__cc">+91</span>
          <span className="phone-field__rule" />
          <input
            id="phone"
            className="text-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={phone}
            onChange={onChange}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "phone-error" : undefined}
          />
        </div>

        {error && (
          <p className="auth__error" id="phone-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary" style={{ marginTop: 14 }} disabled={!ready}>
          {pending ? "Sending code…" : "Continue"}
        </button>

        <div className="divider-or">
          <span />
          <span className="eyebrow">or</span>
          <span />
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setNote("Google sign-in isn't wired up in the prototype — use your number above.")
          }
        >
          <span className="google-mark" />
          Continue with Google
        </button>

        {note && <p className="auth__error auth__error--muted">{note}</p>}

        <div className="spacer" />
        <p className="fine-print auth__legal">
          Read-only access via RBI-licensed account aggregators. Paise can never move your money.
        </p>
      </form>
    </AuthLayout>
  );
}
