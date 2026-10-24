# Unbundle

> Unbundle shows Malaysian workers which of their own tasks AI could do and when, which future jobs fit what is left, and which courses to take, so AI works *for* them, not instead of them.

*Jobs don't disappear, they unbundle.*

---

## Team Information

| Field                  | Details                                                   |
| ---------------------- | --------------------------------------------------------- |
| **Team Name**          | Really cool team name                                      |
| **Team Domain**        | Domain 1: Aiversecity, Future-Ready Workforce             |
| **SDG Track (1–17)**   | SDG 8 — Decent Work and Economic Growth (with SDG 4 — Quality Education as a second goal)         |
| **Team Leader**        | Amina Zaatir                                              |
| **University**         | Xiamen University                                         |
| **Number of Members**  | 4                                                         |

## Links

| Resource          | Link                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| GitHub Repository | https://github.com/tsetsen-oyun/SDG-Hackaton-2026                    |
| Replit Project    | [CONFIRM: Replit link, or remove if not used]                        |
| Live Demo         | [CONFIRM: live URL, once deployed]                                   |
| RunPod Endpoint   | Not applicable: Runpod was used offline only (see "How We Use RunPod") |
| Slide Deck        | [CONFIRM: slide deck link]                                           |
| Demo Video        | [CONFIRM: demo video link]                                           |

---

## Overview

### Problem

About **45%** of Malaysian workers have at least 40% of their tasks that today's AI could do (ISIS Malaysia & World Bank, July 2025). Workers keep hearing that AI will change their jobs, but not *which of their tasks*, *when*, or *what to do about it*. Reskilling money, including HRD Corp-claimable training, is wasted when it goes to skills AI will soon cover, and the cost of displacement falls hardest on the workers least able to absorb it. Malaysia is also flagged as off track on SDG 4 (quality education and skills) in the Sustainable Development Report 2026 (SDSN).

### Solution

Unbundle takes a person's real week of tasks and splits it into the parts AI could take over and the parts that stay human. It then maps the future jobs that fit what is left, and the courses that close the skill gap. The forecast covers 2026–2035 under three AI-adoption scenarios, and every number links to its source, its date and whether it is an estimate.

AI is used in two places, and both are disclosed. Task timing builds on published AI-capability research (METR) and exposure data (Anthropic Economic Index, O\*NET). A language model (Qwen3-32B-AWQ) drafted the job-to-SDG links once, offline; these are labelled "Estimate" until a person reviews them. The running app calls no AI API. Its only outside call is the Refresh button fetching METR's published AI-progress data (see *Live Trend Data* below).

### Key Features

- **Forecast** — Which tasks AI could do, year by year (2026–2035), under three scenarios (slowdown, normal pace, fast pace).
- **Map** — Future jobs that fit what is left of your week and the skills you already have, ranked by market fit, or by market fit plus the SDGs ("Market + planet").
- **Route** — The courses that close the skill gap, with HRD Corp claimability, the skills not worth investing in, and the SDG links of each step.
- **Build your own profile** — Create a profile by picking tasks and skills, or paste a CV to find skills in it. The CV text is read in your browser and is never uploaded or stored.
- **Mentor matches** — Who could swap skills with you. Both people must consent, a person approves, and age is never used.
- **Receipts** — Tap (i) next to any number to see the source, the date and whether it is an estimate.
- **Refresh data** — Fetches METR's latest AI-progress data live, rebuilds the forecast if it changed, and tells you plainly if the fetch failed and the saved copy is used instead.

### Tech Stack

| Layer         | Technology                                                        |
| ------------- | ----------------------------------------------------------------- |
| Frontend      | React 19, Vite, React Router                                      |
| Backend       | Node.js 22, Express 5                                             |
| Database      | None. Versioned CSV data snapshots kept in Git (`data/snapshots/`) |
| AI / Compute  | Qwen3-32B-AWQ on Runpod (offline, one-off drafting of SDG links)  |
| Hosting / Dev | [CONFIRM: Replit or other host]                                   |

---

## Project Structure

