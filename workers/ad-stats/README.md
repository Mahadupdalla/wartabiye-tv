# Wartabiye TV advert counter (Cloudflare Worker + D1)

Counts how often each **real** advert is seen and clicked, so you can give advertisers honest numbers.
GitHub Pages cannot count anything, so the counts are kept in this small Worker (Cloudflare free plan).

What is counted
* **Impression (aragti):** at least half of the advert was on screen for one second, once per page view.
* **Click (gujin):** the visitor opened the advert's link (or pressed play on its YouTube video).
* Demo adverts on the Xayeysiimaha page are never counted. Only adverts that are live in `data/ads.json` are accepted.

Privacy
* No cookie, no visitor id, no IP address, no user agent is stored. Only one total per day, advert and placement.
* Browsers that send *Do Not Track* or *Global Privacy Control* are not counted (the site does not even send the count).
* Bots and requests from other websites are ignored.

## Deploy (once, about 10 minutes)
1. Free Cloudflare account, Node.js 18+. In this folder: `npx wrangler@3 login`
2. `npx wrangler@3 d1 create wartabiye-ad-stats` → paste the printed `database_id` into `wrangler.toml`.
3. `npx wrangler@3 d1 execute wartabiye-ad-stats --remote --file=schema.sql`
4. Make a long random password (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`)
   and `npx wrangler@3 secret put STATS_TOKEN` → paste it. Keep it safe: you type it in the stats page.
5. `npx wrangler@3 deploy` → note the address, e.g. `https://wartabiye-ad-stats.<you>.workers.dev`
6. Check `https://…workers.dev/v1/health` shows `"configured": true`.
7. /admin/ → *Settings* → **Tirakoobka xayeysiiska**: paste the Worker address and switch **Tirinta waa shidan tahay** on.
8. Open `https://www.wartabiyetv.com/admin/xayeysiis/` → *Tirakoobka*, enter the address and the password.

Endpoints: `POST /v1/hit` (from the site), `GET /v1/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` (needs
`Authorization: Bearer <STATS_TOKEN>`), `GET /v1/health`.
Free-plan limits: 100 000 D1 writes per day (one per impression or click).

Tests (no network, no account): `node --test test/worker.test.mjs`
