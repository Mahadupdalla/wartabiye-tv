"""Merge new or changed articles into data/news.json and record the run time.
Usage: python3 tools/add_news.py <file.json with a list of article objects (each has "id")> [--note TEXT]
Existing articles with the same id are updated; nothing is deleted except the oldest "by":"claude" ones above 300."""
import json, os, sys, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(root, 'data', 'news.json')
data = json.load(open(path, encoding='utf-8'))
items = {n['id']: n for n in data['news']}
new = json.load(open(sys.argv[1], encoding='utf-8')) if len(sys.argv) > 1 and sys.argv[1] != '-' else []
for n in new:
    items[n['id']] = {**items.get(n['id'], {}), **n}
news = sorted(items.values(), key=lambda x: x.get('publishedAt', ''), reverse=True)
claude = [n for n in news if n.get('by') != 'admin']
while len(news) > 300 and claude:
    old = claude.pop(); news.remove(old)
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).isoformat(timespec='seconds')
data.update({'news': news, 'updatedAt': now if new else data.get('updatedAt'), 'lastRunAt': now})
if '--note' in sys.argv: data['lastRunNote'] = sys.argv[sys.argv.index('--note') + 1]
json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(new)} merged, {len(news)} total, lastRunAt {now}')
