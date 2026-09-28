# Enterprise roadmap

What is already in place is listed in the README ("Engineering standards in place"). The items below are ordered by value for GNAT, then effort. **P1** means do it before a national rollout; **P2** means do it within the first quarter; **P3** means when needed.

## Governance and data protection (Ghana Data Protection Act, 2012, Act 843)

| | Recommendation | Why |
|---|---|---|
| P1 | **Register GNAT as a data controller** with the Data Protection Commission (if not already), and name a data protection contact. | The system holds members' names and phone numbers. |
| P1 | **Add a short privacy notice** on the registration and code pages: what is collected, why, who sees it, and how long it is kept. | A requirement under Act 843. It also builds trust with chairmen. |
| P1 | **Data processing agreement** covering Rootabytes (the builder and operator), Railway and Cloudflare. | Hosting is outside Ghana, so the transfer needs a documented basis. |
| P2 | **Retention policy:** archive or delete contacts N months after the exercise ends. Export the final approved dataset as the official record. | Keeps only what's needed. |
| P2 | **Data sharing rule:** exports carry a "Confidential: GNAT internal" footer, and the downloads page records who downloaded what (already in the audit log). | Stops spreadsheets drifting around WhatsApp. |

## Security

| | Recommendation |
|---|---|
| P1 | **Two-factor authentication for admins** (an authenticator app, i.e. TOTP), plus a forced password change on first sign-in. |
| P1 | **Custom domain** (e.g. `mapping.gnatashanti.org`) on Cloudflare, with HSTS preload. Chairmen trust a GNAT address more than `pages.dev`. |
| P2 | **Cloudflare WAF and Bot Fight Mode** in front of the site, and **Turnstile** (Cloudflare's free CAPTCHA) on registration and code entry. |
| P2 | **Role-based access control:** Viewer (read only), Reviewer (approve/return), Admin (settings, delete). Useful when regional executives also need access. |
| P2 | **Access code expiry:** a date after which codes stop working, e.g. at the close of the exercise. |
| P3 | A yearly **penetration test**, and secret scanning on the repo (GitHub Advanced Security or gitleaks). |

## Reliability and operations

| | Recommendation |
|---|---|
| P1 | **Daily database backups** on Railway, plus a **monthly restore test** into a scratch database. A backup that has never been restored is untested. |
| P1 | **Uptime monitoring** of `/api/health` (Better Stack, UptimeRobot or Cloudflare Health Checks), with alerts to the secretary's WhatsApp or email. |
| P2 | **Error tracking** (Sentry) on the API and site. The request ID already links a user's error to the log line. |
| P2 | **Staging environment:** a second Railway environment plus Cloudflare preview deploys, so changes are tested before they reach chairmen. |
| P2 | **Two API replicas** on Railway for zero-downtime deploys. Migrations are already lock-safe. |
| P3 | Point-in-time recovery for Postgres, and a written incident runbook. |

## Product (for the mapping exercise and beyond)

| | Recommendation |
|---|---|
| P1 | **Deadline and reminders:** a submission deadline shown to chairmen, plus reminders by SMS or WhatsApp Business API (Hubtel, Arkesel or Twilio) to districts that haven't submitted. |
| P2 | **Member counts per workplace** (optional field), turning the map into a membership baseline for dues and planning. |
| P2 | **GPS / Ghana Post GPS address** per workplace, and a map view on the dashboard. |
| P2 | **Excel import** for districts that already keep lists, to avoid typing 200 schools on a phone. |
| P2 | **Offline-first PWA** (installable app with a service worker) for rural chairmen. Autosave to the phone is already built. |
| P2 | **Link to the GES school register** to pick schools from a list, which cuts spelling duplicates. |
| P3 | **National rollout:** open other regions from Settings (the data model already supports this), with a national dashboard comparing regions. |
| P3 | **Twi / Ewe / Dagbani** interface translations. |
| P3 | **Public API** (read-only, key-protected) for GNAT's other systems, e.g. membership and dues. |

## Engineering quality

| | Recommendation |
|---|---|
| P2 | ESLint + Prettier with a pre-commit hook. The browser end-to-end tests (Playwright) move into CI. |
| P2 | An **OpenAPI spec** generated from the zod schemas, so other teams can integrate. |
| P3 | Accessibility audit (axe) in CI, and a performance budget (form bundle under 110 KB gzipped; it is about 101 KB today). |
