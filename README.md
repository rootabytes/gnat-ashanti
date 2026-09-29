# GNAT Mapping

A web system for the Ghana National Association of Teachers (GNAT) to map its structure: **Region → GNAT Districts → GNAT Locals → Basic Units / Workplaces**. It follows the _GNAT Mapping Activity_ form (v1.0).

- **District Chairmen** register their district, select the political administrative districts it covers (01), and list its locals (02).
- **Local Chairmen** get a code per local (sent on WhatsApp) and list the workplaces in their local (03), each tagged with one of the 11 workplace categories.
- **Regional Secretary** (admin) tracks progress, reviews, approves or returns submissions, sees charts, and downloads Excel, CSV or PDF.

Built and operated by [Rootabytes](https://rootabytes.com), which is registered with the Data Protection Commission of Ghana. Every page carries a "Built by Rootabytes" credit and a link to the privacy notice (`/privacy`).

Live at `https://gnatashanti.rootabytes.com`, with a demo for testers at `https://gnatashanti-demo.rootabytes.com/demo`. Deployment: see **[DEPLOY.md](DEPLOY.md)**.

## How it works

| Who                                                | Signs in with                                                                                            | Can                                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| District Chairman                                  | District access code (from self-registration or the admin)                                               | Edit chairman details, political districts, locals; fill any local on its chairman's behalf; share and reset local codes; submit or reopen |
| Local Chairman                                     | Local access code (from the District Chairman)                                                           | Edit chairman details and workplaces (with optional Ghana Post GPS addresses, or imported from Excel/CSV); submit or reopen                |
| Regional admin (e.g. Assistant Regional Secretary) | Phone number + temporary password sent on WhatsApp by the super admin; then their own email and password | Everything in their region: review, approve, return with a note, edit, delete, reset codes, export, settings                               |
| Super admin (Rootabytes, `akasiya@rootabytes.com`) | Email + password (the first, from `ADMIN_PASSWORD`, must be replaced)                                    | Everything in every region, plus adding, resetting and removing admins                                                                     |

Statuses: **In progress → Submitted → Approved**, or **Returned** with a note. A submitted form is locked. The chairman can reopen it until the admin approves.

Design choices:

- **Codes, not accounts.** Chairmen type or tap a code like `D-7K3P-Q9XM`. Shared links carry the code (`/?code=…`) for one-tap sign-in. Codes are stored as an HMAC (for lookup) plus AES-GCM ciphertext (so they can be re-shared). Resetting a code signs out every device that used the old one.
- **Every phone, old or new.** Built for Android 7 and later (Chrome 99+) and iPhone 6s and later (Safari 15.4+). `e2e/mobile.mjs` checks every screen on a 320 px Android, a normal Android, an iPhone SE and an iPhone Pro Max, in Chrome and Safari's engine: no sideways scrolling, tap targets at least 24 px, and no field small enough to make an iPhone zoom in.
- **Role guides.** Each person's first sign-in opens a short step-by-step guide for their role (Local Chairman, District Chairman, Regional Secretary, super admin), and **Guide** at the top reopens it. The same text is in one-page PDFs at `/guides/…pdf` for printing or sharing on WhatsApp. Edit `frontend/src/lib/guides.ts`, then run `npm --prefix backend run guides` to remake the PDFs.
- **Mobile first, bad networks expected.** Workplace lists save to the phone first and sync automatically, including after reconnecting. The form bundle is about 100 KB gzipped, with a CI budget of 110 KB. The admin dashboard, privacy notice and demo page load separately.
- **Excel import.** Chairmen who keep their schools in a spreadsheet download the template (category dropdown, optional GPS column) and upload it. The server only reads the file; the rows are shown for checking and saved through the normal form.
- **Demo site.** With `DEMO_MODE=true` the API loads fictional districts in every status and `/demo` offers one-tap sign-in for every role. It runs on its own database: the API refuses to mix demo and real data.
- **Registration key** (optional, set by the admin) stops strangers registering districts. Self-registered districts are flagged until the admin marks them genuine.
- **Audit log** of every change, shown under Admin → Activity.
- **Multi-region ready.** All 10 GNAT regions exist, but only Ashanti is open. A national admin (no region) can switch regions. A regional admin sees only theirs.

## How codes reach chairmen (no SMS or WhatsApp provider)

The system never sends messages itself, so there is no provider account, API key or per-message cost. Every "Send" button opens the **sender's own** WhatsApp or SMS app with the message and link already written; they only tap send.

| Step                        | Who                            | How                                                                                                                                                                                              |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Invite District Chairmen | Regional Secretary             | **Settings → Share on WhatsApp** posts one message (link + registration key) to the District Chairmen's group.                                                                                   |
| 2. District code            | District Chairman              | Shown on screen the moment they register, with "Send to my WhatsApp" to keep a copy.                                                                                                             |
| 3. Local codes              | District Chairman              | Adding a local shows its code with **WhatsApp**, **SMS** and **Copy** buttons addressed to the Local Chairman.                                                                                   |
| Lost or never received      | Regional Secretary             | **Access codes** lists every code, with WhatsApp and SMS per chairman, or read it out on a call (no 0/O or 1/I/L to confuse). **Print code slips** makes cut-out slips to hand out at a meeting. |
| Wrong person has it         | Secretary or District Chairman | Reset the code: the old one stops working at once.                                                                                                                                               |

On a laptop, WhatsApp buttons open WhatsApp Web or Desktop; SMS buttons need a phone (or Windows Phone Link). Automatic bulk reminders would need a provider (Hubtel, Arkesel); see ENTERPRISE.md.

## Project layout

```
backend/    Node 20+ · Express 5 · TypeScript · PostgreSQL (pg) · zod · ExcelJS · PDFKit
  src/schema.ts      migrations (run automatically at start)
  src/reference.ts   GNAT regions, 43 Ashanti MMDAs, 11 workplace categories
  src/routes/        public · district · local · admin
  src/analytics.ts   dashboard queries
  src/exports.ts     Excel / CSV / PDF
  src/importUnits.ts Excel/CSV workplace import and its template
  src/demo.ts        demo mode: fictional data, the demo sign-in list, and the database guard
  src/openapi.ts     OpenAPI 3.1 description, served at /api/openapi.json
  test/              API tests against a real Postgres (api.test.ts, demo.test.ts)
frontend/   React 19 · Vite · Tailwind 4 · Recharts
  src/pages/         Home, Register, Privacy, Demo, district/, local/, admin/
  src/lib/org.ts     Rootabytes details shown on the privacy notice
e2e/        Playwright browser tests, axe accessibility audit, demo test
```

## Continue on your laptop (VS Code)

You need **Node 22** (`nvm use` reads `.nvmrc`), **Git**, and **Docker Desktop** for the local database. If you'd rather not use Docker, install PostgreSQL 16 and create the databases `gnat`, `gnat_test` and `gnat_demo` (user and password `gnat`).

```bash
git clone https://github.com/rootabytes/gnat-ashanti && cd gnat-ashanti
code .                                   # VS Code will suggest the recommended extensions

npm install                              # lint, format and the pre-commit hook
docker compose up -d                     # Postgres on :5432 (gnat, gnat_test, gnat_demo)
                                         # port taken? GNAT_DB_PORT=5434 docker compose up -d

cd backend && npm install
cp .env.example .env                     # edit ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                              # API on http://localhost:4000

cd ../frontend && npm install
cp .env.example .env.local               # VITE_API_URL=http://localhost:4000
npm run dev                              # site on http://localhost:5173
```

The backend reads `.env` automatically in dev mode (`node --env-file`). Open http://localhost:5173/admin to sign in; the first sign-in asks you to replace `ADMIN_PASSWORD`.

To try the demo locally, stop the API and start it on the demo database instead, then open http://localhost:5173/demo:

```bash
cd backend
DEMO_MODE=true DATABASE_URL=postgres://gnat:gnat@localhost:5432/gnat_demo npm run dev
```

(An existing Docker volume was created before `gnat_demo` was added: run `docker compose exec postgres createdb -U gnat gnat_demo` once.)

Checks to run before pushing (CI runs the same ones):

```bash
npm run lint && npm run format:check             # from the repo root
cd backend && npm run typecheck && npm test      # wipes the gnat_test database
cd frontend && npm run build && npm run budget   # form bundle under 110 KB gzipped
```

The pre-commit hook runs ESLint and Prettier on the files you commit.

Browser tests, the accessibility audit and the demo test: see `e2e/README.md`.

## Brand

- **Colours:** GNAT red, sky blue and white. The tokens live in `frontend/src/index.css`. Buttons and links use sky `#0369A1` (5.9:1 contrast on white), accents use red `#E0302A`, and surfaces are white. The site is always light, even on phones and computers set to dark mode (`color-scheme: light only`).
- **Font:** Inter (self-hosted through `@fontsource-variable/inter`, so there are no Google Fonts requests). It is also embedded in the PDF report (`backend/assets/fonts`, SIL Open Font License). Excel files use the recipient's default font, because Inter may not be installed on their computer.
- **Logo:** the original GNAT emblem, kept full size in `brand/gnat-logo-original.png`. The copies the system uses are made from it: `frontend/public/gnat-logo.png` (360 px, site header and home page), `frontend/public/icon-180.png` (on white, for the browser tab and phone home screen) and `backend/assets/gnat-logo.png` (600 px, PDF report). The PNGs use a colour palette, so the site logo is 15 KB.
- **Icons:** [Lucide](https://lucide.dev) (`lucide-react`).
- **Charts:** sky `#0284C7` and red `#E0302A`. The pair passes the lightness, chroma, colour-blind separation and contrast checks. Status colours (green approved, violet submitted, amber returned, grey in progress) are kept apart from the brand colours and always come with an icon and a label. Every chart has a Table view.

## Engineering standards in place

- **CI** (`.github/workflows/ci.yml`) on every push and pull request:
  - ESLint and Prettier;
  - typecheck and the API tests against Postgres 16, including demo mode;
  - the frontend build and its performance budget;
  - Playwright browser tests of the whole flow, an axe accessibility audit (WCAG 2.1 AA, including devices in dark mode), the demo site, and every screen on four phones in Chrome and WebKit (iPhone Safari);
  - `npm audit`.
- **API description:** OpenAPI 3.1 at `/api/openapi.json`, generated from the zod schemas. A test fails if a route is missing from it.
- **Dependabot:** weekly grouped dependency updates.
- **Security:**
  - Access codes stored hashed and encrypted.
  - Rate-limited sign-in, counted per visitor even through Cloudflare's proxy (the API trusts Railway's edge and Cloudflare's published address ranges, nothing else).
  - Admin passwords hashed with bcrypt. Temporary passwords (from Railway or another admin) must be replaced at first sign-in.
  - Validation on every input (zod).
  - Excel formula injection blocked in CSV exports. Excel and PDF exports are marked "Confidential: GNAT internal".
  - Security headers: Helmet on the API, CSP/HSTS/frame-deny on the site (`frontend/public/_headers`).
- **Observability:**
  - One JSON log line per request, with an `X-Request-Id`. No bodies are logged, so there's no personal data in the logs.
  - Error messages show a reference that matches the log line.
  - `/api/health` checks the database.
- **Data integrity:** append-only migrations, run under an advisory lock (safe with more than one replica), and an audit log of every change.

See **[ENTERPRISE.md](ENTERPRISE.md)** for the roadmap.
