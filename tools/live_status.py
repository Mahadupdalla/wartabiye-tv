"""LIVE TV check: is the official Wartabiye TV broadcast really on air?

Asks the official YouTube Data API v3 (key in the repository secret YOUTUBE_API_KEY, never in the public site) about the
stream set in /admin/ (data/live.json): the video in "streamUrl", and/or the newest uploads of the channel in
"youtubeChannelId" / a /channel/UC... link. Writes data/live-status.json:
  {"live": true|false, "videoId", "title", "startedAt", "checkedAt", "source", "channelId", "upcoming": [...]}
Viewer counts are never stored or shown. The file is only rewritten when something changes, or every 25 minutes
while live (so the site can tell a fresh "live" from an old one: assets/media.js trusts it for 60 minutes).
Run by .github/workflows/live-status.yml. Exit code 0 even when nothing can be checked (it then says why)."""
import json, os, sys, urllib.request, urllib.parse, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from media_rules import provider, parse_time  # noqa: E402

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(root, 'data', 'live.json')
OUT = os.path.join(root, 'data', 'live-status.json')
API = 'https://www.googleapis.com/youtube/v3/'
HEARTBEAT = 25 * 60


def now():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)


def iso(d):
    return d.isoformat().replace('+00:00', 'Z')


def get(path, **q):
    q['key'] = os.environ['YOUTUBE_TOKEN']
    with urllib.request.urlopen(API + path + '?' + urllib.parse.urlencode(q), timeout=20) as r:
        return json.load(r)


def decide(cfg, videos, channel):
    """Pure decision from YouTube 'videos' items (tested in tools/media_test.py)."""
    live, upcoming = None, []
    for v in videos:
        sn, ls = v.get('snippet', {}), v.get('liveStreamingDetails', {})
        if channel and sn.get('channelId') != channel:
            continue  # only the official channel
        if sn.get('liveBroadcastContent') == 'live' and ls.get('actualStartTime') and not ls.get('actualEndTime') and not live:
            live = {'videoId': v['id'], 'title': sn.get('title', ''), 'startedAt': ls['actualStartTime']}
        elif sn.get('liveBroadcastContent') == 'upcoming' and ls.get('scheduledStartTime'):
            upcoming.append({'videoId': v['id'], 'title': sn.get('title', ''), 'scheduledStart': ls['scheduledStartTime']})
    upcoming.sort(key=lambda x: x['scheduledStart'])
    out = {'live': bool(live), 'source': 'YouTube Data API', 'channelId': channel or None, 'upcoming': upcoming[:5]}
    if live:
        out.update(live)
    return out


def changed(old, new):
    keys = ('live', 'videoId', 'title', 'startedAt', 'upcoming')
    if any(old.get(k) != new.get(k) for k in keys):
        return True
    last = parse_time(old.get('checkedAt'))
    return bool(new['live'] and (not last or (now() - last).total_seconds() >= HEARTBEAT))


def main():
    cfg = json.load(open(CFG, encoding='utf-8')) if os.path.exists(CFG) else {}
    old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    site = json.load(open(os.path.join(root, 'data', 'site.json'), encoding='utf-8'))
    if (site.get('sections') or {}).get('live') is False or cfg.get('statusMode') == 'manual':
        print('LIVE TV is off or in manual mode: nothing to check'); return
    p, pid = provider(cfg.get('streamUrl'))
    channel = (cfg.get('youtubeChannelId') or '').strip() or (pid if p == 'youtube-channel' else None)
    ids = [pid] if p == 'youtube' else []
    if not ids and not channel:
        print('No official YouTube live link or channel ID in /admin/ (LIVE TV): nothing to check'); return
    if not os.environ.get('YOUTUBE_TOKEN'):
        print('Repository secret YOUTUBE_API_KEY is not set: the LIVE sign stays off (see HAGAHA-MAAMULKA.md)'); return
    if channel:  # newest uploads of the official channel (2 quota units per check)
        pl = get('playlistItems', part='contentDetails', playlistId='UU' + channel[2:], maxResults=8)
        ids += [i['contentDetails']['videoId'] for i in pl.get('items', []) if i['contentDetails']['videoId'] not in ids]
    vids = get('videos', part='snippet,liveStreamingDetails', id=','.join(ids[:50])).get('items', [])
    new = decide(cfg, vids, channel)
    if not changed(old, new):
        print('no change:', 'LIVE' if new['live'] else 'offline'); return
    new['checkedAt'] = iso(now())
    json.dump(new, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('updated:', 'LIVE ' + new.get('videoId', '') if new['live'] else 'offline', '| upcoming', len(new['upcoming']))


if __name__ == '__main__':
    main()
