"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";

const LENGTH = 6;

export default function Otp() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(24);
  const inputRef = useRef(null);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const cells = Array.from({ length: LENGTH }, (_, i) => i);

  return (
    <AuthLayout>
      <form
        className="stack-screen"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === LENGTH) router.push("/profile");
        }}
      >
        <button
          type="button"
          className="back-btn"
          aria-label="Back"
          onClick={() => router.push("/login")}
        >
          ‹
        </button>

        <h1 className="h-display" style={{ marginTop: 34 }}>
          Enter the code
        </h1>
        <p className="body-text" style={{ marginTop: 9, fontSize: 14 }}>
          Sent to +91 98765 43210 ·{" "}
          <button
            type="button"
            className="section-link"
            style={{ fontSize: 14 }}
            onClick={() => router.push("/login")}
          >
            change
          </button>
        </p>

        <div className="otp-row" onClick={() => inputRef.current?.focus()}>
          {cells.map((i) => {
            const filled = i < code.length;
            const active = i === code.length;
            return (
              <span
                key={i}
                className={`otp-cell${filled ? " otp-cell--filled" : ""}${
                  active ? " otp-cell--active" : ""
                }`}
              >
                {filled ? code[i] : active ? <span className="otp-caret" /> : null}
              </span>
            );
          })}
          <input
            ref={inputRef}
            className="otp-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, LENGTH))}
          />
        </div>

        <div className="otp-resend">
          {secondsLeft > 0
            ? `RESEND IN 0:${String(secondsLeft).padStart(2, "0")}`
            : "RESEND CODE"}
        </div>

        <button
          type="submit"
          className="btn-primary"
          style={{ marginTop: 26 }}
          disabled={code.length !== LENGTH}
        >
          Verify
        </button>

        <div className="spacer" />
        <p className="fine-print" style={{ marginTop: 30 }}>
          Didn't get it? Check that you have network, or use Google sign-in instead.
        </p>
      </form>
    </AuthLayout>
  );
}
