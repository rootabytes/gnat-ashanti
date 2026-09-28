# Browser tests

These click through the whole system the way people will use it:
1. The admin signs in and sets the registration key.
2. A District Chairman registers on a phone, picks political districts, adds 3 locals and fills one on its chairman's behalf.
3. A Local Chairman opens their WhatsApp link, pastes a list, goes offline mid-edit (the work is kept and syncs on reconnect), and submits.
4. The district submits. The admin reviews, approves everything, searches the structure and downloads Excel and PDF.
5. The admin dashboard is checked on a phone in dark mode.

`race.mjs` checks that tapping "Review" straight after adding a school still saves it.

```bash
# 1. fresh database + API with the test admin
docker compose up -d            # from the repo root
cd backend && npm run build
ADMIN_EMAIL=secretary@gnatashanti.org ADMIN_PASSWORD='Secretary2026!' ALLOWED_ORIGINS=http://localhost:4173 npm start

# 2. site
cd frontend && VITE_API_URL=http://localhost:4000 npm run build && npx vite preview --port 4173

# 3. tests
cd e2e && npm install && npx playwright install chromium && npm test
```

Screenshots land in `e2e/screenshots/`.
