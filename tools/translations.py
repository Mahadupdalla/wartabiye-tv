"""Article translations (English, Arabic, French) for the daily task and for checks.

Each article file data/news/<id>.json keeps the original Somali text in title/summary/body/imageAlt.
A translation is stored in the same file under "en", "ar" or "fr":
  "en": {"title": ..., "summary": ..., "body": ..., "imageAlt": ..., "status": "auto", "hash": ...}
"status" is "auto" for a machine translation and "manual" for one the owner wrote or corrected in /admin/.
"hash" fingerprints the text as it was machine-translated; if someone edits it later, build_news.py
reports it as "manual". A translation that already exists is NEVER overwritten by this tool.

  python3 tools/translations.py missing            list articles that lack a translation (JSON, Somali text included)
  python3 tools/translations.py add <file.json>    add translations: {"<id>": {"en": {...}, "ar": {...}, "fr": {...}}}
  python3 tools/translations.py verify [<ref>]     check that existing article files only GAINED translations since <ref> (default HEAD)
"""
import json, os, sys, glob, re, hashlib, subprocess
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS = os.path.join(root, 'data', 'news')
LANGS = ('en', 'ar', 'fr')
FIELDS = ('title', 'summary', 'body', 'imageAlt')


def text_hash(t):
    s = '\n'.join(str(t.get(k) or '').strip() for k in ('title', 'summary', 'body'))
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]


def has(n, lang):
    t = n.get(lang)
    return isinstance(t, dict) and isinstance(t.get('title'), str) and t['title'].strip() != ''


def numbers(s):
    # digits only, so 47.45 (English) and 47,45 (French) both give ['47', '45']
    return sorted(re.findall(r'\d+', s or ''))


def load(path):
    return json.load(open(path, encoding='utf-8'))


def save(path, n):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(n, f, ensure_ascii=False, indent=2)


def missing():
    out = []
    for f in sorted(glob.glob(os.path.join(NEWS, '*.json'))):
        n = load(f)
        need = [l for l in LANGS if not has(n, l)]
        if need:
            out.append({'id': os.path.basename(f)[:-5], 'missing': need, **{k: n[k] for k in FIELDS if n.get(k)}})
    print(json.dumps(out, ensure_ascii=False, indent=1))
    print(f'{len(out)} article(s) need translations', file=sys.stderr)


def add(src):
    data = load(src)
    added = skipped = refused = 0
    for nid, langs in data.items():
        path = os.path.join(NEWS, nid + '.json')
        if not re.fullmatch(r'[a-z0-9-]+', nid) or not os.path.isfile(path):
            print(f'{nid}: no such article, skipped'); refused += 1; continue
        n = load(path)
        so = ' '.join(str(n.get(k) or '') for k in ('title', 'summary', 'body'))
        changed = False
        for lang, t in langs.items():
            if lang not in LANGS or not isinstance(t, dict) or not str(t.get('title') or '').strip():
                print(f'{nid}/{lang}: empty or unknown language, skipped'); refused += 1; continue
            if has(n, lang):
                print(f'{nid}/{lang}: already translated, kept as it is'); skipped += 1; continue
            if n.get('body') and not str(t.get('body') or '').strip():
                print(f'{nid}/{lang}: the Somali article has a body but the translation has none, refused'); refused += 1; continue
            tr = ' '.join(str(t.get(k) or '') for k in ('title', 'summary', 'body'))
            if numbers(so) != numbers(tr):
                print(f'{nid}/{lang}: numbers differ from the Somali text {numbers(so)} != {numbers(tr)}, refused'); refused += 1; continue
            block = {k: t[k].strip() for k in FIELDS if isinstance(t.get(k), str) and t[k].strip()}
            block['status'] = 'auto'
            block['hash'] = text_hash(block)
            n[lang] = block; changed = True; added += 1
        if changed:
            save(path, n)
    print(f'{added} translation(s) added, {skipped} kept (already there), {refused} refused')
    return 1 if refused and not added else 0


def verify(ref='HEAD'):
    """Existing files may only gain en/ar/fr blocks that were missing; nothing else may change."""
    bad = []
    files = subprocess.run(['git', 'diff', '--name-only', ref, '--', 'data/news/'], cwd=root, capture_output=True, text=True).stdout.split()
    for rel in files:
        old = subprocess.run(['git', 'show', f'{ref}:{rel}'], cwd=root, capture_output=True, text=True)
        if old.returncode != 0:
            continue  # a new file
        if not os.path.exists(os.path.join(root, rel)):
            bad.append(f'{rel}: deleted'); continue
        a, b = json.loads(old.stdout), load(os.path.join(root, rel))
        for k in set(a) | set(b):
            if a.get(k) == b.get(k):
                continue
            if k in LANGS and not has(a, k) and has(b, k):
                continue
            bad.append(f'{rel}: field "{k}" changed')
    print('\n'.join(bad) if bad else 'OK: existing articles only gained missing translations')
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'missing':
        missing()
    elif cmd == 'add' and len(sys.argv) > 2:
        sys.exit(add(sys.argv[2]))
    elif cmd == 'verify':
        sys.exit(verify(sys.argv[2] if len(sys.argv) > 2 else 'HEAD'))
    else:
        print(__doc__); sys.exit(2)
