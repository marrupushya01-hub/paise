# paise backend

Express API behind the Paise client: net worth, cash flow, category breakdown,
portfolio, and an "Ask Paise" endpoint backed by a locally hosted model.

Four files. `server.js` is the HTTP layer, `db.js` is SQLite and every read,
`auth.js` is sign-in and sessions, `seed.js` is the template dataset.

## Run it

```bash
npm install
cp .env.example .env   # edit as needed
npm start              # or: npm run dev (auto-restart)
```

Listens on `http://localhost:4000` and allows `http://localhost:3000` by
default. **Node 22.5+** — `node:sqlite` needs it.

First boot creates `paise.db` and seeds the template dataset. `npm run reset-db`
deletes the file if you want a clean slate.

## Signing in

There is no SMS gateway. A code is generated, hashed and stored; how it reaches
the user is `OTP_DELIVERY`:

- `log` (default) — printed to this terminal: `[paise] OTP for +91…`
- `response` — **also returned in the API response body**, so an unattended
  phone on a demo hotspot can sign itself in. This hands a working credential
  to anyone who can reach the port. Demo machines only; the server warns at
  boot when it is on.

```bash
# 1. ask for a code
curl -sX POST localhost:4000/api/auth/request-otp \
  -H 'content-type: application/json' -d '{"phone":"9876543210"}'
# → { "challengeId": "…", "expiresAt": "…", "delivery": "log" }

# 2. exchange it for a session
curl -sX POST localhost:4000/api/auth/verify-otp \
  -H 'content-type: application/json' \
  -d '{"challengeId":"…","code":"123456"}'
# → { "token": "…", "expiresAt": "…", "isNewAccount": true, "profile": {…} }

# 3. use it
curl -s localhost:4000/api/user-data -H "Authorization: Bearer <token>"
```

First verification for a number creates the account **and clones the template
dataset into it**, so every account has its own rows rather than a shared view
of one object.

## Endpoints

Everything under `/api` except the two entry points requires
`Authorization: Bearer <token>`.

| Method | Path | Auth | Notes |
|--------|------|:----:|-------|
| GET | `/health` | — | Liveness, account count, OTP delivery mode, auth-secret source |
| POST | `/api/auth/request-otp` | — | `{ phone }` → `{ challengeId, expiresAt }`. 5 per 15 min |
| POST | `/api/auth/verify-otp` | — | `{ challengeId, code }` → `{ token, profile }`. 20 per 15 min |
| GET | `/api/auth/me` | 🔐 | Profile + settings for the token |
| POST | `/api/auth/logout` | 🔐 | Revokes this session |
| POST | `/api/auth/logout-all` | 🔐 | Revokes every session for the account |
| GET | `/api/user-data` | 🔐 | Net worth, milestones, safe-to-spend, forecast, categories, transactions (with detail), connected accounts |
| GET | `/api/portfolio` | 🔐 | Portfolio figures, holdings, active SIPs, goals |
| GET | `/api/profile` | 🔐 | Name, initials, phone, age |
| GET | `/api/insights` | 🔐 | Home assistant cards. `?tone=Direct\|Warm` |
| GET | `/api/screen-insights` | 🔐 | Money / Invest cards. `?screen=money\|invest` |
| GET | `/api/subscriptions` | 🔐 | Recurring charges. `?forgotten=true` to filter |
| GET | `/api/spending-trend` | 🔐 | `?category=<slug>&months=1-12` |
| GET | `/api/settings` | 🔐 | `{ privacyMode, tone }` |
| PATCH | `/api/settings` | 🔐 | Same shape, partial |
| GET | `/api/dismissed` | 🔐 | Insight ids closed with "Not now" |
| POST | `/api/dismissed` | 🔐 | `{ insightId }` |
| DELETE | `/api/dismissed/:insightId` | 🔐 | Undo a dismissal |
| POST | `/api/ask` | 🔐 | `{ question }` → `{ answer }`, or SSE. 10/min |

Category slugs (used by `/api/user-data`'s `categories` and by
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
  "moneyIn": { "amount": 52000, "note": "salary · 1 Aug" },
  "monthEndForecast": { "remaining": 8400, "until": "2026-08-31", "basis": "burn_rate" },
  "spentThisMonth": 38420,
  "monthlyBudget": 42000,
  "spentVsLastMonth": 4200,
  "categories": [
    { "slug": "food-delivery", "name": "Food & delivery", "amount": 11900,
      "payments": 64, "pct": 31, "color": "#b25f3c" }
  ],
  "recentTransactions": [
    { "merchant": "Zomato", "amount": -486, "date": "2026-08-26T21:12:00+05:30",
      "method": "UPI",
      "detail": { "initial": "Z", "color": "#b25f3c", "meta": "Today, 9:12 pm · UPI",
                  "category": "Food & delivery", "account": "HDFC ••4021",
                  "note": "Your 11th food order this week…" } }
  ],
  "connectedAccounts": [
    { "name": "Bank & UPI", "provider": "HDFC", "status": "connected", "syncedAgo": "2m" }
  ]
}
```

`safeToSpend` (day-to-day) and `monthEndForecast.remaining` (end-of-month
burn-rate projection) are intentionally separate numbers — don't collapse them
into one field on the frontend.

### Privacy mode

With the account's `privacyMode` on — or with `?privacy=true` — the masked
fields are dropped **before the response is serialised**: `netWorth`,
`safeToSpend`, every transaction amount and merchant, every category amount,
and the portfolio figures come back as `null`. The number is not in the payload,
so devtools cannot see through it. `?privacy=false` overrides the stored
setting for one request.

### `/api/ask` streaming

Send `Accept: text/event-stream` and the answer arrives as server-sent events:

```
event: token
data: {"text":"₹6,"}

event: done
data: {"answer":"₹6,300"}
```

Without that header the same route answers with one `{ answer }` JSON body.
Closing the connection aborts the upstream generation.

## Security notes

The long version, with what is *not* covered, is in the root
[README → Security](../README.md#-security). In short:

- **Sessions, not a shared key.** 256-bit opaque tokens from `crypto.randomBytes`,
  stored as HMAC-SHA256. `PAISE_API_KEY` is gone — it was one secret for every
  caller and the frontend shipped it in its bundle.
- **Codes are hashed, expiring, single-use and attempt-capped.** Compared with
  `crypto.timingSafeEqual`. Requesting a new one invalidates every outstanding
  code for that number.
- **Every read is scoped by session user id.** Prepared statements only; no SQL
  in `db.js` is built by concatenating a request value.
- **CORS** is an explicit allowlist via `ALLOWED_ORIGINS` — no wildcard.
- **Four rate limiters**: 120/min general, 10/min on `/api/ask`, 5 per 15 min on
  code issuance, 20 per 15 min on verification. Keyed per session when there is
  one, so a shared NAT doesn't pool the budget.
- **10kb body cap**, and type/length/enum validation before any value is used.
- Financial responses carry `Cache-Control: no-store`.
- Errors are logged server-side with detail; clients get a generic message.

## What this is *not*

- **No SMS gateway.** See `OTP_DELIVERY` above.
- **No TLS.** Put this behind a reverse proxy, or a platform that terminates
  TLS, before it is reachable over any network you don't own.
- **No KYC, no account aggregator, no real bank link.** Any valid Indian mobile
  number that can receive its own code gets an account, seeded with the same
  fixture in `seed.js`.
- **No audit log** beyond `morgan`, and **no tests** — `npm test` is still
  `echo "No tests yet"`.
- **Rate limiting and the expiry sweep live in process memory.** Single
  instance only.
