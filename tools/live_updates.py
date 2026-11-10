"""LIVE News updates written inside Wartabiye TV (owner's request, 9 Nov 2026: "real content inside my website, not links").

Every 5 minutes (tools/live_feeds_cycle.sh, inside the one 5-minute source loop tools/fast_loop.sh) this reads the newest
items of the LIVE News wire (live-wire.json: the official RSS feeds of BBC, BBC Somali, Al Jazeera, DW, France 24 and UN
News, set in /admin/ -> Ilaha muuqaalka iyo wararka tooska) and turns each NEW, genuinely fresh news item into a short
ORIGINAL update in Somali (a headline and two or three sentences) with the eight site translations. The updates appear on
the LIVE News page (#wararka-tooska) as an automatically updated timeline; nothing is copied from the publisher: only the
publisher's own headline and short RSS description are given to Claude as the facts, and the update is written in Wartabiye
TV's own words, attributing the claim to the newsroom that reported it ("sida ay BBC sheegtay").

Rules that keep the timeline honest:
  - an update exists only when an approved newsroom's own feed lists the story, with the publisher's own time;
  - the time shown is the PUBLISHER's time (never the time we wrote it, never "just now" for an older story);
  - only fresh items (MAX_AGE_MIN), never a story already on the timeline: the same event reported by a second newsroom is
    added to that update as a corroborating source (no new update, no API call);
  - opinion, analysis, explainers, live blogs, galleries, videos, podcasts and quizzes are skipped without an API call;
  - Claude declines anything that is not a factual news report or that the given facts do not support; every number in the
    update must appear in the publisher's headline or description, and the reporting newsroom must be named;
  - "breaking" only when the publisher itself marked it.

Cost: the owner's own Claude API key (GitHub secret ANTHROPIC_API_KEY, billed per use by Anthropic, separate from the
owner's Claude Max plan). A hard daily limit (LIVE_UPDATES_DAILY_USD, default $1, separate from the sports writer's $1) and
at most LIVE_UPDATES_PER_RUN updates per 5-minute check. OFF by default: paid API use only after the owner switches it
on (repository variable LIVE_UPDATES_MODE=on). While off, nothing is written or paid; the check still runs and records
what it would have written (live-updates-status.json), and the LIVE News page shows Wartabiye TV's own stories.

Event-driven, not a timer: an update is written only when the newsroom feeds carry a NEW report. A later report of an
event we already cover is either merged as a corroborating source (nothing new) or, when it brings new facts (a new
number, new names), written as a follow-up in the same developing story ("story": the first update's id).

Output (OUT_DIR, published on branch live-data next to live-wire.json, no site rebuild needed):
  live-updates.json         the public timeline (last 48 hours, newest first) incl. each update's sources (the source
                            names, links and times are kept for the record and shown in /admin/, not on the public cards)
  live-updates-status.json  counts per day, spend, and why each item was written, merged, skipped or declined (/admin/)

  python3 tools/live_updates.py OUT_DIR       one check
  python3 tools/live_updates.py OUT_DIR --dry list what would be sent to Claude, no API call
  python3 tools/live_updates.py test          offline self-test
"""
import datetime as D
import hashlib
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translations import LANGS  # noqa: E402  ('en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es')

EAT = D.timezone(D.timedelta(hours=3))
# OFF unless the owner switches it on (repository variable LIVE_UPDATES_MODE=on): paid API use needs his approval
MODE = (os.environ.get('LIVE_UPDATES_MODE') or 'off').strip().lower()
MODEL = os.environ.get('LIVE_UPDATES_MODEL') or 'claude-opus-5-5'
MAX_USD_PER_DAY = float(os.environ.get('LIVE_UPDATES_DAILY_USD') or '1')
PER_RUN = int(os.environ.get('LIVE_UPDATES_PER_RUN') or '2')
MAX_AGE_MIN = int(os.environ.get('LIVE_UPDATES_MAX_AGE_MIN') or '90')
EST_CALL_USD = 0.06            # usual worst cost of one update (short input, nine short texts): a call starts only within the limit
KEEP_HOURS = 48
MAX_ITEMS = 150
# list prices per token (claude-opus-5-5 $4 / $20 per million; other models: the same estimate is a safe upper bound)
PRICE = {'claude-opus-5-5': (4e-6, 20e-6), 'claude-sonnet-5-5': (2e-6, 10e-6), 'claude-haiku-5-5': (0.1e-6, 0.5e-6)}
REGIONS = ('somalia', 'eastafrica', 'africa', 'world')
PRIO = {'somalia': 0, 'eastafrica': 1, 'africa': 2, 'world': 3}
SKIP = re.compile(r"(?i)(\blive\b[:|]|\bas it happened\b|\blive updates?\b|\bin pictures\b|\bin photos\b|\bgallery\b|\bwatch:|\bvideo:|"
                  r"\bpodcast\b|\bquiz\b|\bnewsletter\b|\bopinion\b|\banalysis\b|\bexplainer\b|\bexplained\b|\bwhat we know\b|"
                  r"\bwhat to know\b|\bq&a\b|\binterview:|\breview:|\bcrossword\b|\bhoroscope\b|/video/|/videos/|/av/|/programmes/|"
                  r"/opinions?/|/features?/|/gallery/|/podcasts?/|/live/)")
