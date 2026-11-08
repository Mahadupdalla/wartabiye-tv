"""Decides whether a pull request is LOW RISK (may be merged automatically once every check passes and the owner's
"auto-merge" label is on it) or SENSITIVE (only the owner merges it, after reading it).

The owner's rule (8 Nov 2026): never merge automatically anything that touches passwords, admin access, secrets,
the automation itself, or that deletes things. When in doubt, a pull request is SENSITIVE.

  python3 tools/pr_risk.py classify files.json   # files.json = GitHub's "list pull request files" answer (a JSON list)
  python3 tools/pr_risk.py test

The workflow always runs THIS file from main, never the pull request's own copy, so a pull request cannot loosen
these rules for itself.
"""
import json, re, sys

# Paths that are always SENSITIVE (first match wins; checked against every changed file and the old name of a rename).
SENSITIVE_PATHS = [
    (r'^\.github/', 'GitHub workflows or settings (the automation itself)'),
    (r'^admin/', 'admin dashboard or sign-in settings'),
    (r'^workers/', 'Cloudflare workers that hold secret keys'),
    (r'^CNAME$', 'the website address (domain)'),
    (r'^sw\.js$', 'the service worker (controls every visitor\'s page and push alerts)'),
    (r'^CLAUDE\.md$', 'the rules Claude follows in this repository'),
    (r'^tools/pr_risk\.py$', 'the auto-merge safety rules'),
    (r'^tools/deploy_status(\.py|_push\.sh)$', 'the deploy status writer used by the workflows'),
    (r'^tools/(push_send\.py|live_status\.py|sports_feed\.mjs|fast_loop\.sh|live_feeds_cycle\.sh)$',
     'a tool that uses a secret key or the GitHub token'),
    (r'^data/(notify-settings|schedule)\.json$', 'push alert or news-task schedule settings'),
    (r'(^|/)\.env|\.pem$|\.key$|id_rsa|(^|/)secrets?[./]|password', 'a file whose name suggests a secret'),
]
# Text in ADDED lines of code/config files that needs the owner's eyes. News text (data/news, data/videos, data/alerts,
# *.md) is not scanned: words like "Secretary" or "secret talks" are normal in headlines.
SENSITIVE_TEXT = [
    (r'ghp_[A-Za-z0-9]{20}|github_pat_|gh[osu]_[A-Za-z0-9]{20}', 'a GitHub token'),
    (r'BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY', 'a private key'),
    (r'(?i)\bpass(word|wd)\b\s*[:=]', 'a password'),
    (r'(?i)(client_secret|api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*[\'"][^\'"\s]{8,}', 'a key or token value'),
    (r'(?i)secrets\.[A-Z_]+', 'use of a repository secret'),
    (r'(?i)\bauth_methods\b|\bbackend\s*:', 'sign-in settings'),
    (r'(?i)\brm\s+-rf\b|git\s+push\s+(-f|--force)|git\s+reset\s+--hard|DROP\s+TABLE', 'a destructive command'),
]
TEXT_SKIP = re.compile(r'^(data/(news|videos|alerts|ads|world|live-feeds|sports-feed)/|.*\.md$|.*\.txt$|img/)')
MAX_CHANGED_LINES = 4000      # bigger than this: the owner looks first
MAX_DELETED_LINES = 600       # more removed than this: treated as destructive
MAX_FILES = 300


def classify(files):
    reasons = []
    total = deleted = 0
    for f in files:
        name = f.get('filename', '')
        names = [name] + ([f['previous_filename']] if f.get('previous_filename') else [])
        for n in names:
            for pat, why in SENSITIVE_PATHS:
                if re.search(pat, n, re.I):
                    reasons.append(f'{n}: {why}')
                    break
        if f.get('status') == 'removed':
            reasons.append(f'{name}: file deleted (destructive)')
        total += int(f.get('additions') or 0) + int(f.get('deletions') or 0)
        deleted += int(f.get('deletions') or 0)
        if TEXT_SKIP.match(name):
            continue
        patch = f.get('patch')
        if patch is None and int(f.get('changes') or 0) > 0 and not re.search(r'\.(png|jpe?g|webp|gif|svg|ico|mp4|woff2?)$', name, re.I):
            reasons.append(f'{name}: change too large for GitHub to show (cannot be checked automatically)')
            continue
        added = '\n'.join(l[1:] for l in (patch or '').splitlines() if l.startswith('+') and not l.startswith('+++'))
        for pat, why in SENSITIVE_TEXT:
            if re.search(pat, added):
                reasons.append(f'{name}: adds {why}')
    if len(files) > MAX_FILES:
        reasons.append(f'{len(files)} files changed (more than {MAX_FILES})')
    if total > MAX_CHANGED_LINES:
        reasons.append(f'{total} lines changed (more than {MAX_CHANGED_LINES})')
    if deleted > MAX_DELETED_LINES:
        reasons.append(f'{deleted} lines removed (more than {MAX_DELETED_LINES}, treated as destructive)')
    if not files:
        reasons.append('no changed files could be read')
    seen, out = set(), []
    for r in reasons:
        if r not in seen:
            seen.add(r); out.append(r)
    return {'risk': 'sensitive' if out else 'low', 'reasons': out}


def _f(name, patch='', status='modified', add=1, rem=0, **kw):
    d = {'filename': name, 'status': status, 'additions': add, 'deletions': rem, 'changes': add + rem, 'patch': patch}
    d.update(kw)
    return d


def test():
    low = [_f('index.html', '@@\n+<p>Hello</p>'), _f('assets/app.js', '@@\n+const x = 1;'),
           _f('data/news/abc.json', '@@\n+"title": "Culture Secretary says password: none"'), _f('img/news/a.jpg', None, add=0)]
    assert classify(low) == {'risk': 'low', 'reasons': []}, classify(low)
    cases = [
        [_f('.github/workflows/publish.yml')],
        [_f('admin/config.yml')],
        [_f('workers/push/src/index.js')],
        [_f('CNAME')],
        [_f('tools/pr_risk.py')],
        [_f('tools/push_send.py')],
        [_f('index.html', status='removed', add=0, rem=3)],
        [_f('assets/new.js', status='renamed', previous_filename='admin/x.js')],
        [_f('assets/app.js', '@@\n+const t = "ghp_abcdefghijklmnopqrstuvwxyz1234";')],
        [_f('assets/app.js', '@@\n+password = "hunter2"')],
        [_f('tools/build_pages.py', '@@\n+os.system("rm -rf /")')],
        [_f('tools/x.py', '@@\n+token = os.environ["X"]  # ${{ secrets.FOO }}')],
        [_f('assets/app.js', '@@\n+x', add=10, rem=900)],
        [_f('assets/big.js', None, add=5000)],
        [_f('.env.local')],
        [],
    ]
    for c in cases:
        r = classify(c)
        assert r['risk'] == 'sensitive' and r['reasons'], (c, r)
    print('pr_risk: all tests passed')


if __name__ == '__main__':
    if sys.argv[1:2] == ['test']:
        test()
    elif sys.argv[1:2] == ['classify']:
        res = classify(json.load(open(sys.argv[2], encoding='utf-8')))
        print(json.dumps(res, ensure_ascii=False))
    else:
        print(__doc__); sys.exit(2)
