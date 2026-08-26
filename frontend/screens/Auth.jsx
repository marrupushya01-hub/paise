"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";

export default function Auth() {
  const router = useRouter();
  const [phone, setPhone] = useState("");

  const digits = phone.replace(/\D/g, "");
  const ready = digits.length === 10;

  function onChange(e) {
    // Keep it to 10 digits, shown as "98765 43210".
    const next = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(next.length > 5 ? `${next.slice(0, 5)} ${next.slice(5)}` : next);
  }

  return (
    <AuthLayout>
      <form
        className="auth"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) router.push("/otp");
        }}
      >
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
          />
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: 14 }} disabled={!ready}>
          Continue
        </button>

        <div className="divider-or">
          <span />
          <span className="eyebrow">or</span>
          <span />
        </div>

        <button type="button" className="btn-secondary" onClick={() => router.push("/otp")}>
          <span className="google-mark" />
          Continue with Google
        </button>

        <div className="spacer" />
        <p className="fine-print auth__legal">
          Read-only access via RBI-licensed account aggregators. Paise can never move your money.
        </p>
      </form>
    </AuthLayout>
  );
}
