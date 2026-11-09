"""Wartabiye TV live feeds: official publisher videos and newsroom headlines, refreshed every 5 minutes by
.github/workflows/live-feeds.yml (GitHub Actions, no Claude run needed).

Reads data/media-sources.json (edited in /admin/ → Ilaha muuqaalka iyo wararka tooska) and writes, into OUT_DIR:

  video-feed.json   newest videos from the publishers' OFFICIAL YouTube channels (public channel RSS). A video is listed only
                    when YouTube itself confirms the publisher allows embedding (YouTube oEmbed answers 200). Nothing is
                    downloaded or re-uploaded: the site plays it in YouTube's own player. Shorts are left out.
  live-wire.json    the latest headlines from the newsrooms' OFFICIAL RSS feeds (BBC, BBC Somali, Al Jazeera, DW,
                    France 24, UN News ...): headline, publisher, the publisher's own time and the link to the full article.
                    Only the headline is shown (no article text is copied). When a publisher changes a headline, the new one
                    replaces it and "updatedAt" says when. Breaking marks only when the publisher itself marks the story.
  feeds-status.json for every source: last check, last success, items, newest item, last error (admin health page).

Nothing here is invented: an item exists only when the publisher's own feed lists it.

  python3 tools/live_feeds.py OUT_DIR        update (keeps what it saw before in OUT_DIR)
  python3 tools/live_feeds.py test           offline self-test
"""
import datetime as D
import email.utils
import hashlib
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = {'User-Agent': 'WartabiyeTV-feeds/1.0 (+https://www.wartabiyetv.com/)', 'Accept-Language': 'en'}
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'media': 'http://search.yahoo.com/mrss/',
      'dc': 'http://purl.org/dc/elements/1.1/', 'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rss1': 'http://purl.org/rss/1.0/'}
SOMALIA = re.compile(r"(?i)\b(somali|soomaal|mogadishu|muqdisho|puntland|jubaland|galmudug|hirshabelle|hiiraan|baidoa|kismayo|kismaayo|al-shabaab|shabaab|hargeisa|somaliland)")
EAST_AFRICA = re.compile(r"(?i)\b(kenya|nairobi|ethiopia|addis ababa|tigray|amhara|oromia|djibouti|uganda|kampala|tanzania|dodoma|zanzibar|rwanda|kigali|burundi|south sudan|juba|eritrea|asmara|sudan|khartoum|darfur|igad|east africa|horn of africa)\b")
BREAKING = re.compile(r"^\s*(breaking|breaking news|live)\s*[:|–-]\s*", re.I)
VIDEO_ID = re.compile(r'^[A-Za-z0-9_-]{11}$')
CHANNEL_ID = re.compile(r'^UC[A-Za-z0-9_-]{22}$')


def now():
    return D.datetime.now(D.timezone.utc)


def iso(d):
    return d.astimezone(D.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def fetch(url, timeout=25):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.status, r.read()


def parse_time(s):
    s = (s or '').strip()
    if not s:
        return None
    try:
        d = email.utils.parsedate_to_datetime(s)
    except (TypeError, ValueError):
        d = None
    if d is None:
        try:
            d = D.datetime.fromisoformat(s.replace('Z', '+00:00'))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=D.timezone.utc)
    return d


def clean(s, n=300):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= n else s[:n - 1].rsplit(' ', 1)[0] + '…'


def host(u):
    try:
        return urllib.parse.urlsplit(u).hostname or ''
    except ValueError:
        return ''


def same_site(a, b):
    """True when a and b are on the same registered site (bbc.co.uk / bbc.com count as BBC)."""
    def base(h):
        h = h.lower()
        parts = h.split('.')
        b2 = '.'.join(parts[-3:]) if len(parts) > 2 and parts[-2] in ('co', 'com', 'org') and len(parts[-1]) == 2 else '.'.join(parts[-2:])
        return {'bbc.co.uk': 'bbc', 'bbc.com': 'bbc', 'bbci.co.uk': 'bbc', 'dw.com': 'dw', 'france24.com': 'france24', 'aljazeera.com': 'aljazeera',
                'aljazeera.net': 'aljazeera', 'un.org': 'un'}.get(b2, b2)
    return bool(a and b) and base(a) == base(b)


