# Wartabiye TV daily opening hours (Cloudflare Worker)

**Open 07:00 → 24:00, closed 00:00 → 07:00, Africa/Nairobi (EAT, UTC+3, no summer time). Every day, automatically.**

GitHub Pages only serves files: it cannot look at the clock or refuse a visitor. This small Worker runs on Cloudflare's
servers in front of `www.wartabiyetv.com`. For every request it checks the Nairobi time:

- **07:00–23:59:** the request goes to GitHub Pages unchanged. HTML is never kept in a browser cache past midnight.
- **00:00–06:59:** public pages answer **`503 Service Unavailable` + `Retry-After: <seconds until 07:00>`** with the
  branded closed page (logo, colours, light/dark, phone sizes, exact message, next opening time, live countdown that
  corrects for a wrong phone clock and reloads the page at 07:00). GitHub Pages is not even asked, so there is nothing
  in the browser to unhide: it is not a JavaScript overlay.

No cron job, no GitHub run, no person: the clock decides on each request.

## Still reachable at night

| Path | Why |
|---|---|
| `/robots.txt`, `/sitemap*.xml`, `/rss.xml`, `/google….html`, `/.well-known/` | A 5xx on robots.txt makes Google stop crawling the whole site; the others keep search tools and feed readers healthy. |
| `/data/*.json` | The 5-minute monitor and the watchdog read `data/news.json` from the live site; the source clock reads `data/schedule.json`. Without this they would raise false "site down" alerts every night. |
| `/admin/` | The entrance to the dashboard. The dashboard itself runs on `wartabiye-admin.wartabiye.workers.dev` and is not affected at all. |
| `/img/logo.png`, icons, `/sw.js`, manifest | What the closed page and push notifications need. |

Nothing else, including articles, images, scripts and every other page.

## Owner preview (optional)

`npx wrangler@3 secret put OWNER_PREVIEW_KEY` (at least 16 random characters). Opening
`https://www.wartabiyetv.com/?furo=<key>` then shows the normal site on that browser for 8 hours (signed `HttpOnly`
cookie). Without the secret there is no way past the closed page.

## Switches

- Change hours: `OPEN` / `CLOSE` in `wrangler.toml`.
- Emergency open without code: Cloudflare → Workers → wartabiye-hours → Settings → Variables → `CLOSURE = off`.
- Remove completely: Actions → *Saacadaha furitaanka* → Run workflow → `REMOVE`.

## Before the first deploy (one time, owner)

1. Cloudflare → *Add a site* → `wartabiyetv.com` (Free). Cloudflare copies the current DNS records; check that the
   GitHub Pages records are there (`www` CNAME → `mahadupdalla.github.io`, apex A records 185.199.108–111.153) and
   set them to **Proxied**. Also keep any email (MX/TXT) records.
2. At the domain registrar, replace the nameservers with the two Cloudflare gives you. Wait until Cloudflare says *Active*.
3. SSL/TLS mode **Full**. In GitHub → Settings → Pages, keep the custom domain and *Enforce HTTPS*.
4. Give the API token one more permission: *Zone · Workers Routes · Edit* for wartabiyetv.com.
5. Actions → *Saacadaha furitaanka* → Run workflow → `DEPLOY`.

## Tests

`npm test`: every hour of 30 days and the minute boundaries 23:59:59 / 00:00 / 06:59:59 / 07:00, next-opening and
month change, 503 + Retry-After + page text, attempts to get past the closure (query strings, `index.html`, `..`,
apex domain, POST/HEAD), machine files stay 200, day pages unchanged, cache capped before midnight, owner key and
forged/expired cookies.
