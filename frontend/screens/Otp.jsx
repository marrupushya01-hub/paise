"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import * as api from "@/lib/api";
import { usePaise } from "@/lib/store";

const LENGTH = 6;
const RESEND_SECONDS = 30;

// Step two. The code is checked by the server against a hash it stored: it
// expires, it is single-use, and five wrong guesses burn the challenge. A
// correct one comes back with a session token, which is the credential every
// later request carries.
export default function Otp() {
  const router = useRouter();
  const { signIn } = usePaise();

  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // No challenge means this screen was opened directly. Send them back rather
  // than pretending a code could be verified.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("paise.challenge");
      if (!raw) {
        router.replace("/login");
        return;
      }
      setChallenge(JSON.parse(raw));
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const resend = useCallback(async () => {
    if (!challenge || secondsLeft > 0) return;
    setError(null);
    try {
      const next = await api.requestOtp(challenge.phone);
      const updated = {
        challengeId: next.challengeId,
        phone: challenge.phone,
        expiresAt: next.expiresAt,
        devCode: next.devCode ?? null,
      };
      sessionStorage.setItem("paise.challenge", JSON.stringify(updated));
      setChallenge(updated);
      setCode("");
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(err.message);
    }
  }, [challenge, secondsLeft]);

  async function onSubmit(e) {
    e.preventDefault();
    if (code.length !== LENGTH || pending || !challenge) return;
    setPending(true);
    setError(null);
    try {
      const result = await api.verifyOtp(challenge.challengeId, code);
      sessionStorage.removeItem("paise.challenge");
      signIn({ token: result.token, expiresAt: result.expiresAt }, result.profile);
      router.replace(result.isNewAccount ? "/profile" : "/");
    } catch (err) {
      setError(err.message);
      setCode("");
      setPending(false);
      // An expired or spent challenge cannot be retried — only replaced.
      if (err.code === "expired" || err.code === "locked") setSecondsLeft(0);
    }
  }

  const cells = Array.from({ length: LENGTH }, (_, i) => i);
  const prettyPhone = challenge
    ? `+91 ${challenge.phone.slice(0, 5)} ${challenge.phone.slice(5)}`
    : "";

  return (
    <AuthLayout>
      <form className="stack-screen" onSubmit={onSubmit}>
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
          Sent to {prettyPhone} ·{" "}
          <button
            type="button"
            className="section-link"
            style={{ fontSize: 14 }}
            onClick={() => router.push("/login")}
          >
            change
          </button>
        </p>

        {/* Demo delivery only: the backend returns the code in the response
            when OTP_DELIVERY=response, so a phone on a hotspot can sign itself
            in. With the default (log) this is absent and the code is in the
            server terminal. */}
        {challenge?.devCode && (
          <p className="fine-print" style={{ marginTop: 8 }}>
            Demo mode — your code is <strong>{challenge.devCode}</strong>
          </p>
        )}

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
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, LENGTH));
              setError(null);
            }}
          />
        </div>

        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="otp-resend"
          onClick={resend}
          disabled={secondsLeft > 0}
        >
          {secondsLeft > 0
            ? `RESEND IN 0:${String(secondsLeft).padStart(2, "0")}`
            : "RESEND CODE"}
        </button>

        <button
          type="submit"
          className="btn-primary"
          style={{ marginTop: 26 }}
          disabled={code.length !== LENGTH || pending}
        >
          {pending ? "Verifying…" : "Verify"}
        </button>

        <div className="spacer" />
        <p className="fine-print" style={{ marginTop: 30 }}>
          Codes last five minutes and can be used once. Five wrong tries and you'll need a
          new one.
        </p>
      </form>
    </AuthLayout>
  );
}
