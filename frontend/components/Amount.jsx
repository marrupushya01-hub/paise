"use client";

// Renders text with any ₹ figures picked out in the accent colour, the way
// the design highlights "Food is up ₹4,200 this month."
const AMOUNT = /(₹[\d,]+(?:\.\d+)?)/g;

export default function Amount({ text, tone = "var(--rust)" }) {
  return (
    <>
      {String(text)
        .split(AMOUNT)
        .map((part, i) =>
          part.startsWith("₹") ? (
            <span key={i} style={{ color: tone }}>
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
    </>
  );
}
