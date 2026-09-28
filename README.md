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

## Run locally

```bash
# Postgres running locally with a database "gnat" (user/pass gnat/gnat), or set DATABASE_URL
cd backend && cp .env.example .env && npm install && ADMIN_EMAIL=me@x.com ADMIN_PASSWORD=secret123456 npm run dev
cd frontend && npm install && npm run dev      # http://localhost:5173
```

Tests (these wipe the database in `TEST_DATABASE_URL`, default `gnat_test`):

```bash
cd backend && npm test
```

## Charts

The series colours are a brand-derived indigo (`#4040B0` light / `#7A7AE0` dark) and orange (`#EB6834` / `#D95926`). Both pairs pass lightness, chroma, colour-blind separation and contrast checks. Status colours always come with an icon and a label. Every chart has a Table view.
