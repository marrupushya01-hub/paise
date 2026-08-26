"use client";

// The two-up figure card ("net worth | safe to spend") that opens the
// Money screen on Home, and appears as a plain panel elsewhere.
export default function StatPair({ left, right, onClick, tight = false }) {
  const className = [
    "stat-card",
    tight ? "stat-card--tight" : "",
    onClick ? "stat-card--button" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <Stat {...left} />
      <span className="stat__rule" />
      <Stat {...right} />
    </>
  );

  if (!onClick) return <div className={className}>{body}</div>;

  return (
    <button type="button" className={className} onClick={onClick}>
      {body}
    </button>
  );
}

function Stat({ label, value, note, noteTone, empty }) {
  return (
    <span className="stat">
      <span className="eyebrow stat__label">{label}</span>
      <span className={`stat__value${empty ? " stat__value--empty" : ""}`}>{value}</span>
      {note && (
        <span className={`stat__note${noteTone ? ` stat__note--${noteTone}` : ""}`}>{note}</span>
      )}
    </span>
  );
}
