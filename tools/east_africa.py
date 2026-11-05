"""East Africa news rule (owner's decision, 5 November 2026).

Wartabiye TV no longer collects Somalia news automatically. This module is the ONE gate every collected item passes
(tools/world_news.py uses it in `fetch` and again in `dedup`, so candidates added by hand or by an old run are checked
too). It is code, not a setting: switching a Somali source back on in data/world/sources.json or in /admin/ does not
bring it back, because its address is refused here.

  python3 tools/east_africa.py check "<headline>" ["<summary>"] [--url URL] [--section somalia|world|sports]
  python3 tools/east_africa.py test        -> runs the rule tests, prints OK

Rules
 1. Somalia-specific sources are refused by address (EXCLUDED_SITES: the ten former Somali sources, other Somali outlets
    and every *.so / *.gov.so address).
 2. Somalia-focused articles are refused from ANY source and ANY section (regional, World News, Sports): a headline that
    names Somalia, a Somali region or city, or the Somalia missions; or a summary that is mostly about Somalia.
 3. The regional feed ("section": "somalia" on the website, which is the homepage's East Africa feed) only takes
    stories about Kenya, Ethiopia, Tanzania, Uganda, Rwanda, Burundi, South Sudan, Djibouti or Eritrea (or IGAD / EAC /
    the region as a whole). Unrelated international stories are refused there.
 4. A World News story that is mainly about one of those nine countries moves to the regional feed with its country
    code. Sports stories stay in Sports (only rule 2 applies to them).
"""
import re, sys, urllib.parse

# ---------------------------------------------------------------- 1. sources that may never be collected again
EXCLUDED_IDS = {'bbc-somali', 'voa-somali', 'hiiraan', 'garoweonline', 'dawan', 'somaliguardian', 'goobjoog',
                'radiodalsan', 'horseedmedia', 'sonna'}
# host (and its sub-domains), or host + path prefix
EXCLUDED_SITES = [
    'bbc.com/somali', 'bbc.co.uk/somali', 'feeds.bbci.co.uk/somali',
    'voasomali.com', 'hiiraan.com', 'garoweonline.com', 'dawan.africa', 'somaliguardian.com', 'goobjoog.com',
    'radiodalsan.com', 'horseedmedia.net', 'sonna.so',
    'caasimada.net', 'mustaqbalmedia.net', 'shabellemedia.com', 'radioshabelle.com', 'puntlandpost.net',
    'somalilandsun.com', 'somalilandstandard.com', 'hornobserver.com', 'halqabsi.com', 'kaabtv.com',
    'universaltvsomali.net', 'saxafimedia.com', 'allbanaadir.org', 'raxanreeb.com', 'somaliaffairs.com',
    'somalinews.net', 'jowhar.com', 'wardheernews.com', 'hadhwanaagnews.ca', 'somalispot.com', 'qorilugud.com',
    'gobjoog.com', 'mogadishutimes.com', 'hornafricanpost.com', 'kaaha.net', 'xogdoon.com', 'muqdishonews.com',
    '.so',  # every Somali national domain: radiomuqdisho.so, sntv.so, villasomalia.gov.so, ...
]


def _host_path(url):
    p = urllib.parse.urlsplit((url or '').strip())
    host = p.netloc.lower().split('@')[-1].split(':')[0].removeprefix('www.')
    return host, (host + p.path.lower())


def excluded_url(url):
    """The rule that matched, or None."""
    if not url: return None
    host, hp = _host_path(url)
    if not host: return None
    for s in EXCLUDED_SITES:
        if s.startswith('.'):
            if host.endswith(s): return s
        elif '/' in s:
            if hp == s or hp.startswith(s + '/') or hp.startswith(s + '_'): return s
        elif host == s or host.endswith('.' + s):
            return s
    return None


def excluded_source(src):
    """A source (data/world/sources.json entry) that may not be read: by id or by any of its addresses."""
    if not src: return None
    if src.get('id') in EXCLUDED_IDS: return 'Somalia-specific source ' + src['id']
    for u in [src.get('homepage'), src.get('shareLink')] + [f.get('url') for f in src.get('feeds') or []]:
        r = excluded_url(u)
        if r: return 'Somalia-specific address ' + r
    return None


# ---------------------------------------------------------------- 2. Somalia-focused articles
_SO = (r"somalia\w*|somaliland\w*|soomaaliya\w*|soomaaliland\w*|"
       r"mogadishu|muqdisho|xamar|puntland\w*|jubaland|jubbaland|galmudug|hirshabelle|hirshabeelle|"
       r"south\s*west\s+state|koonfur\s+galbeed|banadir|benadir|kismayo|kismaayo|baidoa|baydhabo|beledweyne?|"
       r"galkayo|gaalkacyo|bosaso|boosaaso|berbera|hargeisa|hargeysa|garowe|garoowe|las\s*anod|laascaanood|"
       r"dhusamareb|dhuusamareeb|jowhar|baraawe|barawe|aussom|amisom|atmis|unsom|unsos|"
       r"villa\s+somalia|hassan\s+sheikh|xasan\s+sheekh|hamza\s+abdi\s+barre|abdirahman\s+irro|cirro")
