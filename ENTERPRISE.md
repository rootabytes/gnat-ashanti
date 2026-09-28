# Enterprise roadmap

What is already in place is listed in the README ("Engineering standards in place"). **P1** means do it before a national rollout, **P2** within the first quarter, and **P3** when needed. ✅ marks items that are done.

## Governance and data protection (Ghana Data Protection Act, 2012, Act 843)

Rootabytes (Rootabytes Enterprise, Kumasi) builds and operates the system and is registered with the Data Protection Commission. The privacy notice names Rootabytes as responsible for the personal data, with `dpo@rootabytes.com` as the contact.

|     | Recommendation                                                                                                                                                                                | Status                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Registered data controller** and a named data protection contact.                                                                                                                           | ✅ Rootabytes' DPC registration. Add the registration number in `frontend/src/lib/org.ts` (`dpcRegistration`) and it shows on the notice. |
| P1  | **Privacy notice**: what is collected, why, who sees it, where it is stored, how long it is kept, and people's rights.                                                                        | ✅ `/privacy`, linked from every page footer, the code screen and the registration form.                                                  |
| P1  | **Data processing agreement** between Rootabytes and GNAT: roles (GNAT decides the purpose, Rootabytes runs the system), Railway and Cloudflare as sub-processors, and hosting outside Ghana. | Open. A document to sign, not code.                                                                                                       |
| P2  | **Retention**: chairmen's names and phones deleted or anonymised within 12 months after final approval; the approved structure kept as GNAT's record.                                         | ✅ Stated in the notice. The anonymise action itself (an admin button) is still to build.                                                 |
| P2  | **Data sharing rule**: every export says "Confidential: GNAT internal", and downloads are logged.                                                                                             | ✅ Excel (sheet footers and Summary), PDF (every page). The audit log records every download.                                             |
| P2  | **Demo kept apart from real data**: the demo publishes its passwords, so it runs on its own database.                                                                                         | ✅ The API refuses to mix them, in both directions.                                                                                       |

## Security

|     | Recommendation                                                                                          | Status                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| P1  | **Forced password change** on first sign-in, for the seeded admin and every admin added by another.     | ✅                                                                                               |
| P1  | **Two-factor authentication for admins** (authenticator app, TOTP).                                     | Open. Next security item.                                                                        |
| P1  | **Custom domain** instead of `pages.dev`.                                                               | ✅ `gnatashanti.rootabytes.com` (free, see DEPLOY.md). A GNAT-owned domain can replace it later. |
| P2  | **Cloudflare WAF and Bot Fight Mode**, and **Turnstile** (free CAPTCHA) on registration and code entry. | Open. WAF and Bot Fight Mode are dashboard switches on the rootabytes.com zone.                  |
| P2  | **Role-based access**: Viewer (read only), Reviewer (approve/return), Admin (settings, delete).         | Open.                                                                                            |
| P2  | **Access code expiry** at the close of the exercise.                                                    | Open.                                                                                            |
| P3  | Yearly **penetration test**, and secret scanning on the repo (gitleaks).                                | Open.                                                                                            |

## Reliability and operations

|     | Recommendation                                                                                                | Status                                                             |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| P1  | **Daily database backups** on Railway, plus a **monthly restore test** into a scratch database.               | Switch on in Railway (DEPLOY.md step 1.7).                         |
| P1  | **Uptime monitoring** of `/api/health` with alerts.                                                           | Set up in UptimeRobot or Better Stack (DEPLOY.md step 5.5).        |
| P2  | **Error tracking** (Sentry) on the API and site. The request ID already links a user's error to its log line. | Open.                                                              |
| P2  | **Staging environment** where changes are tested before chairmen see them.                                    | Partly: the demo site runs every change on its own database first. |
| P2  | **Two API replicas** on Railway for zero-downtime deploys. Migrations are already lock-safe.                  | Open.                                                              |
| P3  | Point-in-time recovery for Postgres, and a written incident runbook.                                          | Open.                                                              |

## Product

|     | Recommendation                                                                                                                                      | Status                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Deadline and reminders**: a submission deadline, plus SMS or WhatsApp reminders to districts that haven't submitted (Hubtel, Arkesel or Twilio).  | Manual for now, with no provider: one-tap WhatsApp/SMS reminders from the Secretary's own phone (Districts page), and printable code slips. Automatic bulk reminders need a provider. |
| P2  | **Excel import** of workplaces, with a downloadable template (category dropdown, optional GPS column). Rows are previewed before anything is saved. | ✅                                                                                                                                                                                    |
| P2  | **Ghana Post GPS address** per workplace (optional), in the form, the admin views and every export.                                                 | ✅ A map view on the dashboard is the next step.                                                                                                                                      |
| P2  | **Demo site** with one-tap sign-in for every role.                                                                                                  | ✅                                                                                                                                                                                    |
| P2  | **Member counts per workplace** (optional), as a membership baseline for dues and planning.                                                         | Open.                                                                                                                                                                                 |
| P2  | **Offline-first PWA** (installable, service worker). Autosave to the phone is already built.                                                        | Open.                                                                                                                                                                                 |
| P2  | **Pick schools from the GES register** to cut spelling duplicates.                                                                                  | Open.                                                                                                                                                                                 |
| P3  | **National rollout**: open other regions from Settings (the data model supports it), with a national dashboard.                                     | Open.                                                                                                                                                                                 |
| P3  | **Twi / Ewe / Dagbani** interface translations.                                                                                                     | Open.                                                                                                                                                                                 |
| P3  | **Public API** (read-only, key-protected) for GNAT's other systems.                                                                                 | The OpenAPI description exists; keys are open.                                                                                                                                        |

## Engineering quality

|     | Recommendation                                                                                                                                                          | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P2  | **ESLint + Prettier** with a pre-commit hook (husky + lint-staged), checked in CI.                                                                                      | ✅     |
| P2  | **Browser tests (Playwright) in CI**, including the demo site.                                                                                                          | ✅     |
| P2  | **OpenAPI spec** generated from the zod schemas, at `/api/openapi.json`. A test fails if a route is missing from it.                                                    | ✅     |
| P3  | **Accessibility audit (axe)** in CI: home, registration, privacy, both chairman forms, admin pages and demo, including devices set to dark mode (the site stays white). | ✅     |
| P3  | **Performance budget** in CI: the chairmen's form under 110 KB of JavaScript and 12 KB of CSS, gzipped (about 100 KB and 7 KB today).                                   | ✅     |
