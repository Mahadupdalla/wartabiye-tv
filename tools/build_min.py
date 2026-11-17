"""Minified copies of the site's own JS and CSS for visitors (assets/min/), made at every publish (publish.yml).

The readable files in assets/ stay the source: edit those, never assets/min/. This script writes
assets/min/<name>.min.js / site.min.css with esbuild (whitespace, comments and local names removed, no syntax lowering; the /*! © … */
copyright line is kept; NO source maps are made) and assets/min/manifest.json, which records the source hash of each
minified file. tools/build_pages.py points the pages at a minified file only while its source hash still matches the
readable file, so a failed or skipped minify never serves stale code: the page simply keeps the readable file.

Usage: python3 tools/build_min.py [path to esbuild]   (default: npx --yes esbuild@0.24.0)
       python3 tools/build_min.py test                 checks assets/min against the sources, no network needed
"""
import hashlib, json, os, re, shutil, subprocess, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(root, 'assets')
OUT = os.path.join(ASSETS, 'min')
MANIFEST = os.path.join(OUT, 'manifest.json')
FILES = ['i18n.js', 'media-i18n.js', 'sports-src.js', 'media.js', 'app.js', 'notify.js', 'protect.js', 'stats.js', 'ads.js', 'site.css']
COPYRIGHT = '/*! © 2026 Wartabiye TV. All Rights Reserved.'


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def min_name(name):
    base, ext = os.path.splitext(name)
    return base + '.min' + ext


def load_manifest():
    try:
        return json.load(open(MANIFEST, encoding='utf-8'))
    except Exception:
        return {}


def current():
    """{source name: (minified name, short content hash)} for every minified file that is up to date with its source."""
    man, ok = load_manifest(), {}
    for name, rec in man.items():
        src, out = os.path.join(ASSETS, name), os.path.join(OUT, rec.get('min', ''))
        if os.path.isfile(src) and os.path.isfile(out) and rec.get('source') == sha(src) and rec.get('output') == sha(out):
            ok[name] = (rec['min'], rec['output'][:10])
    return ok


def rewrite(html):
    """Point every <script src="assets/X.js?v=…"> / <link href="assets/site.css?v=…"> at its up-to-date minified copy."""
    ok = current()

    def sub(m):
        name = m.group(2)
        if name not in ok:
            return m.group(0)
        return f'{m.group(1)}assets/min/{ok[name][0]}?v={ok[name][1]}{m.group(4)}'
    return re.sub(r'((?:src|href)=")assets/([a-z0-9-]+\.(?:js|css))(\?v=[^"]*)?(")', sub, html)


def unrewrite(html):
    """The reverse of rewrite(): readable assets again, versioned by their source content (the page template)."""
    def sub(m):
        name = m.group(2) + '.' + m.group(3)
        src = os.path.join(ASSETS, name)
        return f'{m.group(1)}assets/{name}?v={sha(src)[:10] if os.path.isfile(src) else "0"}{m.group(4)}'
    return re.sub(r'((?:src|href)=")assets/min/([a-z0-9-]+)\.min\.(js|css)(?:\?v=[^"]*)?(")', sub, html)


def build(esbuild):
    os.makedirs(OUT, exist_ok=True)
    man = {}
    for name in FILES:
        src = os.path.join(ASSETS, name)
        if not os.path.isfile(src):
            continue
        out = os.path.join(OUT, min_name(name))
        subprocess.run(esbuild + [src, '--minify', '--legal-comments=inline', '--charset=utf8',
                                  '--outfile=' + out, '--log-level=warning'], check=True, cwd=root, timeout=300)
        text = open(out, encoding='utf-8').read()
        assert COPYRIGHT in text, f'copyright line missing in {out}'
        assert 'sourceMappingURL' not in text, f'source map reference in {out}'
        man[name] = {'min': min_name(name), 'source': sha(src), 'output': sha(out)}
        print(f'{name}: {os.path.getsize(src)} -> {os.path.getsize(out)} bytes')
    for f in os.listdir(OUT):  # nothing else (old files, *.map) is published from assets/min
        if f != 'manifest.json' and f not in {r['min'] for r in man.values()}:
            os.remove(os.path.join(OUT, f))
    json.dump(man, open(MANIFEST, 'w', encoding='utf-8'), indent=1, sort_keys=True)


def test():
    ok, man = current(), load_manifest()
    stale = sorted(set(man) - set(ok))
    maps = [f for f in os.listdir(OUT)] if os.path.isdir(OUT) else []
    maps = [f for f in maps if f.endswith('.map')]
    for name in ok:
        js = open(os.path.join(OUT, ok[name][0]), encoding='utf-8').read()
        assert COPYRIGHT in js, f'copyright line missing in assets/min/{ok[name][0]}'
        assert 'sourceMappingURL' not in js, f'source map reference in assets/min/{ok[name][0]}'
        if name.endswith('.js'):
            subprocess.run(['node', '--check', os.path.join(OUT, ok[name][0])], check=True)
    assert not maps, f'source maps found: {maps}'
    print(f'minified up to date: {len(ok)}, stale (readable file served instead): {stale or "none"}')


if __name__ == '__main__':
    if sys.argv[1:] == ['test']:
        test()
    else:
        build(sys.argv[1:] or (['npx', '--yes', 'esbuild@0.24.0'] if shutil.which('npx') else sys.exit('npx not found')))
        test()
