# Paise frontend

Next.js (App Router) implementation of Paise. Below 900px it is the
`Paise App.dc.html` canvas screen for screen; above 900px the same screens
lay out for a desktop window. One app at two densities, not two products.

## Run it

```bash
npm install
cp .env.example .env.local   # only needed if you change the API URL/port
npm run dev                  # http://localhost:3000
```

The backend must be running too — `cd ../backend && npm start`. Port 3000 is
not arbitrary: it's the origin the backend's CORS allowlist permits by
default.

There is no credential in this bundle. Auth is a session token the backend
mints at sign-in and `lib/session.js` holds per browser; the shared
`NEXT_PUBLIC_PAISE_API_KEY` that used to be compiled in is gone.

## Routes

| Route       | Screen                                                    |
|-------------|-----------------------------------------------------------|
| `/`         | Home — headline figures + assistant cards                 |
| `/money`    | Money — net worth, milestones, Cash flow / Insights tabs  |
| `/invest`   | Invest — portfolio, holdings, SIPs, goals                 |
| `/settings` | Settings — accounts, privacy, assistant tone              |
| `/empty`    | First run, nothing connected                              |
| `/login`    | Phone entry — `POST /api/auth/request-otp`                |
| `/otp`      | Code entry — `POST /api/auth/verify-otp`, mints the session|
| `/profile`  | Onboarding step 2                                         |
| `/connect`  | Onboarding step 3 — account aggregator sources            |

`/money?tab=insights` deep-links the Insights tab; that's where the Home
assistant cards send you. "Ask Paise" is a sheet over whichever screen you're
on, opened from the tab bar or any card's primary action.

## Where the data comes from

| Screen data                                              | Source                    |
|----------------------------------------------------------|---------------------------|
| Net worth, safe-to-spend, milestones, categories, transactions (with their expanded detail), "money in", accounts | `GET /api/user-data` |
| Portfolio, holdings, active SIPs, goals                  | `GET /api/portfolio`      |
| Name, initials, phone, age                               | `GET /api/profile`        |
| Home assistant cards (copy changes with tone)            | `GET /api/insights?tone=` |
| Money and Invest assistant cards                         | `GET /api/screen-insights?screen=` |
| Cards closed with "Not now"                              | `GET/POST /api/dismissed` |
| Hide balances, tone                                      | `GET/PATCH /api/settings` |
| Ask sheet's Jun/Jul/Aug chart                            | `GET /api/spending-trend` |
| Ask sheet answers (streamed)                             | `POST /api/ask`           |
| The editorial feature card and the Ask sheet's seed thread | `data/mock.js`          |

`data/mock.js` is down to 42 lines, and none of it is account data — holdings,
SIPs, goals, transaction detail copy, the profile and the category colours all
come from the API now. What's left is design content that isn't anybody's
money: the feature card, and the seeded exchange the Ask sheet opens on.

Two figures that look interchangeable are not: `safeToSpend` (day-to-day, on
Home and the Cash flow tab) and `monthEndForecast.remaining` (the burn-rate
projection, shown as Invest's "idle cash"). The backend README calls this
out; keep them separate.

## Settings that actually do something

- **Hide balances** masks every figure as `₹ • • •`. It's the design's
  `privacyMode` prop, and the `HIDE` / `SHOW` toggles on Money and Invest
  flip the same switch. It is enforced on the server: with it on, the hidden
  figures come back as `null` and are refetched when you flip it, so devtools
  has nothing to see through.
- **Tone** swaps the assistant between Direct and Warm, refetching
  `/api/insights` with the new tone.
- **Not now** on an assistant card now outlives the session — the id goes to
  `/api/dismissed` and the card stays gone across reloads and devices.

Both settings belong to the account, not the browser: they're written through
to `PATCH /api/settings`. `localStorage["paise.settings"]` is only a
first-paint cache so a reload doesn't flash the wrong tone; the server's copy
wins as soon as `/api/auth/me` answers.

## Layout

`components/AppShell.jsx` owns both shells. Under 900px: the design's 430px
column with the bottom tab bar. Over 900px: a sticky sidebar
(`components/Sidebar.jsx`) on the canvas colour, and a content column capped
at 1080px. Pre-login screens use `components/AuthLayout.jsx` instead, which
splits into a brand panel and a form column.

What changes at 900px:

| | Phone | Desktop |
|---|---|---|
| Navigation | Bottom tab bar | Left sidebar; Ask is an action, not a tab |
| Home, first run | One column | Figures band across the top, cards left, the essay slot right |
| Money | Stacked | Transactions left, connected accounts right; breakdown left, assistant cards right |
| Invest | Stacked | Figures paired across the top, holdings and SIPs left, goals right, insights 2-up |
| Settings | Full width | 660px measure |
| Login, OTP, profile, connect | One column | Brand panel left, form right; account sources in a 2-up grid |
| Ask Paise | Bottom sheet | Right slide-over, 460px |

The fork is narrow on purpose. `styles/desktop.css` holds every
`min-width: 900px` rule and nothing else, and the screens carry three
structural classes — `.split`, `.col-main`, `.col-side` — that are
`display: contents` on phone, so the phone layout renders as if the wrappers
weren't there. Nothing about the mobile design is reachable from a desktop
edit by accident.

Styling is otherwise one stylesheet, `styles/app.css`, with the design's
palette and type scale in `styles/tokens.css`. Values are the canvas's own
(including its graded set of border colours), so a class like `.card` or
`.pill-dark` maps back to a specific element in the design.

## Not built yet

- Real code delivery. `/login` → `/otp` is a genuine challenge now — the code
  is generated, hashed, expiring, single-use and attempt-capped — but there is
  no SMS gateway behind it, so the code arrives in the backend terminal (or in
  the response body when the backend runs `OTP_DELIVERY=response`). `/profile`
  and `/connect` are still navigation only.
- The token lives in `localStorage` rather than an httpOnly cookie, because the
  API is a different origin over plain HTTP on a LAN demo. Behind TLS that
  becomes a one-file change in `lib/session.js`.
- Non-navigating buttons: Edit profile, Recategorise, Split, See all,
  Add a goal, Data & consents, Delete my data, Notifications.
- The editorial photo slot on Home and first-run is the design's hatched
  placeholder, waiting on real art.