```
.
├── backend/
│   ├── engine/              # Forecast, match, route, mentor and skills logic (+ tests)
│   ├── mock/                # Fake engine with the same response shapes, for UI work
│   ├── samples/             # Example responses
│   └── server.js            # Express API
├── data/
│   └── snapshots/           # Dated, cleaned CSV snapshots the engine reads
├── examples/                # Example forecast and match outputs
├── frontend/
│   └── src/
│       ├── pages/           # You, Forecast, Map, Route, About
│       ├── components/      # Sidebar, PeopleDock, ProfileBuilder, WeekSplit, ...
│       ├── api.js           # The only place that talks to the server
│       └── cv.js            # Finds skills in pasted CV text (runs in the browser)
├── submission/              # Required submission documents
│   ├── SDC2026_TeamName_Preliminary.pdf      # Preliminary submission
│   ├── SDC2026_TeamName_TechDeclaration.pdf  # Technology declaration
│   ├── SDC2026_TeamName_Replit_POU.pdf       # Replit proof of use
│   └── SDC2026_TeamName_Runpod_POU.pdf       # RunPod proof of use
├── package.json
└── README.md
```

### Architecture

```
User ──► React web app (Vite) ──► Express API ──► Engine ──► CSV data snapshots
                                                     │
                                                     └──► Forecast / Map / Route responses
                                                          (every number carries its source)

Offline, one-off:  public sources ──► cleaned CSVs ──► Qwen3-32B (Runpod) drafts SDG links
                                                       (stored as "Estimate")
```

### API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/profiles` | Sample people (Aisyah, Daniel) |
| `POST /api/forecast` | Tasks → AI date range per task, hours by year, new role forming |
| `POST /api/match` | Tasks + skills → ranked jobs (market and planet ranks) |
| `POST /api/route` | Job + skills → courses, labels by year, SDG links |
| `POST /api/mentor` | Who could swap skills with you |
| `GET /api/tasks` | Every task we know, for "add a task" |
| `GET /api/skills` | Every skill we know, for the profile builder and CV finder |
| `GET /api/sources` | Where every number comes from |
| `POST /api/refresh` | Fetch METR's latest AI-progress data live, build a new dated snapshot if it changed, and load it (falls back to the saved snapshot if the fetch fails) |

---

## How to Run

You need **Node.js 22** (18.11 or newer also works). There is no `requirements.txt` because the project has no Python dependencies; Node installs everything from `package.json`.

### Option 1 — Run on Replit

[CONFIRM: only keep this if the team deploys on Replit]

1. Import this repository via **Create Repl → Import from GitHub**.
2. Run `npm run install:all`, then `npm run dev`.
3. No secrets are needed: the running app calls no external API.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/tsetsen-oyun/SDG-Hackaton-2026.git
cd SDG-Hackaton-2026

# 2. Install everything (root, backend and frontend)
npm run install:all

# 3. Run the API (port 3000) and the web app together
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app together |
| `npm run demo` | Same, but starts on the oldest data snapshot so **Refresh data** visibly changes the rankings |
| `npm run build` | Builds the web app for production |
| `USE_MOCK=1 npm run dev` | Uses the mock engine instead of the real one (different sample people, for UI work only) |

Backend settings, if you need any, go in `backend/.env` (never committed).

### Run Tests

```bash
npm test
```

This runs the 89 engine tests (`node --test backend/engine/test/*.test.js`).

---

## How We Use Replit *(Required)*

[CONFIRM: describe how the team used Replit. Delete anything that is not true.]

- **Hosting:** [e.g. deployed with Replit Deployments at the Live Demo link above]
- **Secrets:** The app needs no API keys. Nothing secret is committed to the repository.

📄 Proof of use: [`submission/SDC2026_TeamName_Replit_POU.pdf`](submission/SDC2026_TeamName_Replit_POU.pdf)

## How We Use RunPod *(Required)*

- **Workload:** Qwen3-32B-AWQ ran on a Runpod public endpoint to draft job-to-SDG links (516 of the 549 links in our data). This was done once, offline, on 2026-10-21.
- **Why offline:** the links are stored in `data/snapshots/*/sdg_links.csv` and labelled "Estimate" until a person reviews them. The running app makes no Runpod or other AI API calls, so it works even if Runpod is down.
- **Integration:** [CONFIRM: describe the script or notebook used to call the endpoint, and whether it is in the repository]

📄 Proof of use: [`submission/SDC2026_TeamName_Runpod_POU.pdf`](submission/SDC2026_TeamName_Runpod_POU.pdf)

---

## Data and Sources

