// Wartabiye TV: reliable 5-minute clock for the source monitor (.github/workflows/fast-sources.yml).
// Every 5 minutes (Cron Trigger) it starts the monitor with GitHub's workflow_dispatch API, only inside the owner's
// operating hours (data/schedule.json on the live site, Africa/Nairobi). The token is a Cloudflare secret.

export function hoursOf(sched) {
  const h = String((sched && sched.hours) || '24/7').trim();
  const m = h.match(/^(\d{1,2})(?::00)?\s*[-–]\s*(\d{1,2})(?::00)?$/);
  if (!m) return null;
  const a = +m[1], b = +m[2];
  return a === b || (a === 0 && b === 24) ? null : [a, b];
}

export function isOpen(date, sched) {
  const hb = hoursOf(sched);
  if (!hb) return true;
  const h = (date.getUTCHours() + 3) % 24; // Africa/Nairobi is UTC+3 all year
  const [a, b] = hb;
  return a < b ? a <= h && h < b : h >= a || h < b;
}

async function schedule(env) {
  try {
    const r = await fetch(env.SCHEDULE_URL + '?ts=' + Date.now(), { cf: { cacheTtl: 0 } });
    if (r.ok) return await r.json();
  } catch (e) {}
  return null; // site unreachable: the workflow checks the hours again itself
}

export async function tick(env, now = new Date(), f = fetch) {
  if (!env.GH_DISPATCH_TOKEN) return { started: false, why: 'GH_DISPATCH_TOKEN secret is not set' };
  const sched = await schedule(env);
  if (sched && !isOpen(now, sched)) return { started: false, why: 'outside operating hours ' + sched.hours };
  const r = await f(`https://api.github.com/repos/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.GH_DISPATCH_TOKEN, Accept: 'application/vnd.github+json',
               'User-Agent': 'wartabiye-fast-trigger', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main' }),
  });
  return { started: r.status === 204, status: r.status };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env, new Date(event.scheduledTime)).then(x => console.log(JSON.stringify(x))));
  },
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === '/v1/health') {
      return Response.json({ configured: !!env.GH_DISPATCH_TOKEN, repo: env.REPO, workflow: env.WORKFLOW, every: '5 minutes' });
    }
    return new Response('Wartabiye TV source-monitor clock', { status: 404 });
  },
};
