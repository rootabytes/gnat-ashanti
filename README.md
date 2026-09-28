# GNAT Mapping

A web system for the Ghana National Association of Teachers (GNAT) to map its structure: **Region → GNAT Districts → GNAT Locals → Basic Units / Workplaces**. It follows the *GNAT Mapping Activity* form (v1.0).

- **District Chairmen** register their district, select the political administrative districts it covers (01), and list its locals (02).
- **Local Chairmen** get a code per local (sent on WhatsApp) and list the workplaces in their local (03), each tagged with one of the 11 workplace categories.
- **Regional Secretary** (admin) tracks progress, reviews, approves or returns submissions, sees charts, and downloads Excel, CSV or PDF.

Deployment: see **[DEPLOY.md](DEPLOY.md)**.

## How it works

| Who | Signs in with | Can |
|---|---|---|
| District Chairman | District access code (from self-registration or the admin) | Edit chairman details, political districts, locals; fill any local on its chairman's behalf; share and reset local codes; submit or reopen |
| Local Chairman | Local access code (from the District Chairman) | Edit chairman details and workplaces; submit or reopen |
| Regional Secretary | Email + password | Everything in the region: review, approve, return with a note, edit, delete, reset codes, export, settings |

Statuses: **In progress → Submitted → Approved**, or **Returned** with a note. A submitted form is locked. The chairman can reopen it until the admin approves.

Design choices:
- **Codes, not accounts.** Chairmen type or tap a code like `D-7K3P-Q9XM`. Shared links carry the code (`/?code=…`) for one-tap sign-in. Codes are stored as an HMAC (for lookup) plus AES-GCM ciphertext (so they can be re-shared). Resetting a code signs out every device that used the old one.
- **Mobile first, bad networks expected.** Workplace lists save to the phone first and sync automatically, including after reconnecting. The form bundle is about 97 KB gzipped. The admin dashboard and chart library load separately.
- **Registration key** (optional, set by the admin) stops strangers registering districts. Self-registered districts are flagged until the admin marks them genuine.
- **Audit log** of every change, shown under Admin → Activity.
- **Multi-region ready.** All 10 GNAT regions exist, but only Ashanti is open. A national admin (no region) can switch regions. A regional admin sees only theirs.

## Project layout

```
backend/    Node 20+ · Express 5 · TypeScript · PostgreSQL (pg) · zod · ExcelJS · PDFKit
  src/schema.ts      migrations (run automatically at start)
  src/reference.ts   GNAT regions, 43 Ashanti MMDAs, 11 workplace categories
  src/routes/        public · district · local · admin
  src/analytics.ts   dashboard queries
  src/exports.ts     Excel / CSV / PDF
  test/api.test.ts   end-to-end API test against a real Postgres
frontend/   React 19 · Vite · Tailwind 4 · Recharts
  src/pages/         Home, Register, district/, local/, admin/
```

## Continue on your laptop (VS Code)

You need **Node 22** (`nvm use` reads `.nvmrc`), **Git**, and **Docker Desktop** for the local database. If you'd rather not use Docker, install PostgreSQL 16 and create the databases `gnat` and `gnat_test` (user and password `gnat`).

```bash
git clone https://github.com/rootabytes/gnat-ashanti && cd gnat-ashanti
code .                                   # VS Code will suggest the recommended extensions

docker compose up -d                     # Postgres on :5432 (gnat and gnat_test)

cd backend && npm install
cp .env.example .env                     # edit ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                              # API on http://localhost:4000

cd ../frontend && npm install
cp .env.example .env.local               # VITE_API_URL=http://localhost:4000
npm run dev                              # site on http://localhost:5173
```

The backend reads `.env` automatically in dev mode (`node --env-file`). Open http://localhost:5173/admin to sign in.

Checks to run before pushing (CI runs the same ones):

```bash
cd backend && npm run typecheck && npm test      # wipes the gnat_test database
cd frontend && npm run build
```

Browser tests: see `e2e/README.md`.

## Brand

- **Colours:** GNAT red, sky blue and white. The tokens live in `frontend/src/index.css`. Buttons and links use sky `#0369A1` (5.9:1 contrast on white), accents use red `#E0302A`, and there is a matching dark mode.
- **Font:** Inter (self-hosted through `@fontsource-variable/inter`, so there are no Google Fonts requests). It is also embedded in the PDF report (`backend/assets/fonts`, SIL Open Font License). Excel files use the recipient's default font, because Inter may not be installed on their computer.
- **Icons:** [Lucide](https://lucide.dev) (`lucide-react`).
- **Charts:** sky `#0284C7` and red `#E0302A` (dark mode: `#1795DB` and `#E5484D`). Both pairs pass the lightness, chroma, colour-blind separation and contrast checks. Status colours (green approved, violet submitted, amber returned, grey in progress) are kept apart from the brand colours and always come with an icon and a label. Every chart has a Table view.

## Engineering standards in place

- **CI** (`.github/workflows/ci.yml`): typecheck, the end-to-end API test against Postgres 16, the frontend build, and `npm audit` on every push and pull request.
- **Dependabot:** weekly grouped dependency updates.
- **Security:**
  - Access codes stored hashed and encrypted.
  - Rate-limited sign-in.
  - Admin passwords hashed with bcrypt.
  - Validation on every input (zod).
  - Excel formula injection blocked in CSV exports.
  - Security headers: Helmet on the API, CSP/HSTS/frame-deny on the site (`frontend/public/_headers`).
- **Observability:**
  - One JSON log line per request, with an `X-Request-Id`. No bodies are logged, so there's no personal data in the logs.
  - Error messages show a reference that matches the log line.
  - `/api/health` checks the database.
- **Data integrity:** append-only migrations, run under an advisory lock (safe with more than one replica), and an audit log of every change.

See **[ENTERPRISE.md](ENTERPRISE.md)** for the roadmap.