SO_RE = re.compile(r'(?<![a-z])(?:' + _SO + r')', re.I)
# the bare word "Somali(s)" is also an ethnic group living in Ethiopia, Kenya and Djibouti: it only marks a story as
# Somalia-focused when the headline names none of the nine countries (and never in "Somali region" of Ethiopia)
WEAK_RE = re.compile(r'(?<![a-z])(?:somalis?|soomaali)\b(?!\s+(?:region(?:al)?\b|state\s+of\s+ethiopia))', re.I)

# ---------------------------------------------------------------- 3. the nine countries of the regional feed
COUNTRIES = {
    'ke': r"kenya\w*|nairobi|mombasa|kisumu|nakuru|eldoret|garissa|ruto|raila|odinga|gachagua|kindiki|kenyatta|kdf\b",
    'et': r"ethiopia\w*|addis\s+ababa|abiy|tigray\w*|amhara|oromia|oromo|afar\s+region|dire\s+dawa|tplf|fano\b|bahir\s+dar|mekelle|gerd\b",
    'tz': r"tanzania\w*|dodoma|dar\s+es\s+salaam|zanzibar\w*|arusha|samia|suluhu|chadema|ccm\b",
    'ug': r"uganda\w*|kampala|museveni|bobi\s+wine|kyagulanyi|entebbe|gulu\b|updf",
    'rw': r"rwanda\w*|kigali|kagame|rdf\b",
    'bi': r"burundi\w*|bujumbura|gitega|ndayishimiye",
    'ss': r"south\s+sudan\w*|salva\s+kiir|riek\s+machar|machar|juba(?!\s*(?:land|river|valley))\b|unmiss",
    'dj': r"djibouti\w*|guelleh|jabuuti",
    'er': r"eritrea\w*|asmara|afwerki|afewerki|isaias",
}
CRE = {k: re.compile(r'(?<![a-z])(?:' + v + r')', re.I) for k, v in COUNTRIES.items()}
REGION_RE = re.compile(r"(?<![a-z])(?:igad|east\s+african?\s+community|\beac\b|east\s+africa\w*|horn\s+of\s+africa|great\s+lakes\s+region|"
                       r"lake\s+victoria|bariga\s+afrika|geeska\s+afrika)", re.I)


def _text(item):
    return ' '.join(filter(None, [item.get('description'), item.get('excerpt')]))


def _titles(item):
    return ' '.join(filter(None, [item.get('title'), item.get('originalTitle')]))


def somalia_focused(item):
    """Why the item is about Somalia, or None."""
    t = _titles(item)
    m = SO_RE.search(t)
    if m: return f'headline names Somalia ("{m.group(0)}")'
    m = WEAK_RE.search(t)
    if m and not any(r.search(t) for r in CRE.values()): return f'headline is about Somalis ("{m.group(0)}") and names no other East African country'
    body = _text(item)
    so = len(SO_RE.findall(body)) + len(WEAK_RE.findall(body))
    other = sum(len(r.findall(body)) for r in CRE.values())
    if so >= 2 and so > other:
        return f'summary is mainly about Somalia ({so} Somalia mentions, {other} for the other countries)'
    return None


def country(item, need=1):
    """Main country code of the nine (ke et tz ug rw bi ss dj er), 'ea' for the region as a whole, or None.
    The headline decides first; the summary counts only with at least `need` mentions (World News sources use 2,
    so a world story that names Kenya once in passing stays in World News)."""
    for txt, n in ((_titles(item), 1), (_text(item), need)):
        hits = {k: len(r.findall(txt)) for k, r in CRE.items()}
        best = max(hits, key=hits.get)
        if hits[best] >= n: return best
        if len(REGION_RE.findall(txt)) >= n: return 'ea'
    return None


def gate(item, src=None):
    """(ok, reason). On ok the item gets "country" / "region" and, when it is East African, the regional section.
    src: the item's source entry from data/world/sources.json (its "section" decides what the source is for)."""
    for u in (item.get('url'), item.get('canonicalUrl')):
        r = excluded_url(u)
        if r: return False, f'Somalia-specific source ({r})'
    r = excluded_source(src) if src else None
    if r: return False, r
    why = somalia_focused(item)
    if why: return False, 'Somalia-focused article: ' + why
    sec = item.get('section') or (src or {}).get('section') or 'world'
    if sec == 'sports': return True, None
    c = country(item, 1 if sec == 'somalia' else 2)
    if sec == 'somalia':  # the regional East Africa feed
        if not c: return False, 'not about Kenya, Ethiopia, Tanzania, Uganda, Rwanda, Burundi, South Sudan, Djibouti or Eritrea'
    if c:
        item['region'] = 'east-africa'
        if c != 'ea': item['country'] = c
        item['section'] = 'somalia'
    return True, None


