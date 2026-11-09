"""Keep ONE bad new article from blocking every other article (publish workflow, after tools/check_site.py failed).

tools/check_site.py stops the whole publication when any article breaks a rule (no photo, a photo another article uses, a
missing photo description or licence ...). Before this tool, one such NEW automatic article held back every other valid
article until someone fixed it by hand on GitHub. Now:

  - only articles that are NOT on the site yet (not in the data/news.json of the last publication) and that were written
    automatically (never "by": "admin") are touched: they are turned into drafts in /admin/ -> "Sugaya sawir"
    ("published": false, "imagePending": true) with the exact reason in "imageNote" and "heldBy": "publish-check";
  - data/news.json is rebuilt and checked again; nothing is published unless tools/check_site.py then prints OK;
  - an error in an article that is already on the site, in an admin article, or anywhere else (adverts, videos, JSON)
    is NOT hidden: the tool fails, the publish run fails, and the owner gets the alert. Validation is never bypassed.

  python3 tools/quarantine.py [--previous FILE]   FILE = the data/news.json of the last publication (default: git HEAD)
  python3 tools/quarantine.py test
"""
import json, os, re, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS = os.path.join(root, 'data', 'news')


def check():
    r = subprocess.run([sys.executable, os.path.join(root, 'tools', 'check_site.py')], capture_output=True, text=True, cwd=root)
    return r.returncode == 0, (r.stdout + r.stderr).splitlines()


def errors_by_article(lines):
    """-> ({article id: [errors]}, [errors that are not about one article])"""
    per, other = {}, []
    for ln in lines:
        m = re.match(r'^([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+): (.+)$', ln.strip())
        if m and os.path.exists(os.path.join(NEWS, m.group(1) + '.json')):
            per.setdefault(m.group(1), []).append(m.group(2))
        elif ln and not re.match(r'^(adverts=|articles=|updatedAt|translated |videos=|WARNING|OK$)', ln):
            other.append(ln)
    return per, other


def previous_ids(path=None):
    try:
        raw = open(path, encoding='utf-8').read() if path else subprocess.run(['git', '-C', root, 'show', 'HEAD:data/news.json'], capture_output=True, text=True).stdout
        return {n['id'] for n in json.loads(raw)['news']}
    except Exception:
        return None


def hold(nid, reasons):
    p = os.path.join(NEWS, nid + '.json')
    n = json.load(open(p, encoding='utf-8'))
    n.update({'published': False, 'imagePending': True, 'heldBy': 'publish-check',
              'imageNote': 'Hubinta daabacaadda ayaa celisay (Sugaya sawir): ' + '; '.join(reasons)[:400]})
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(n, f, ensure_ascii=False, indent=2); f.write('\n')


def main(prev_path=None):
    ok, lines = check()
    if ok:
        print('check_site OK, nothing to hold'); return 0
    prev = previous_ids(prev_path)
    if prev is None:
        print('cannot read the last published data/news.json: nothing held, publication stopped'); return 1
    for _ in range(3):
        per, other = errors_by_article(lines)
        if other:
            print('errors that are not about one new article (not hidden, publication stopped):'); print('\n'.join(other)); return 1
        held, blocked = [], []
        for nid, errs in per.items():
            n = json.load(open(os.path.join(NEWS, nid + '.json'), encoding='utf-8'))
            if nid in prev or n.get('by') == 'admin':
                blocked.append(f'{nid}: ' + '; '.join(errs))
            else:
                held.append((nid, errs))
        if not held:
            print('errors in articles already on the site or written in /admin/ (not hidden, publication stopped):')
            print('\n'.join(blocked)); return 1
        for nid, errs in held:
            hold(nid, errs)
            print(f'held in Sugaya sawir (not published): {nid}: ' + '; '.join(errs))
        subprocess.run([sys.executable, os.path.join(root, 'tools', 'build_news.py')], cwd=root, check=True, capture_output=True)
        ok, lines = check()
        if ok:
            print('check_site OK after holding the articles above; every other article is published'); return 0
    print('\n'.join(lines)); return 1


def self_test():
    per, other = errors_by_article(['adverts=0', 'articles=3 with_image=3 placeholder=0', 'updatedAt x', 'WARNING y',
                                    '2026-11-09-trump-putin-xi-shenzhen: photo needs a description (imageAlt)',
                                    '2099-01-01-no-such-file: bad', 'ad x: needs a title and the advertiser name', 'OK'])
    good = list(per) == ['2026-11-09-trump-putin-xi-shenzhen'] and other == ['2099-01-01-no-such-file: bad', 'ad x: needs a title and the advertiser name']
    print('QUARANTINE OK' if good else f'QUARANTINE FAILED {per} {other}')
    return 0 if good else 1


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['test']:
        sys.exit(self_test())
    sys.exit(main(a[a.index('--previous') + 1] if '--previous' in a else None))
