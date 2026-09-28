# Deploying GNAT Mapping

Everything below is done in a web browser. No laptop or terminal is needed.

| Part | Where | Cost |
|---|---|---|
| API + database | Railway (your Pro plan) | a few dollars a month at this size |
| Website | Cloudflare Pages | free |

Allow about 20 minutes. Do the steps in order: the website needs the API's address, and the API needs the website's address.

---

## 1. Railway: database and API

1. Go to **railway.com → New Project → Deploy from GitHub repo** and choose **`gnat-mapping`**.
2. Open the new service → **Settings**:
   - **Source → Root Directory**: `backend`
   - **Config-as-code → Railway config file**: `backend/railway.json`
3. In the project canvas click **+ Create → Database → PostgreSQL**.
4. Open the API service → **Variables** → **Raw Editor**, paste this and fill in your own values:

   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=${{secret(64)}}
   ADMIN_EMAIL=secretary@your-email.com
   ADMIN_PASSWORD=a-strong-temporary-password
   ADMIN_NAME=Regional Secretary
   ALLOWED_ORIGINS=https://*.gnat-mapping.pages.dev
   ```

   - `JWT_SECRET` must **never change** after launch. It also encrypts the stored access codes. If `${{secret(64)}}` isn't accepted, paste any random 64-character string.
   - Use a temporary password. You will change it inside the dashboard.
5. **Settings → Networking → Generate Domain**. Copy the address, e.g. `https://gnat-mapping-production.up.railway.app`.
6. Open `https://<that address>/api/health`. You should see `{"ok":true}`.
   The database tables, the 43 Ashanti districts and the admin account are created automatically on first start.

> Backups: open the Postgres service → **Backups** and turn on daily backups (included with Pro).

## 2. Cloudflare Pages: the website

1. Go to **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git** and choose **`gnat-mapping`**.
2. Build settings:
   - **Framework preset**: `Vite` (or None)
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. **Environment variables** (add to both Production and Preview):
   - `VITE_API_URL` = the Railway address from step 1.5 (no trailing slash)
   - `NODE_VERSION` = `22`
4. **Save and Deploy**. When it finishes you get an address like `https://gnat-mapping.pages.dev`.

## 3. Connect them

Back in Railway → API service → **Variables**, set:

```
ALLOWED_ORIGINS=https://gnat-mapping.pages.dev,https://*.gnat-mapping.pages.dev
```

(Add your custom domain too if you set one, e.g. `https://mapping.gnatashanti.org`.) Railway redeploys automatically.

Optional custom domain: Cloudflare Pages → your project → **Custom domains**.

## 4. Before sharing with chairmen

1. Open `https://<your site>/admin` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. **Settings → Change your password.**
3. **Settings → District registration**: set a **registration key**, e.g. `torch2026`.
4. Test it yourself: register a test district on your phone, add a local, add a workplace, then delete the test district from the admin page (Danger zone).
5. **Settings → Share on WhatsApp** sends the ready-made message (link + key) to the District Chairmen's group.

## Updating later

Push to the `main` branch. Railway and Cloudflare both redeploy on their own. Database changes are applied automatically at start-up.

## If something goes wrong

| Symptom | Fix |
|---|---|
| Website says "No internet connection" on every action | `VITE_API_URL` is wrong, or the site's address is missing from `ALLOWED_ORIGINS`. Fix it, then redeploy the Cloudflare site (Deployments → Retry). |
| `/api/health` gives `{"ok":false}` | The API can't reach the database. Check that `DATABASE_URL=${{Postgres.DATABASE_URL}}` is set. |
| Can't sign in as admin | The admin is only created if that email doesn't exist yet. Check `ADMIN_EMAIL` in Railway and the deploy logs for `[seed] created admin`. |
| Railway deploy fails with "JWT_SECRET must be at least 32 characters" | Set a longer `JWT_SECRET`. |