# ---------------------------------------------------------------- tests
TESTS = [
    # (expected ok, expected section/country or reason fragment, item)
    (False, 'Somalia-specific source', {'url': 'https://www.hiiraan.com/news4/2026/Nov/1/x.aspx', 'title': 'Kenya election date set', 'section': 'somalia'}),
    (False, 'Somalia-specific source', {'url': 'https://www.bbc.com/somali/articles/c1234', 'title': 'Uganda: doorasho', 'section': 'somalia'}),
    (False, 'Somalia-specific source', {'url': 'https://sonna.so/en/x', 'title': 'Ethiopia talks', 'section': 'somalia'}),
    (False, 'Somalia-specific source', {'url': 'https://radiomuqdisho.so/x', 'title': 'Djibouti port deal', 'section': 'world'}),
    (False, 'Somalia-focused', {'url': 'https://www.aljazeera.com/news/1', 'title': 'Al-Shabaab attack kills 5 in Mogadishu', 'section': 'world'}),
    (False, 'Somalia-focused', {'url': 'https://www.bbc.com/news/1', 'title': "Somaliland president visits Addis Ababa", 'section': 'world'}),
    (False, 'Somalia-focused', {'url': 'https://www.espn.com/1', 'title': 'Somalia national team names squad', 'section': 'sports'}),
    (False, 'Somalia-focused', {'url': 'https://x.example/1', 'title': 'Troops to stay longer', 'description': 'AUSSOM troops will remain in Somalia, the Somali government said.', 'section': 'world'}),
    (False, 'Somalia-focused', {'url': 'https://x.example/2', 'title': 'Puntland holds constitution talks', 'section': 'somalia'}),
    (True, 'ke', {'url': 'https://www.capitalfm.co.ke/news/1', 'title': 'Ruto signs housing bill into law', 'section': 'somalia'}),
    (True, 'et', {'url': 'https://addisstandard.com/x', 'title': 'Tigray interim administration names new head', 'section': 'world'}),
    (True, 'ss', {'url': 'https://www.eyeradio.org/x', 'title': 'Kiir reshuffles cabinet in Juba', 'section': 'somalia'}),
    (True, 'dj', {'url': 'https://www.lanation.dj/x', 'title': 'Djibouti : le port de Doraleh signe un accord', 'section': 'somalia'}),
    (True, 'er', {'url': 'https://shabait.com/x', 'title': 'President Isaias receives envoy', 'section': 'somalia'}),
    (True, 'ea', {'url': 'https://igad.int/x', 'title': 'IGAD ministers meet on drought response', 'section': 'world'}),
    (True, 'et', {'url': 'https://x.example/3', 'title': 'Ethiopia’s Somali region hit by floods', 'section': 'somalia'}),
    (True, 'et', {'url': 'https://addisstandard.com/y', 'title': 'Conflict continues in Ethiopia’s Moyale as Borana, Somali elders harden stance', 'section': 'world'}),
    (False, 'Somalia-focused', {'url': 'https://x.example/4', 'title': 'Somali elders call for talks', 'section': 'somalia'}),
    (False, 'Somalia-focused', {'url': 'https://x.example/5', 'title': 'Ethiopia and Somalia sign port deal', 'section': 'somalia'}),
    (True, 'world', {'url': 'https://www.dw.com/x', 'title': "Africa's shifting role in the global drug trade", 'description': 'Ports in Kenya and West Africa are transit points.', 'section': 'world'}),
    (False, 'not about', {'url': 'https://www.africanews.com/x', 'title': 'Nigeria raises fuel prices', 'section': 'somalia'}),
    (True, 'world', {'url': 'https://www.bbc.com/news/2', 'title': "Bulgaria's first woman president sworn in", 'section': 'world'}),
    (True, 'sports', {'url': 'https://www.bbc.com/sport/1', 'title': 'Arsenal beat Chelsea 2-1', 'section': 'sports'}),
    (True, 'sports', {'url': 'https://www.bbc.com/sport/2', 'title': 'Kipchoge wins Valencia marathon', 'section': 'sports'}),
]


def run_tests():
    fails = 0
    for want, exp, it in TESTS:
        it = dict(it)
        ok, why = gate(it)
        got = (it.get('country') or ('ea' if it.get('region') else it.get('section'))) if ok else why
        good = ok == want and exp in (got or '')
        fails += not good
        print(('ok  ' if good else 'FAIL'), ('keep' if ok else 'drop'), f'{got!s:<70.70}', it['title'][:60])
    print('OK' if not fails else f'{fails} failing')
    return fails


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'test': sys.exit(1 if run_tests() else 0)
    if a[0] == 'check':
        def o(n, d=None): return a[a.index(n) + 1] if n in a else d
        pos = [x for i, x in enumerate(a[1:], 1) if not x.startswith('--') and not a[i - 1].startswith('--')]
        it = {'title': pos[0] if pos else '', 'description': pos[1] if len(pos) > 1 else '', 'url': o('--url'), 'section': o('--section', 'somalia')}
        ok, why = gate(it)
        print('KEEP' if ok else 'DROP', why or f"section {it.get('section')} country {it.get('country') or it.get('region') or '-'}")
        sys.exit(0 if ok else 3)
    print(__doc__); sys.exit(2)