# ---------------- YouTube: official channel RSS + oEmbed (embedding allowed?) ----------------
def youtube_entries(xml_bytes):
    root = ET.fromstring(xml_bytes)
    out = []
    for e in root.findall('a:entry', NS):
        vid = e.findtext('yt:videoId', '', NS)
        link = (e.find('a:link', NS).get('href') if e.find('a:link', NS) is not None else '') or ''
        g = e.find('media:group', NS)
        desc = g.findtext('media:description', '', NS) if g is not None else ''
        out.append({'videoId': vid, 'title': clean(e.findtext('a:title', '', NS), 200), 'published': e.findtext('a:published', '', NS),
                    'updated': e.findtext('a:updated', '', NS), 'link': link, 'description': clean(desc, 280), 'short': '/shorts/' in link})
    return out


def embeddable(video_id, cache):
    if video_id in cache:
        return cache[video_id]
    try:
        st, _ = fetch('https://www.youtube.com/oembed?format=json&url=' + urllib.parse.quote('https://www.youtube.com/watch?v=' + video_id), 15)
        ok = st == 200
    except Exception:
        ok = False  # 401/403: the publisher switched embedding off (or the video is private): not listed
    cache[video_id] = ok
    return ok


def update_videos(cfg, prev, status, t):
    vc = cfg.get('videos') or {}
    max_n, max_age = int(vc.get('maxPerChannel', 8)), float(vc.get('maxAgeDays', 7))
    cache = {v['videoId']: True for v in (prev or {}).get('videos', []) if v.get('videoId')}
    keep = {v['id']: v for v in (prev or {}).get('videos', [])}
    out = []
    for ch in vc.get('channels') or []:
        if not ch or ch.get('enabled') is False or not CHANNEL_ID.match(str(ch.get('channelId', ''))):
            continue
        key = 'yt:' + ch['channelId']
        s = status.setdefault(key, {'name': ch.get('name'), 'kind': 'video'})
        s.update(name=ch.get('name'), kind='video', checkedAt=iso(t))
        try:
            _, body = fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch['channelId'])
            ents = youtube_entries(body)
            n = 0
            for e in ents:
                pub = parse_time(e['published'])
                if not VIDEO_ID.match(e['videoId']) or not pub or (t - pub).total_seconds() > max_age * 86400:
                    continue
                if e['short'] and vc.get('skipShorts', True):
                    continue
                if not embeddable(e['videoId'], cache):
                    continue
                vid = 'yt-' + e['videoId']
                v = {'id': vid, 'videoId': e['videoId'], 'title': e['title'], 'summary': e['description'], 'kind': ch.get('kind') or 'world',
                     'language': ch.get('language') or 'en', 'youtube': 'https://www.youtube.com/watch?v=' + e['videoId'], 'publishedAt': iso(pub),
                     'source': ch.get('name'), 'sourceUrl': 'https://www.youtube.com/channel/' + ch['channelId'], 'channelId': ch['channelId'],
                     'license': 'YouTube embed', 'auto': True}
                if vid in keep and keep[vid].get('title') != v['title']:
                    v['updatedAt'] = iso(t)
                out.append(v)
                n += 1
                if n >= max_n:
                    break
            s.update(ok=True, lastOkAt=iso(t), items=n, newest=max((v['publishedAt'] for v in out if v.get('channelId') == ch['channelId']), default=None), error=None)
        except Exception as ex:
            s.update(ok=False, error=str(ex)[:200])
            # keep this channel's earlier videos while its feed is unreachable (they are real and still embeddable)
            out += [v for v in keep.values() if v.get('channelId') == ch['channelId']]
    out.sort(key=lambda v: v['publishedAt'], reverse=True)
    return {'updatedAt': iso(t), 'videos': out}


