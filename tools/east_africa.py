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
    'ke': r"kenya\w*|kiiniya\w*|nairobi|mombasa|kisumu|nakuru|eldoret|garissa|ruto|raila|odinga|gachagua|kindiki|kenyatta|kdf\b",
    'et': r"ethiopia\w*|itoobiya\w*|addis\s+ababa|abiy|tigray\w*|amhara|oromia|oromo|afar\s+region|dire\s+dawa|tplf|fano\b|mekelle|gerd\b",
    'tz': r"tanzania\w*|tansaaniya\w*|tanzaaniya\w*|dodoma|dar\s+es\s+salaam|zanzibar\w*|arusha|samia|suluhu|chadema|ccm\b",
    'ug': r"uganda\w*|ugaandha\w*|kampala|museveni|bobi\s+wine|kyagulanyi|entebbe|gulu\b|updf",
    'rw': r"rwanda\w*|ruwaanda\w*|kigali|kagame|rdf\b",
    'bi': r"burundi\w*|bujumbura|gitega|ndayishimiye",
    'ss': r"south\s+sudan\w*|koonfur(?:ta)?\s+suudaan\w*|bahr\s+el\s+ghazal|equatoria|jonglei|unity\s+state|upper\s+nile|abyei|pibor|salva\s+kiir|riek\s+machar|machar|juba(?!\s*(?:land|river|valley))\b|unmiss",
    'dj': r"djibouti\w*|guelleh|jabuuti\w*|jibuuti\w*",
    'er': r"eritrea\w*|eriteriya\w*|ereteriya\w*|asmara|afwerki|afewerki|isaias",
}
CRE = {k: re.compile(r'(?<![a-z])(?:' + v + r')', re.I) for k, v in COUNTRIES.items()}
REGION_RE = re.compile(r"(?<![a-z])(?:igad|east\s+african?\s+community|\beac\b|east\s+africa\w*|horn\s+of\s+africa|great\s+lakes\s+region|"
                       r"lake\s+victoria|bariga\s+afrika|geeska\s+afrika)", re.I)


# places outside the nine countries: a headline that names one of them (and none of the nine) is an international story
FOREIGN_RE = re.compile(r"(?<![a-z])(?:(?<!south\s)sudan(?:ese)?\b|khartoum|darfur|kordofan|nuba\s+mountains|congo\w*|drc\b|kinshasa|goma|"
    r"egypt\w*|cairo|libya\w*|tunisia\w*|algeria\w*|morocc\w*|nigeria\w*|ghana\w*|senegal\w*|mali\b|malian|niger\b|chad\w*|"
    r"cameroon\w*|ivory\s+coast|ivorian|south\s+africa\w*|zimbabwe\w*|zambia\w*|mozambique|malawi\w*|angola\w*|namibia\w*|"
    r"botswana|madagascar|israel\w*|gaza|palestin\w*|iran\w*|iraq\w*|syria\w*|lebanon|yemen\w*|saudi|qatar\w*|emirat\w*|uae\b|"
    r"turkey|t[uü]rkiye|turkish|russia\w*|ukrain\w*|kremlin|putin|zelensk\w*|china|chinese|beijing|xi\s+jinping|japan\w*|korea\w*|"
    r"india\b|indian|pakistan\w*|afghan\w*|hong\s+kong|taiwan\w*|australia\w*|europe\w*|\beu\b|britain|british|\buk\b|"
    r"london|france|french|paris|german\w*|berlin|spain|spanish|madrid|ital\w*|rome|vatican|pope|united\s+states|america\w*|"
    r"\bus\b|\bu\.s\.|washington|trump|biden|vance|white\s+house|midterm\w*|canada|mexic\w*|brazil\w*|venezuela\w*|"
    r"champions\s+league|premier\s+league|la\s?liga|serie\s+a|bundesliga|dortmund|napoli|porto|man(?:chester)?\s+city|haaland)", re.I)
NOT_NEWS_RE = re.compile(r"^\W*(?:haddas\s+ertra|eritrea\s+(?:profile|haddas|alhaditha)|from\s+the\s+archives?)\b|^\W*pix\s+of\s+the\s+day", re.I)


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


