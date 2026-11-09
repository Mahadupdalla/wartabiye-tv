# Wartabiye TV secure admin + visitor statistics (Cloudflare Worker)

GitHub Pages can only serve files, so it cannot check a password or keep a secret. This small Cloudflare Worker
(free plan, no payment card) does both. It serves the whole admin dashboard and checks the owner on every request.

## What it does

**Owner-only sign-in.** Signing in has two steps:
1. **GitHub**, with GitHub's own 2-step verification. The account must be an **admin of `Mahadupdalla/wartabiye-tv`**,
   and today that is only the owner. Any other account is refused, recorded and its token revoked. No username or
   password exists in this code. You can also lock sign-in to particular GitHub ids with `OWNER_GITHUB_IDS` in
   `wrangler.toml`.
2. **A 6-digit code from an authenticator app** (Google Authenticator, Microsoft Authenticator, 2FAS …), checked here on
   the server. The first sign-in sets it up and shows 8 one-time recovery codes. After 5 wrong codes, sign-in is locked
   for 15 minutes.

**Sessions.** The browser only holds a random id in an `HttpOnly; Secure; SameSite=Strict` cookie. The database stores
only a hash of that id. A session ends after 30 minutes without activity, and always after 8 hours. Logout ends the
session and revokes the GitHub token at once. Settings → *Security & sessions* lists every sign-in, refusal, lock-out
and save, and every signed-in device.

**No token in the browser.** GitHub user tokens expire after 8 hours. They are kept AES-256-GCM encrypted in D1 and
never sent to the browser. The publishing tool (the same Sveltia CMS and the same `admin/config.yml`) sends every GitHub
call to `/api/github`. There the Worker checks the session, allows only this repository (and the private
`wartabiye-codsiyada`), blocks dangerous calls like deleting the repository, webhooks or secrets, and adds the token on
the server.

**Every page and API is protected.** Only `/login`, the sign-in steps, the logo and the public visit counter `/c`
are open. Everything else, including the dashboard's own files, needs the session: pages redirect to `/login` and APIs
answer `401`.

**Real visitor statistics.** `assets/stats.js` on the public website sends one small message per page opened. It
contains the page, the site language and the referring site. The Worker counts it in D1:

* No cookies. No IP address is stored. A visitor is a daily one-way code made from the IP and the browser with a
  random daily key, and the key is deleted after 2 days.
* Country only (Cloudflare's network estimate), never a city or exact location.
* No pop-up or consent notice: nothing is stored on the visitor's device. "Returning visitors" are therefore not
  measured (the dashboard says so); every visit is still counted.
* Robots, link previews, automated browsers (the site checks) and the owner's `?preview=` pages are not counted.
  Open `https://www.wartabiyetv.com/?notrack=1` once on your own phone or computer to stop counting your own visits.
* Raw per-visitor rows are deleted after 8 days. Daily totals are kept.
* Nothing is estimated or invented. The dashboard shows the first day of collected data, and days before it are 0.

The dashboard shows: visitors today, yesterday, this week, this month and the last 30 days; active now; total page
views; visits; pages per visitor; returning visitors; top articles; categories; sources; countries; devices; languages;
hourly and daily charts with date filters; and a comparison with the previous period. It refreshes automatically.

**Free-plan limits:** 100 000 Worker requests and 100 000 D1 row writes per day. That is about 30 000 page views a day,
because each page view writes 3 rows. Above that, extra page views that day are not counted. Nothing is made up, and
the website itself is not affected. The Workers Paid plan (5 USD a month) removes this limit if the site ever needs it.

## Set up (once, about 10 minutes)

### A. Cloudflare (free)
1. Create a free account at <https://dash.cloudflare.com/sign-up>. No payment card is needed for Workers and D1.
2. Open **My Profile → API Tokens → Create Token**. Choose the template **Edit Cloudflare Workers**, then
   **+ Add more** → **Account · D1 · Edit**. Press **Continue to summary**, then **Create Token**, and copy the token.
3. Open **Workers & Pages** and copy your **Account ID** from the right-hand side.
4. On GitHub, open the repository → **Settings → Secrets and variables → Actions → New repository secret**, and add:
   * `CLOUDFLARE_API_TOKEN`: the token from step 2
   * `CLOUDFLARE_ACCOUNT_ID`: the id from step 3
5. Open GitHub → **Actions** → **Maamulka ammaan ah** → **Run workflow**. In about 2 minutes this workflow:
   * creates the database
   * generates the session key (stored only in Cloudflare)
   * deploys the Worker
   * checks that strangers get nothing
   * writes the address to `data/admin.json`
   * switches on visitor counting on the website

### B. Connect GitHub sign-in (in the browser, 2 minutes)
6. Open <https://www.wartabiyetv.com/admin/>. It now opens the secure dashboard. Press **Set up secure sign-in**, then
   **Create the GitHub App**, then **Create GitHub App** on GitHub. This makes a private app owned by `@Mahadupdalla`.
7. GitHub asks where to install the app. Choose **Only select repositories** → `wartabiye-tv` (and `wartabiye-codsiyada`
   if you use it) → **Install**.
8. Press **Sign in with GitHub**. Scan the QR code with your authenticator app, type the 6-digit code, and **save the
   8 recovery codes** somewhere private.
9. The old token sign-in is now switched off. Delete your old GitHub token at
   <https://github.com/settings/personal-access-tokens> because it is no longer needed.

From then on, `https://www.wartabiyetv.com/admin/` always opens the secure dashboard.

## Lost your phone?
Use one of your recovery codes. If you have none left, open GitHub → Actions → **Maamulka ammaan ah** → Run workflow
and type `RESET`. This removes the authenticator. The next sign-in, which still needs the owner's GitHub account, sets
up a new one.

## Development
* `npm test`: unit tests. They need no network or Cloudflare account: real SQL runs on SQLite and GitHub is faked.
* `python3 ../../tools/build_pages.py && node test/e2e.mjs <dir>` (then `git checkout` the rebuilt pages): full run on your computer with `wrangler dev`, the real website pages, a real browser and
  real GitHub reads. It saves screenshots to `<dir>`.
* Files: `src/auth.js` (sign-in, sessions, setup), `src/github.js` (proxy, automation status), `src/analytics.js`
  (counter and reports), `public/` (dashboard), `scripts/prepare.mjs` (copies the CMS and its config at deploy).
