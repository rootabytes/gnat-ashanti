# Deploying GNAT Mapping

Everything below is done in a web browser. No terminal is needed.

| Part                | Where              | Address                                       | Cost                    |
| ------------------- | ------------------ | --------------------------------------------- | ----------------------- |
| Website             | Cloudflare Worker  | `https://gnatashanti.rootabytes.com`          | free                    |
| API + database      | Railway (Pro plan) | `https://gnatashanti-api.rootabytes.com`      | a few dollars a month   |
| Demo website        | Cloudflare Worker  | `https://gnatashanti-demo.rootabytes.com`     | free                    |
| Demo API + database | Railway            | `https://gnatashanti-demo-api.rootabytes.com` | a dollar or two a month |

The addresses are free subdomains of `rootabytes.com`, whose DNS is already on Cloudflare. The Rootabytes website (Firebase) is not affected. Each subdomain has a single level (`gnatashanti-api`, not `api.gnatashanti`), so Cloudflare's free certificate covers it.

Allow about 40 minutes for everything. Do the steps in order: the website needs the API's address, and the API needs the website's address.

---

## 1. Railway: database and API

1. Go to **railway.com → New Project → Deploy from GitHub repo** and choose **`gnat-ashanti`**. Rename the service **`api`**.
2. Open the service → **Settings**:
   - **Source → Root Directory**: `backend`
   - **Config-as-code → Railway config file**: `backend/railway.json`
3. In the project canvas click **+ Create → Database → PostgreSQL**.
4. Open the API service → **Variables** → **Raw Editor**, paste this and fill in your own values:

   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=${{secret(64)}}
   ADMIN_EMAIL=akasiya@rootabytes.com
   ADMIN_PASSWORD=a-temporary-password
   ADMIN_NAME=Super Admin
   ALLOWED_ORIGINS=https://gnatashanti.rootabytes.com
   ```

   - `JWT_SECRET` must **never change** after launch. It also encrypts the stored access codes. If `${{secret(64)}}` isn't accepted, paste any random 64-character string.
   - `ADMIN_EMAIL` becomes the **super admin**: every region, and the only one who can add or remove admins.
   - `ADMIN_PASSWORD` is temporary. The first sign-in only opens a "Set up your account" screen, so the password in Railway stops working as soon as it is used.

5. **Settings → Networking → Generate Domain**. Copy the address, e.g. `https://gnat-ashanti-production.up.railway.app`.
6. Open `https://<that address>/api/health`. You should see `{"ok":true}`.
   The tables, the 43 Ashanti districts and the admin account are created on first start.
7. **Postgres service → Backups**: turn on daily backups.

## 2. Cloudflare Worker: the website

The website is a set of static files served by a Cloudflare Worker (free). [frontend/wrangler.toml](frontend/wrangler.toml) holds its settings.

