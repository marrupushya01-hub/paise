"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ask } from "@/lib/api";
import { ASK_SEED } from "@/data/mock";
import { usePaise } from "@/lib/store";
import { useSheetDrag } from "@/lib/useSheetDrag";
import TrendCard from "./TrendCard";

// Bottom sheet for "Ask Paise". Opens on the design's seeded exchange;
// anything typed goes to POST /api/ask and is appended below it.
//
// On phone the sheet is draggable: up from the handle to fill the screen,
// down to put it back, down again to dismiss. Above 900px it's a right
// slide-over and the gesture is off.
const EXIT_MS = 220;
// The seeded thread arrives as a short cascade rather than all at once.
const SEED_STEP = 45;

export default function AskSheet() {
  const { closeAsk } = usePaise();
  const [thread, setThread] = useState(ASK_SEED);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [entering, setEntering] = useState(true);
  const [closing, setClosing] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const exitTimer = useRef(null);

  // Play the sheet out, then unmount it. Everything that closes the panel
  // goes through here so the exit reads the same from any trigger.
  const dismiss = useCallback(() => {
    if (exitTimer.current) return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant) {
      closeAsk();
      return;
    }
    setClosing(true);
    exitTimer.current = setTimeout(closeAsk, EXIT_MS);
  }, [closeAsk]);

  const { sheetRef, detent, dragging, handleProps, threadProps, toggle, expand, collapse } =
    useSheetDrag({ enabled: isPhone, onDismiss: dismiss });

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // The sheet covers the page, so the page behind it shouldn't scroll under
  // the gesture.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // The panel is a dialog on both shells: Escape closes it, Tab stays inside
  // it, and focus goes back where it came from on close.
  useEffect(() => {
    const opener = document.activeElement;
    inputRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll(
        'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [dismiss]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, pending]);

  async function send(question) {
    const text = question.trim();
    if (!text || pending) return;

    setThread((t) => [...t, { role: "user", text }]);
    setDraft("");
    setPending(true);
    try {
      const { answer } = await ask(text);
      setThread((t) => [...t, { role: "paise", text: answer }]);
    } catch (err) {
      setThread((t) => [
        ...t,
        { role: "paise", text: `Couldn't reach Paise just now — ${err.message}` },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onGrabberKey(e) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      expand();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (detent === "full") collapse();
      else dismiss();
    }
  }

  const sheetClass = [
    "sheet",
    entering && !closing ? "is-entering" : "",
    dragging ? "is-dragging" : "",
    closing ? "is-closing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className={`sheet-scrim${detent === "full" ? " is-full" : ""}${
          closing ? " is-closing" : ""
        }`}
        aria-label="Close Ask Paise"
        onClick={dismiss}
      />
      <section
        className={sheetClass}
        data-detent={detent}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Paise"
        ref={(node) => {
          panelRef.current = node;
          sheetRef.current = node;
        }}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setEntering(false);
        }}
      >
        <div className="sheet__handle" {...handleProps}>
          <button
            type="button"
            className="sheet__grabber"
            aria-label={detent === "full" ? "Collapse Ask Paise" : "Expand Ask Paise"}
            aria-expanded={detent === "full"}
            onClick={toggle}
            onKeyDown={onGrabberKey}
          />
          <div className="sheet__head">
            <span className="card__dot" />
            <span className="eyebrow eyebrow--dark">Ask Paise</span>
            <span className="spacer" />
            <button type="button" className="sheet__close" aria-label="Close" onClick={dismiss}>
              ×
            </button>
          </div>
        </div>

        <div className="sheet__thread" ref={threadRef} {...threadProps}>
          {thread.map((item, i) => (
            <Message
              key={i}
              item={item}
              delay={i < ASK_SEED.length ? 90 + i * SEED_STEP : 0}
              onSuggestion={send}
            />
          ))}
          {pending && (
            <div className="msg-paise msg-paise--pending">
              <span className="pending-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              Reading your accounts…
            </div>
          )}
        </div>

        <form
          className="sheet__composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <input
            ref={inputRef}
            className="sheet__input"
            placeholder="Ask about your money…"
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Ask about your money"
          />
          <button
            type="submit"
            className="sheet__send"
            aria-label="Send"
            disabled={pending || !draft.trim()}
          >
            <span />
          </button>
        </form>
      </section>
    </>
  );
}

function Message({ item, delay, onSuggestion }) {
  const style = { "--msg-delay": `${delay}ms` };

  if (item.role === "user")
    return (
      <div className="msg-user msg-in" style={style}>
        {item.text}
      </div>
    );

  if (item.role === "trend") {
    return (
      <div className="msg-in" style={style}>
        <TrendCard category={item.category} title="food & delivery · last 3 months" />
      </div>
    );
  }

  if (item.role === "suggestions") {
    return (
      <div className="card__actions msg-in" style={{ ...style, paddingBottom: 4 }}>
        {item.items.map((label) => (
          <button
            key={label}
            type="button"
            className="pill-soft"
            onClick={() => onSuggestion(label)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (item.segments) {
    return (
      <div className="msg-paise msg-in" style={style}>
        {item.segments.map((seg, i) =>
          seg.accent ? (
            <span key={i} style={{ color: "var(--rust)", fontWeight: 500 }}>
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>
    );
  }

  return (
    <div className="msg-paise msg-in" style={style}>
      {item.text}
    </div>
  );
}
