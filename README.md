<div align="center">

# 💸 Paise

**Your money, finally explained.**

*"Safe to spend", cash flow, category insights, and an on-device AI assistant — **Ask Paise** — over your accounts.*

<p>
  <img alt="Node" src="https://img.shields.io/badge/Node-%E2%89%A522.5-339933?style=for-the-badge&logo=node.js&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black">
  <img alt="Express" src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?style=for-the-badge&logo=sqlite&logoColor=white">
  <img alt="Ollama" src="https://img.shields.io/badge/Ollama-qwen3%3A8b-0f172a?style=for-the-badge&logo=ollama&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/status-prototype-orange?style=for-the-badge">
</p>

**[Architecture](./ARCHITECTURE.md) · [Backend API](./backend/README.md) · [Frontend](./frontend/README.md) · [Security](#-security)**

</div>

---

## 🧩 What is Paise?

A personal-finance app that answers *"can I spend this?"* instead of showing you
a spreadsheet. Net worth, safe-to-spend, cash flow, category breakdowns and
subscription detection — plus an assistant you can ask in plain language.

**The assistant runs on your own machine.** `Ask Paise` talks to a locally
hosted Ollama model — no API key, no per-token cost, and your financial
snapshot never leaves the host.

One app at two densities: below 900px it is the phone canvas screen for screen;
above 900px the same screens lay out for a desktop window. Not two products.

> **Prototype.** Real sign-in, real per-account persistence, real server-side
> privacy — but the money itself is a fixture, and there is no bank on the
> other end. See [Security](#-security) for what is actually enforced, and
> [Known limitations](#-known-limitations) for what is not.

---

## ✨ Features

| | Feature | What it does |
|:-:|---|---|
| 🏠 | **Home** | Net worth, safe-to-spend, and assistant cards that explain the change |
| 📊 | **Money** | Milestones, Cash flow / Insights tabs, expandable transaction detail |
| 📈 | **Invest** | Portfolio, holdings, active SIPs, goals, idle-cash forecast |
| 🔐 | **Real sign-in** | Phone + one-time code — hashed, expiring, single-use, attempt-capped |
| 💬 | **Ask Paise** | Bottom sheet over any screen — local LLM answers, streamed, grounded in your figures only |
| 🎚️ | **Assistant tone** | `Direct` or `Warm` — refetches and rewrites every insight card |
| 🙈 | **Hide balances** | One switch, enforced on the server — the hidden figures never reach the browser |
| 🔁 | **Subscription detection** | Recurring charges surfaced, "forgotten" ones flagged |
| 📉 | **Spending trends** | Per-category Jun/Jul/Aug bars in the Ask sheet |
| 🦴 | **Measured skeletons** | Silhouettes settle to the real box, then wipe — no layout jump, no flash |
| 🖐️ | **Drag physics** | Two-detent sheet with fling detection, driven by CSS vars at zero React renders |
| 🧭 | **Lane-aware transitions** | Route direction inferred from screen lanes — Home → Money slides right, back slides left |
| 📱 | **Phone + desktop** | Bottom tab bar becomes a sidebar; sheet becomes a slide-over, at 900px |
| ♿ | **Reduced motion** | Every animation collapses to ~0ms while the state machines still run |

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, plain CSS with design tokens |
| **Backend** | Express 4 + helmet, cors, express-rate-limit, morgan |
| **Database** | SQLite via `node:sqlite` — no ORM, no migration tool, no service |
| **Auth** | Phone + OTP → opaque bearer sessions, HMAC-SHA256 at rest |
| **AI** | Ollama, `qwen3:8b`, streamed over SSE, `think:false` |
| **State** | React context + `localStorage` — no Redux, no query library |
| **Animation** | Pure CSS keyframes + mask wipes — no animation library |
| **Fonts** | DM Sans · Mulish · Instrument Serif via `next/font` |

---

## 📦 Getting Started

> **Two terminals.** The frontend expects the API on port **4000**; the backend's
> CORS allowlist expects the frontend on port **3000**. Neither port is arbitrary.
> Node **22.5+** — `node:sqlite` needs it.

**Terminal 1 — backend**

```bash
cd backend
npm install
cp .env.example .env
npm start           # http://localhost:4000
```

First boot creates `backend/paise.db` and seeds it. `npm run reset-db` deletes
it if you want a clean slate.

**Terminal 2 — frontend**

```bash
cd frontend
npm install
npm run dev         # http://localhost:3000
```

**Signing in**

Any 10-digit Indian mobile number. The six-digit code is printed in the
**backend terminal** — watch for `[paise] OTP for +91…`. First sign-in for a
number creates the account and seeds it with its own copy of the dataset.

> For an unattended demo phone, set `OTP_DELIVERY=response` in `backend/.env`
> and the code is shown on the OTP screen itself. That hands a working
> credential to anyone who can reach the port — demo machines only.

**Optional — the assistant**

`Ask Paise` needs Ollama running locally. Without it the app works fine;
`/api/ask` returns a 502 instead of an answer.

```bash
ollama pull qwen3:8b
```

---

## 🗂️ Project Structure

```
paise/
├── ARCHITECTURE.md          # diagrams, workflows, data model, tradeoffs
├── backend/
│   ├── server.js            # HTTP layer — routes, CORS, limits, masking, SSE
│   ├── db.js                # SQLite schema, seed, per-account clone, all reads
│   ├── auth.js              # OTP issue/verify, session mint/resolve/revoke
│   ├── seed.js              # the template dataset every account is cloned from
│   ├── paise.db             # created and seeded on first boot (gitignored)
│   └── .env.example         # ports, CORS, DB path, auth, Ollama tuning
└── frontend/
    ├── app/                 # route shells (server components, metadata only)
    ├── screens/             # one file per route — Home, Money, Invest, Settings…
    ├── components/          # AppShell, AskSheet, Skeleton pipeline, TabBar…
    ├── lib/                 # api client, session, store, formatters, hooks
    ├── data/mock.js         # what's left: the feature card and the Ask seed
    └── styles/              # tokens · app (phone) · desktop · skeleton
```

Full breakdown with responsibilities: **[ARCHITECTURE.md](./ARCHITECTURE.md#codebase-internals)**

---

## 🌐 Endpoints

Everything under `/api` except the two `auth` entry points requires
`Authorization: Bearer <session token>`.

| Method | Path | Auth | Notes |
|---|---|:-:|---|
| `GET` | `/health` | — | Liveness, account count, OTP delivery mode |
| `POST` | `/api/auth/request-otp` | — | `{ phone }` → `{ challengeId }`. 5 per 15 min |
| `POST` | `/api/auth/verify-otp` | — | `{ challengeId, code }` → `{ token, profile }` |
| `GET` | `/api/auth/me` | 🔐 | Resolve the token → profile + settings |
| `POST` | `/api/auth/logout` | 🔐 | Destroys this session server-side |
| `POST` | `/api/auth/logout-all` | 🔐 | Destroys every session for the account |
| `GET` | `/api/user-data` | 🔐 | Net worth, milestones, safe-to-spend, forecast, categories, transactions, accounts |
| `GET` | `/api/portfolio` | 🔐 | Portfolio, holdings, SIPs, goals |
| `GET` | `/api/profile` | 🔐 | Name, initials, phone, age |
| `GET` | `/api/insights` | 🔐 | Home assistant cards — `?tone=Direct\|Warm` |
| `GET` | `/api/screen-insights` | 🔐 | Money / Invest cards — `?screen=money\|invest` |
| `GET` | `/api/subscriptions` | 🔐 | Recurring charges — `?forgotten=true` |
| `GET` | `/api/spending-trend` | 🔐 | `?category=<slug>&months=1-12` |
| `GET` `PATCH` | `/api/settings` | 🔐 | `{ privacyMode, tone }` — the account's, not the device's |
| `GET` `POST` `DELETE` | `/api/dismissed` | 🔐 | Cards closed with "Not now", per account |
| `POST` | `/api/ask` | 🔐 | `{ question }` → `{ answer }`, or SSE with `Accept: text/event-stream` |

Category slugs: `food-delivery`, `rent`, `travel-cabs`, `subscriptions`, `shopping`.
Full request/response shapes: **[backend/README.md](./backend/README.md)**

---

## 📱 Demoing over a hotspot

Both halves run on one laptop (**the host**); every phone joins the host's
hotspot and browses to it. **No tunnel, no cloud account, no internet needed.**

> **Requirements:** Node 22.5+ on the host (`node --version`). The phones need
> nothing but a browser.

### 1. Start the hotspot

| OS | Steps |
|---|---|
| **Linux (GNOME)** | Settings → Wi-Fi → ⋮ → *Turn On Wi-Fi Hotspot* |
| **Windows** | Settings → Network & internet → *Mobile hotspot* → on |

Phones join that network. Everything below happens on the host.

### 2. Open the two ports

> ⚠️ The host's firewall blocks inbound connections by default, so the phones
> get a timeout until these are added.

<details open>
<summary><b>Linux (ufw)</b></summary>

```bash
sudo ufw enable
sudo ufw allow 3000/tcp    # frontend
sudo ufw allow 4000/tcp    # backend API
```

</details>

<details>
<summary><b>Windows (PowerShell, "Run as administrator")</b></summary>

```powershell
New-NetFirewallRule -DisplayName "Paise frontend" -Direction Inbound `
  -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "Paise backend" -Direction Inbound `
  -Protocol TCP -LocalPort 4000 -Action Allow -Profile Any
```

`-Profile Any` matters: Windows usually classifies a hotspot as a *Public*
network, and a rule scoped to *Private* alone silently will not apply. If a
"Windows Defender Firewall has blocked some features" dialog appears when node
first starts, tick **both** Private and Public.

</details>

### 3. Run both halves

```bash
cd backend
npm install
cp .env.example .env         # Windows: copy .env.example .env
npm start
```

```bash
cd frontend
npm install
npm run build                # build first — dev mode is much slower on a phone
npm start
```

Both bind `0.0.0.0`, so they answer on the LAN and not just on the host.

### 4. Point the phones at the host

The backend banner lists every address this machine answers on, with the
interface each one belongs to:

```console
[paise] backend listening on http://localhost:4000
[paise]                     http://10.216.147.211:4000  (wlp195s0)
```

> 👉 Phones open `http://10.216.147.211:3000` — **that address, port 3000.**

Pick the line for your wifi adapter (`wlp*`/`wl*` on Linux, `Wi-Fi` on Windows).

> **VPNs lie here.** Cloudflare WARP or Tailscale adds its own line with an
> address no phone on your hotspot can reach — the same reason makes
> `ip route get 1.1.1.1` the wrong way to find this address, since it returns
> the VPN's. Turn the VPN off for the demo if you are unsure.

`frontend/lib/api.js` derives the API base from whatever host served the page,
so the phone reaches the laptop's API instead of its own loopback — nothing to
configure per device. Leave `NEXT_PUBLIC_API_BASE_URL` unset for that to hold.

`ALLOW_LAN_ORIGINS=true` in `backend/.env` accepts any private-range origin, so
a fresh hotspot address does not mean editing `ALLOWED_ORIGINS` first.

### 🩺 If a phone cannot load the page

| Symptom | Cause |
|---|---|
| `{"error":"Not found."}` | You opened port 4000. That is the API — the app is on **3000** |
| Times out, never loads | Firewall rule missing, or you used a VPN interface's address |
| Loads on the laptop, not the phone | Phone is on mobile data, not the hotspot |
| Page renders, numbers never arrive | Backend not running, or port 4000 not opened — only 3000 was |
| Numbers blank, console shows a 403 | `ALLOW_LAN_ORIGINS` is not `true` in `backend/.env` |
| Stuck on the sign-in screen | The code is in the **backend terminal**. For an unattended phone set `OTP_DELIVERY=response` |
| "That code isn't right" on a code you just read | Requesting a new one invalidates the old one — use the newest |
| Kicked back to sign-in mid-demo | Session expired (24h) or someone hit Log out. Sign in again |
| Assistant answers with an error | Ollama not running, or the model not pulled |

Check the backend terminal while a phone loads: `GET /api/user-data 200` means
the whole path works; `403` means CORS rejected the origin.

<details>
<summary><b>Why not host the frontend on Vercel and point it here?</b></summary>

A Vercel page is served over HTTPS, and a browser refuses to let an HTTPS page
`fetch()` a plaintext `http://192.168.x.x` API — **mixed content**, blocked
before the request leaves the browser. No CORS setting on this server can
change that, because the request never arrives. Reaching a laptop from a Vercel
frontend needs an HTTPS tunnel (cloudflared or ngrok) in front of the backend,
which in turn needs the venue's internet to hold up. Serving both halves from
the host avoids the whole problem.

</details>

---

## 🔒 Security

> **Read this first.** Everything in **Shipped** is in the repository and can be
> checked against the code — file names are given so you can. Everything in
> [Not shipped](#not-shipped--the-part-that-would-make-this-real) is what a
> real deployment would need and this does **not** have. The two lists are kept
> apart on purpose: a finance app that oversells its own security is worse than
> one that admits what it is.

Paise is a prototype that handles a fixture, not a bank account. It is still
built like the fixture matters, because the shape of the thing is the point.

### Defence in depth — the layers a request passes through

```
                    ┌───────────────────────────────────────────┐
   phone / laptop   │  no credential in the JS bundle           │
                    │  session token, per account, revocable    │
                    └────────────────────┬──────────────────────┘
                                         │  Authorization: Bearer …
   ┌─────────────────────────────────────▼─────────────────────────────────────┐
   │  L1  CORS         explicit origin allowlist · no wildcard · methods and   │
   │                   headers pinned · RFC1918 escape hatch, off by default   │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L2  Headers      helmet() · nosniff · frameguard · referrer policy ·     │
   │                   cross-origin-resource-policy: same-site · no x-powered  │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L3  Budget       4 independent rate limiters, keyed per session so one   │
   │                   phone on a shared NAT can't exhaust the room's quota    │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L4  Shape        10kb body cap · type, length and enum checks before     │
   │                   any value is used · 413 and 400 rather than a stack     │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L5  Identity     bearer token → HMAC lookup → user id. One function.     │
   │                   No route reaches data without passing through it.       │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L6  Isolation    every query scoped by that user id · prepared           │
   │                   statements only · no SQL built by concatenation         │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L7  Minimisation privacy mask applied before serialisation · the model   │
   │                   gets a ~1KB projection, never the full record           │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L8  Egress       exactly one outbound call in the system, to 127.0.0.1   │
   ├───────────────────────────────────────────────────────────────────────────┤
   │  L9  Response     no-store on everything financial · generic errors ·     │
   │                   upstream bodies logged, never forwarded                 │
   └───────────────────────────────────────────────────────────────────────────┘
```

### Shipped

<details open>
<summary><b>🔑 Authentication — nothing secret ships to the browser</b></summary>

| Control | How |
|---|---|
| **No credential in the bundle** | `NEXT_PUBLIC_PAISE_API_KEY` is gone. It was one string for every visitor, readable in the sources panel, and unrevocable without a redeploy. `frontend/.env.example` now contains nothing secret at all |
| **Codes are generated, not accepted** | `crypto.randomInt` — rejection-sampled, so uniform and unpredictable. `Math.random() * 900000` is neither |
| **Codes are stored as HMACs** | `HMAC-SHA256(challengeId:code, pepper)`. A copy of the database does not contain a usable code |
| **Codes expire** | 5 minutes, `OTP_TTL_MS` |
| **Codes are single-use** | Marked consumed on success; a replay of the same challenge fails |
| **Codes are attempt-capped** | 5 wrong guesses burns the challenge, `OTP_MAX_ATTEMPTS` |
| **Requesting a new code kills the old** | Every outstanding challenge for that number is consumed first, so an old code can't be replayed |
| **Constant-time comparison** | `crypto.timingSafeEqual` over fixed-length digests — no early return to time |
| **Failures are indistinguishable** | Unknown challenge, wrong code and spent code all return the same 401. Only *expired* and *locked* differ, because the user has to act on those |
| **Sessions are 256 bits from the CSPRNG** | `crypto.randomBytes(32)`, base64url. Not a JWT — nothing to forge, nothing to decode |
| **Sessions are stored as HMACs too** | The token is returned once and never written down. A leaked `paise.db` is not a set of working sessions |
| **Sessions expire and can be destroyed** | 24h default; Log out revokes server-side, and `logout-all` kills every device — the one thing a shared secret could never offer |
| **Expired rows are swept** | Every 10 minutes, not left to accumulate |
| **The pepper is not in the repo** | `PAISE_AUTH_SECRET` from the environment, or generated once and stored so a local demo needs no configuration |

*`backend/auth.js` · `frontend/lib/session.js`*

</details>

<details open>
<summary><b>🧱 Isolation — one dataset per account, and no way across</b></summary>

- **Every read is scoped by session user id.** There is no query in `db.js` that
  runs without one. Not "should not" — the functions do not accept anything
  else.
- **Accounts are cloned, not shared.** A verified code provisions a user and
  gives them a row-level copy of the template. Two phones signing in get two
  datasets, not two views of one object.
- **The clone is one transaction.** A half-provisioned account is never
  observable.
- **The template is unreachable.** It lives under a reserved owner id `0`, and
  `sessions.user_id` is a foreign key into `users` — where no row with id 0
  exists. No session can resolve to it.
- **Prepared statements only.** No SQL string in `db.js` is built by
  concatenating a request value. The category parameter is checked against an
  enum read from the database before it is used at all.
- **Foreign keys are on.** `PRAGMA foreign_keys = ON` — deleting a user takes
  their whole dataset with them.

*`backend/db.js`*

</details>

<details open>
<summary><b>🙈 Data minimisation — the figures you hide are not sent</b></summary>

"Hide balances" used to be a CSS-level truth: the server sent the full numbers
and the client drew dots over them. Devtools saw straight through it.

Now the masked fields are dropped **before the response is serialised**. With
the switch on, `netWorth` leaves the server as `null` — it is not in the
payload, not in the network tab, not in a cached response, not recoverable.
Merchants are masked alongside amounts, because a merchant list identifies
spending as surely as the figures do.

It is also an *account* setting rather than a device one, so flipping it on a
laptop hides the numbers on the phone too.

The same principle governs the assistant: `/api/ask` builds a **~1KB lean
projection** — net worth, safe-to-spend, budget figures, top categories,
subscription names — never the full internal record. Nothing from the request
body reaches the prompt except the question itself.

*`maskUserData` / `maskPortfolio` / `getModelSnapshot`*

</details>

<details open>
<summary><b>🚪 Perimeter — CORS, headers, budgets, shapes</b></summary>

| Control | Setting |
|---|---|
| **CORS allowlist** | Explicit origins from `ALLOWED_ORIGINS`. **No wildcard, ever** — a rejected origin gets a 403, not a permissive default |
| **LAN escape hatch** | `ALLOW_LAN_ORIGINS` accepts RFC1918 `http:` origins so a hotspot's DHCP address doesn't mean editing `.env`. Off by default, and the boot banner says when it is on |
| **Methods and headers pinned** | `GET POST PATCH DELETE`, `Content-Type` and `Authorization`. Nothing else is negotiable |
| **Security headers** | `helmet()` — nosniff, frameguard, referrer policy, `cross-origin-resource-policy: same-site`, `x-powered-by` off. CSP is deliberately **off** rather than shipped misleadingly: this server returns only JSON, and a page-oriented CSP on it would be decoration |
| **Rate limits** | 120/min general · 10/min on the assistant · **5 per 15 min on code issuance** · 20 per 15 min on verification |
| **Keyed per session** | Signed-in traffic is counted per token, not per IP — every phone on one hotspot shares a NAT address, and an IP-only budget would have the first device exhaust it for the room. IPv6 is normalised to a /64 so one address can't mint a fresh budget per interface identifier |
| **Body cap** | 10kb, and an oversized body gets a 413 rather than a stack trace |
| **Input validation** | Type, length and enum checks before any value is used. The question is capped at 500 characters; `months` is clamped to 1–12; `tone` is an enum; the category must match a slug that exists in the database |
| **No-store** | `Cache-Control: no-store` and `Vary: Origin, Authorization` on everything under `/api`, so nothing financial lands in an intermediary |
| **Generic errors** | Upstream error bodies are logged server-side and never forwarded — they can echo the request. Clients get a fixed string |

</details>

<details open>
<summary><b>📡 Egress — one outbound call, to loopback</b></summary>

**The financial snapshot never leaves the machine.** There is exactly one
outbound request in the entire system: `/api/ask` → `127.0.0.1:11434`. No
hosted model, no API key, no per-token cost, no vendor with a copy of anyone's
spending.

The call is bounded (`AbortController`, `OLLAMA_TIMEOUT_MS`) and **cancelled
when the user closes the sheet** — a browser disconnect aborts the upstream
generation instead of leaving the runner busy on an answer nobody will read.

</details>

<details>
<summary><b>🔍 Verify any of this yourself</b></summary>

```bash
# Nothing gets in without a session
curl -i localhost:4000/api/user-data                    # 401

# A wrong code is rejected, and the attempt is counted
curl -sX POST localhost:4000/api/auth/request-otp \
  -H 'content-type: application/json' -d '{"phone":"9876543210"}'
curl -sX POST localhost:4000/api/auth/verify-otp \
  -H 'content-type: application/json' \
  -d '{"challengeId":"<id>","code":"000000"}'           # 401, attemptsLeft: 4

# With Hide balances on, the number is not in the payload
curl -s "localhost:4000/api/user-data?privacy=true" \
  -H "Authorization: Bearer <token>" | grep netWorth    # "netWorth": null

# The database holds hashes, not tokens
sqlite3 backend/paise.db 'SELECT token_hash FROM sessions LIMIT 1'
```

</details>

## ⚠️ Known limitations

Eight of the original twelve are closed — see the table at the end of
[ARCHITECTURE.md](./ARCHITECTURE.md#known-v1-tradeoffs) for what closed them.
What is left:

- **No SMS gateway.** The code is real; the delivery is a terminal, or the
  response body in demo mode.
- **The token lives in `localStorage`, not an httpOnly cookie** — see the table
  above for why, and what changes it.
- **No TLS of its own.** Everything is `http://` on a LAN.
- **The numbers are a fixture.** Every account is seeded with the same dataset.
  There is no bank, no account aggregator, no real balance behind any of it.
- **The assistant is slow.** An 8B model on CPU still takes tens of seconds to
  finish. Streaming turns the wait into reading time; it does not make it fast.
- **Rate limiting and the expiry sweep are in-process.** Single instance only.
- **No tests, no type checking.** The only gate is `eslint`.

The full list, with the reasoning behind each:
**[ARCHITECTURE.md → Known v1 tradeoffs](./ARCHITECTURE.md#known-v1-tradeoffs)**

---

<div align="center">

**[⚙️ Architecture](./ARCHITECTURE.md)** · **[🔌 API reference](./backend/README.md)** · **[🎨 Screen map](./frontend/README.md)** · **[🔒 Security](#-security)**

</div>
