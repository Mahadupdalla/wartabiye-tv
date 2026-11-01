"""List every article id and source URL the site has EVER had, including articles the owner deleted
or unpublished in /admin/, so the automatic update never brings a deleted story back.
Reads data/news/*.json and the git history of data/news/ (needs a full clone, not --depth 1).

  python3 tools/known_sources.py            -> JSON {"ids": [...], "urls": [...], "titles": [...], "deleted": [...]}
  python3 tools/known_sources.py --check URL  -> exit 1 (and print the id) if URL is already known
"""
import json, os, sys, glob, subprocess
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def norm(u):
    return (u or '').split('?')[0].split('#')[0].rstrip('/').lower()


def git(*a):
    return subprocess.run(['git', '-C', root, *a], capture_output=True, text=True).stdout


def collect():
    ids, urls, titles, deleted = {}, {}, set(), []
    for f in glob.glob(os.path.join(root, 'data', 'news', '*.json')):
        try: n = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        i = os.path.basename(f)[:-5]; ids[i] = 'current'
        if n.get('sourceUrl'): urls[norm(n['sourceUrl'])] = i
        if n.get('title'): titles.add(n['title'].strip())
    if git('rev-parse', '--is-shallow-repository').strip() == 'true':
        print('warning: shallow clone, deleted articles cannot be read; run git fetch --unshallow', file=sys.stderr)
    # every version of every article file that ever existed (deleted ones included)
    log = git('log', 'HEAD', '--format=@%H', '--name-only', '--diff-filter=AMD', '--', 'data/news/')
    commit = None
    for line in log.splitlines():
        if line.startswith('@'): commit = line[1:]; continue
        if not line.endswith('.json') or not line.startswith('data/news/'): continue
        i = os.path.basename(line)[:-5]
        if i in ids: continue
        ids[i] = 'deleted'; deleted.append(i)
        raw = git('show', f'{commit}^:{line}') or git('show', f'{commit}:{line}')
        try: n = json.loads(raw)
        except Exception: continue
        if n.get('sourceUrl'): urls.setdefault(norm(n['sourceUrl']), i)
        if n.get('title'): titles.add(n['title'].strip())
    return ids, urls, titles, deleted


if __name__ == '__main__':
    ids, urls, titles, deleted = collect()
    if '--check' in sys.argv:
        u = norm(sys.argv[sys.argv.index('--check') + 1])
        if u in urls: print('known:', urls[u], '(' + ids.get(urls[u], '?') + ')'); sys.exit(1)
        print('new'); sys.exit(0)
    print(json.dumps({'ids': sorted(ids), 'urls': sorted(urls), 'titles': sorted(titles), 'deleted': sorted(deleted)}, ensure_ascii=False, indent=1))
