# paise backend 

A small Express API serving the mock data used by the Paise wireframes:
net worth, cash flow, category breakdown, and an "Ask Paise" endpoint.

## Run it

```bash
npm install
cp .env.example .env   # edit as needed
npm start               # or: npm run dev (auto-restart)
```

By default it listens on `http://localhost:4000` and allows requests
from `http://localhost:3000`.

## Endpoints

| Method | Path                  | Notes                                                                 |
|--------|-----------------------|------------------------------------------------------------------------|
| GET    | `/health`             | Liveness check, unauthenticated                                        |
| GET    | `/api/user-data`      | Net worth, milestones, safe-to-spend, month-end forecast, categories, transactions, connected accounts |
| GET    | `/api/insights`       | Assistant cards. `?tone=Direct\|Warm`                                  |
| GET    | `/api/subscriptions`  | Detected recurring charges. `?forgotten=true` to filter                |
| GET    | `/api/spending-trend` | Category trend for charts. `?category=<slug>&months=1-12`              |
| POST   | `/api/ask`            | `{ "question": "..." }` → `{ "answer": "..." }`                        |

Category slugs (used by both `/api/user-data`'s `categories` array and
`/api/spending-trend`): `food-delivery`, `rent`, `travel-cabs`,
`subscriptions`, `shopping`.

### `/api/user-data` shape

```json
{
  "netWorth": 842600,
  "netWorthChangeThisMonth": 18400,
  "netWorthMilestones": {
    "currentAge": 23,
    "progressPct": 34,
    "milestones": [{ "label": "₹10L", "amount": 1000000, "projectedAge": 24 }]
  },
  "safeToSpend": 6300,
  "safeToSpendUntil": "2026-08-31",
  "monthEndForecast": { "remaining": 8400, "until": "2026-08-31", "basis": "burn_rate" },
  "spentThisMonth": 38420,
  "monthlyBudget": 42000,
  "spentVsLastMonth": 4200,
  "categories": [{ "slug": "food-delivery", "name": "Food & delivery", "amount": 11900, "payments": 64, "pct": 31 }],
  "recentTransactions": [{ "merchant": "Zomato", "amount": -486, "date": "...", "method": "UPI" }],
  "connectedAccounts": [{ "name": "Bank & UPI", "provider": "HDFC", "status": "connected", "syncedAgo": "2m" }]
}
```

Note: `safeToSpend` (day-to-day) and `monthEndForecast.remaining`
(end-of-month burn-rate projection) are intentionally separate numbers
— don't collapse them into one field on the frontend.

## Security notes

- **CORS** is an explicit allowlist via `ALLOWED_ORIGINS` — no wildcard.
- **Rate limiting**: 60 req/min general, 10 req/min on `/api/ask`.
- **`PAISE_API_KEY`**: if set, `/api/*` requires a matching `x-api-key`
  header. If unset, the server runs in open demo mode and logs a
  warning on startup. **Set this before deploying anywhere reachable
  off your own machine.**
- **`ANTHROPIC_API_KEY`**: optional. Without it, `/api/ask` returns a
  stub response (`"stub": true`) instead of calling any AI provider.
  If you provide your own key, the server calls the Anthropic API
  directly with the mock financial data as context — swap in your
  real data source before using this for anything beyond a demo.
- Financial responses are sent with `Cache-Control: no-store`.
- Errors are logged server-side with detail; clients only ever get a
  generic message so internals never leak in responses.

## What this is *not*

This is a local prototype, not a production backend:

- No real authentication/session/user model — `PAISE_API_KEY` is a
  single shared secret, not per-user auth.
- No database — all data is in-memory mock data in `server.js`.
- No HTTPS termination — put this behind a reverse proxy (or a
  platform that terminates TLS for you) before it's reachable over
  the network.
- No audit logging, no input sanitization beyond basic type/length
  checks on `/api/ask`.

Treat it as a stand-in for a real backend while you build the frontend
and iterate on the data shape.
