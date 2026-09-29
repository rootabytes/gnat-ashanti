# Browser tests

These click through the whole system the way people will use it. CI runs them on every push (the `e2e` job).

`flow.mjs`:

1. The admin signs in with the temporary password, is made to choose their own, and sets the registration key.
2. The footer credit links to rootabytes.com, and the privacy notice opens.
3. A District Chairman registers on a phone, picks political districts, adds 3 locals and fills one on its chairman's behalf, including a GPS address.
4. A Local Chairman opens their WhatsApp link, pastes a list, imports a CSV (previewed, duplicates skipped), goes offline mid-edit (the work is kept and syncs on reconnect), and submits.
5. The district submits. The admin reviews, approves everything, searches the structure and downloads Excel and PDF.
6. The admin dashboard is checked on a phone in dark mode, with no sideways scrolling.

`race.mjs` checks that tapping "Review" straight after adding a school still saves it.

`a11y.mjs` runs axe (WCAG 2.1 A/AA) on the home, registration, privacy, both chairman forms and the admin pages, in light and dark mode. Serious or critical problems fail the run.

`demo.mjs` runs against the demo API: the demo bar shows, every role signs in with one tap and sees their guide, the page passes axe, and reset issues new codes.

`mobile.mjs` also runs against the demo API. It opens every screen, and each role's first-sign-in guide, on a 320 px Android, a normal Android (Chrome), an iPhone SE and an iPhone Pro Max (WebKit), and fails on sideways scrolling, anything past the screen edge, tap targets under 24 px, or fields under 16 px that make iPhones zoom. `MOBILE_SHOTS=1` saves a screenshot of each. Needs `npx playwright install webkit` once.

Every script exits non-zero on failure. Screenshots land in `e2e/screenshots/`.

```bash
# 1. fresh database + API with the test admin
docker compose up -d            # from the repo root
cd backend && npm run build
ADMIN_EMAIL=secretary@gnatashanti.org ADMIN_PASSWORD='Secretary2026!' ALLOWED_ORIGINS=http://localhost:4173 npm start

# 2. site
cd frontend && VITE_API_URL=http://localhost:4000 npm run build && npx vite preview --port 4173

# 3. tests (flow, race, accessibility)
cd e2e && npm install && npx playwright install chromium && npm test

# 4. demo: restart the API in demo mode on its own empty database, then
DEMO_MODE=true DATABASE_URL=postgres://gnat:gnat@localhost:5432/gnat_demo ALLOWED_ORIGINS=http://localhost:4173 npm start   # in backend/
node demo.mjs                                                                                                         # in e2e/
```

The flow needs a **fresh** database: it registers "Kumasi Metro" and replaces the admin's temporary password.
