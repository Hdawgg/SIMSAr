# SIMSAR — Project Context

*Last updated: 21 October 2026*

A single reference for the project as it stands. Useful for catching a teammate up, for starting a fresh conversation with an AI assistant, or for revising before the viva. Setup, API tables and demo credentials are in `README.md`; collections and rules are in `docs/schema.md`.

---

## 1. The basics

| | |
|---|---|
| **Project** | SIMSAR |
| **Course** | Full Stack Development, Semester V, CSBS |
| **Batch** | A1 |
| **Team** | Harmeet Bhatia (16015024010), Moiz Arsiwala (16015024004), Atharva Borreddi (16015024012) |
| **Repository** | github.com/arsiwalamoiz24/FSDL-mini-project |
| **SDGs** | Goal 8 — Decent Work and Economic Growth · Goal 9 — Industry, Innovation and Infrastructure |

---

## 2. What SIMSAR is

"Simsar" is the Hindi/Urdu word for a broker. SIMSAR is meant to be a *fair* broker: a marketplace where employers (households and small businesses) post jobs and hire background-checked tradespeople — electricians, plumbers, carpenters, painters, tailors, AC technicians, masons.

What defines it:

1. **One small, fixed, visible commission.** SIMSAR takes `PLATFORM_FEE_PERCENT` of the job budget (default **5%**, allowed 0–50). Every job shows *budget → SIMSAR fee → worker payout*. The percentage is copied onto the job when it is posted and never changes afterwards, so a later fee change can't touch an agreed job. Setting it to `0` gives the original "worker keeps 100%" model. (The earlier static prototype used a flat ₹29 booking fee instead — that model is no longer used.)
2. **An enforced wage floor.** Each trade has a fair minimum hourly rate. A job whose *worker payout ÷ estimated hours* is below it is rejected by the server, and a worker can't set a rate below it. This is the most important feature — SDG target 8.5 implemented as a validation rule rather than a claim on an About page. The rates are stored in MongoDB and the admin can change them.
3. **Background-checked workers.** A worker must pass an admin-reviewed background check (ID + address, simulated) before they can apply for any job.
4. **ITI Certified badge (optional, simulated).** Workers can upload their ITI certificate; an admin compares it with the scan and approves or rejects it. Approved workers get an "ITI Certified · <trade>" badge, separate from "Verified". Employers can mark a job "ITI-certified workers only", enforced on the server. There is **no** real NCVT/SCVT integration — the UI says "verified by SIMSAR admin against the certificate".
5. **Two-way ratings and a Work Passport.** After completion, employer and worker rate each other. Completed jobs, ratings and earnings build a record shown on the worker's dashboard and public profile.

**Default fair minimum rates** (seeded, editable by the admin): Electrician ₹350/hr · Plumber ₹320 · Carpenter ₹380 · Painter ₹280 · Tailor ₹250 · AC technician ₹420 · Mason ₹300. The home page compares SIMSAR's fee with an assumed 35% contractor cut (labelled as illustrative).

---

## 3. Tech stack

The project went static Bootstrap prototype → full MERN-style app. The React app keeps the Bootstrap classes and the design tokens of the prototype, so it still looks and reads like what the team was taught.

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite, React Router, Axios, Bootstrap 5.3 + Bootstrap Icons, one custom stylesheet (`client/src/styles/style.css`) |
| Backend | Node.js (tested on 22), Express 5 REST API |
| Database | MongoDB (local, port 27017) with Mongoose — database name **`simsar`** |
| Auth | JWT (stored in `localStorage` as `simsar_token`) + bcrypt; role guards in middleware (`protect`, `authorize`) and in React (protected routes) |
| Validation / safety | express-validator, Mongoose validators and hooks, helmet, CORS, rate limit on login/register, central error handler |
| Uploads | multer (memory, 2 MB, JPG/PNG/PDF + file-signature check) → `server/uploads/` (git-ignored, private) |
| Tooling | npm workspaces, concurrently, nodemon (watches `src/` and `.env` only) |
| Fonts | Figtree (body), Bricolage Grotesque (headings) |

`simsar-bootstrap/` is the earlier static prototype, **superseded** and kept for reference only.

### Layout

