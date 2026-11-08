"""Tests for the Video News / LIVE TV / LIVE Sports rules (no network). Run: python3 tools/media_test.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from media_rules import provider, stream_authorised  # noqa: E402
from live_status import decide, changed  # noqa: E402

ok = 0
def check(cond, msg):
    global ok
    if not cond:
        print('FAIL', msg); sys.exit(1)
    ok += 1

# accepted providers only
check(provider('https://www.youtube.com/watch?v=dQw4w9WgXcQ') == ('youtube', 'dQw4w9WgXcQ'), 'youtube watch')
check(provider('https://youtu.be/dQw4w9WgXcQ')[0] == 'youtube', 'youtu.be')
check(provider('https://www.youtube.com/live/dQw4w9WgXcQ?si=x')[0] == 'youtube', 'youtube /live/')
check(provider('https://www.youtube.com/channel/UC1234567890123456789012')[0] == 'youtube-channel', 'channel')
check(provider('https://vimeo.com/123456')[0] == 'vimeo', 'vimeo')
check(provider('https://vimeo.com/event/42')[0] == 'vimeo-event', 'vimeo event')
check(provider('https://www.dailymotion.com/video/x8abc')[0] == 'dailymotion', 'dailymotion')
check(provider('https://customer-abc123.cloudflarestream.com/' + 'a' * 32 + '/iframe')[0] == 'cloudflare', 'cloudflare')
check(provider('https://cdn.example.com/live/index.m3u8')[0] == 'hls', 'hls')
check(provider('videos/report.mp4')[0] == 'file', 'own file')
check(provider('http://example.com/x.mp4')[0] is None, 'plain http refused')
check(provider('https://evil.example/watch?v=dQw4w9WgXcQ')[0] is None, 'fake youtube domain refused')
check(provider('javascript:alert(1)')[0] is None, 'javascript refused')
# sports streams need confirmed rights, a rights holder and the authorisation
base = {'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'rightsHolder': 'Somali Football Federation', 'authorization': 'Letter 2026-11-01'}
check(stream_authorised(dict(base, rightsConfirmed=True)), 'authorised stream')
check(not stream_authorised(dict(base, rightsConfirmed=False)), 'unconfirmed rights hidden')
check(not stream_authorised(dict(base, rightsConfirmed=True, rightsHolder='')), 'no rights holder hidden')
check(not stream_authorised(dict(base, rightsConfirmed=True, url='https://pirate.example/stream')), 'unknown provider hidden')
# LIVE decision: only an official-channel video that YouTube reports as live and started (not ended)
CH = 'UC1234567890123456789012'
vid = lambda i, state, ch=CH, **ls: {'id': i, 'snippet': {'channelId': ch, 'title': 't' + i, 'liveBroadcastContent': state}, 'liveStreamingDetails': ls}
d = decide({}, [vid('a' * 11, 'live', actualStartTime='2026-11-08T09:00:00Z')], CH)
check(d['live'] and d['videoId'] == 'a' * 11 and 'concurrentViewers' not in d, 'live detected, no viewer count')
check(not decide({}, [vid('b' * 11, 'live', ch='UCother000000000000000000', actualStartTime='x')], CH)['live'], 'other channel ignored')
check(not decide({}, [vid('c' * 11, 'none', actualStartTime='x', actualEndTime='y')], CH)['live'], 'ended stream not live')
up = decide({}, [vid('d' * 11, 'upcoming', scheduledStartTime='2026-11-09T17:00:00Z')], CH)
check(not up['live'] and up['upcoming'][0]['scheduledStart'] == '2026-11-09T17:00:00Z', 'upcoming listed')
check(changed({}, d) and not changed(dict(d, checkedAt='2999-01-01T00:00:00Z'), d), 'write only on change')
# LIVE Sports sources: the open-data leagues are well formed, the page loads the data sources, no key anywhere public
import json as _j, re as _re
_sp = _j.load(open('data/sports.json'))
for _l in (_sp.get('openData') or {}).get('leagues') or []:
    check(_re.fullmatch(r'[A-Za-z0-9_-]{1,20}', str(_l.get('id', ''))) and _re.fullmatch(r'\d{4}', str(_l.get('season', ''))), f"open-data league {_l}")
_ix = open('index.html').read()
check(0 < _ix.find('assets/sports-src.js') < _ix.find('assets/media.js'), 'sports-src.js loads before media.js')
_feed = 'data/sports-feed'
import os as _os
for _f in (_os.listdir(_feed) if _os.path.isdir(_feed) else []):
    _t = open(_os.path.join(_feed, _f)).read()
    check(not _re.search(r'(?i)(token|api[_-]?key|x-auth)', _t), f'no key in {_f}')
# Video News / LIVE News sources: official channels and https feeds only, unique ids, no key in the public files
_ms = _j.load(open('data/media-sources.json'))
for _c in _ms['videos']['channels'] + _ms.get('liveChannels', []):
    check(_re.fullmatch(r'UC[A-Za-z0-9_-]{22}', _c.get('channelId', '')), f"channel id {_c.get('name')}")
_ids = [f['id'] for f in _ms['wire']['feeds']]
check(len(_ids) == len(set(_ids)), 'wire feed ids are unique')
for _f in _ms['wire']['feeds']:
    check(_f['url'].startswith('https://') and _f.get('region') in ('somalia', 'eastafrica', 'africa', 'world'), f"wire feed {_f['id']}")
for _d in ('data/live-feeds',):
    for _f in (_os.listdir(_d) if _os.path.isdir(_d) else []):
        # a key would be a JSON field or a URL parameter, never a word in a headline or video title
        check(not _re.search(r'(?i)("(token|access_token|api_?key|key|secret|x-auth-token)"\s*:|[?&](key|token|api_?key)=)', open(_os.path.join(_d, _f)).read()), f'no key in {_f}')
check(not _re.search(r'(?i)(api[_-]?key|token)', open('data/media-sources.json').read()), 'no key in media-sources.json')
print(f'media tests OK ({ok} checks)')