1. **dash.cloudflare.com → Workers & Pages → Create → Import a repository** → choose **`gnat-ashanti`**. Name the Worker **`gnat-ashanti`** (it must match `name` in `frontend/wrangler.toml`).
2. Build settings (later under **Settings → Build**):
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
3. **Build variables** (under **Settings → Build → Variables and secrets**, not the Worker's runtime variables):
   - `VITE_API_URL` = `https://gnatashanti-api.rootabytes.com` (set up in step 3; until then use the Railway address from 1.5, no trailing slash)
   - `NODE_VERSION` = `22`
4. **Deploy**. The API address is built into the site, so after changing `VITE_API_URL` run a new build (**Deployments → ⋯ → Retry build**, or push a commit).

## 3. The rootabytes.com addresses (free)

Log in to the Cloudflare account that holds **rootabytes.com**.

**Website:**

1. **Workers & Pages → gnat-ashanti → Settings → Domains & Routes → Add → Custom domain** → `gnatashanti.rootabytes.com`. rootabytes.com is in the same Cloudflare account, so Cloudflare adds the DNS record and the certificate itself, ready within a few minutes.

**API:**

1. **Railway → api → Settings → Networking → Custom Domain** → `gnatashanti-api.rootabytes.com`. Railway shows a **CNAME target** (and sometimes a TXT record for verification).
2. **Cloudflare → rootabytes.com → DNS → Add record**:
   - Type `CNAME`, Name `gnatashanti-api`, Target: the value Railway showed.
   - **Proxy status:** either works. DNS only (grey cloud) is simplest. Proxied (orange cloud) also works, with SSL/TLS mode **Full**; the API still sees each visitor's real address for its rate limits.
   - If Railway showed a TXT record, add it too.
3. Wait for Railway to show the domain as active (usually a few minutes), then open `https://gnatashanti-api.rootabytes.com/api/health`.

**Connect them:**

1. Cloudflare → gnat-ashanti → **Settings → Build → Variables and secrets**: set `VITE_API_URL=https://gnatashanti-api.rootabytes.com`, then run a new build (the address is built into the site).
2. Railway: `ALLOWED_ORIGINS` from step 1.4 already includes `https://gnatashanti.rootabytes.com`.

## 4. Demo site (for testers)

The demo lets anyone try every role with one tap: Regional Secretary, District Chairmen and Local Chairmen, with fictional districts in every status. Its passwords and access codes are **shown on a public page**, so it runs on its **own database**. The API refuses to start in demo mode on a database that already holds data, and refuses real mode on the demo database.

1. **Railway**: in the same project, **+ Create → GitHub Repo → gnat-ashanti** again, rename it **`api-demo`**, and set the same Root Directory and config file as in step 1.2.
2. **+ Create → Database → PostgreSQL** again, and rename it **`Postgres-demo`**.
3. `api-demo` → **Variables** (no admin variables needed):

   ```
   NODE_ENV=production
   DEMO_MODE=true
   DATABASE_URL=${{Postgres-demo.DATABASE_URL}}
   JWT_SECRET=${{secret(64)}}
   ALLOWED_ORIGINS=https://gnatashanti-demo.rootabytes.com
   ```

4. Custom domain `gnatashanti-demo-api.rootabytes.com`, exactly as in step 3 (grey-cloud CNAME in Cloudflare).
5. **Cloudflare**: import the same repo again as a second Worker named **`gnat-ashanti-demo`**, with the same build settings except **Deploy command** `npx wrangler deploy --name gnat-ashanti-demo`, and build variable `VITE_API_URL=https://gnatashanti-demo-api.rootabytes.com`. Add the custom domain `gnatashanti-demo.rootabytes.com`.
6. Open `https://gnatashanti-demo.rootabytes.com/demo`. Every page shows a yellow "Demo site" bar.

The demo data is reset on every deploy and whenever a tester taps **Reset demo data** on the demo page. Demo admins cannot change their password, so the published one keeps working.

## 5. Before sharing with chairmen

1. Open `https://gnatashanti.rootabytes.com/admin`, sign in with `akasiya@rootabytes.com` and the temporary password, then set your name and choose your own password.
1. **Settings → Admins → Add an admin**: add the Assistant Regional Secretary with his name and WhatsApp number (access: Ashanti Region only). Tap **WhatsApp** in the window that opens to send him the link and a temporary password from your own WhatsApp. He signs in with his phone number, adds his email and chooses his own password; the temporary one works for 7 days. If he loses it, **New password** sends a fresh one.
1. **Settings → District registration**: set a **registration key**, e.g. `torch2026`.
1. Test it yourself on a phone: register a test district, add a local and a workplace (try the Excel template and a GPS address), then delete the test district from the admin page (Danger zone).
1. Check the **Privacy notice** link at the bottom of every page. Fill in the Data Protection Commission registration number in `frontend/src/lib/org.ts` (`dpcRegistration`) when you have it.
1. **Uptime monitoring**: add `https://gnatashanti-api.rootabytes.com/api/health` to UptimeRobot or Better Stack (both free) with an email or WhatsApp alert.
1. **Settings → Share on WhatsApp** sends the ready-made message (link and key) to the District Chairmen's group.

## Updating later

Push to the `main` branch. Railway and Cloudflare redeploy both the real site and the demo on their own. Database changes are applied automatically at start-up. The demo resets its data on each deploy.

## If something goes wrong

| Symptom                                                               | Fix                                                                                                                                                |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website says "No internet connection" on every action                 | `VITE_API_URL` is wrong, or the site's address is missing from `ALLOWED_ORIGINS`. Fix it, then redeploy the Cloudflare site (Deployments → Retry). |
| `gnatashanti-api.rootabytes.com` shows a certificate or 5xx error     | The domain must show as active in Railway. If the Cloudflare record is proxied (orange), SSL/TLS mode must be **Full**; or switch it to DNS only.  |
| `/api/health` gives `{"ok":false}`                                    | The API can't reach the database. Check that `DATABASE_URL` references the right Postgres service.                                                 |
| Deploy log: "DEMO_MODE=true but this database already holds data"     | The demo service points at the real database. Give it `Postgres-demo`.                                                                             |
| Deploy log: "This database belongs to the demo site"                  | The real service points at the demo database. Point it at the real `Postgres`.                                                                     |
| Can't sign in as admin                                                | The admin is only created if that email doesn't exist yet. Check `ADMIN_EMAIL` and the deploy log for `[seed] created admin`.                      |
| Railway deploy fails with "JWT_SECRET must be at least 32 characters" | Set a longer `JWT_SECRET`.                                                                                                                         |