```
FSDL-mini-project/
├── package.json        workspaces; dev, dev:demo, seed, seed:trades, smoke, build
├── README.md           setup, demo accounts, demo mode, API reference
├── docs/schema.md      collections, ER diagram, business rules
├── server/src/
│   ├── models/         User, WorkerProfile, EmployerProfile, Trade, Job, Application,
│   │                   BackgroundCheck, ItiCertificate, Review
│   ├── controllers/    one per feature (auth, profile, job, application, review,
│   │                   backgroundCheck, iti, trade, admin)
│   ├── routes/, middleware/, validators/, utils/, config/
│   └── seed/           seed.js (full reset), trades.js (default rates), seedTrades.js
├── server/scripts/smoke-test.js
└── client/src/
    ├── api/            axios instance + every API call
    ├── context/        AuthContext, ConfigContext (config + trades), ToastContext
    ├── components/     Navbar, JobCard, PriceBreakdown, Stars, ItiBadge, CertificateViewer, ...
    ├── pages/          public pages + worker/, employer/, admin/
    └── demo.js         demo-mode settings (VITE_DEMO_ROLE)
```

### How the main rules are implemented

- **Trades** are documents in the `trades` collection (`slug`, `label`, `plural`, `icon`, `minHourlyRate`, `description`, `active`, `sortOrder`). Every other collection refers to a trade by its **slug** (`"plumber"`), which is immutable. The client loads them once through `ConfigContext` (`useTrades()`), so nothing is hardcoded on either side. The admin edits them in *Trades & Wage Rates*; a trade in use is deactivated rather than deleted.
- **Wage floor:** `Job` `pre('validate')` reads the trade's current `minHourlyRate` when a job is created or edited (or its category/budget/hours change), rejects it with a message like *"Below the fair minimum: plumbers must earn at least ₹320/hr…"*, and stores a `minHourlyRate` snapshot on the job. Status changes don't re-check, so raising a rate never breaks a job already in progress. `WorkerProfile` does the same for the worker's own rate.
- **Fee:** the same hook computes `platformFee = round(budget × feePercent / 100)` and `workerPayout = budget − platformFee`.
- **ITI:** one certificate number per council can only be pending/approved for one worker (partial unique index); the certificate's trade must match the worker's trade; rejecting needs a note; the scan is served only to the owner and admins. `requireItiIfNeeded` in `jobController` blocks applying to — and accepting a worker for — an ITI-only job without an approved certificate.

### Demo mode (three roles at once)

`npm run dev:demo` starts the API once and three Vite servers: **5173 employer** (priya@simsar.in), **5174 worker** (manoj@simsar.in), **5175 admin** (admin@simsar.in). `localStorage` is per origin, and ports are part of the origin, so each tab stays logged in as a different user in the same browser. No cookies are used. Each client runs with `--mode demo-<role>` (`client/.env.demo-<role>`), which adds a "Demo: Employer view" navbar label and pre-fills that role's login. Plain `npm run dev` is unaffected.

### Design tokens

| Name | Hex | Use |
|---|---|---|
| Ink | #16204A | Text, dark sections, avatars |
| Indigo | #2D46B9 | Primary buttons |
| Turmeric | #F2B138 | Highlights, ticket strip, current week |
| Chalk | #F3F4F7 | Page background |
| Slate | #5A6275 | Secondary text |
| Leaf | #17875A | Verified badges, success |
| Brick | #B93A26 | Errors, below-minimum warnings |
| Line | #DCDFE7 | Borders |

---

## 4. Testing done

- **`npm run smoke`** (API must be running) — an end-to-end script against the real API and database, cleaning up after itself. **121 checks, all passing** (October 2026). Covers registration/login per role, the full job → apply → accept → start → done → complete → rate flow, the wage floor, fees, background checks, and the newer features: trades CRUD (admin only; 401/403 for others; slug immutable; deactivate vs delete), the wage floor reading the new rate after the admin changes it (old jobs keep their snapshot), ITI submit/approve/reject, duplicate-certificate rejection, file type/size/signature checks, who may download a scan, the ITI-only job rule, and the login rate-limit setting.
- **Browser** (headless Chrome, scripted): the three-port demo with all three roles logged in at once in one browser profile, surviving reloads, three different tokens and no cookies; the whole presentation walkthrough including ITI approval and an admin rate change showing up in the employer tab; no horizontal overflow at 390px; no JavaScript errors.

---

## 5. Use case model

**Actors:** Employer (primary), Worker (primary), Admin (supporting), Payment Gateway (external, not built), Lender (external, secondary).

Main use cases now built: register/log in per role, post/edit/close a job (wage floor), find workers and jobs, apply, accept/reject applicants, start/finish/complete work, rate each other, submit background check, submit ITI certificate, admin review of checks and certificates, admin trade/rate management, admin user suspension and job moderation.