NAMES = {  # how a newsroom may be named in the Somali text (attribution check)
    'bbc': ('bbc',), 'aljazeera': ('al jazeera', 'aljazeera', 'al-jazeera', 'jaziira'), 'dw': ('dw', 'deutsche welle'),
    'france24': ('france 24', 'france24', 'faransiis 24'), 'un-news': ('un news', 'qaramada midoobay')}
STOP = set('the a an of to in on for and or at by with from as is are was were be been has have had it its this that over after '
           'into says said say new news live latest amid more than will would could their his her they he she we you not no'.split())


def now():
    return D.datetime.now(D.timezone.utc)


def iso(t):
    return t.astimezone(D.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def ptime(s):
    try:
        t = D.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
        return t if t.tzinfo else t.replace(tzinfo=D.timezone.utc)
    except Exception:
        return None


def load(path, default):
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception:
        return default


def words(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return {w for w in re.findall(r'[a-z0-9]+', s) if len(w) > 2 and w not in STOP}


def similar(a, b):
    """same event? (headline word overlap; names and places dominate short news headlines)"""
    wa, wb = words(a), words(b)
    if len(wa) < 3 or len(wb) < 3:
        return False
    inter = len(wa & wb)
    return inter >= 3 and inter / min(len(wa), len(wb)) >= 0.5


def story_text(u, items):
    sid = u.get('story') or u['id']
    return ' '.join(' '.join([v.get('so', {}).get('text', ''), v.get('en', {}).get('text', '') if isinstance(v.get('en'), dict) else '']
                             + [(s.get('title') or '') for s in v.get('sources') or []])
                    for v in items if (v.get('story') or v['id']) == sid)


def new_facts(x, same, items):
    """Does this later report of an event we already cover bring something new? New numbers (deaths, votes, sums) or at
    least three new words in the headline and description, and published at least 15 minutes after the story's latest
    update. Claude then still decides (publish false when it repeats the story)."""
    sid = same.get('story') or same['id']
    latest = max(ptime(v['publishedAt']) for v in items if (v.get('story') or v['id']) == sid)
    if (ptime(x['publishedAt']) - latest).total_seconds() < 15 * 60:
        return False
    known = story_text(same, items)
    txt = (x.get('title') or '') + ' ' + (x.get('desc') or '')
    if numbers(txt) - numbers(known):
        return True
    return len(words(txt) - words(known)) >= 3 and len(words(x.get('title') or '') - words(known)) >= 2


def numbers(s):
    return set(re.findall(r'\d+', s or ''))


def newsroom_key(source_id, name):
    k = (source_id or '').lower()
    for key in NAMES:
        if k.startswith(key.split('-')[0]):
            return key
    n = (name or '').lower()
    return next((key for key, al in NAMES.items() if any(a.strip() in n for a in al)), None)


def names_newsroom(text, sources):
    t = ' ' + (text or '').lower() + ' '
    for s in sources:
        key = newsroom_key(s.get('sourceId'), s.get('source') or s.get('name'))
        aliases = NAMES.get(key, ()) + ((s.get('source') or s.get('name') or '').lower(),)
        if any(a and a in t for a in aliases):
            return True
    return False


def cost(model, u):
    pin, pout = PRICE.get(model, PRICE['claude-opus-5-5'])
    return round(u.get('in', 0) * pin + u.get('out', 0) * pout + u.get('cacheRead', 0) * pin / 10, 5)


SYSTEM = """You write the LIVE News timeline of Wartabiye TV (wartabiyetv.com), a Somali-language news website. You receive ONE fresh news item from the official RSS feed of an established international newsroom (BBC, BBC Somali, Al Jazeera, DW, France 24, UN News): its headline, its short description and its publication time, sometimes the same event as reported by a second newsroom.

Write a short LIVE update in neutral, standard Somali, in Wartabiye TV's own words:
- "title": a clear Somali news headline (at most 110 characters), no clickbait, no quotation of the original headline word for word.
- "text": two or three short sentences (at most 420 characters) with the core facts: who, what, where, and when if given.
- Use ONLY the facts in the headline and description you are given. Add nothing: no background you remember, no numbers, names, places or causes that are not in the text, no speculation, no opinion. If a fact is a claim by someone, say who claims it.
- Name the newsroom that reported it inside the text in the Somali way, e.g. "sida ay BBC sheegtay", "Al Jazeera ayaa werisay", "DW ayaa sheegtay". Do not add links.
- Every number you use must appear in the given text (or be the day or year of the publication date), written with Western digits 0-9 in every language.
- Then translate the Somali title and text faithfully into English (en), Modern Standard Arabic (ar), French (fr), Dutch (nl), Italian (it), German (de), Turkish (tr) and Spanish (es), keeping the same facts, names and numbers.

Set "publish": false (and say why in "reason") when the item is not a factual news report (opinion, analysis, explainer, review, feature, quiz, live blog, video or audio page, advert, horoscope, sports betting), when the headline and description are too vague to state a fact, or when it repeats something already in the list of our recent LIVE updates without a new development. Then leave the texts empty.

"region": "somalia" for Somalia or Somaliland, "eastafrica" for Kenya, Ethiopia, Djibouti, Eritrea, Sudan, South Sudan, Uganda, Tanzania, Rwanda or Burundi, "africa" for the rest of Africa, otherwise "world".
Answer with the JSON object only."""

LANG_OBJ = {'type': 'object', 'additionalProperties': False, 'required': ['title', 'text'],
            'properties': {'title': {'type': 'string'}, 'text': {'type': 'string'}}}
SCHEMA = {'type': 'object', 'additionalProperties': False,
          'required': ['publish', 'reason', 'region', 'so'] + list(LANGS),
          'properties': dict({'publish': {'type': 'boolean'}, 'reason': {'type': 'string'},
                              'region': {'type': 'string', 'enum': list(REGIONS)}, 'so': LANG_OBJ},
                             **{lang: LANG_OBJ for lang in LANGS})}


def prompt_for(group, recent):
    lines = []
    sid = group[0].get('_story')
    if sid:
        so_far = sorted((u for u in recent if (u.get('story') or u['id']) == sid), key=lambda u: u['publishedAt'])
        lines.append('THIS IS A POSSIBLE NEW DEVELOPMENT OF A STORY WE ALREADY COVER. Our updates so far, oldest first:\n'
                     + '\n'.join(f"- {u['publishedAt']}: {u['so']['title']}. {u['so']['text']}" for u in so_far)
                     + '\nWrite ONLY the new development (what is new compared with these updates). If nothing is new, set publish false.')
    for i, x in enumerate(group):
        lines.append(f"{'MAIN ITEM' if i == 0 else 'SAME EVENT, ANOTHER NEWSROOM'}\nNewsroom: {x.get('source')}\nPublished (UTC): {x.get('publishedAt')}"
                     f"\nLanguage: {x.get('language') or 'en'}\nHeadline: {x.get('title')}\nDescription: {x.get('desc') or '(none)'}")
    rec = '\n'.join(f"- {u['so']['title']}" for u in recent[:25]) or '(none yet)'
    return '\n\n'.join(lines) + f"\n\nOur recent LIVE updates (do not repeat them):\n{rec}"


def call_claude(client, group, recent):
    """-> (answer dict or None, reason, usage dict)"""
    try:
        import anthropic
        BadRequest, APIError = anthropic.BadRequestError, anthropic.APIError
    except ImportError:          # offline self-test with a stand-in client
        class BadRequest(Exception): pass
        class APIError(Exception): pass
    usage = {'in': 0, 'out': 0, 'cacheRead': 0}
    req = dict(model=MODEL, max_tokens=8000, system=[{'type': 'text', 'text': SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
               messages=[{'role': 'user', 'content': prompt_for(group, recent)}])
    body = {'output_config': {'effort': 'low', 'format': {'type': 'json_schema', 'schema': SCHEMA}}}
    for _ in range(2):
        try:
            with client.messages.stream(**req, extra_body=body) as s:
                msg = s.get_final_message()
        except BadRequest as e:
            if 'format' in body['output_config'] and ('format' in str(e).lower() or 'schema' in str(e).lower()):
                body = {'output_config': {'effort': 'low'}}
                continue
            return None, f'API error: {str(e)[:160]}', usage
        except APIError as e:
            return None, f'API error: {str(e)[:160]}', usage
        u = msg.usage
        usage = {'in': u.input_tokens or 0, 'out': u.output_tokens or 0, 'cacheRead': getattr(u, 'cache_read_input_tokens', 0) or 0}
        if msg.stop_reason == 'refusal':
            return None, 'Claude declined this item', usage
        if msg.stop_reason == 'max_tokens':
            return None, 'answer too long', usage
        text = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text').strip()
        m = re.search(r'\{.*\}', text, re.S)
        try:
            return json.loads(m.group(0) if m else text), '', usage
        except Exception:
            return None, 'answer was not valid JSON', usage
    return None, 'no answer', usage


def check_answer(a, group):
    """the rules every published update must pass -> problem text or ''"""
    if not isinstance(a, dict) or a.get('publish') is not True:
        return (a or {}).get('reason') or 'declined'
    facts = ' '.join([(x.get('title') or '') + ' ' + (x.get('desc') or '') for x in group])
    allowed = numbers(facts)
    for x in group:  # the day and year of the publication date (Nairobi time) may be stated
        p = ptime(x.get('publishedAt'))
        if p:
            allowed |= {str(p.astimezone(EAT).day), str(p.astimezone(EAT).year)}
    for lang in ('so',) + tuple(LANGS):
        t = a.get(lang) or {}
        title, text = (t.get('title') or '').strip(), (t.get('text') or '').strip()
        if not (8 <= len(title) <= 160) or not (40 <= len(text) <= 700):
            return f'{lang}: title or text missing or the wrong length'
        if re.search(r'https?://|www\.', title + text):
            return f'{lang}: contains a link'
        extra = numbers(title + ' ' + text) - allowed
        if extra:
            return f'{lang}: number(s) not in the source: {", ".join(sorted(extra))}'
    if not names_newsroom(a['so']['text'] + ' ' + a['so']['title'], group):
        return 'the Somali text does not name the newsroom that reported it'
    if a.get('region') not in REGIONS:
        return 'unknown region'
    return ''


def candidates(wire, done, t):
    out = []
    for x in (wire or {}).get('items') or []:
        pub = ptime(x.get('publishedAt'))
        if not x.get('id') or not x.get('title') or not pub or x['id'] in done:
            continue
        if pub > t + D.timedelta(minutes=10):
            continue
        out.append(x)
    return out


ADMIN_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'live-admin.json')


def apply_admin(items, t, path=None):
    """The owner's own LIVE updates and corrections from /admin/ (data/live-admin.json on main, owner's request of
    10 Nov 2026: "correct, add, approve or remove live text updates"). Applied on every check, so they survive the
    5-minute rewrite of live-updates.json: "removed" ids leave the timeline, "edits" replace the given fields of an
    automatic update, and "items" are the owner's own updates (by: admin), kept for KEEP_HOURS like every update."""
    adm = load(path or ADMIN_FILE, {})
    removed = set(adm.get('removed') or [])
    edits = adm.get('edits') or {}
    out = []
    for u in items:
        if u.get('id') in removed or u.get('by') == 'admin':
            continue
        e = edits.get(u.get('id'))
        if isinstance(e, dict):
            u = dict(u, **{k: v for k, v in e.items() if k in ('so', 'region', 'breaking', 'publishedAt') or k in LANGS}, editedBy='admin')
            if e.get('breaking') is False:
                u.pop('breaking', None)
        out.append(u)
    for u in adm.get('items') or []:
        p = ptime(u.get('publishedAt'))
        if u.get('id') and u['id'] not in removed and p and -600 <= (t - p).total_seconds() <= KEEP_HOURS * 3600 and (u.get('so') or {}).get('title'):
            out.append(dict(u, by='admin'))
    out.sort(key=lambda u: u['publishedAt'], reverse=True)
    return out


def run(out_dir, dry=False, client=None, t=None):
    t = t or now()
    wire = load(os.path.join(out_dir, 'live-wire.json'), {})
    feed = load(os.path.join(out_dir, 'live-updates.json'), {'items': []})
    st = load(os.path.join(out_dir, 'live-updates-status.json'), {})
    items = [u for u in feed.get('items') or [] if ptime(u.get('publishedAt')) and (t - ptime(u['publishedAt'])).total_seconds() <= KEEP_HOURS * 3600]
    done = {k: v for k, v in (st.get('done') or {}).items() if ptime(v) and (t - ptime(v)).total_seconds() <= 72 * 3600}
    day = t.astimezone(EAT).strftime('%Y-%m-%d')
    days = st.get('days') or {}
    d = days.setdefault(day, {'written': 0, 'merged': 0, 'skipped': 0, 'declined': 0, 'failed': 0, 'calls': 0, 'usd': 0})
    log = []

    def note(x, result, reason=''):
        log.append({'at': iso(t), 'result': result, 'reason': reason, 'source': x.get('source'), 'title': x.get('title'), 'url': x.get('url')})

    def src(x):
        return {'name': x.get('source'), 'sourceId': x.get('sourceId'), 'url': x.get('url'), 'title': x.get('title'), 'publishedAt': x.get('publishedAt')}

    cand = candidates(wire, done, t)
    fresh = []
    for x in cand:
        age = (t - ptime(x['publishedAt'])).total_seconds() / 60
        if age > MAX_AGE_MIN:
            done[x['id']] = iso(t)  # first seen when already old (e.g. the very first run): never published as "live"
            d['skipped'] += 1; note(x, 'skipped', f'older than {MAX_AGE_MIN} minutes')
            continue
        if SKIP.search((x.get('title') or '') + ' ' + (x.get('url') or '')):
            done[x['id']] = iso(t); d['skipped'] += 1; note(x, 'skipped', 'not a news report (live blog, video, opinion, analysis ...)')
            continue
        same = next((u for u in items if any(similar(x['title'], s.get('title') or '') for s in u.get('sources') or [])
                     and abs((ptime(u['publishedAt']) - ptime(x['publishedAt'])).total_seconds()) <= 12 * 3600), None)
        if same and new_facts(x, same, items):
            x['_story'] = same.get('story') or same['id']  # a new development of an event we already cover
            fresh.append(x)
            continue
        if same:
            done[x['id']] = iso(t)
            if not any(s.get('url') == x.get('url') for s in same['sources']):
                same['sources'].append(src(x))
                same['corroborated'] = len({s.get('name') for s in same['sources']})
            d['merged'] += 1; note(x, 'merged', 'same event as: ' + same['so']['title'][:90])
            continue
        fresh.append(x)
    # group the remaining items that report the same event; priority: Somalia, East Africa, Africa, World; publisher's
    # breaking mark first; then the newest
    groups = []
    for x in sorted(fresh, key=lambda x: x['publishedAt']):
        g = next((g for g in groups if similar(g[0]['title'], x['title']) and g[0].get('_story') == x.get('_story')), None)
        if g:
            g.append(x)
        else:
            groups.append([x])
    def rank(g):
        best = min((PRIO.get(x.get('region'), 3) for x in g))
        newest = max(ptime(x['publishedAt']) for x in g).timestamp()
        return (best, not any(x.get('breaking') for x in g), -newest)
    groups.sort(key=rank)
    room = PER_RUN
    on = MODE == 'on' and bool(os.environ.get('ANTHROPIC_API_KEY') or client)
    for g in groups:
        if room <= 0:
            break
        if dry or not on:
            note(g[0], 'waiting', 'dry run' if dry else 'writer off (needs the owner\'s approval: LIVE_UPDATES_MODE=on, and ANTHROPIC_API_KEY with credit)')
            continue
        if d['usd'] + EST_CALL_USD > MAX_USD_PER_DAY:
            note(g[0], 'waiting', f'daily limit ${MAX_USD_PER_DAY:g} reached')
            break
        # pacing: the day's budget is spread over the day (Nairobi time), so the evening news is covered too
        loc = t.astimezone(EAT)
        pace = MAX_USD_PER_DAY * min(1.0, 1.5 * (loc.hour + loc.minute / 60 + 1) / 24)
        if d['usd'] + EST_CALL_USD > pace:
            note(g[0], 'waiting', f'budget paced: ${d["usd"]:.2f} used, ${pace:.2f} allowed by {loc:%H:%M}')
            break
        if client is None:
            import anthropic
            client = anthropic.Anthropic(max_retries=2, timeout=120)
        room -= 1
        a, why, u = call_claude(client, g, items)
        d['calls'] += 1
        d['usd'] = round(d['usd'] + cost(MODEL, u), 4)
        for x in g:
            done[x['id']] = iso(t)
        if a is None:
            d['failed'] += 1; note(g[0], 'failed', why)
            if why.startswith('API error'):
                for x in g:
                    done.pop(x['id'], None)  # try again at the next check
                break
            continue
        problem = check_answer(a, g)
        if problem:
            d['declined'] += 1; note(g[0], 'declined', problem)
            continue
        main = g[0]
        uid = 'lu-' + hashlib.sha1((main.get('url') or main['id']).encode()).hexdigest()[:12]
        entry = {'id': uid, 'publishedAt': main['publishedAt'], 'writtenAt': iso(t), 'region': a['region'],
                 'so': {'title': a['so']['title'].strip(), 'text': a['so']['text'].strip()},
                 **{lang: {'title': a[lang]['title'].strip(), 'text': a[lang]['text'].strip()} for lang in LANGS},
                 'sources': [src(x) for x in g], 'corroborated': len({x.get('source') for x in g}), 'by': 'auto-live', 'model': MODEL}
        if main.get('_story'):
            entry['story'] = main['_story']
        if any(x.get('breaking') for x in g):
            entry['breaking'] = True
        items.append(entry)
        d['written'] += 1; note(main, 'written', a['so']['title'][:100])
        print(f"wrote {uid}: {a['so']['title']}")
    items.sort(key=lambda u: u['publishedAt'], reverse=True)
    items = items[:MAX_ITEMS]
    for k in sorted(days)[:-14]:
        days.pop(k)
    st = {'about': 'LIVE News updates written by tools/live_updates.py (Claude API, owner\'s key). Counts per day (Africa/Nairobi). '
                   '"merged" = the same event from another newsroom, added to an existing update as a corroborating source.',
          'mode': 'dry' if dry else ('on' if on else 'off'), 'model': MODEL,
          'limits': {'usdPerDay': MAX_USD_PER_DAY, 'perCheck': PER_RUN, 'maxAgeMinutes': MAX_AGE_MIN},
          'lastCheckAt': iso(t), 'lastWrittenAt': max((u['writtenAt'] for u in items if u.get('writtenAt')), default=st.get('lastWrittenAt')),
          'days': days, 'done': done, 'recent': (log + (st.get('recent') or []))[:60]}
    items = apply_admin(items, t)
    if not dry:
        json.dump({'updatedAt': iso(t), 'items': items}, open(os.path.join(out_dir, 'live-updates.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(st, open(os.path.join(out_dir, 'live-updates-status.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"live updates: {len(items)} on the timeline; today written={d['written']} merged={d['merged']} skipped={d['skipped']} "
          f"declined={d['declined']} failed={d['failed']} spent=${d['usd']:.3f} of ${MAX_USD_PER_DAY:g}; mode={st['mode']}")
    for x in log:
        if x['result'] in ('waiting', 'declined', 'failed'):
            print(f"  {x['result']}: {x['source']}: {x['title'][:90]} ({x['reason']})")
    return items, st


# ---------------------------------------------------------------- offline self-test
def selftest():
    import tempfile
    global MODE, ADMIN_FILE
    MODE = 'on'
    ADMIN_FILE = '/nonexistent/live-admin.json'  # the real owner file never changes the self-test  # the self-test exercises the writer as if the owner had switched it on (no real API call is made)
    ok = [0]

    def check(c, m):
        if not c:
            raise SystemExit('LIVE UPDATES TEST FAILED: ' + m)
        ok[0] += 1
    t = D.datetime(2026, 11, 9, 12, 0, tzinfo=D.timezone.utc)
    wire = {'items': [
        {'id': 'a1', 'title': 'Kenya floods: 12 killed as heavy rains hit Nairobi', 'desc': 'At least 12 people died in Nairobi after heavy rain on Sunday, police said.',
         'url': 'https://www.bbc.co.uk/news/articles/a1', 'source': 'BBC News Africa', 'sourceId': 'bbc-africa', 'region': 'eastafrica', 'publishedAt': '2026-11-09T11:40:00Z'},
        {'id': 'a2', 'title': 'Heavy rains in Nairobi kill 12, Kenya police say', 'desc': 'Kenyan police said 12 people were killed.',
         'url': 'https://www.aljazeera.com/news/a2', 'source': 'Al Jazeera', 'sourceId': 'aljazeera', 'region': 'eastafrica', 'publishedAt': '2026-11-09T11:45:00Z'},
        {'id': 'b1', 'title': 'Opinion: why the summit failed', 'url': 'https://www.dw.com/en/opinion-b1', 'source': 'DW News', 'sourceId': 'dw', 'region': 'world', 'publishedAt': '2026-11-09T11:50:00Z'},
        {'id': 'c1', 'title': 'Old story about a ministerial meeting', 'url': 'https://www.dw.com/en/c1', 'source': 'DW News', 'sourceId': 'dw', 'region': 'world', 'publishedAt': '2026-11-09T08:00:00Z'},
        {'id': 'd1', 'title': 'Somali parliament approves 2027 budget', 'desc': 'Lawmakers in Mogadishu approved the budget on Monday.',
         'url': 'https://www.bbc.com/somali/d1', 'source': 'BBC Somali', 'sourceId': 'bbc-somali', 'region': 'somalia', 'publishedAt': '2026-11-09T11:30:00Z'}]}

    def answer(title, text, region='eastafrica', publish=True):
        a = {'publish': publish, 'reason': '' if publish else 'vague', 'region': region, 'so': {'title': title, 'text': text}}
        for lang in LANGS:
            a[lang] = {'title': title + ' ' + lang, 'text': text}
        return a

    class Msg:
        def __init__(self, a):
            self.content = [type('B', (), {'type': 'text', 'text': json.dumps(a)})()]
            self.stop_reason = 'end_turn'
            self.usage = type('U', (), {'input_tokens': 1500, 'output_tokens': 1200, 'cache_read_input_tokens': 0})()

    class Stream:
        def __init__(self, a): self.a = a
        def __enter__(self): return self
        def __exit__(self, *e): return False
        def get_final_message(self): return Msg(self.a)

    class Client:
        def __init__(self, answers): self.answers = list(answers); self.calls = []; self.messages = self
        def stream(self, **kw):
            self.calls.append(kw['messages'][0]['content'])
            return Stream(self.answers.pop(0))

    with tempfile.TemporaryDirectory() as dd:
        json.dump(wire, open(os.path.join(dd, 'live-wire.json'), 'w'))
        c = Client([answer('Baarlamaanka Soomaaliya oo ansixiyay miisaaniyadda 2027', 'Xildhibaannada Muqdisho ayaa ansixiyay miisaaniyadda 2027, sida ay BBC Somali sheegtay.', 'somalia'),
                    answer('Daadad ka dhacay Nairobi oo dilay 12 qof', 'Ugu yaraan 12 qof ayaa ku dhintay Nairobi kadib roob culus, sida ay BBC sheegtay iyadoo xiganaysa booliiska.')])
        items, st = run(dd, client=c, t=t)
        check(len(c.calls) == 2, 'two API calls (Somalia story first, the two Kenya reports as one event)')
        check('MAIN ITEM' in c.calls[0] and 'Somali parliament' in c.calls[0], 'Somalia has priority')
        check('SAME EVENT' in c.calls[1], 'the same event from two newsrooms goes in one call')
        check(len(items) == 2 and items[0]['publishedAt'] == '2026-11-09T11:40:00Z', 'newest first, the publisher time')
        k = next(u for u in items if u['region'] == 'eastafrica')
        check(k['corroborated'] == 2 and len(k['sources']) == 2 and k['sources'][0]['url'].startswith('https://'), 'sources kept for the record')
        check(st['done'].get('b1') and st['done'].get('c1'), 'opinion and old items skipped')
        check(any(x['result'] == 'skipped' and 'older' in x['reason'] for x in st['recent']), 'old item skipped with the reason')
        # a second newsroom later: merged into the update, no call
        w2 = dict(wire); w2['items'] = wire['items'] + [{'id': 'a3', 'title': 'Nairobi rains: 12 killed in Kenya floods', 'url': 'https://www.france24.com/en/a3',
                                                          'source': 'France 24', 'sourceId': 'france24', 'region': 'eastafrica', 'publishedAt': '2026-11-09T11:55:00Z'}]
        json.dump(w2, open(os.path.join(dd, 'live-wire.json'), 'w'))
        c2 = Client([])
        items, st = run(dd, client=c2, t=t + D.timedelta(minutes=5))
        k = next(u for u in items if u['region'] == 'eastafrica')
        check(not c2.calls and k['corroborated'] == 3, 'a later report of the same event is merged without a call')
        # a new development of the same event (a new number), 50 minutes later: a follow-up update in the same story
        w3 = dict(w2); w3['items'] = w2['items'] + [{'id': 'a4', 'title': 'Kenya floods: death toll in Nairobi rises to 20', 'url': 'https://www.bbc.co.uk/news/articles/a4',
                                                      'desc': 'Police say 20 people have now died in Nairobi.', 'source': 'BBC News Africa', 'sourceId': 'bbc-africa', 'region': 'eastafrica', 'publishedAt': '2026-11-09T12:30:00Z'}]
        json.dump(w3, open(os.path.join(dd, 'live-wire.json'), 'w'))
        c3 = Client([answer('Daadadka Nairobi: dhimashadu waxay gaartay 20', 'Booliiska ayaa sheegay in 20 qof ay hadda ku dhinteen Nairobi, sida ay BBC sheegtay.')])
        items, st = run(dd, client=c3, t=t + D.timedelta(minutes=55))
        f = next((u for u in items if u.get('story')), None)
        check(len(c3.calls) == 1 and 'NEW DEVELOPMENT' in c3.calls[0] and 'Daadad ka dhacay Nairobi' in c3.calls[0], 'follow-up sent with the story so far')
        check(f and f['story'] == k['id'] and f['publishedAt'] == '2026-11-09T12:30:00Z', 'follow-up joins the developing story, publisher time')
        # the same follow-up from another newsroom 5 minutes later adds nothing new: merged, no call
        w4 = dict(w3); w4['items'] = w3['items'] + [{'id': 'a5', 'title': 'Kenya floods: Nairobi death toll rises to 20, police say', 'url': 'https://www.aljazeera.com/news/a5',
                                                      'source': 'Al Jazeera', 'sourceId': 'aljazeera', 'region': 'eastafrica', 'publishedAt': '2026-11-09T12:35:00Z'}]
        json.dump(w4, open(os.path.join(dd, 'live-wire.json'), 'w'))
        c4 = Client([])
        items, st = run(dd, client=c4, t=t + D.timedelta(minutes=60))
        check(not c4.calls, 'a repeat of the latest development is merged without a call')
    # the rules
    g = [wire['items'][0]]
    check(check_answer(answer('Daadad Nairobi', 'Ugu yaraan 15 qof ayaa ku dhintay Nairobi, sida ay BBC sheegtay iyadoo xiganaysa booliiska.'), g).startswith('so: number'), 'invented number refused')
    check('newsroom' in check_answer(answer('Daadad ka dhacay Nairobi', 'Ugu yaraan 12 qof ayaa ku dhintay Nairobi kadib roob culus oo da\'ay.'), g), 'newsroom must be named')
    check(check_answer(answer('x', 'y', publish=False), g) == 'vague', 'declined item kept out')
    check(check_answer(answer('Daadad ka dhacay Nairobi oo dilay 12', 'Ugu yaraan 12 qof ayaa ku dhintay Nairobi, sida ay BBC sheegtay. https://bbc.co.uk'), g) == 'so: contains a link', 'no links')
    check(similar('Kenya floods: 12 killed as heavy rains hit Nairobi', 'Heavy rains in Nairobi kill 12, Kenya police say'), 'same event detected')
    check(not similar('Kenya floods kill 12 in Nairobi', 'Ethiopia and Eritrea leaders meet in Asmara'), 'different events kept apart')
    check(SKIP.search('Live: Israel strikes Gaza') and SKIP.search('https://www.bbc.co.uk/news/av/world-1') and not SKIP.search('Kenya floods kill 12'), 'skip rules')
    # writer off without the key: nothing written, nothing marked done
    with tempfile.TemporaryDirectory() as dd:
        json.dump(wire, open(os.path.join(dd, 'live-wire.json'), 'w'))
        os.environ.pop('ANTHROPIC_API_KEY', None)
        items, st = run(dd, t=t)
        check(not items and not st['done'].get('a1') and st['mode'] == 'off', 'off without the key, items stay open')
    # the owner's own updates and corrections from /admin/
    with tempfile.TemporaryDirectory() as dd:
        ap = os.path.join(dd, 'live-admin.json')
        json.dump({'items': [{'id': 'admin-1', 'publishedAt': '2026-11-09T11:50:00Z', 'region': 'somalia', 'so': {'title': 'Cusub', 'text': 'Qoraal.'}},
                             {'id': 'admin-old', 'publishedAt': '2026-11-01T11:50:00Z', 'so': {'title': 'Duq', 'text': 'x'}}],
                   'edits': {'a': {'so': {'title': 'Sax', 'text': 'Qoraal la saxay.'}, 'breaking': False, 'model': 'x'}}, 'removed': ['b']}, open(ap, 'w'))
        got = apply_admin([{'id': 'a', 'publishedAt': '2026-11-09T11:00:00Z', 'so': {'title': 'Khalad', 'text': 'y'}, 'breaking': True, 'model': 'm'},
                           {'id': 'b', 'publishedAt': '2026-11-09T11:10:00Z', 'so': {'title': 'Ka saar', 'text': 'z'}}], t, ap)
        check([u['id'] for u in got] == ['admin-1', 'a'], 'owner update added, removed update gone, old owner update expired')
        a = got[1]
        check(a['so']['title'] == 'Sax' and 'breaking' not in a and a['model'] == 'm' and a['editedBy'] == 'admin', 'owner correction applied to the listed fields only')
        check(apply_admin(got, t, ap) == got, 'applying twice changes nothing')
    print(f'LIVE UPDATES OK ({ok[0]} checks)')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        selftest()
    elif len(sys.argv) > 1:
        run(sys.argv[1], dry='--dry' in sys.argv)
    else:
        print(__doc__)
