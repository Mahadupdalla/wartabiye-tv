"""Checks that every open-data league in data/sports.json (OpenLigaDB) still answers with this season's matches.
Run by the health check (needs the internet). A league that has no matches within 45 days either side of today is
reported as a warning: usually the season changed (update "season" / the shortcut in /admin/ every July)."""
import datetime as D, json, sys, urllib.request

cfg = json.load(open('data/sports.json'))
od = cfg.get('openData') or {}
if od.get('enabled') is False:
    print('open data switched off'); sys.exit(0)
now = D.datetime.now(D.timezone.utc)
bad = 0
for lg in od.get('leagues') or []:
    if not lg or lg.get('enabled') is False:
        continue
    url = f"https://api.openligadb.de/getmatchdata/{lg['id']}/{lg['season']}"
    try:
        data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'wartabiye-tv-check'}), timeout=30))
    except Exception as e:
        print(f"::warning::OpenLigaDB {lg['id']} {lg['season']}: not reachable ({e})"); bad += 1; continue
    near = [m for m in data if abs((D.datetime.fromisoformat(m['matchDateTimeUTC'].replace('Z', '+00:00')) - now).days) <= 45]
    overdue = [m for m in data if not m['matchIsFinished'] and D.datetime.fromisoformat(m['matchDateTimeUTC'].replace('Z', '+00:00')) < now - D.timedelta(days=2)]
    print(f"{lg['id']:9} {lg['season']} matches={len(data)} within45d={len(near)} unfinished_older_than_2d={len(overdue)}")
    if not near:
        print(f"::warning::OpenLigaDB {lg['id']} {lg['season']}: no matches within 45 days (season changed? update it in /admin/ → Ciyaaraha Toos)"); bad += 1
    elif len(overdue) > 3:
        print(f"::warning::OpenLigaDB {lg['id']}: {len(overdue)} past matches still have no confirmed result (data not maintained?)"); bad += 1
print('OPEN DATA OK' if not bad else f'OPEN DATA: {bad} warning(s)')
