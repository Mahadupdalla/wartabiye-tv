# Wartabiye TV push notifications (Cloudflare Worker)

Browser push needs a private signing key (VAPID) and a list of subscribed browsers. GitHub Pages cannot keep a secret,
so both live in this small Cloudflare Worker (free plan) and **never** in this repository or on the public website.

* The browser asks for permission only after the visitor presses **Enable notifications** in the bell (`assets/notify.js`).
  The visitor picks **All News** or single categories (Somalia, East Africa, World, Sports, LIVE TV; Breaking is always on),
  how often (every story / one short summary / only the most important) and gets alerts in the site language they use.
* Order of work: source check → verification → article published → GitHub Pages deployed → `tools/push_send.py` opens the
  live article page and checks it answers 200 with the article → `/v1/send`. A failed deploy, a draft or a page that is not
  live yet is never announced. Each story id is sent once (checked here, 90 days, and in `data/push-log.json`).
* The publish workflow proves who it is with **GitHub's own OIDC token** (repository `GITHUB_REPO`, branch `main`,
  audience `wartabiye-push`). No password is shared. A `PUSH_ADMIN_TOKEN` secret still works as an optional fallback.
* Stored per browser: the push endpoint and its two public keys, the chosen categories, frequency and language. Nothing else.
  `/v1/stats` returns only counts. A subscription the browser has dropped (HTTP 404/410) is deleted automatically.
* Sending runs in GitHub Actions and Cloudflare, so it does not depend on Claude usage limits. (Finding and writing the
  news does: when the hourly news task cannot run, nothing new is published and nothing is sent.)

## Setup (once, about 10 minutes, only the site owner can do this)
1. Make a free Cloudflare account: <https://dash.cloudflare.com/sign-up>.
2. Cloudflare dashboard → **Workers & Pages**. The first time, Cloudflare asks you to choose a free
   `<name>.workers.dev` subdomain: choose one. On the same page, copy the **Account ID** (right-hand side).
3. Cloudflare → My Profile → **API Tokens** → *Create Token* → template **Edit Cloudflare Workers** → *Use template* →
   Account Resources: your account; Zone Resources: *All zones* → *Continue* → *Create Token*. Copy the token.
4. GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**, add two secrets:
   `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (the account id).
5. GitHub → **Actions** → *Push: deploy the notification service (Cloudflare)* → **Run workflow** (leave "no").
   It tests and deploys the Worker, creates the storage and the VAPID keys, checks the service, and writes the Worker
   address and public key into `data/notify-settings.json`. The site rebuilds and the bell offers **Enable notifications**.

Run the same workflow again after any change in `workers/push/`. Choose "yes" (new keys) only if the private key leaked:
every subscriber then has to press Enable again.

## Test delivery (site open and closed)
1. On a desktop or Android phone in Chrome / Edge / Firefox, open the site, bell → **Enable notifications** → Allow.
2. /admin/ → *Ogeysiisyada* → new alert, kind **Degdeg**, linked to an article that is already published, "U dir push"
   on → Save. Close the site tab (keep the browser running). The alert arrives within a few minutes.
3. /admin/ → *Xaaladda dirista* shows the delivery result (delivered / failed / removed) and errors.

## Browsers
Works with the site closed: Chrome, Edge, Opera, Samsung Internet, Firefox (desktop and Android); Safari 16+ on macOS 13+.
iPhone / iPad: iOS 16.4+ only after **Share → Add to Home Screen** and opening the site from that icon.
Not supported: iOS before 16.4, Safari tabs on iPhone, in-app browsers (Facebook, Instagram, TikTok), and any browser where
the visitor blocked notifications. The bell says so instead of offering the button. A browser that is fully closed
(not running) receives the alert when it next starts; Android usually shows it at once.

## Endpoints
`GET /v1/health`, `GET /v1/key`, `POST /v1/subscribe`, `POST /v1/unsubscribe` (browser, CORS: wartabiyetv.com only),
`POST /v1/send` and `GET /v1/stats` (need the GitHub OIDC token, or `Authorization: Bearer <PUSH_ADMIN_TOKEN>`).

## Costs and limits
Cloudflare Workers free plan: 100 000 requests and 1 000 KV writes per day (one write per new subscriber or change, two per
update), 50 outgoing requests per call (the sender pages through subscribers). That is enough for a few thousand
subscribers. Beyond that, Workers Paid is US$5 a month. GitHub Actions on a public repository is free.

Tests (no network, no keys): `node --test test/worker.test.mjs` — each test message is decrypted with the browser's
keys (RFC 8291), the VAPID signature is verified (RFC 8292) and forged / wrong-repository OIDC tokens are refused.