# ---------------- Newsroom RSS → LIVE News wire ----------------
def rss_items(xml_bytes):
    root = ET.fromstring(xml_bytes)
    items = root.findall('.//item') or root.findall('.//rss1:item', NS) or root.findall('.//a:entry', NS)
    out = []
    for it in items:
        title = it.findtext('title') or it.findtext('rss1:title', None, NS) or it.findtext('a:title', None, NS) or ''
        link = it.findtext('link') or it.findtext('rss1:link', None, NS) or ''
        if not link and it.find('a:link', NS) is not None:
            link = it.find('a:link', NS).get('href', '')
        when = it.findtext('pubDate') or it.findtext('dc:date', None, NS) or it.findtext('a:published', None, NS) or it.findtext('a:updated', None, NS) or ''
        # the publisher's own short description: input for tools/live_updates.py (the facts of the LIVE update); never shown
        desc = it.findtext('description') or it.findtext('rss1:description', None, NS) or it.findtext('a:summary', None, NS) or ''
        out.append({'title': clean(title, 220), 'url': (link or '').strip(), 'time': when, 'desc': clean(desc, 400)})
    return out


def region_of(title, feed_region):
    if feed_region == 'somalia' or SOMALIA.search(title):
        return 'somalia'
    if EAST_AFRICA.search(title):
        return 'eastafrica'
    return 'africa' if feed_region == 'africa' else 'world'


def update_wire(cfg, prev, status, t):
    wc = cfg.get('wire') or {}
    max_age, max_n = float(wc.get('maxAgeHours', 24)), int(wc.get('maxItems', 120))
    old = {x['id']: x for x in (prev or {}).get('items', [])}
    seen = {}
    for f in wc.get('feeds') or []:
        if not f or f.get('enabled') is False or not str(f.get('url', '')).startswith('https://'):
            continue
        key = 'rss:' + f['url']
        s = status.setdefault(key, {})
        s.update(name=f.get('name'), kind='news', checkedAt=iso(t))
        try:
            _, body = fetch(f['url'])
            n = 0
            for it in rss_items(body):
                pub = parse_time(it['time'])
                u = it['url']
                # only the publisher's own article address, only real times (never in the future), only recent
                if not it['title'] or not u.startswith('https://') or not same_site(host(u), f.get('site') or host(f['url'])):
                    continue
                if not pub or pub > t + D.timedelta(minutes=10) or (t - pub).total_seconds() > max_age * 3600:
                    continue
                iid = hashlib.sha1(u.split('#')[0].encode()).hexdigest()[:16]
                title = it['title']
                brk = bool(BREAKING.match(title))
                title = BREAKING.sub('', title).strip() or title
                x = {'id': iid, 'title': title, 'url': u, 'source': f.get('name'), 'sourceId': f.get('id'), 'language': f.get('language') or 'en',
                     'region': region_of(title, f.get('region')), 'publishedAt': iso(pub)}
                if brk:
                    x['breaking'] = True
                if it.get('desc') and it['desc'] != title:
                    x['desc'] = it['desc']
                o = old.get(iid)
                x['firstSeenAt'] = o.get('firstSeenAt', iso(t)) if o else iso(t)
                if o and o.get('title') != title:
                    x['updatedAt'] = iso(t)
                    x['previousTitle'] = o.get('title')
                elif o and o.get('updatedAt'):
                    x['updatedAt'], x['previousTitle'] = o['updatedAt'], o.get('previousTitle')
                if iid not in seen or seen[iid]['publishedAt'] < x['publishedAt']:
                    seen[iid] = x
                n += 1
            s.update(ok=True, lastOkAt=iso(t), items=n, newest=max((x['publishedAt'] for x in seen.values() if x['sourceId'] == f.get('id')), default=None), error=None)
        except Exception as ex:
            s.update(ok=False, error=str(ex)[:200])
            for x in old.values():  # keep this feed's recent items while it is unreachable
                if x.get('sourceId') == f.get('id') and (t - parse_time(x['publishedAt'])).total_seconds() <= max_age * 3600:
                    seen.setdefault(x['id'], x)
    items = sorted(seen.values(), key=lambda x: x['publishedAt'], reverse=True)[:max_n]
    return {'updatedAt': iso(t), 'items': items}


