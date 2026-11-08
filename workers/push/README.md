# Wartabiye TV push notifications (Cloudflare Worker)

Browser push needs a private signing key (VAPID) and a list of subscribed browsers. GitHub Pages cannot keep a secret,
so both live in this small Cloudflare Worker (free plan) and **never** in this repository or the public website.

* The browser subscribes only after the visitor presses **Enable notifications** in the bell (`assets/notify.js`).
* The publish workflow (`tools/push_send.py`) calls `/v1/send` with the `PUSH_ADMIN_TOKEN` secret, **after** GitHub Pages
  is live with the new story. Each id is sent once (checked here and in `data/push-log.json`); links must be on the site.
* Stored per browser: the push endpoint and its two public keys, the chosen categories and the language. Nothing else.
* A subscription the browser has dropped (HTTP 404/410) is deleted automatically.

## Deploy (once, about 15 minutes)
1. Create a free Cloudflare account and install Node.js 18+.
2. In this folder: `npx wrangler@3 login`
3. `npx wrangler@3 kv namespace create SUBS` → paste the printed `id` into `wrangler.toml`.
4. `node make-keys.mjs` → paste **VAPID_PUBLIC_KEY** into `wrangler.toml` (it is public). Keep the private key window open.
5. `npx wrangler@3 secret put VAPID_PRIVATE_JWK` → paste the private key JSON (one line).
6. Make a long random password (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`):
   `npx wrangler@3 secret put PUSH_ADMIN_TOKEN` → paste it, and add the **same** value on GitHub:
   repository → Settings → Secrets and variables → Actions → New repository secret `PUSH_ADMIN_TOKEN`.
7. `npx wrangler@3 deploy` → note the address, e.g. `https://wartabiye-push.<you>.workers.dev`.
8. Check `https://…workers.dev/v1/health` shows `"configured": true`.
9. /admin/ → *Ogeysiisyada: Settings …* → **Settings-ka push**: paste the Worker address and the VAPID public key,
   switch **Push waa shidan yahay** on, Save. The bell now offers "Enable notifications".

To test delivery: enable notifications in your own browser, then create an alert in /admin/ → *Ogeysiisyada* (link it
to a published article, "U dir push" on) and Save. The result appears in /admin/ → *Xaaladda dirista* 2–4 minutes later.

## Endpoints
`GET /v1/health`, `GET /v1/key`, `POST /v1/subscribe`, `POST /v1/unsubscribe` (browser, CORS: wartabiyetv.com only),
`POST /v1/send` and `GET /v1/stats` (need `Authorization: Bearer <PUSH_ADMIN_TOKEN>`).

Free-plan limits: 50 outgoing requests per call (the workflow sends in pages of 40), 1 000 KV writes per day (one per
new subscriber or delivery log), 100 000 reads per day.

Tests (no network, no keys): `node --test test/worker.test.mjs` — each test message is decrypted with the browser's
keys (RFC 8291) and the VAPID signature is verified (RFC 8292).
