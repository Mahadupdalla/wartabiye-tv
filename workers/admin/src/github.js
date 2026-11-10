// The publishing dashboard (Sveltia CMS) talks to GitHub ONLY through this proxy. The browser never has a GitHub
// token: the proxy checks the signed-in owner session and adds the owner's short-lived GitHub token on the server.
import { json, now } from './util.js';
import { ghApi, ghHeaders, sessionToken, audit } from './auth.js';

const repos = env => [env.REPO, ...String(env.EXTRA_REPOS || '').split(',')].map(s => s.trim().toLowerCase()).filter(Boolean);

export function allowed(env, method, path) {
  if (path === '/user' || path === '/rate_limit') return method === 'GET';
  if (path === '/graphql') return method === 'POST';
  const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (!m || !repos(env).includes(m[1].toLowerCase())) return false;
  const rest = m[2] || '';
  if (!rest) return method === 'GET';                                        // never delete or rename the repository
  if (/^\/(hooks|keys|collaborators|invitations|actions\/(secrets|variables|permissions)|environments|pages|branches\/[^/]+\/protection|transfer|rulesets)/.test(rest)) return false;
  // automation controls from the Automation screen: run now, pause/resume a workflow, re-run or stop a run
  // (GitHub only allows them when the dashboard's GitHub App has the "Actions: read and write" permission)
  if (/^\/actions\/workflows\/[\w.-]+\/dispatches$/.test(rest)) return method === 'POST';
  if (/^\/actions\/workflows\/[\w.-]+\/(enable|disable)$/.test(rest)) return method === 'PUT';
  if (/^\/actions\/runs\/\d+\/(rerun|rerun-failed-jobs|cancel)$/.test(rest)) return method === 'POST';
  if (/^\/actions\//.test(rest)) return method === 'GET';
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

export async function proxy(req, env, s) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/github(\/api\/v3)?/, '').replace(/^\/api\/graphql$/, '/graphql') || '/';
  // a page on another site cannot use the session: the cookie is SameSite=Strict and this header check needs a script on this origin
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return json({ message: 'Forbidden' }, 403);
  if (!allowed(env, req.method, path)) {
    await audit(env, req, 'github_blocked', { login: s.login, ok: false, detail: req.method + ' ' + path });
    return json({ message: 'This action is not allowed from the dashboard.' }, 403);
  }
  const token = await sessionToken(env, s);
  if (!token) return json({ message: 'Session ended' }, 401);
  const h = ghHeaders(token);
  for (const k of ['accept', 'content-type', 'if-none-match', 'if-modified-since']) { const v = req.headers.get(k); if (v) h[k] = v; }
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
  const r = await fetch(ghApi(env) + path + url.search, { method: req.method, headers: h, body });
  // one audit line per saved change: the branch update (a commit) or a single-file write; not every Git building block
  const building = /\/git\/(blobs|trees|commits)$/.test(path) && req.method === 'POST';
  if (req.method !== 'GET' && !building) {
    let detail = req.method + ' ' + path;
    if (/\/git\/refs\/heads\/main$/.test(path) && req.method === 'PATCH') detail = 'publish commit (dashboard)';
    if (/\/git\/refs\/heads\/live-data$/.test(path) && req.method === 'PATCH') detail = 'LIVE News update (dashboard)';
    if (/\/actions\//.test(path)) detail = 'automation: ' + path.replace(/^\/repos\/[^/]+\/[^/]+\/actions\//, '') + ' (' + r.status + ')';
    if (path === '/graphql' && body) { const q = new TextDecoder().decode(body.slice(0, 4000)); const m = q.match(/mutation\s*\w*|createCommitOnBranch/); if (!m) detail = null; else detail = 'save (GitHub commit)'; }
    if (detail) await audit(env, req, 'content_change', { login: s.login, ok: r.ok, detail });
  }
  const out = new Headers();
  for (const k of ['content-type', 'etag', 'last-modified', 'link', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-github-request-id']) { const v = r.headers.get(k); if (v) out.set(k, v); }
  out.set('cache-control', 'no-store');
  return new Response(r.body, { status: r.status, headers: out });
}

// Automation Status page: recent GitHub Actions runs (read-only) and the watchdog's status file
export async function automation(req, env, s) {
  const token = await sessionToken(env, s);
  const h = ghHeaders(token);
  const [runs, status, wfs] = await Promise.all([
    fetch(`${ghApi(env)}/repos/${env.REPO}/actions/runs?per_page=100&exclude_pull_requests=true`, { headers: h }).then(r => r.ok ? r.json() : { error: r.status }),
    fetch(`${ghApi(env)}/repos/${env.REPO}/contents/data/automation-status.json?ref=main`, { headers: { ...h, Accept: 'application/vnd.github.raw+json' } }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${ghApi(env)}/repos/${env.REPO}/actions/workflows?per_page=100`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  const list = (runs.workflow_runs || []).map(r => ({ id: r.id, name: r.name, path: r.path, event: r.event, status: r.status, conclusion: r.conclusion, created: r.created_at, updated: r.updated_at, started: r.run_started_at, attempt: r.run_attempt, url: r.html_url, title: r.display_title }));
  const latest = {};
  for (const r of list) if (!latest[r.path]) latest[r.path] = r;
  const defs = ((wfs && wfs.workflows) || []).map(w => ({ id: w.id, name: w.name, path: w.path, state: w.state, url: w.html_url }));
  return json({ at: now(), error: runs.error || null, workflows: Object.values(latest), runs: list.slice(0, 30), allRuns: list, defs, status });
}
