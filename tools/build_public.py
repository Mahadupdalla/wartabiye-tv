"""Build the public (GitHub Pages) index.html from the artifact page source.
Adds a document skeleton and makes the page read data/news.json instead of the claude.ai database.
On the public site the claude.ai runtime is never used, even if a browser exposes window.claude."""
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
old = "if(!window.claude||!window.claude.use){loaded=true;renderAll();return}"
new = ("if(window.WARTABIYE_PUBLIC||!window.claude||!window.claude.use){"
       "try{var r=await fetch('data/news.json?v='+Date.now(),{cache:'no-store'});"
       "if(!r.ok)throw new Error('HTTP '+r.status+' data/news.json');var j=await r.json();"
       "items=(Array.isArray(j)?j:j.news||[]).map(function(o){o=Object.assign({},o);o._id=o._id||o.id;return o})"
       ".filter(function(o){return typeof o.title==='string'&&o.title})"
       ".sort(function(a,b){return a.publishedAt<b.publishedAt?1:-1});"
       "if(j.lastRunAt)window.WARTABIYE_LAST_RUN=j.lastRunAt;}"
       "catch(e){console.error('Wartabiye: news.json load failed',e);"
       "loadError='Wararka lama soo rari karin ('+(e&&e.message||e)+'). Fadlan dib u cusbooneysii bogga.';}"
       "loaded=true;renderAll();return}")
assert s.count(old) == 1, 'loader marker not found'
s = s.replace(old, new)
head = ('<!doctype html>\n<html lang="so">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<link rel="icon" href="img/logo.png">\n'
        '<script>window.WARTABIYE_PUBLIC=true</script>\n')
i = s.index('<style>'); j = s.index('</style>') + len('</style>')
out = head + s[:j] + '\n</head>\n<body>\n' + s[j:] + '\n</body>\n</html>\n'
open(dst, 'w', encoding='utf-8').write(out)
print('ok', len(out))