BROWSER_UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.8', 'Cookie': 'SOCS=CAI; CONSENT=YES+1'}


def live_state(page):
    """Is the channel broadcasting right now? Read from the channel's public /live page (YouTube's own answer).
    Returns ('live', videoId, title) / ('offline', None, None) / ('unknown', None, None) when the page cannot tell."""
    s = page.decode('utf-8', 'replace') if isinstance(page, bytes) else page
    if 'ytInitialPlayerResponse' not in s and 'ytInitialData' not in s:
        return 'unknown', None, None  # consent, sign-in or error page: say nothing
    can = re.search(r'<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})"', s)
    if not can and re.search(r'"isLive"\s*:\s*true', s) and re.search(r'"text":" watching now"', s):
        # YouTube may ask a data-centre server to sign in before PLAYING (playabilityStatus LOGIN_REQUIRED) but still sends the
        # watch page data: the current video, its live viewer count ("N watching now") and "isLive": that is a live broadcast now
        i = s.find('"currentVideoEndpoint"')
        m = re.search(r'"videoId":"([A-Za-z0-9_-]{11})"', s[i:i + 800]) if i >= 0 else None
        if not m:
            return 'unknown', None, None
        t = re.search(r'"videoPrimaryInfoRenderer":\{"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"', s)
        title = ''
        if t:
            try:
                title = json.loads('"' + t.group(1) + '"')
            except Exception:
                title = ''
        if re.search(r'"playableInEmbed"\s*:\s*false', s):
            return 'noembed', m.group(1), None
        return 'live', m.group(1), clean(title, 160)
    if not can:
        # /live opens the channel page itself: no broadcast now. Anything else (consent, sign-in, a changed page): unknown
        return ('offline', None, None) if re.search(r'<link rel="canonical" href="https://www\.youtube\.com/(channel/UC|@)', s) else ('unknown', None, None)
    if re.search(r'"isLiveNow"\s*:\s*true', s) or re.search(r'"isLive"\s*:\s*true', s):
        if re.search(r'"playableInEmbed"\s*:\s*false', s):
            return 'noembed', can.group(1), None
        m = re.search(r'<meta name="title" content="([^"]*)"', s)
        return 'live', can.group(1), clean(html.unescape(m.group(1)) if m else '', 160)
    return 'offline', None, None  # an upcoming or ended broadcast is not live


def update_live_channels(cfg, status, t, prev=None, getter=None):
    """Official 24/7 news channels, played in YouTube's own embedded player. Every 5 minutes the channel's public /live
    page is read: "live" only when YouTube says the broadcast is on now and embedding is allowed (checked again with
    YouTube oEmbed); "offline" when YouTube shows no broadcast; "unknown" when the check failed (the site then shows no
    LIVE sign). Nothing is downloaded, proxied or restreamed."""
    getter = getter or (lambda u: fetch_with(u, BROWSER_UA))
    old = {c.get('channelId'): c for c in ((prev or {}).get('liveChannels') or []) if isinstance(c, dict)}
    out = []
    for ch in (cfg.get('liveChannels') or []):
        if not (ch and ch.get('enabled') is not False and CHANNEL_ID.match(str(ch.get('channelId', '')))):
            continue
        cid = ch['channelId']
        c = {'name': ch.get('name'), 'channelId': cid, 'language': ch.get('language') or 'en'}
        try:
            st, body = getter('https://www.youtube.com/channel/' + cid + '/live')
            state, vid, title = live_state(body) if st == 200 else ('unknown', None, None)
            if os.environ.get('LIVE_DEBUG'):
                txt = body.decode('utf-8', 'replace')
                print('LIVE_DEBUG', ch.get('name'), st, len(txt), state, vid, title, re.findall(r'"currentVideoEndpoint".{0,260}', txt)[:1])
            if state == 'live' and not embeddable(vid, {}):
                state = 'noembed'
        except Exception as ex:
            state, vid, title = 'unknown', None, None
            status.setdefault('live:' + cid, {})['error'] = str(ex)[:200]
        c['state'] = state
        c['checkedAt'] = iso(t)
        if state in ('live', 'noembed'):
            c['videoId'] = vid
            if title:
                c['title'] = title
            p = old.get(cid) or {}
            c['liveSince'] = p.get('liveSince') if p.get('videoId') == vid and p.get('liveSince') else iso(t)  # first seen live
        s2 = status.setdefault('live:' + cid, {})
        s2.update(name=ch.get('name') + ' (LIVE)', kind='video', checkedAt=iso(t), ok=state != 'unknown', items=1 if state == 'live' else 0)
        if state != 'unknown':
            s2['lastOkAt'] = iso(t)
            s2.pop('error', None)
        out.append(c)
    return out


