# SIMSAR — the fair broker

*"Simsar"* is the Hindi/Urdu word for a broker. SIMSAR is a **fair** one: a marketplace where employers (households and businesses) hire background-checked tradespeople — electricians, plumbers, carpenters, painters, tailors, AC technicians and masons — with:

- **One transparent, fixed platform fee** (default 5%, a config value) shown on every job as *budget → SIMSAR fee → worker payout*, and locked in when the job is posted.
- **An enforced wage floor.** Every trade has a fair minimum hourly rate, stored in the database and editable by the admin. A job whose worker payout per hour falls below it is rejected by the server (SDG target 8.5 as a validation rule).
- **Background-checked workers.** Workers must pass an admin-reviewed background check before they can apply for jobs.
- **ITI Certified badge (optional).** Workers can upload their ITI (Industrial Training Institute) certificate; once an admin has checked it against the scan, the worker gets an "ITI Certified · <trade>" badge. Employers can mark a job "ITI-certified workers only". *Simulated:* see [Notes](#notes-and-limitations).
- **Two-way ratings and a Work Passport.** After a job, employer and worker rate each other; completed jobs, ratings and earnings build a worker-owned record.

Full Stack Development mini project — Semester V, CSBS, Batch A1.
Team: Harmeet Bhatia (16015024010), Moiz Arsiwala (16015024004), Atharva Borreddi (16015024012). Mapped to SDG 8 and SDG 9.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 (Vite), React Router, Axios, Bootstrap 5.3 + Bootstrap Icons (same design tokens as the original static site) |
| Backend | Node.js, Express 5 REST API |
| Database | MongoDB (local) with Mongoose — database name **`simsar`** |
| Auth | JWT + bcrypt, role-based guards on the API (middleware) and in React (protected routes) |
| Security / quality | helmet, CORS, rate limiting on auth routes, express-validator, central error handler |
| File uploads | multer (memory storage, 2 MB, JPG/PNG/PDF with a file-signature check), saved to `server/uploads/` (git-ignored) |

## Prerequisites

- **Node.js 18+** (tested on Node 22) and npm
- **MongoDB Community Server running locally on port 27017**
  - Windows: install MongoDB and make sure the **MongoDB** service is running (Services app, or `net start MongoDB`)
  - macOS/Linux: `mongod` (or `brew services start mongodb-community`)
- Optional: **MongoDB Compass** to browse the data at `mongodb://localhost:27017`

## Setup

```bash
git clone https://github.com/arsiwalamoiz24/FSDL-mini-project.git
cd FSDL-mini-project

npm install                                  # installs root, server and client (npm workspaces)
cp server/.env.example server/.env           # Windows PowerShell: Copy-Item server/.env.example server/.env
npm run seed                                 # creates the "simsar" database with demo data
npm run dev                                  # starts API (port 5000) + React app (port 5173)
```

Open **http://localhost:5173**. The server prints `MongoDB connected: simsar` when it connects; if MongoDB is not running it exits with a clear error.

### Environment variables (`server/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | |
| `CLIENT_URL` | `http://localhost:5173` | allowed CORS origin(s), comma-separated. Outside production, 5173, 5174 and 5175 are always allowed (for `dev:demo`) |
| `MONGO_URI` | `mongodb://localhost:27017/simsar` | the database name **must** be `simsar` |
| `JWT_SECRET` | — | secret for signing login tokens (use a long random string) |
| `JWT_EXPIRES_IN` | `7d` | token lifetime |
| `PLATFORM_FEE_PERCENT` | `5` | SIMSAR's fixed commission (0–50). Set `0` for the original "worker keeps 100%" model |
| `AUTH_RATE_LIMIT` | *(empty)* | login/register requests per 15 min per IP. Empty = **50 in production, 1000 otherwise** (so a demo with three tabs and repeated logins never locks you out). The limiter is never switched off |

In development the Vite dev server proxies `/api` to `http://localhost:5000` (see `client/vite.config.js`), so the browser only talks to one origin. CORS is also configured for `CLIENT_URL`.

### Scripts (run from the project root)

| Command | What it does |
|---|---|
| `npm run dev` | API with nodemon + React dev server, together (`concurrently`) |
| `npm run dev:demo` | API once + **three** React dev servers (5173 employer, 5174 worker, 5175 admin) — see [Demo mode](#demo-mode-three-roles-side-by-side) |
| `npm run seed` | **drops and recreates** the `simsar` database with demo data (and the sample ITI scans in `server/uploads/iti/`) |
| `npm run seed:trades` | adds any missing default trades **without** touching existing data or rates the admin has changed |
| `npm run smoke` | end-to-end API test of every main flow (server must be running; cleans up after itself) |
| `npm run build` | production build of the React app into `client/dist` |
| `npm start` | API only, without nodemon |

## Demo accounts (after `npm run seed`)

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@simsar.in` | `Admin@123` | log in at `/login/admin` |
| Worker | `rafiq@simsar.in` | `Worker@123` | electrician, **verified**, **ITI approved** (NCVT), 1 job in progress, 2 completed |
| Worker | `sunita@simsar.in` | `Worker@123` | tailor, **verified**, **ITI approved** (SCVT), has a pending application |
| Worker | `manoj@simsar.in` | `Worker@123` | plumber, **not verified** — background check pending **and** ITI certificate pending (approve both as admin) |
| Worker | `imran@simsar.in` | `Worker@123` | carpenter, **verified**, ITI certificate **rejected** with a note — shows the "fix and re-submit" flow |
| Employer | `priya@simsar.in` | `Employer@123` | household; has open, in-progress, completed and closed jobs, plus an ITI-only electrician job |
| Employer | `arjun@simsar.in` | `Employer@123` | Sunrise Boys Hostel; has a completed job **not yet rated by the worker**, plus an ITI-only plumber job |

Each role has its **own login page** (`/login/worker`, `/login/employer`, `/login/admin`); the API refuses, for example, a worker account on the employer login.

## Demo mode: three roles side by side

```bash
npm run seed        # fresh data
npm run dev:demo    # API on 5000 + three React dev servers
```

| Tab | URL | Logged in as | Password |
|---|---|---|---|
| Employer | http://localhost:5173 | `priya@simsar.in` | `Employer@123` |
| Worker | http://localhost:5174 | `manoj@simsar.in` | `Worker@123` |
| Admin | http://localhost:5175 | `admin@simsar.in` | `Admin@123` |

Open the three URLs as three tabs in the **same** browser window. Each one can stay logged in as a different user because the login token is kept in `localStorage`, which the browser keeps separately for every origin (scheme + host + **port**). SIMSAR sets no cookies (cookies are shared across ports on `localhost`, which would break this). All three Vite servers proxy `/api` to the one Express server, so they share the same database.

Each demo client is started with `--mode demo-<role>`, which loads `client/.env.demo-<role>` (`VITE_DEMO_ROLE`, `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD`). In demo mode the navbar shows a coloured **"Demo: Employer view"** label, the tab title starts with `[Employer view]`, **Log in** goes straight to that role's login page with the account pre-filled, and the login chooser highlights that tab's role. Plain `npm run dev` sets none of these, so the normal app is unchanged.

*Windows note:* if you stop `dev:demo` and a later start says a port is in use, an old Vite process is still running. Close it from Task Manager (node.exe), or in PowerShell: `Get-NetTCPConnection -LocalPort 5173,5174,5175 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }`.

### Presentation walkthrough (≈ 8 minutes)

1. **Employer tab — Home.** Drag the job-length slider: contractor cut vs SIMSAR's fixed fee. The trade rates come from the database.
2. **Employer tab — Post a job.** Plumber, 2 hr, budget ₹500: the live wage-floor warning ("fair minimum of ₹320/hr for plumbers") — the SDG 8 argument on one screen. Change to ₹900, tick **ITI-certified workers only**, post. Note the price breakdown.
3. **Worker tab — open the job.** Manoj sees "Background check required" and can't apply.
4. **Admin tab — Background checks.** Approve Manoj. Then **ITI Certificates**: view his uploaded scan, show that rejecting needs a note, then approve.
5. **Worker tab — reload, apply.** He now has *Verified* and *ITI Certified · Plumber*.
6. **Employer tab — Manage job.** The applicant shows both badges → **Accept**.
7. **Worker tab — dashboard.** Start work → Mark work done.
8. **Employer tab.** Mark job complete → rate the worker. **Worker tab:** rate the employer. Both profiles show the new rating.
9. **Admin tab — Trades & Wage Rates.** Raise the plumber minimum to ₹400 and save; reload the employer's Post a job page and the new floor applies at once. (Set it back to ₹320 afterwards.) Existing jobs keep the minimum they were posted with.
10. **Admin dashboard** — stats (users, jobs, completed jobs, average rating, verified and ITI-certified workers, fees vs payouts), user suspension, job moderation.

## Project structure

```
FSDL-mini-project/
├── package.json            root: workspaces + dev/seed/smoke scripts
├── docs/schema.md          Mongoose models, ER diagram (Mermaid), business rules
├── server/
│   ├── .env.example
│   ├── scripts/smoke-test.js
│   ├── uploads/            ITI certificate scans (git-ignored, created on first upload)
│   └── src/
│       ├── server.js       starts the app after connecting to MongoDB
│       ├── app.js          express app: helmet, cors, json, routes, error handler
│       ├── config/         env loading, DB connection, constants (roles, statuses, upload limits)
│       ├── models/         User, WorkerProfile, EmployerProfile, Trade, Job, Application, BackgroundCheck, ItiCertificate, Review
│       ├── controllers/    request handlers, one file per feature
│       ├── routes/         URL → middleware → controller
│       ├── middleware/     auth (protect/authorize), validate, rate limit, upload, error handler
│       ├── validators/     express-validator rules
│       ├── utils/          ApiError, pricing, helpers
│       └── seed/           seed.js (full reset), trades.js (default trades + rates), seedTrades.js
├── client/
│   ├── .env.demo-employer / -worker / -admin   demo-mode settings for `dev:demo`
│   └── src/
│       ├── main.jsx, App.jsx   providers + all routes
│       ├── demo.js             reads the demo-mode settings (off unless VITE_DEMO_ROLE is set)
│       ├── api/                axios instance (JWT interceptor) + every API call
│       ├── context/            AuthContext, ConfigContext (config + trades from the API), ToastContext
│       ├── components/         Navbar, ProtectedRoute, JobCard, PriceBreakdown, Stars, ReviewModal, ItiBadge, CertificateViewer, ...
│       ├── pages/              public pages, worker/, employer/, admin/
│       ├── styles/style.css    brand tokens, ported from the static site
│       └── utils/              formatting, price breakdown, useAsync hook
└── simsar-bootstrap/       the original static Bootstrap prototype (superseded, kept for reference)
```

## API endpoints

All routes are prefixed with `/api`. 🔒 = needs `Authorization: Bearer <token>`; the role in brackets is enforced by the `authorize` middleware.
Errors always come back as `{ "message": "...", "fields": { "field": "message" } }`.

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/health` | health check |
| GET | `/config` | platform fee %, ID types, ITI council types, upload size limit |
| GET | `/trades` | active trades with their fair minimum hourly rates, in display order (`?all=true` includes inactive ones) |
| GET | `/jobs` | open jobs. Query: `category` (trade slug), `location`, `minBudget`, `maxBudget`, `q`, `status` |
| GET | `/jobs/:id` | job detail with employer, price breakdown, `itiRequired` and the `minHourlyRate` it was posted with |
| GET | `/workers` | worker search. Query: `trade`, `location`, `q`, `verified=true`, `iti=true`, `available=true`, `sort=rating\|rate\|experience` |
| GET | `/users/:id/profile` | public worker/employer profile, stats (Work Passport), average rating, recent reviews |
| GET | `/reviews/user/:id` | all reviews a user received |

### Auth (rate limited per IP: `AUTH_RATE_LIMIT` per 15 min — 50 in production, 1000 in development)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{ role: worker\|employer, name, email, phone, password, location, ...}` — workers also send `trade, hourlyRate, experienceYears, skills`; employers `company` |
| POST | `/auth/login` | `{ email, password, role }` — role must match the account |
| GET | `/auth/me` 🔒 | current user |

### Profile
| Method | Path | Description |
|---|---|---|
| GET | `/profile/me` 🔒 | own user + profile (+ latest background check and ITI certificates for workers) |
| PUT | `/profile/me` 🔒 [worker, employer] | update own profile |

### Jobs
| Method | Path | Description |
|---|---|---|
| GET | `/jobs/mine` 🔒 [employer] | own jobs with applicant counts, booking state, own rating |
| POST | `/jobs` 🔒 [employer] | post a job (wage floor from the `trades` collection + fee applied). Optional `itiRequired: true` |
| PUT | `/jobs/:id` 🔒 [employer] | edit (open jobs only; the wage floor is re-checked against the current rate) |
| PATCH | `/jobs/:id/close` 🔒 [employer] | close an open/assigned job `{ reason? }` |
| GET | `/jobs/:id/applications` 🔒 [employer] | applicants with their approved ITI certificates (worker phone shared only after hiring) |
| POST | `/jobs/:id/apply` 🔒 [worker] | apply `{ coverNote? }` — **verified workers only**; ITI-only jobs also need an approved ITI certificate for that trade |

### Applications (bookings)
| Method | Path | Description |
|---|---|---|
| GET | `/applications/mine` 🔒 [worker] | own applications/bookings |
| PATCH | `/applications/:id/accept` 🔒 [employer] | hire this worker; other applicants are rejected (ITI-only jobs: the worker must still hold an approved certificate) |
| PATCH | `/applications/:id/reject` 🔒 [employer] | decline an applicant |
| PATCH | `/applications/:id/start` 🔒 [worker] | accepted → in-progress |
| PATCH | `/applications/:id/done` 🔒 [worker] | worker marks work done |
| PATCH | `/applications/:id/complete` 🔒 [employer] | in-progress → completed (job completed) |
| PATCH | `/applications/:id/cancel` 🔒 [worker, employer] | withdraw / cancel a booking (job re-opens) |

### Reviews
| Method | Path | Description |
|---|---|---|
| POST | `/reviews` 🔒 [worker, employer] | `{ jobId, rating 1–5, comment? }` — completed jobs only, one per party per job |

### Background checks
| Method | Path | Description |
|---|---|---|
| POST | `/background-checks` 🔒 [worker] | submit ID + address details |
| GET | `/background-checks/mine` 🔒 [worker] | own submissions (history) |

### ITI certificates
| Method | Path | Description |
|---|---|---|
| POST | `/iti-certificates` 🔒 [worker] | `multipart/form-data`: `trade, instituteName, instituteState, instituteDistrict, certificateNumber, registrationNumber?, councilType (NCVT\|SCVT), passingYear, grade?, percentage?` + `certificateFile` (JPG/PNG/PDF, ≤ 2 MB). Trade must be the worker's trade; the same certificate number + council can't be claimed twice |
| GET | `/iti-certificates/mine` 🔒 [worker] | own submissions (history) |
| GET | `/iti-certificates/:id/file` 🔒 [worker, admin] | the uploaded scan — the owner and admins only |

### Admin (all 🔒 [admin])
| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | users by role, jobs by status, completed jobs, average rating, fees vs payouts |
| GET | `/admin/users` | query `role`, `q` |
| PATCH | `/admin/users/:id/status` | `{ isActive }` suspend / restore |
| GET | `/admin/background-checks` | query `status` |
| PATCH | `/admin/background-checks/:id` | `{ status: approved\|rejected, reviewerNotes }` (note required to reject) |
| GET | `/admin/iti-certificates` | query `status`; includes each worker's profile |
| PATCH | `/admin/iti-certificates/:id` | `{ status: approved\|rejected, reviewerNote }` (note required to reject; pending only) |
| GET | `/admin/trades` | all trades with usage counts (workers, jobs, certificates, workers below the minimum) |
| POST | `/admin/trades` | `{ slug, label, plural, icon, minHourlyRate, description?, sortOrder? }` |
| PATCH | `/admin/trades/:id` | change label, plural, icon, `minHourlyRate`, description, `active`, sortOrder (the slug can't change) |
| DELETE | `/admin/trades/:id` | deletes an unused trade; a trade that workers, jobs or certificates use is **deactivated** instead |
| GET | `/admin/jobs` | query `status`, `q` |
| PATCH | `/admin/jobs/:id/close` | moderation `{ reason }` |
| DELETE | `/admin/jobs/:id` | delete a non-completed job and its applications |

## Notes and limitations

- **No real payments.** The price breakdown is calculated and stored, but no money moves.
- **Simulated background check.** Format checks plus manual admin review; no third-party verification API.
- **Simulated ITI verification.** A SIMSAR admin compares the typed details with the uploaded scan by hand. SIMSAR is **not** connected to the NCVT MIS portal or any state council (they offer no public verification API), and the UI says "verified by SIMSAR admin against the certificate". The seed's sample scans are clearly marked as fake.
- **Trades live in the database** (`trades` collection), referenced everywhere by their `slug` (e.g. `plumber`). The admin edits rates in *Trades & Wage Rates*; new jobs and rate changes are checked against the current rate, while each job keeps a snapshot of the minimum it was posted with. Workers whose rate is now below a raised minimum keep it until they next change it (their Edit profile page shows them a notice).
- Login/register are rate limited per IP (`AUTH_RATE_LIMIT`; 50 / 15 min in production, 1000 in development). The counter is in memory, so if you hit "Too many login attempts" while testing, restart the server.
- Uploaded scans are stored on disk in `server/uploads/iti/` with random file names, never served statically. nodemon watches only `src/` and `.env`, so an upload doesn't restart the API.
- The JWT is kept in `localStorage` for simplicity. A production app would prefer an httpOnly cookie.
- `simsar-bootstrap/` is the earlier static prototype. Its design (colours, fonts, ticket card, calculator, post-job preview) was carried into the React app.