| What | Source |
| --- | --- |
| Worker exposure to AI | ISIS Malaysia & World Bank, *Novel AI Technologies and the Future of Work in Malaysia*, policy brief, July 2025 |
| AI task timing | METR time-horizon data, fetched live on Refresh (shortened for office work; see the About page for the exact assumptions); Whitfill, Snodin and Becker (2025), arXiv:2511.19492; Anthropic Economic Index (2026) |
| Jobs and tasks | O\*NET 31.0, US BLS, DOSM |
| Skills | ESCO |
| Courses | Coursera and Microsoft Learn catalogues |
| SDG targets and progress | UN Statistics Division SDG API; SDSN *Sustainable Development Report 2026* (use confirmed by SDSN by email, 21 Oct 2026); Aurora |
| SDG links | 516 drafted by Qwen3-32B (estimates), 22 from Aurora, 11 reviewed by the team |

Only sample and synthetic people are used. No real CVs or personal data are in the repository.

## Live Trend Data

The AI-trend signal layer is **fetched live**, not typed in. When you press **Refresh data**:

1. The server downloads METR's published time-horizon file ([`benchmark_results_1_1.yaml`](https://metr.org/assets/benchmark_results_1_1.yaml)), with an 8-second timeout.
2. `backend/engine/ingest.js` parses it and **checks it** (enough models, sane dates and units, plausible doubling times). A file that fails the checks is never used.
3. If it differs from the newest saved snapshot, a new dated folder is written to `data/snapshots/` with METR's numbers (`ai_progress.csv`, `scenarios.csv`). Every other file is copied from the previous snapshot. METR's raw file is saved next to it as evidence, and `manifest.json` records `fetched_live` and the fetch time.
4. The engine loads the new snapshot, so the forecast, the match and the route all change.

**If the fetch or the checks fail**, Refresh says why and keeps using the newest saved snapshot. This is our plan for the biggest risk: METR changing its file format or being unreachable.

```bash
npm run ingest:check   # downloads METR's real file and prints what we would use; writes nothing
npm run ingest:now     # same as the Refresh button, from the terminal
```

Not live yet: the Anthropic Economic Index task times, ESCO, O\*NET, SDSN and the course list are saved snapshots with their dates on the About page.

## Principles We Kept To

- **Every number has a receipt.** Tap the (i) to see the source, the date and whether it is an estimate.
- **Estimates are labelled.** Dates, scores and SDG links made by a model say "Estimate".
- **No data is not "safe".** Tasks with no published AI date count as human work, and we say so.
- **People stay in control.** You can change hours, remove tasks or add tasks, and every page updates. Suggestions are suggestions.
- **Your CV stays on your device.** It is read in the browser and never uploaded or stored.
- **If new data fails to load, we say so** and keep using the saved copy.

---

## Challenges & Learnings

- **Data we could not find.** Only 66% (102 of 154) of the skills missing for our 7 target jobs have any course in our catalogue, and none of the 96 courses has a checked HRD Corp claim status. We show this gap openly ("No course in our list yet") instead of filling it with guesses.
- **Estimates vs. facts.** Most SDG links are model estimates, so we label them and show "not yet checked" until a person reviews them.
- **Making numbers trustworthy.** Putting a source, a date and an "Estimate" label behind every figure changed how we designed the engine and the interface.
- **Accessibility.** We checked colour contrast, avoided relying on colour alone, and made the layout work on phones.
- [CONFIRM: add one or two team-specific lessons]

## Future Improvements

- [ ] Have people review the model-estimated SDG links
- [ ] Check the HRD Corp claim status of every course
- [ ] Read CVs in PDF and Word format, with a larger skill vocabulary
- [ ] Add a Bahasa Malaysia version
- [ ] Add more roles beyond the current 12

## Team

| Name | Role | GitHub |
| ---- | ---- | ------ |
| Amina Zaatir | Backend | [@username](https://github.com/username) |
| Tsetsen-Oyun Zolbayar| Frontend | [CONFIRM] |
| Seidir Dariga | Data cleaning and snapshots | [CONFIRM] |
| Tleubay Almaz | Coordinator, documentation | [CONFIRM] |

---

## Submission Checklist

- [ ] Team name, domain (Domain 1) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/` [CONFIRM: is Replit required for our entry?]
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Preliminary submission completed (`SDC2026_TeamName_Preliminary.pdf`)
- [ ] Technology declaration completed (`SDC2026_TeamName_TechDeclaration.pdf`)
- [ ] Submission files renamed with your team name (replace `TeamName`)
- [ ] "How to Run" steps verified
- [ ] No API keys or secrets committed to the repository

## License

Licensed under the Apache License 2.0. See (LICENSE)
