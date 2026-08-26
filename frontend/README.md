# Paise frontend

Next.js (App Router) implementation of Paise. Below 900px it is the
`Paise App.dc.html` canvas screen for screen; above 900px the same screens
lay out for a desktop window. One app at two densities, not two products.

## Run it

```bash
npm install
cp .env.example .env.local   # only needed if you change the API URL/key
npm run dev                  # http://localhost:3000
```

The backend must be running too — `cd ../backend && npm start`. Port 3000 is
not arbitrary: it's the origin the backend's CORS allowlist permits by
default.

## Routes

| Route       | Screen                                                    |
|-------------|-----------------------------------------------------------|
| `/`         | Home — headline figures + assistant cards                 |
| `/money`    | Money — net worth, milestones, Cash flow / Insights tabs  |
| `/invest`   | Invest — portfolio, holdings, SIPs, goals                 |
| `/settings` | Settings — accounts, privacy, assistant tone              |
| `/empty`    | First run, nothing connected                              |
| `/login`    | Phone entry                                               |
| `/otp`      | Code entry                                                |
| `/profile`  | Onboarding step 2                                         |
| `/connect`  | Onboarding step 3 — account aggregator sources            |

`/money?tab=insights` deep-links the Insights tab; that's where the Home
assistant cards send you. "Ask Paise" is a sheet over whichever screen you're
on, opened from the tab bar or any card's primary action.

## Where the data comes from

| Screen data                                              | Source                    |
|----------------------------------------------------------|---------------------------|
| Net worth, safe-to-spend, milestones, categories, transactions, accounts | `GET /api/user-data` |
| Home assistant cards (copy changes with tone)            | `GET /api/insights?tone=` |
| Ask sheet's Jun/Jul/Aug chart                            | `GET /api/spending-trend` |
| Ask sheet answers                                        | `POST /api/ask`           |
| Holdings, SIPs, goals, transaction detail copy, "money in" | `data/mock.js`          |

`data/mock.js` exists because the design shows content the prototype backend
doesn't serve yet. When those endpoints land, delete from that file and fetch
instead — nothing else needs to change.

Two figures that look interchangeable are not: `safeToSpend` (day-to-day, on
Home and the Cash flow tab) and `monthEndForecast.remaining` (the burn-rate
projection, shown as Invest's "idle cash"). The backend README calls this
out; keep them separate.

## Settings that actually do something

- **Hide balances** masks every figure as `₹ • • •`. It's the design's
  `privacyMode` prop, and the `HIDE` / `SHOW` toggles on Money and Invest
  flip the same switch.
- **Tone** swaps the assistant between Direct and Warm, refetching
  `/api/insights` with the new tone.

Both persist to `localStorage` under `paise.settings`.

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

- Real auth. `/login` → `/otp` → `/profile` → `/connect` accept any input and
  just advance; there's no session, and the backend has no user model.
- Non-navigating buttons: Edit profile, Recategorise, Split, See all,
  Add a goal, Data & consents, Delete my data, Notifications.
- The editorial photo slot on Home and first-run is the design's hatched
  placeholder, waiting on real art.
