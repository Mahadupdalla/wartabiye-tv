// End-to-end test of the admin dashboard on the LIVE site, run by .github/workflows/admin-test.yml.
// Signs in with the workflow's own short-lived GitHub token (never printed), then:
// adds a draft with an uploaded image, edits it, publishes it, checks it on the live site, deletes it, checks it is gone.
// Exit code 1 on any problem.
const { chromium } = require('playwright');
const fs = require('fs');
const TOKEN = process.env.GH_TOKEN, REPO = process.env.GITHUB_REPOSITORY;
const SITE = `https://${REPO.split('/')[0].toLowerCase()}.github.io/${REPO.split('/')[1]}/`;
const OUT = process.argv[2] || '.';
const TITLE = 'TIJAABO maamul ' + Date.now();
const api = (path, opt = {}) => fetch('https://api.github.com/' + path, { ...opt, headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', ...(opt.headers || {}) } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function publishAndWait(check, what) {
  const r = await api(`repos/${REPO}/actions/workflows/publish.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
  if (r.status !== 204) throw new Error('could not start publish: ' + r.status);
  for (let i = 0; i < 40; i++) {
    await sleep(15000);
    const live = await (await fetch(SITE + 'data/news.json?ts=' + Date.now())).json();
    if (check(live.news)) { console.log('LIVE:', what, `(after ${(i + 1) * 15}s)`); return }
  }
  throw new Error('live site never showed: ' + what);
}
async function newsFiles() { const r = await api(`repos/${REPO}/contents/data/news?ref=main&ts=${Date.now()}`); return (await r.json()).map(x => x.name) }
(async () => {
  const b = await chromium.launch(); let ok = false;
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const log = [];
  p.on('pageerror', e => log.push('ERR ' + e.message));
  // The workflow token is an app token, which GitHub does not allow to read /user; answer that one call
  // with the repo owner's public profile. Every read and write still goes to GitHub with the token.
  await p.route('https://api.github.com/user', async r => { const u = await (await fetch('https://api.github.com/users/' + REPO.split('/')[0])).json(); await r.fulfill({ json: u }) });
  await p.route(new RegExp('^https://api\\.github\\.com/repos/' + REPO + '$'), async r => { const res = await r.fetch(); const j = await res.json(); if (!j.permissions) { j.permissions = { admin: false, push: true, pull: true }; log.push('repo permissions added for app token') } await r.fulfill({ response: res, json: j }) });
  p.on('response', r => { if (r.url().startsWith('https://api.github.com')) log.push(r.status() + ' ' + r.request().method() + ' ' + r.url().slice(0, 120)) });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push('console ' + m.type() + ': ' + m.text().slice(0, 300)) });
  const shot = n => p.screenshot({ path: `${OUT}/admin-${n}.png` });
  const field = async (text) => { const id = await p.evaluate(t => { const l = [...document.querySelectorAll('[id$="-label"]')].find(e => e.offsetParent && e.textContent.trim().replace(/\*$/, '').trim() === t); return l && l.id }, text); if (!id) throw new Error('no field ' + text); return p.locator(`[aria-labelledby="${id}"]`).first() };
  try {
    const before = await newsFiles();
    await p.goto(SITE + 'admin/', { waitUntil: 'networkidle' }); await shot('0-login');
    const body0 = await p.evaluate(() => document.body.innerText);
    console.log('login page offers:', body0.replace(/\s+/g, ' ').slice(0, 200));
    await p.getByText('Sign In Using Access Token').click(); await sleep(500);
    await p.locator('input').first().fill(TOKEN); await p.keyboard.press('Enter');
    await p.getByRole('button', { name: 'New' }).first().waitFor({ timeout: 60000 }); await sleep(2000); await shot('1-dashboard');
    // add a draft with an uploaded image
    await p.getByRole('button', { name: 'New' }).first().click(); await sleep(1500);
    await (await field('Cinwaanka')).fill(TITLE);
    await (await field('Soo koobid')).fill('Tijaabo otomaatig ah oo dashboard-ka maamulka ah; waa la tirtirayaa.');
    await (await field('Qaybta')).click(); await sleep(400); await p.getByRole('option', { name: 'Bulshada' }).click();
    await (await field('La daabacay (bogga ka muuqda)')).click();
    await p.getByRole('button', { name: 'Browse' }).first().click(); await sleep(1000);
    await p.locator('input[type=file]').first().setInputFiles('tools/test-image.png'); await sleep(2000);
    if (await p.getByRole('button', { name: 'Insert' }).isVisible()) { await p.locator('dialog[open] [role=option]', { hasText: 'test-image' }).first().click(); await sleep(400); await p.getByRole('button', { name: 'Insert' }).click() }
    await shot('2-new'); await p.getByRole('button', { name: 'Save' }).click(); await sleep(8000); await shot('3-saved');
    const added = (await newsFiles()).filter(x => !before.includes(x));
    if (added.length !== 1) throw new Error('expected 1 new file in data/news, got ' + JSON.stringify(added));
    const file = added[0]; console.log('SAVED to GitHub: data/news/' + file);
    const saved = JSON.parse(Buffer.from((await (await api(`repos/${REPO}/contents/data/news/${file}?ref=main`)).json()).content, 'base64').toString());
    if (saved.published !== false || !saved.image) throw new Error('draft not saved as expected: ' + JSON.stringify(saved));
    console.log('draft has image', saved.image);
    await publishAndWait(n => !n.some(x => x.id === file.slice(0, -5)) && true, 'draft is NOT on the public site');
    // edit headline and publish
    await p.getByRole('button', { name: 'Cancel Editing' }).click().catch(() => { }); await sleep(1500);
    await p.getByText(TITLE).first().click(); await sleep(2000);
    await (await field('Cinwaanka')).fill(TITLE + ' (la beddelay)');
    await (await field('La daabacay (bogga ka muuqda)')).click();
    await p.getByRole('button', { name: 'Save' }).click(); await sleep(8000); await shot('4-edited');
    await publishAndWait(n => n.some(x => x.title === TITLE + ' (la beddelay)'), 'edited article is on the public site');
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    await pg.goto(SITE + '#war-' + file.slice(0, -5), { waitUntil: 'networkidle' }); await sleep(1500);
    const shown = await pg.evaluate(() => document.body.innerText);
    if (!shown.includes(TITLE + ' (la beddelay)')) throw new Error('article page does not show the edited title');
    await pg.screenshot({ path: `${OUT}/admin-5-live-article.png` }); console.log('LIVE article page shows the edited title');
    // delete
    await p.getByRole('button', { name: 'Cancel Editing' }).click().catch(() => { }); await sleep(1500);
    await p.getByText(TITLE + ' (la beddelay)').first().click(); await sleep(2000);
    await p.getByRole('button', { name: 'Show Editor Options' }).click(); await sleep(500);
    await p.getByRole('menuitem', { name: /Delete/ }).click(); await sleep(600);
    await p.getByRole('button', { name: /^Delete$/ }).last().click(); await sleep(8000); await shot('6-deleted');
    if ((await newsFiles()).includes(file)) throw new Error('file still in GitHub after delete');
    console.log('DELETED from GitHub');
    await publishAndWait(n => !n.some(x => x.id === file.slice(0, -5)), 'deleted article is gone from the public site');
    fs.writeFileSync(`${OUT}/uploaded-image.txt`, saved.image.replace(/^\//, ''));
    ok = true;
  } catch (e) { console.log('PROBLEM:', e.message); await shot('x-error').catch(() => { }); console.log('PAGE TEXT:', (await p.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ').slice(0, 1500)) }
  console.log(log.join('\n')); await b.close();
  console.log(ok ? 'ADMIN TEST OK' : 'ADMIN TEST FAILED'); process.exit(ok ? 0 : 1);
})();
