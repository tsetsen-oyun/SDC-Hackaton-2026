# [App name]

> SDC Hackathon 2026 · Domain 1: Aiversecity, Future-Ready Workforce

Malaysian workers keep hearing that AI will change their jobs, but not *which of their tasks*, *when*, or *what to do about it*. This app takes a person's real week of tasks and shows:

1. **Forecast:** which tasks AI could do, year by year (2026–2035), under three adoption scenarios.
2. **Map:** future jobs that fit what's left of their week and the skills they already have, ranked by market fit, or by market fit plus the SDGs ("Market + planet").
3. **Route:** the courses to close the skill gap, with HRD Corp claimability, and the skills not worth investing in.

About **45%** of Malaysian workers have at least 40% of their tasks that today's AI could do (ISIS Malaysia & World Bank, July 2025).

## Run it

You need Node 18.11 or newer.

```bash
git clone https://github.com/tsetsen-oyun/SDG-Hackaton-2026.git
cd SDG-Hackaton-2026
npm run install:all     # installs root, backend and frontend
npm run dev             # starts the API (port 3000) and the web app together
```

Open the address Vite prints (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app together |
| `npm run dev --prefix backend` | API only (restarts when you save) |
| `npm run dev --prefix frontend` | web app only |
| `USE_MOCK=1 npm run dev` | uses the mock engine instead of the real one |

Backend settings go in `backend/.env` (never committed).

## How it's put together

```
backend/
  engine/     the forecast, match, route, mentor and skills logic (+ tests)
  mock/       a fake engine with the same response shapes, for UI work
  samples/    real example responses
  server.js   Express API
data/         cleaned data snapshots the engine reads
frontend/     React + Vite
  src/pages/        You, Forecast, Map, Route, About
  src/components/   Sidebar, ScenarioDock, Receipt, WeekSplit, MentorCard, SdgTags
  src/api.js        the only place that talks to the server
```

### API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/profiles` | sample people (Aisyah, Daniel) |
| `POST /api/forecast` | tasks → AI date range per task, hours by year, new role forming |
| `POST /api/match` | tasks + skills → ranked jobs (always returns market and planet ranks) |
| `POST /api/route` | job + skills → courses, labels by year, SDG links |
| `POST /api/mentor` | who could swap skills with you |
| `GET /api/tasks` | every task we know, for "add a task" |
| `GET /api/sources` | where every number comes from |
| `POST /api/refresh` | reload the newest data snapshot |

Errors always come back as `{ "error": "..." }` with status 400, 500 or 501.

## Principles we kept to

- **Every number has a receipt.** Tap the (i) to see the source, the date and whether it's an estimate.
- **Estimates are labelled.** Dates, scores and SDG links made by a model say "Estimate". SDG links also say "not yet checked" until a person reviews them.
- **No data is not "safe".** Tasks with no published AI date count as human work, and we say so ("X h with no AI date").
- **People stay in control.** You can change hours, remove tasks or add tasks, and every page updates. Suggestions are suggestions.
- **Mentor matches need consent.** Both people must say yes, a person approves, and age is never used.
- **If new data fails to load, we say so** and keep using the saved copy.

## Data and sources

- AI task timing: METR time-horizon research, shortened for office work (see the About page for the exact assumptions).
- Worker exposure: ISIS Malaysia & World Bank, *Novel AI Technologies and the Future of Work in Malaysia*, policy brief, July 2025.
- SDG progress ("Malaysia off track"): SDSN.
- SDG links: 516 are model estimates (Qwen3-32B), 22 come from keyword queries. None have been human-reviewed yet.
- Jobs, tasks and skills: the cleaned snapshots in `data/`.

The full, current list with dates and licences is on the **About** page (`GET /api/sources`).

## Tests

```bash
cd backend
npm test                                  # engine tests
BASE=http://localhost:3001 node smoke-test.mjs   # against a spare server
```

Run the smoke test against a **separate** server. It presses Refresh, which would use up the Refresh moment on the demo server.

## Team

- [Name]: web app (React + Express)
- [Name]: engine (forecast, match, route, mentor)
- [Name]: data cleaning and snapshots
- [Name]: design

## Limits

These are estimates to help someone decide, not predictions. Time horizons come from research on AI capability, and real adoption in Malaysian firms may be slower or faster. We have no job-demand data, so a job's outlook is only "declining" or "steady", never "rising".