# Paise

Personal finance app — "safe to spend", cash flow, category insights,
and an AI assistant ("Ask Paise") over your accounts.

## Structure

```
paise/
├── backend/     Express API — see backend/README.md
└── frontend/    Next.js mobile app — see frontend/README.md
```

## Getting started

Two terminals — the frontend expects the API on port 4000, and the
backend's CORS allowlist expects the frontend on port 3000.

```bash
cd backend
npm install
cp .env.example .env
npm start           # http://localhost:4000
```

```bash
cd frontend
npm install
npm run dev         # http://localhost:3000
```

See [`backend/README.md`](./backend/README.md) for the full API
reference, security notes, and what's still prototype-only, and
[`frontend/README.md`](./frontend/README.md) for the screen map and
where each number on screen comes from.

The frontend covers phone and desktop from the same screens — see
`frontend/README.md` for what changes at the 900px breakpoint.
