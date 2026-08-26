"use client";

// Single-row proportional bar above a category / holdings breakdown.
export default function ShareBar({ segments }) {
  return (
    <div className="share-bar">
      {segments.map((s) => (
        <div key={s.key} style={{ flex: s.share, background: s.color }} />
      ))}
    </div>
  );
}
