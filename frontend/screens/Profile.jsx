"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";

export default function Profile() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");

  const ready = name.trim().length > 0 && Number(age) >= 13 && Number(age) <= 120;

  return (
    <AuthLayout>
      <form
        className="stack-screen"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) router.push("/connect");
        }}
      >
        <button type="button" className="back-btn" aria-label="Back" onClick={() => router.push("/otp")}>
          ‹
        </button>

        <div className="steps">
          <span className="is-done" />
          <span className="is-done" />
          <span />
        </div>
        <div className="eyebrow" style={{ marginTop: 16 }}>
          step 2 of 3
        </div>
        <h1 className="h-display" style={{ marginTop: 12 }}>
          What should we call you?
        </h1>

        <label className="eyebrow" htmlFor="first-name" style={{ marginTop: 28 }}>
          first name
        </label>
        <div className="field">
          <input
            id="first-name"
            className="text-input"
            autoComplete="given-name"
            placeholder="Aarav"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <label className="eyebrow" htmlFor="age" style={{ marginTop: 20 }}>
          age
        </label>
        <div className="field">
          <input
            id="age"
            className="text-input"
            type="text"
            inputMode="numeric"
            placeholder="23"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </div>
        <p className="body-text" style={{ fontSize: 12.5, color: "var(--muted-2)", marginTop: 11 }}>
          Used for milestone ages — “₹1Cr by 38” — nothing else.
        </p>

        <button type="submit" className="btn-primary" style={{ marginTop: 26 }} disabled={!ready}>
          Continue
        </button>
        <div className="spacer" />
      </form>
    </AuthLayout>
  );
}
