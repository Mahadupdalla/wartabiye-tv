# Wartabiye TV: 5-minute clock for the source monitor

The 5-minute source monitor (`.github/workflows/fast-sources.yml`, `tools/fast_monitor.py`) needs to start every
5 minutes. GitHub's own schedule is "best effort": on this repository, scheduled runs are often skipped for an hour or
more (measured on 8 Nov 2026: no scheduled run for 90 minutes). This tiny Cloudflare Worker is a reliable clock. Its
Cron Trigger fires every 5 minutes and asks GitHub to start the monitor (`workflow_dispatch`), only inside the
operating hours in `data/schedule.json` (Africa/Nairobi). It reads no news and stores nothing. The monitor itself still
checks the hours, so the clock can never make it run at night.

Cost: free. The Cloudflare Workers free plan includes Cron Triggers, and GitHub Actions is free for public repositories.

## Set up (once, about 10 minutes)
1. GitHub → Settings → Developer settings → Fine-grained tokens → **Generate new token**:
   repository access **Only Mahadupdalla/wartabiye-tv**, permission **Actions: Read and write** (nothing else),
   expiry up to 1 year (put a reminder to renew it).
2. Install Node.js. In this folder: `npx wrangler@3 login`.
3. `npx wrangler@3 secret put GH_DISPATCH_TOKEN` and paste the token. It is never written in this repository.
4. `npx wrangler@3 deploy`.
5. Check `https://wartabiye-fast-trigger.<you>.workers.dev/v1/health` shows `"configured": true`. Within 5 minutes
   GitHub → Actions → "Ilaha degdegga ah" shows runs started by `workflow_dispatch` every 5 minutes, and
   /admin/ → Ilaha degdegga ah shows the measured interval close to 5 minutes.

To stop it: Cloudflare dashboard → Workers → wartabiye-fast-trigger → Triggers → delete the cron (or delete the Worker).

Tests (no network, no token): `node --test test/worker.test.mjs`.
