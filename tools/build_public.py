"""Build the public (GitHub Pages) index.html from the artifact page source.
Adds a document skeleton and makes the page read data/news.json when it is not running inside claude.ai."""
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
old = "if(!window.claude||!window.claude.use){loaded=true;renderAll();return}"
new = ("if(!window.claude||!window.claude.use){"
       "try{var r=await fetch('data/news.json?v='+Date.now(),{cache:'no-store'});var j=await r.json();"
       "items=(Array.isArray(j)?j:j.news||[]).map(function(o){o=Object.assign({},o);o._id=o.id;return o})"
       ".filter(function(o){return typeof o.title==='string'&&o.title})"
       ".sort(function(a,b){return a.publishedAt<b.publishedAt?1:-1});}catch(e){}"
       "loaded=true;renderAll();return}")
assert s.count(old) == 1, 'loader marker not found'
s = s.replace(old, new)
head = ('<!doctype html>\n<html lang="so">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<link rel="icon" href="img/logo.png">\n')
i = s.index('<style>'); j = s.index('</style>') + len('</style>')
out = head + s[:j] + '\n</head>\n<body>\n' + s[j:] + '\n</body>\n</html>\n'
open(dst, 'w', encoding='utf-8').write(out)
print('ok', len(out))