The expanded **UC-03 Post a job** (preconditions, main scenario, alternate flows including the below-minimum rejection) is still the strongest software-engineering artefact; the ITI-only option is a new alternate flow of UC-03 and of *Apply for a job*.

---

## 6. Competitive position — be honest about this

SIMSAR is **not** wholly original, and claiming otherwise is easy to disprove with one search.

| Platform | What they do |
|---|---|
| Urban Company | Takes a commission; the platform sets the price |
| Service By Local | Zero commission, but no wage floor — free negotiation |
| Digital Labour Chowk | Connects construction labour directly to contractors |
| KarmaLife | Credit scoring for gig workers, but inside the platforms that hire them |

**What's actually ours:** the enforced wage floor (most platforms let undercutting set the price), a small fixed commission shown on every job instead of a hidden or variable cut, and a work record that belongs to the worker.

**Suggested viva answer:** "Direct-connect platforms exist, and alternative credit scoring for gig workers exists. What isn't being done is enforcing a wage floor instead of letting undercutting set the price, taking one small visible fee instead of a large hidden cut, and giving the record to the worker instead of the platform."

---

## 7. SDG target mapping

| Target | UN asks for | SIMSAR feature | Metric we'd track |
|---|---|---|---|
| 8.3 | Formalisation and growth of micro/small enterprises | Each worker runs as their own micro-business with a public profile, own rate and credentials (Verified, ITI) | Workers with 10+ repeat customers |
| 8.5 | Equal pay for work of equal value | Enforced fair minimum per trade, stored and maintained by the admin; fixed 5% fee | Take-home per hour vs the contractor route |
| 8.6 / 4.4 | Youth in employment and training; skills for decent jobs | ITI Certified badge and ITI-only jobs reward formal vocational training | Share of jobs going to ITI-certified workers |
| 8.8 | Safe, secure working environments | Background-checked workers; two-way ratings | Disputes per 1,000 bookings |
| 9.3 | Small enterprise access to affordable credit | Work Passport as a lender-checkable record | Passports shared with lenders per month |
| 9.c | Increased access to ICT | Mobile-first layouts (tested at 390px) | Workers onboarded who never used a work app |

---

## 8. Demo script (≈ 8 minutes)

Run `npm run seed`, then `npm run dev:demo`, and open 5173 / 5174 / 5175 as three tabs. The full step-by-step is in the README (*Presentation walkthrough*). The short version:

1. **Employer — Home:** the fee vs contractor-cut calculator.
2. **Employer — Post a job:** Plumber, 2 hr, ₹500 → the wage-floor warning. **This is the moment that earns marks.** Raise to ₹900, tick ITI-only, post.
3. **Worker:** can't apply — background check required.
4. **Admin:** approve the background check; open the ITI scan, approve the certificate.
5. **Worker** applies → **Employer** accepts → worker starts and finishes → employer completes and rates → worker rates back.
6. **Admin — Trades & Wage Rates:** raise the plumber minimum and show it apply immediately in the employer tab; set it back.

---

## 9. Known weak points, and what to say

| If asked | Answer |
|---|---|
| Is the ITI check real? | No — it's a manual admin review of the uploaded scan, and the UI says so. NCVT MIS has no public verification API. The data model (council, certificate number, institute, year) is what a real integration would need. |
| Is the background check real? | Also simulated: format checks plus admin review. |
| Where does the money go? | Nowhere yet — the price breakdown is calculated and stored, but there's no payment gateway. |
| Why `localStorage` for the JWT? | Simple to explain and it's what makes the three-port demo work. Production would use an httpOnly cookie. |
| What if the admin raises a rate? | New jobs and edits use the new rate; existing jobs keep the snapshot they were posted with; workers below the new minimum keep their rate until they change it. |
| Why slugs instead of ObjectIds for trades? | Readable in the database and URLs, and the slug can't change, so references never break. Deactivation hides a trade without orphaning data. |
| Rate limit? | Login/register are limited per IP: 50 per 15 min in production, 1000 in development (`AUTH_RATE_LIMIT`). It is never switched off. |

---

## 10. What's left

- Commit and push the current work (from all three accounts so the contributor graph shows three people).
- Payment gateway so payment is genuinely held until job completion.
- A worker can have only one trade; multi-trade workers would need `trade` to become an array.
- Hindi and Marathi interface for the worker pages.
- Store uploads in object storage (S3 or similar) instead of the server's disk if deployed.