def country(item, need=1, home=None):
    """Main country code of the nine (ke et tz ug rw bi ss dj er), 'ea' for the region as a whole, or None.
    The headline decides first. need=0: headline only (World News sources: a world story that names Kenya in its
    summary stays in World News). home: a national outlet's own country, used when the headline names no other
    country (local stories rarely name their own country), never when it names a place outside the nine."""
    t = _titles(item)
    for txt, n in ((t, 1), (_text(item), need)):
        if not n: break
        hits = {k: len(r.findall(txt)) for k, r in CRE.items()}
        best = max(hits, key=hits.get)
        if hits[best] >= n: return best
        if len(REGION_RE.findall(txt)) >= n: return 'ea'
        if txt is t and home: return None if FOREIGN_RE.search(t) else home
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
    if sec == 'somalia':  # the regional East Africa feed
        if NOT_NEWS_RE.search(item.get('title') or ''): return False, 'not a news article (newspaper issue, archive or photo gallery)'
        if re.search(r'/sports?/', urllib.parse.urlsplit(item.get('url') or '').path): return False, 'sports page of a regional outlet (Sports has its own sources)'
        home = (src or {}).get('country') or item.get('homeCountry')
        c = country(item, 1, home if home in COUNTRIES else None)
        if not c: return False, 'not about Kenya, Ethiopia, Tanzania, Uganda, Rwanda, Burundi, South Sudan, Djibouti or Eritrea'
    else:
        c = country(item, 0)  # World News: only a headline about one of the nine moves the story
    if c:
        item['region'] = 'east-africa'
        if c != 'ea': item['country'] = c
        item['section'] = 'somalia'
    return True, None


# ---------------------------------------------------------------- 5. publish guard (tools/build_news.py)
ARCHIVE = 'data/world/somalia-archive.json'  # every article id that existed when the rule started: never hidden


def blocked_article(n, archive_ids):
    """Reason to keep a NEW automatic article off the public site, or None. Existing articles (archive), the owner's own
    articles ("by": "admin") and drafts are never touched; nothing is deleted, the file stays in /admin/."""
    if n.get('by') == 'admin' or n.get('id') in archive_ids: return None
    en = n.get('en') if isinstance(n.get('en'), dict) else {}
    for u in [n.get('sourceUrl')] + [a.get('url') for a in n.get('alsoReportedBy') or [] if isinstance(a, dict)][:0]:
        r = excluded_url(u)
        if r: return f'Somalia-specific source ({r})'
    for t in (n.get('originalTitle'), en.get('title'), n.get('title')):
        why = somalia_focused({'title': t, 'description': en.get('summary') if t == en.get('title') else None})
        if t and why: return 'Somalia-focused article: ' + why
    return None


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
    (True, 'ke', {'url': 'https://capitalfm.africa/eastleigh-building-collapse', 'title': 'Eastleigh building collapse death toll rises to four', 'section': 'somalia', 'homeCountry': 'ke'}),
    (True, 'ss', {'url': 'https://eyeradio.org/x', 'title': 'Western Bahr el Ghazal governor pledges support', 'section': 'somalia'}),
    (False, 'not about', {'url': 'https://nilepost.co.ug/news/1', 'title': "Israel's president begins consultations", 'section': 'somalia', 'homeCountry': 'ug'}),
    (False, 'sports page', {'url': 'https://nilepost.co.ug/sports/384502/dortmund', 'title': 'Dortmund end Betis winning run', 'section': 'somalia', 'homeCountry': 'ug'}),
    (False, 'not about', {'url': 'https://www.radiotamazuj.org/en/news/article/x', 'title': 'Sudan energy minister defends fuel supply', 'section': 'somalia'}),
    (False, 'not about', {'url': 'https://www.ktpress.rw/x', 'title': 'Kilo of salt is $30 in Minembwe as DR Congo implements blockade', 'section': 'somalia', 'homeCountry': 'rw'}),
    (False, 'not a news', {'url': 'https://shabait.com/x', 'title': 'Haddas Ertra 04 November 2026', 'section': 'somalia', 'homeCountry': 'er'}),
    (True, 'world', {'url': 'https://www.france24.com/x', 'title': 'South Africans vote in key municipal elections', 'description': 'Abiy Ahmed of Ethiopia and Ethiopia observers watch.', 'section': 'world'}),
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
