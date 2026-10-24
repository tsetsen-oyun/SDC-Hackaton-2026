# Unbundle

> Unbundle shows Malaysian workers which of their own tasks AI could do and when, which future jobs fit what is left, and which courses to take, so AI works *for* them, not instead of them.

*Jobs don't disappear, they unbundle.*

---

## Team Information

| Field                  | Details                                                   |
| ---------------------- | --------------------------------------------------------- |
| **Team Name**          | Really cool team name                                      |
| **Team Domain**        | Domain 1: Aiversecity, Future-Ready Workforce             |
| **SDG Track (1–17)**   | SDG 4 — Quality Education (with SDG 8 — Decent Work and Economic Growth as a second goal)         |
| **Team Leader**        | Amina Zaatir                                              |
| **University**         | Xiamen University Malaysia                                |
| **Number of Members**  | 4                                                         |

## Links

| Resource          | Link                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| GitHub Repository | https://github.com/tsetsen-oyun/SDC-Hackaton-2026                    |
| Replit Project    | https://unbundle.replit.app/                      |
| Live Demo         | https://unbundle.replit.app/                                |
| RunPod Endpoint   | Runpod public endpoint, Qwen3-32B-AWQ (offline SDG drafting + optional free-text intake |
| Slide Deck        | https://drive.google.com/drive/folders/1zW5P7GUSPqTIIrvDHGhwADO5T9NUOT9G?usp=sharing                                          |
| Demo Video        | https://youtu.be/eod7YEGtNoE                                          |

---

## Overview

### Problem

About **45%** of Malaysian workers have at least 40% of their tasks that today's AI could do (ISIS Malaysia & World Bank, July 2025). Workers keep hearing that AI will change their jobs, but not *which of their tasks*, *when*, or *what to do about it*. Reskilling money, including HRD Corp-claimable training, is wasted when it goes to skills AI will soon cover, and the cost of displacement falls hardest on the workers least able to absorb it. Malaysia is also flagged as off track on SDG 4 (quality education and skills) in the Sustainable Development Report 2026 (SDSN).

### Solution

Unbundle takes a person's real week of tasks and splits it into the parts AI could take over and the parts that stay human. It then maps the future jobs that fit what is left, and the courses that close the skill gap. The forecast covers 2026–2035 under three AI-adoption scenarios, and every number links to its source, its date and whether it is an estimate.

AI is used in two places, and both are disclosed. Task timing builds on published AI-capability research (METR) and exposure data (Anthropic Economic Index, O\*NET). A language model (Qwen3-32B-AWQ) drafted the job-to-SDG links once, offline; these are labelled "Estimate" until a person reviews them. The running app has one optional AI feature: free-text intake on the Build page, which uses a hosted model (Qwen3-32B on our RunPod endpoint) to suggest tasks and skills from a person's own words (see *AI-Assisted Free-Text Intake* below). It never writes forecasts, scores, jobs or courses. The app's only other outside call is the Refresh button fetching METR's published AI-progress data (see *Live Trend Data* below).

### Key Features

- **Forecast** — Which tasks AI could do, year by year (2026–2035), under three scenarios (slowdown, normal pace, fast pace).
- **Map** — Future jobs that fit what is left of your week and the skills you already have, ranked by market fit, or by market fit plus the SDGs ("Market + planet").
- **Route** — The courses that close the skill gap, with HRD Corp claimability, the skills not worth investing in, and the SDG links of each step.
- **Build your own profile** — Describe your week in your own words (AI-assisted, optional), pick tasks and skills, or paste a CV to find skills in it. The CV text is read in your browser and is never uploaded or stored.
- **Mentor matches** — Who could swap skills with you. Both people must consent, a person approves, and age is never used.
- **Receipts** — Tap (i) next to any number to see the source, the date and whether it is an estimate.
- **Refresh data** — Fetches METR's latest AI-progress data live, rebuilds the forecast if it changed, and tells you plainly if the fetch failed and the saved copy is used instead.

### Tech Stack

| Layer         | Technology                                                        |
| ------------- | ----------------------------------------------------------------- |
| Frontend      | React 19, Vite, React Router                                      |
| Backend       | Node.js 22, Express 5                                             |
| Database      | None. Versioned CSV data snapshots kept in Git (`data/snapshots/`) |
| AI / Compute  | Qwen3-32B-AWQ on Runpod (offline, one-off drafting of SDG links); RunPod-hosted model for optional free-text intake (checked, with keyword fallback) |
| Hosting / Dev | https://unbundle.replit.app/                                  |

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
│   ├── SDC2026_Really cool team name_Preliminary.pdf      # Preliminary submission
│   ├── SDC2026_Really cool team name_TechDeclaration.pdf  # Technology declaration
│   ├── SDC2026_Really cool team name_Replit_POU.pdf       # Replit proof of use
│   └── SDC2026_Really cool team name_Runpod_POU.pdf       # RunPod proof of use
├── package.json
└── README.md
```

### Architecture

```
User ──► React web app (Vite) ──► Express API ──► Engine ──► CSV data snapshots
                                     │              │
                                     │              └──► Forecast / Map / Route responses
                                     │                   (every number carries its source)
                                     │
                                     ├──► Runpod endpoint (Qwen3-32B)   optional free-text intake;
                                     │                                  picks checked by code, keyword fallback
                                     │
                                     └──► METR public data file         Refresh button; validated, saved as a
                                                                        new dated snapshot or ignored if it fails

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
| `POST /api/intake` | Free text about your week → suggested tasks and skills from our own lists (a hosted model if a key is set, keyword matching otherwise) |
| `GET /api/tasks` | Every task we know, for "add a task" |
| `GET /api/skills` | Every skill we know, for the profile builder and CV finder |
| `GET /api/sources` | Where every number comes from |
| `POST /api/refresh` | Fetch METR's latest AI-progress data live, build a new dated snapshot if it changed, and load it (falls back to the saved snapshot if the fetch fails) |

---

## How to Run

You need **Node.js 22**.
There is no `requirements.txt` because the project has no Python dependencies; Node installs everything from `package.json`.

### Option 1 — Run on Replit (https://unbundle.replit.app/)



1. Import this repository via **Create Repl → Import from GitHub**.
2. Run `npm run install:all`, then `npm run dev`.
3. Optional: add RUNPOD_API_KEY (and INTAKE_PROVIDER=runpod) in Secrets to turn on AI intake. Without it, the app uses keyword matching.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/tsetsen-oyun/SDC-Hackaton-2026.git
cd SDC-Hackaton-2026

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

This runs the 111 engine tests (`node --test backend/engine/test/*.test.js`).

---

## How We Use Replit *(Required)*

Deployment of our project "Unbundle" is on Replit Autoscale: https://unbundle.replit.app/

- **Hosting:** deployed with Replit Deployments at the Live Demo link above
- **Secrets:** RUNPOD_API_KEY is stored in Replit Secrets (optional feature). Nothing secret is committed.
  
📄 Proof of use: [`submission/SDC2026_Really_cool_team_name_Runpod_POU.pdf`](submission/SDC2026_Really_cool_team_name_Replit_POU.pdf)

## How We Use RunPod *(Required)*

- **Workload:** Qwen3-32B-AWQ ran on a Runpod public endpoint to draft job-to-SDG links (516 of the 549 links in our data). This was done once, offline, on 2026-10-21.
- **Why offline:** the links are stored in `data/snapshots/*/sdg_links.csv` and labelled "Estimate" until a person reviews them. At runtime Runpod is used only for the optional free-text intake. If Runpod is down, the app falls back to keyword matching and still works.

📄 📄 Proof of use: [`submission/SDC2026_Really_cool_team_name_Runpod_POU.pdf`](submission/SDC2026_Really_cool_team_name_Runpod_POU.pdf)

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

## AI-Assisted Free-Text Intake

On the Build page a person can describe their week in their own words ("I record invoices in accounting software and answer supplier calls"). The language model never writes anything the person sees. It only **picks from lists we already have**:

1. **We shortlist first, without AI.** Word overlap finds up to 60 candidate tasks and 90 skills from our own data. Only that shortlist is sent to the model, together with the person's text.
2. **The model must quote the person.** For every pick it returns the words from the text that justify it.
3. **We check every pick.** Anything not on the shortlist, duplicated, or whose quote has nothing to do with the text is thrown away. Names, jobs and hours shown on screen come from our data files, and hours the person did not state are marked "(guess)".
4. **The person decides.** Suggestions are chips; nothing joins the profile until they click it.
5. **It fails safe.** If there is no key, the app falls back to keyword matching and says so. Limits: 8 requests a minute per visitor, a daily cap (`INTAKE_DAILY_CAP`), 3,000 characters, and repeated texts are answered from memory.

The text is not saved or logged. It is sent to the model only when a key is set (`RUNPOD_API_KEY`). Please use made-up descriptions, not real personal details.

```bash
# backend/.env  (never committed; on Replit use Secrets)
RUNPOD_API_KEY=...                    # our RunPod endpoint (Qwen/Qwen3-32B-AWQ, OpenAI-compatible)
INTAKE_PROVIDER=runpod               
npm run eval:intake                   # keyword matching vs the AI helper on 8 made-up cases
```

## Principles We Kept To

- **Every number has a receipt.** Tap the (i) to see the source, the date and whether it is an estimate.
- **Estimates are labelled.** Dates, scores and SDG links made by a model say "Estimate".
- **No data is not "safe".** No data is not evidence of safety. Tasks with no published AI timing are counted as human work for now, and we flag this as a limitation.
- **People stay in control.** You can change hours, remove tasks or add tasks, and every page updates. Suggestions are suggestions.
- **Your CV stays on your device.** It is read in the browser and never uploaded or stored.
- **The AI never writes what you see.** In free-text intake it can only pick from our own lists, every pick is checked, and you confirm each one.
- **If new data fails to load, we say so** and keep using the saved copy.

---

## Challenges & Learnings

- **Data we could not find.** Only 66% (102 of 154) of the skills missing for our 7 target jobs have any course in our catalogue, and none of the 96 courses has a checked HRD Corp claim status. We show this gap openly ("No course in our list yet") instead of filling it with guesses. Anthropic’s usage data covers only Claude conversations and is not specific to Malaysia.
- **Estimates vs. facts.** Most SDG links are model estimates, so we label them and show "not yet checked" until a person reviews them.
- **Making numbers trustworthy.** Putting a source, a date and an "Estimate" label behind every figure changed how we designed the engine and the interface.
- **Accessibility.** We checked colour contrast, avoided relying on colour alone, and made the layout work on phones.
  

## Future Improvements

- [ ] Have people review the model-estimated SDG links
- [ ] Check the HRD Corp claim status of every course
- [ ] Read CVs in PDF and Word format, with a larger skill vocabulary
- [ ] Add a Bahasa Malaysia version
- [ ] Add more roles beyond the current 12

## Team

| Name | Role | GitHub |
| ---- | ---- | ------ |
| Amina Zaatir | Backend | https://github.com/AminaZa |
| Tsetsen-Oyun Zolbayar| Frontend | https://github.com/tsetsen-oyun |
| Seidir Dariga | Data cleaning and snapshots | https://github.com/dariga12 |
| Tleubay Almaz | Coordinator, documentation | https://github.com/almvvz |

---

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE)
