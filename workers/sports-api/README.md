# Wartabiye TV sports-data proxy

A tiny Cloudflare Worker between the public site and a licensed football-data provider. It keeps the provider token
secret (a Cloudflare secret, never in this repository or the website), caches answers for 30 s – 24 h so the provider's
rate limit holds however many people watch, allows only wartabiyetv.com (CORS), and returns one simple format that
`assets/media.js` shows on **LIVE Sports** (`/ciyaaraha-toos/`). It never invents data: when the provider has no
answer, the site says the data is unavailable.

| Provider | `PROVIDER` | Plan notes |
|---|---|---|
| [football-data.org](https://www.football-data.org/) v4 | `football-data` | Free tier: fixtures, results, scores and tables for 12 top competitions (PL, PD, SA, BL1, FL1, CL …). Goals/cards/subs (“deep data”) and statistics need a paid tier. |
| [API-Football](https://www.api-football.com/) v3 (api-sports.io) | `api-football` | Live scores, events, statistics, standings, teams. The free plan only covers past seasons, so a paid plan is needed for the current season. |

## Deploy (once, ~10 minutes)
1. Create a free Cloudflare account and install Node.js.
2. In this folder: `npx wrangler@3 login`, then edit `wrangler.toml` (`PROVIDER`, `SEASON`, optional `COMPETITIONS`).
3. `npx wrangler@3 secret put PROVIDER_TOKEN` and paste the provider token.
4. `npx wrangler@3 deploy` → note the address, e.g. `https://wartabiye-sports.<you>.workers.dev`.
5. Check `https://…workers.dev/v1/health` shows `"configured": true`.
6. In /admin/ → *LIVE TV iyo Ciyaaraha Toos → Ciyaaraha Toos*: paste the address in **Cinwaanka adeegga**, set the
   competition IDs of your provider and save. The site shows live data within a minute.

Tests (no network, no token): `node --test test/worker.test.mjs`.
