"use client";

// The "paise · <date>" assistant card used on Home, Money and Invest.
export default function InsightCard({ date, headline, body, actions = [] }) {
  return (
    <article className="card">
      <div className="card__head">
        <span className="card__dot" />
        <span className="eyebrow eyebrow--dark">paise</span>
        <span className="spacer" />
        <span className="card__date">{date}</span>
      </div>
      <h2 className="h-card">{headline}</h2>
      <p className="body-text" style={{ margin: 0 }}>
        {body}
      </p>
      {actions.length > 0 && (
        <div className="card__actions">
          {actions.map((action, i) => (
            <button
              key={action.label}
              type="button"
              className={i === 0 ? "pill-dark" : "pill-soft"}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
