// Server-rendered sign-in pages (login, security code, setup) in the Wartabiye TV look. No inline script.
import { securityHeaders, esc } from './util.js';

export const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,600..800&family=Public+Sans:wght@400;500;600;700&display=swap';
export const csp = ({ form = '', connect = '', img = '', frame = "'none'", script = "'self'", font = '', style = '' } = {}) =>
  `default-src 'self'; script-src ${script}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${style}; font-src 'self' https://fonts.gstatic.com ${font}; ` +
  `img-src 'self' data: blob: https://avatars.githubusercontent.com ${img}; connect-src 'self' ${connect}; form-action 'self' ${form}; ` +
  `frame-src 'self'; frame-ancestors ${frame}; base-uri 'none'; object-src 'none'`;

const ICON = {
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M12 15v2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
};
export const icon = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

export function page({ title, body, step = 0, wide = false, refresh = '' }, status = 200, cookies = [], { form = '' } = {}) {
  const steps = step ? `<ol class="progress" aria-label="Sign-in steps">${['GitHub account', 'Security code', 'Dashboard'].map((s, i) =>
    `<li class="${i + 1 < step ? 'done' : i + 1 === step ? 'on' : ''}"${i + 1 === step ? ' aria-current="step"' : ''}><span>${i + 1}</span>${s}</li>`).join('')}</ol>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">${refresh ? `<meta http-equiv="refresh" content="0;url=${esc(refresh)}">` : ''}
<title>${esc(title)} · Wartabiye TV Admin</title><link rel="icon" href="/brand/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}"><link rel="stylesheet" href="/assets/login.css">
<script src="/assets/theme.js"></script></head>
<body class="auth"><div class="bg" aria-hidden="true"><span></span><span></span><span></span></div>
<button class="theme" id="themeBtn" type="button" aria-label="Switch light or dark mode" title="Light / dark"></button>
<main class="card${wide ? ' wide' : ''}">
  <header class="brand"><img src="/brand/logo.png" alt="" width="56" height="56"><div><b>Wartabiye <i>TV</i></b><small>${icon('lock', 'ic sm')} Admin Control Panel</small></div></header>
  ${steps}<section class="content">${body}</section>
  <footer class="foot">${icon('shield', 'ic sm')} Owner-only area · every sign-in is recorded</footer>
</main></body></html>`;
  const h = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(html, { status, headers: securityHeaders(h, { csp: csp({ form }) }) });
}

const MSG = {
  rate: ['warn', 'Too many sign-in attempts from this network. Please wait 15 minutes and try again.'],
  state: ['warn', 'The sign-in took too long or was opened in another tab. Please try again.'],
  github: ['bad', 'GitHub could not confirm the sign-in. Please try again.'],
  denied: ['bad', 'This GitHub account is not allowed to open the Wartabiye TV dashboard. Only the owner of the website can sign in. The attempt was recorded.'],
  install: ['warn', 'Almost done: the Wartabiye Admin GitHub App is not installed on the website repository yet. Install it on GitHub (Settings → Applications → Wartabiye Admin → Configure → choose the repository), then sign in again.'],
  expired: ['info', 'Your session has ended for your security (30 minutes without activity or 8 hours in total). Please sign in again.'],
};

export function loginPage(url, configured) {
  const p = url.searchParams;
  let note = '';
  if (p.get('bye')) note = '<div class="alert ok" role="status">You have been signed out securely. Your GitHub access for this dashboard was revoked.</div>';
  else if (p.get('installed')) note = '<div class="alert ok" role="status">The GitHub App is installed. You can sign in now.</div>';
  else if (MSG[p.get('e')]) note = `<div class="alert ${MSG[p.get('e')][0]}" role="alert">${MSG[p.get('e')][1]}</div>`;
  const gh = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>';
  const body = configured
    ? `<h1>Welcome back</h1><p class="lead">Sign in to manage news, sports, LIVE coverage, adverts and see how the website is doing.</p>${note}
       <a class="btn primary big" id="signin" href="/auth/github" data-loading="Connecting to GitHub…">${gh}<span>Sign in with GitHub</span></a>
       <ul class="facts"><li>${icon('shield', 'ic sm')} Step 1: your GitHub account (with GitHub's own 2-step verification)</li>
       <li>${icon('lock', 'ic sm')} Step 2: a 6-digit code from your authenticator app</li></ul>
       <p class="hint">Not the owner? This area is private. No accounts can be created here.</p>`
    : `<h1>Secure sign-in is not set up yet</h1><p class="lead">The owner connects the dashboard to GitHub once. It takes about two minutes.</p>${note}
       <a class="btn primary big" href="/setup"><span>Set up secure sign-in</span></a>`;
  return page({ title: 'Sign in', body, step: configured ? 1 : 0 });
}