def fetch_with(url, headers, timeout=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
        return r.status, r.read()


def run(out_dir):
    cfg = json.load(open('data/media-sources.json', encoding='utf-8'))
    t = now()

    def load(n):
        try:
            return json.load(open(os.path.join(out_dir, n), encoding='utf-8'))
        except Exception:
            return None
    st = (load('feeds-status.json') or {}).get('sources') or {}
    videos = update_videos(cfg, load('video-feed.json'), st, t)
    videos['liveChannels'] = update_live_channels(cfg, st, t, load('video-feed.json'))
    wire = update_wire(cfg, load('live-wire.json'), st, t)
    os.makedirs(out_dir, exist_ok=True)
    changed = []
    for name, d in (('video-feed.json', videos), ('live-wire.json', wire)):
        p = load(name)
        if not p or {**p, 'updatedAt': None} != {**d, 'updatedAt': None} or name == 'live-wire.json':
            json.dump(d, open(os.path.join(out_dir, name), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            changed.append(name)
    json.dump({'checkedAt': iso(t), 'sources': st}, open(os.path.join(out_dir, 'feeds-status.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bad = [v['name'] for v in st.values() if v.get('ok') is False]
    print(f"videos={len(videos['videos'])} wire={len(wire['items'])} live channels={len(videos['liveChannels'])} wrote={changed} failing={bad}")


def selftest():
    ok = 0

    def check(c, m):
        nonlocal ok
        if not c:
            print('FAIL', m)
            sys.exit(1)
        ok += 1
    yt = b'''<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
<entry><yt:videoId>SGa4wqWNXnE</yt:videoId><title>Madaxweyne &amp; golaha</title><link rel="alternate" href="https://www.youtube.com/watch?v=SGa4wqWNXnE"/><published>2026-11-08T14:44:53+00:00</published><media:group><media:description>Warbixin &lt;b&gt;cusub&lt;/b&gt;</media:description></media:group></entry>
<entry><yt:videoId>AAAAAAAAAAA</yt:videoId><title>short</title><link rel="alternate" href="https://www.youtube.com/shorts/AAAAAAAAAAA"/><published>2026-11-08T14:00:00+00:00</published></entry></feed>'''
    e = youtube_entries(yt)
    check(e[0]['videoId'] == 'SGa4wqWNXnE' and e[0]['title'] == 'Madaxweyne & golaha' and e[0]['description'] == 'Warbixin cusub' and not e[0]['short'], 'youtube entry')
    check(e[1]['short'], 'shorts detected')
    rss = b'''<rss><channel><item><title>BREAKING: Quake hits coast</title><link>https://www.bbc.com/news/articles/x1</link><pubDate>Sun, 08 Nov 2026 18:22:53 GMT</pubDate></item>
<item><title>Somalia: talks in Mogadishu</title><link>https://www.bbc.co.uk/news/world-africa-2</link><pubDate>Sun, 08 Nov 2026 17:00:00 GMT</pubDate></item>
<item><title>Spam</title><link>https://evil.example/x</link><pubDate>Sun, 08 Nov 2026 17:00:00 GMT</pubDate></item>
<item><title>Future</title><link>https://www.bbc.com/news/f</link><pubDate>Sun, 08 Nov 2027 17:00:00 GMT</pubDate></item></channel></rss>'''
    items = rss_items(rss)
    check(len(items) == 4 and items[0]['url'].endswith('/x1'), 'rss parse')
    rdf = b'''<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>DW story</title><link>https://www.dw.com/en/a-1</link><dc:date>2026-11-08T19:27:33Z</dc:date></item></rdf:RDF>'''
    check(rss_items(rdf)[0]['time'] == '2026-11-08T19:27:33Z', 'rdf (DW) parse')
    check(region_of('Somalia: talks', 'world') == 'somalia' and region_of('Kenya floods', 'world') == 'eastafrica' and region_of('Paris', 'africa') == 'africa', 'regions')
    check(same_site('www.bbc.co.uk', 'feeds.bbci.co.uk') and not same_site('evil.example', 'feeds.bbci.co.uk'), 'publisher domain check')
    # wire update with a fake fetch
    global fetch
    real = fetch
    t = D.datetime(2026, 11, 8, 19, 0, tzinfo=D.timezone.utc)
    fetch = lambda url, timeout=25: (200, rss)
    cfg = {'wire': {'feeds': [{'id': 'bbc', 'name': 'BBC News', 'url': 'https://feeds.bbci.co.uk/news/world/rss.xml', 'region': 'world'}]}}
    st = {}
    w = update_wire(cfg, None, st, t)
    titles = [x['title'] for x in w['items']]
    check(titles == ['Quake hits coast', 'Somalia: talks in Mogadishu'], f'only publisher links, no future items: {titles}')
    check(w['items'][0].get('breaking') and w['items'][1]['region'] == 'somalia' and w['items'][0]['publishedAt'] == '2026-11-08T18:22:53Z', 'breaking only when marked; original time kept')
    rss2 = rss.replace(b'Somalia: talks in Mogadishu', b'Somalia: talks in Mogadishu end with deal')
    fetch = lambda url, timeout=25: (200, rss2)
    w2 = update_wire(cfg, w, st, t + D.timedelta(minutes=5))
    upd = [x for x in w2['items'] if x['region'] == 'somalia'][0]
    check(upd['title'].endswith('deal') and upd['previousTitle'] == 'Somalia: talks in Mogadishu' and upd['updatedAt'] == '2026-11-08T19:05:00Z' and upd['firstSeenAt'] == '2026-11-08T19:00:00Z', 'changed headline updates the item')
    fetch = lambda url, timeout=25: (_ for _ in ()).throw(OSError('down'))
    w3 = update_wire(cfg, w2, st, t + D.timedelta(minutes=10))
    check(len(w3['items']) == 2 and st['rss:https://feeds.bbci.co.uk/news/world/rss.xml']['ok'] is False, 'feed down: earlier items kept, error reported')
    # videos: embeddable only, no shorts, no old
    calls = []

    def f2(url, timeout=25):
        calls.append(url)
        if 'oembed' in url:
            if 'SGa4wqWNXnE' in url:
                return 200, b'{}'
            raise OSError('401')
        return 200, yt
    fetch = f2
    vcfg = {'videos': {'channels': [{'name': 'BBC News Somali', 'channelId': 'UC_QuRsbRQpaC4iS8WlxW0NA', 'language': 'so', 'kind': 'somalia'}]}}
    v = update_videos(vcfg, None, st, t)
    check([x['id'] for x in v['videos']] == ['yt-SGa4wqWNXnE'] and v['videos'][0]['source'] == 'BBC News Somali' and v['videos'][0]['language'] == 'so', 'embeddable video listed, short skipped')
    calls.clear()
    update_videos(vcfg, v, st, t)
    check(not any('oembed' in c for c in calls), 'embedding not re-checked for known videos')
    # live channels: LIVE only when YouTube says the broadcast is on now; offline / unknown otherwise
    LIVE_PAGE = ('<html><link rel="canonical" href="https://www.youtube.com/watch?v=SGa4wqWNXnE"><meta name="title" content="Al Jazeera English | Live">'
                 '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"playableInEmbed":true},"videoDetails":{"isLive":true},"microformat":{"liveBroadcastDetails":{"isLiveNow":true}}};</script>')
    OFF_PAGE = '<html><link rel="canonical" href="https://www.youtube.com/channel/UCNye-wNBqNL5ZzHSJj3l8Bg"><script>var ytInitialData = {};</script>'
    UPCOMING = LIVE_PAGE.replace('"isLive":true', '"isUpcoming":true').replace('"isLiveNow":true', '"isLiveNow":false')
    check(live_state(LIVE_PAGE.encode())[:2] == ('live', 'SGa4wqWNXnE') and live_state(LIVE_PAGE)[2] == 'Al Jazeera English | Live', 'live channel detected')
    check(live_state(OFF_PAGE)[0] == 'offline' and live_state(UPCOMING)[0] == 'offline', 'no broadcast / upcoming is not live')
    check(live_state('<html>Before you continue to YouTube</html>')[0] == 'unknown', 'consent page says nothing')
    GATED = ('<link rel="canonical" href="undefined"><script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED"}};'
             'var ytInitialData = {"currentVideoEndpoint":{"clickTrackingParams":"x","commandMetadata":{"webCommandMetadata":{"url":"/watch?v=S9K1wzPJ16k"}},"watchEndpoint":{"videoId":"S9K1wzPJ16k"}},'
             '"videoPrimaryInfoRenderer":{"title":{"runs":[{"text":"Al Jazeera English | Live \\u0026 more"}]},"viewCount":{"videoViewCountRenderer":{"viewCount":{"runs":[{"text":"10,096"},{"text":" watching now"}]},"isLive":true}}}};</script>')
    check(live_state(GATED) == ('live', 'S9K1wzPJ16k', 'Al Jazeera English | Live & more'), 'live read from the watch data when playback asks to sign in')
    check(live_state(GATED.replace('"currentVideoEndpoint"', '"otherEndpoint"'))[0] == 'unknown', 'no current video: unknown')
    check(live_state(GATED.replace(' watching now', ' views'))[0] == 'unknown', 'no live viewer count: not live')
    check(live_state(LIVE_PAGE.replace('"playableInEmbed":true', '"playableInEmbed":false'))[0] == 'noembed', 'embedding off is not shown as playable')
    fetch = f2
    lc = {'liveChannels': [{'name': 'AJE', 'channelId': 'UCNye-wNBqNL5ZzHSJj3l8Bg'}, {'name': 'DW', 'channelId': 'UCknLrEdhRCp1aegoMqRaCZg'}, {'name': 'F24', 'channelId': 'UCQfwfsi5VrQ8yKZ-UWmAEFg'}]}
    pages = {'UCNye-wNBqNL5ZzHSJj3l8Bg': (200, LIVE_PAGE.encode()), 'UCknLrEdhRCp1aegoMqRaCZg': (200, OFF_PAGE.encode())}

    def g(u):
        for k, v in pages.items():
            if k in u:
                return v
        raise OSError('timeout')
    t0 = t - D.timedelta(minutes=30)
    r1 = update_live_channels(lc, {}, t0, None, g)
    r2 = update_live_channels(lc, {}, t, {'liveChannels': r1}, g)
    check([c['state'] for c in r2] == ['live', 'offline', 'unknown'] and r2[0]['videoId'] == 'SGa4wqWNXnE', 'channel states')
    check(r2[0]['liveSince'] == iso(t0) and r2[0]['checkedAt'] == iso(t) and 'videoId' not in r2[1], 'live since first seen, checked now')
    fetch = real
    print(f'LIVE FEEDS OK ({ok} checks)')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        selftest()
    else:
        run(sys.argv[1] if len(sys.argv) > 1 else 'live-data')
