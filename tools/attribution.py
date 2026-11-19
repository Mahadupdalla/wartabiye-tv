"""Editorial attribution and branding (owner's spec of 19 November 2026).

Every article on Wartabiye TV is presented as a Wartabiye TV article. When a story is built on another outlet's reporting,
that outlet is credited ONCE, accurately, in a discreet source note in the article's editorial footer
("WARTABIYE TV — Iyadoo lagu salaynayo warbixin ay baahisay Hiiraan Online."), never in the headline and not repeated in
every paragraph. Wartabiye TV is never presented as having reported, investigated or broken a story it did not.

This module is the ONE place that decides it, used by tools/build_news.py (everything public is built from its output:
the page, the prerendered articles, RSS, the app feed):

  clean(text, lang)  removes citation phrases that only name the outlet ("Sida ay werisay Hiiraan Online, …",
                     "…, according to Al Jazeera.", "Puntland Post ayaa sheegtay in …" → "Waxaa la sheegay in …"),
                     "Read more at …" lines and bare links, and returns the outlets it removed, so they are credited.
                     Names inside quotations or interviews ("u sheegay BBC", "told Reuters") are left as they are.
  credit(n, found)   the article's credit: {"type": …, "sources": [{"name", "url"?}]}.
  report()           data/attribution-report.json for /admin/ (status of every article, what still needs review).

The article files in data/news/ are never changed by this: the original text, source, link and history stay there and
in /admin/, so nothing is lost and a wrong clean-up can always be corrected by editing the article.

Attribution types (admin field "attribution"; derived when empty):
  original  Original Wartabiye TV reporting (default for the newsroom's own /admin/ stories): no source note.
  rewritten Rewritten from one external outlet: "Iyadoo lagu salaynayo warbixin ay baahisay X."
  multi     Built on several outlets: "Iyadoo lagu salaynayo warbixinno ay baahiyeen X iyo Y."
  official  Based on an official statement: "Iyadoo lagu salaynayo war rasmi ah oo ay soo saartay X."
  verified  Independently verified by the newsroom: "Xogtan waxaa xaqiijiyay tifaftirka Wartabiye TV." and, when the
            story was first reported elsewhere, "Warbixinta ugu horreysay waxaa baahisay X."
"""
import json, os, re, glob, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = 'Wartabiye TV'
TYPES = ('original', 'rewritten', 'multi', 'official', 'verified')

# canonical outlet name -> other ways the texts write it (Latin script). An article's own "source" and its
# "alsoReportedBy" names are added at run time, so a new outlet needs no change here.
OUTLETS = {
    'Hiiraan Online': [], 'Puntland Post': [], 'Garowe Online': [], 'Caasimada Online': ['Caasimada'],
    'Shabelle Media Network': ['Shabelle Media', 'Radio Shabelle'], 'Goobjoog News': ['Goobjoog'],
    'Dawan Africa': [], 'Horseed Media': ['Horseed'], 'Somali Guardian': [], 'Radio Dalsan': ['Dalsan'],
    'Radio Muqdisho': [], 'SONNA': [], 'Universal TV': [], 'Somali Cable': [], 'Halqabsi': [], 'Radio Daljir': [],
    'Somalia Today': [], 'Kaab TV': [], 'Horn Observer': [], 'Mustaqbal Media': [],
    'BBC Somali': [], 'BBC Sport': [], 'BBC News': [], 'BBC': [], 'VOA Somali': [], 'VOA': ['Voice of America'],
    'Reuters': [], 'AFP': ['Agence France-Presse', 'France-Presse'], 'Associated Press': [], 'Al Jazeera': ['Al Jazeera English'],
    'CNN': [], 'DW': ['Deutsche Welle'], 'France 24': [], 'Euronews': [], 'Africanews': [], 'UN News': [],
    'Anadolu Agency': ['Anadolu Ajansı'], 'Daily Sabah': [], 'Türkiye Today': [], 'TRT World': [],
    'Middle East Eye': [], 'TASS': [], 'Gulf News': [], 'Sweden Herald': [], 'The Moscow Times': [],
    'Capital FM Kenya': ['Capital FM'], 'Nation': ['Daily Nation', 'Nation Africa'], 'The Standard': [], 'Citizen Digital': [],
    'KBC': ['Kenya Broadcasting Corporation'], 'Kenyans.co.ke': [], 'Nile Post': [], 'Daily Monitor': [], 'Eye Radio': [],
    'Radio Tamazuj': [], 'Addis Standard': [], 'Fana Broadcasting': ['Fana'], 'Shabait': [], 'KT Press': [],
    'The Citizen': [], 'Daily News': [], 'La Nation': [],
    'The Athletic': [], 'Sky Sports': [], 'Sky Sport Italia': [], 'Sky Sport': [], 'ESPN': [], 'CBS Sports': [], 'The Guardian': ['Guardian'],
    "L'Équipe": ['L’Équipe', 'Equipe'], 'RMC Sport': ['RMC'], 'AS': [], 'Marca': [], 'Mundo Deportivo': [],
    'kicker': ['Kicker'], 'Bild': [], 'La Gazzetta dello Sport': ['Gazzetta dello Sport', 'Gazzetta'],
    'Corriere dello Sport': [], 'Tuttosport': [], 'Foot Mercato': [], 'Le Parisien': [], 'Football Italia': [],
    'Boxing News': [], 'Field Level Media': [], 'Yahoo Sports': [], 'USA TODAY': ['USA Today'], 'SBS News': [],
    'GMA News': [], 'Irish Examiner': [], 'The Local Italy': [], 'ZDFheute': [], 'dpa': [], 'CBS News': [], 'ABC News': [],
    'PBS NewsHour': [], 'Business Today': [], 'Inven Global': [], 'GosuGamers': [], 'Radio47': [], 'Sports Business Journal': [],
}
# how some outlets are written in the Arabic translations
OUTLETS_AR = {
    'Hiiraan Online': ['هيران أونلاين', 'هيران اونلاين'], 'Puntland Post': ['بونتلاند بوست'], 'Garowe Online': ['غاروي أونلاين', 'جاروي أونلاين'],
    'Caasimada Online': ['العاصمة أونلاين', 'كاسيمادا'], 'Shabelle Media Network': ['شبيلي', 'شبيلي ميديا'], 'Goobjoog News': ['غوبجوغ نيوز', 'غوبجوغ', 'جوبجوج'],
    'Dawan Africa': ['داوان أفريكا', 'داوان أفريقيا', 'داوان'], 'Horseed Media': ['هورسيد ميديا', 'هورسيد'], 'Somali Guardian': ['صومالي غارديان'],
    'BBC Sport': ['بي بي سي سبورت'], 'BBC': ['بي بي سي', 'هيئة الإذاعة البريطانية'], 'Reuters': ['رويترز'], 'AFP': ['فرانس برس', 'الفرنسية'],
    'Associated Press': ['أسوشيتد برس'], 'Al Jazeera': ['الجزيرة'], 'CNN': ['سي إن إن'], 'France 24': ['فرانس 24'], 'Euronews': ['يورونيوز'],
    'DW': ['دويتشه فيله'], 'Anadolu Agency': ['الأناضول'], 'Daily Sabah': ['ديلي صباح'], 'The Athletic': ['ذا أثلتيك', 'ذي أثلتيك'],
    'Sky Sports': ['سكاي سبورتس'], 'Sky Sport Italia': ['سكاي سبورت إيطاليا'], 'ESPN': ['إي إس بي إن'], 'CBS Sports': ['سي بي إس سبورتس'],
    'The Guardian': ['الغارديان', 'الجارديان'], "L'Équipe": ['ليكيب'], 'RMC Sport': ['آر إم سي سبورت', 'آر إم سي'], 'AS': ['آس'],
    'Mundo Deportivo': ['موندو ديبورتيفو'], 'Marca': ['ماركا'], 'kicker': ['كيكر'], 'La Gazzetta dello Sport': ['غازيتا ديلو سبورت', 'لا غازيتا ديلو سبورت'],
    'Corriere dello Sport': ['كورييري ديلو سبورت', 'كوريري ديلو سبورت'], 'Tuttosport': ['توتو سبورت', 'توتوسبورت'], 'Capital FM Kenya': ['كابيتال إف إم'],
    'Nile Post': ['نايل بوست'], 'Eye Radio': ['آي راديو'], 'Radio Tamazuj': ['راديو تمازج'], 'Daily News': ['ديلي نيوز'], 'Le Parisien': ['لو باريزيان'],
}
# not media: a statement by these is an official statement and keeps its attribution in the text
NOT_MEDIA = {'IGAD', 'UEFA', 'FIFA', 'CAF', 'FIA', 'UN', 'AU', 'Official Press', 'OpenLigaDB', 'Greenpeace Norway', 'Élysée (official)',
             'Bundesliga.com', 'Bundesliga.com (official)', 'Premier League News Now', 'Wartabiye TV'}


def canon(name):
    """'Al Jazeera (Reuters)' -> 'Al Jazeera'; 'Capital FM Kenya – Sports' -> 'Capital FM Kenya'."""
    s = re.split(r'\s+\(|\s+[–/]\s+|,\s', str(name or '').strip())[0].strip()
    for c, al in OUTLETS.items():
        if s == c or s in al:
            return c
    return s


def is_media(name):
    s = str(name or '').strip()
    return bool(s) and s not in NOT_MEDIA and canon(s) not in NOT_MEDIA and not re.search(r'\((?:official|rasmi)\)|realmadrid|FC \(', s, re.I)


_cache = {}


def _alias_map(extra=()):
    extra = [str(e).strip() for e in extra if e and str(e).strip()]
    key = tuple(sorted(set(extra)))
    if key in _cache:
        return _cache[key]
    m = {}
    for c, al in OUTLETS.items():
        for a in [c] + al:
            m[a] = c
    for e in extra:
        if is_media(e):
            c = canon(e)
            m.setdefault(c, c)
            m.setdefault(str(e).strip(), c)
    ar = {}
    for c, al in OUTLETS_AR.items():
        for a in al:
            ar[a] = c
            if a.startswith('ال'):
                ar['ل' + a[1:]] = c  # ل + الغارديان = للغارديان
    _cache[key] = (m, ar)
    return m, ar


def _alt(words):
    return '|'.join(re.escape(w) for w in sorted(words, key=len, reverse=True))


ART = r"(?:the |The |la |La |le |Le |l'|L'|el |El |il |Il |lo |die |der |het |de |De )?"
JOIN = {'so': 'iyo', 'en': 'and', 'fr': 'et', 'nl': 'en', 'it': 'e', 'de': 'und', 'tr': 've', 'es': 'y', 'ar': 'و'}

# Somali verbs of reporting: "Sida ay werisay X", "X ayaa sheegtay in"
SO_V = r'(?:werisay|wariyay|wariyeen|weriyeen|sheegtay|sheegay|sheegeen|qortay|qoray|qoreen|xustay|xusay|tebisay|tabisay|baahisay|faafisay|ku warantay|ku waramay|soo warisay|soo wariyay|soo wariyeen)'


def _rules(lang, CH):
    """(pattern, replacement) pairs; CH matches one outlet or a chain "X iyo Y"."""
    S = r'(^|(?<=[.!?…])\s+|(?<=\n))'  # start of a sentence (kept)
    if lang == 'so':
        D = r'(?:(?:wakaaladda (?:wararka )?|wargeyska |idaacadda |telefishinka |shabakadda |warbaahinta (?:dowladda )?ee |wargeys dowladeed ee )?'
        CHs = D + CH + r'(?: \((?:warbaahinta|wargeys|idaacadda|wakaaladda)[^)]{0,40}\)| oo ah warbaahinta dowladda| oo dowladdu leedahay)?)'
        CIT = r' (?:oo|iyadoo) (?:soo xigatay|soo xiganaysa|xiganaysa|xiganaya|soo xiganaya|ka soo xigatay) '
        DAY = r'(?:Isniin|Talaado|Arbaco|Khamiis|Jimce|Sabti|Axad)(?:ta|da|tii|dii)?'
        MON = r'(?:January|February|March|April|May|June|July|August|September|October|November|December|Janaayo|Febraayo|Maarso|Abriil|Maajo|Juun|Luulyo|Ogost|Sebtembar|Oktoobar|Nofembar|Desembar)'
        W2 = r'(?:sidoo kale |(?:maanta |shalay |' + DAY + r' )(?:subax |galab |habeen )?)?'
        TAIL = r'(?: ' + DAY + r',?(?: \d{1,2} ' + MON + r')?| \d{1,2} ' + MON + r'| iyo warbaahin kale(?: [^.,;]{0,30})?| oo (?:dowladda \w+ |dowladdu )leedahay)?'
        V2 = r'(?:ku |u |soo )?(?:warantay|waramay|sheegtay|sheegay|sheegeen|qortay|werisay|wariyay|wariyeen|muujisay|xustay|tebisay)'
        return [
            (r',?\s+sida (?:ay|uu) (?:werisay|sheegeen|wariyeen|sheegtay) ' + CHs + r' iyo warbaahin kale(?=[.,;]|$)', ''),
            (r'\b(iyadoo|halka|balse|laakiin|inkastoo) ' + CHs + r' (?:ay|uu) (?:sheegtay|sheegay|qortay|werisay|xustay) in', r'\1 la sheegay in'),
            (r'\b(balse|laakiin) ' + CHs + r' ayaa (?:sheegtay|sheegay|werisay|qortay) in', r'\1 waxaa la sheegay in'),
            # "Sida ay werisay Reuters oo soo xigatay saraakiil, …" -> "Iyadoo la soo xiganayo saraakiil, …"
            (S + r'[Ss]ida (?:ay|uu) ' + SO_V + r' ' + CHs + CIT, r'\1Iyadoo la soo xiganayo '),
            (r',?\s+sida (?:ay|uu) ' + SO_V + r' ' + CHs + CIT, ', iyadoo la soo xiganayo '),
            (S + r'[Ss]ida (?:ay|uu) ' + W2 + SO_V + r' ' + CHs + r',\s*', r'\1@@CAP@@'),
            (S + r'[Ss]ida (?:ay|uu) ' + CHs + r' ' + V2 + r',\s*', r'\1@@CAP@@'),
            (r',?\s+sida (?:ay|uu) ' + W2 + SO_V + r' ' + CHs + TAIL + r'(?=[.,;]|$)', ''),
            (r',?\s+sida (?:ay|uu) ' + CHs + r' ' + V2 + r'(?=[.,;]|$)', ''),
            (r'[,;]?\s+(?:oo ay (?:xigteen|xigatay)|waxaana (?:xaqiijisay|xaqiijiyay|xaqiijiyeen)|warka waxaa xaqiijiyay|oo ay sidoo kale werisay) ' + CHs + r'(?=[.;]|$)', ''),
            (r',?\s+(?:oo )?ay (?:werisay|wariyeen|soo tebisay) ' + CHs + r'(?=[.;]|$)', ''),
            (S + CHs + r' ayaa (?:sidoo kale |iyaduna |iyana |iyaguna |isna |iyadana )(?:sheegtay|sheegay|werisay|wariyay|wariyeen|qortay|xustay|ku warantay|xaqiijisay|xaqiijiyay|xaqiijiyeen) in', r'\1Waxaa sidoo kale la sheegay in'),
            (S + CHs + r' ayaa intaas ku (?:dartay|daray|dareen) in', r'\1Waxaa intaas lagu daray in'),
            (S + CHs + r' ayaa (?:sheegtay|sheegay|sheegeen|werisay|wariyay|wariyeen|qortay|qoray|ku warantay|soo warisay) in', r'\1Waxaa la sheegay in'),
            (S + CHs + r' ayaa (?:xustay|xusay|tilmaamtay|tilmaamay) in', r'\1Waxaa la xusay in'),
            (S + CHs + r' ayaa (?:xaqiijisay|xaqiijiyay|xaqiijiyeen) in', r'\1Waxaa la xaqiijiyay in'),
        ]
    if lang == 'en':
        return [
            (r',\s+' + CH + r' (?:reported|said), citing (?:the )?' + CH + r'(?=\.)', ''),
            (r',\s+the (?:state|government|state-owned|state-run) (?:newspaper|news agency|broadcaster|media) ' + CH + r' (?:reported|said)(?=\.)', ''),
            (S + r'(?:According to|As reported by|As first reported by) ' + CH + r'(?: news agency)?,\s*', r'\1@@CAP@@'),
            (r',?\s+(?:according to|as reported by|as first reported by) ' + CH + r'(?=[.;])', ''),
            (r',\s+' + CH + r' (?:also )?(?:reported|wrote|said)(?=\.)', ''),
            (S + CH + r' also (?:reported|wrote|noted) that ', r'\1It was also reported that '),
            (S + CH + r' (?:reported|wrote|noted|said) that ', r'\1It was reported that '),
            (S + CH + r' also confirmed that ', r'\1It was also confirmed that '),
            (S + CH + r' added that ', r'\1It was also reported that '),
        ]
    if lang == 'fr':
        return [
            (S + r"(?:Selon|D'après|D’après) " + CH + r',\s*', r'\1@@CAP@@'),
            (r',?\s+(?:a rapporté|ont rapporté|rapporte|selon|d\'après|d’après|a indiqué|a écrit) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' a (?:également (?:rapporté|indiqué|écrit|souligné)|ajouté) que ', r'\1Il a également été rapporté que '),
            (S + CH + r' (?:a rapporté|a indiqué|a écrit|a souligné|rapporte) que ', r'\1Il a été rapporté que '),
        ]
    if lang == 'nl':
        return [
            (S + r'(?:Volgens|Zoals gemeld door) ' + CH + r',\s*', r'\1@@CAP@@'),
            (S + r'Volgens ' + CH + r' ', r'\1Volgens berichten '),
            (r',?\s+(?:meldde|meldden|schreef|schreven|aldus|volgens) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' (?:meldde ook|voegde eraan toe|voegde daaraan toe) dat ', r'\1Er werd ook gemeld dat '),
            (S + CH + r' (?:meldde|schreef|merkte op) dat ', r'\1Er werd gemeld dat '),
        ]
    if lang == 'it':
        return [
            (S + r'(?:Secondo|Come riportato da|Come riferito da|Secondo quanto riportato da) ' + CH + r',\s*', r'\1@@CAP@@'),
            (r',?\s+(?:come riportato da|come riferito da|secondo quanto riportato da|secondo|ha riferito|hanno riferito|ha scritto|riferisce|riporta) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' ha (?:anche (?:riferito|scritto|osservato|precisato|sottolineato)|aggiunto) che ', r'\1È stato anche riferito che '),
            (S + CH + r' ha (?:riferito|scritto|osservato|precisato|sottolineato) che ', r'\1È stato riferito che '),
        ]
    if lang == 'de':
        return [
            (S + r'Wie ' + CH + r' (?:berichtete|berichteten|meldete|schrieb),\s*', r'\1@@CAP@@'),
            (S + r'(?:Laut|Nach Angaben von|Nach Angaben des|Nach Angaben der) ' + CH + r'(?=[ ,])', r'\1Laut Berichten'),
            (r',?\s+(?:berichtete|berichteten|meldete|schrieb|so) ' + CH + r'(?=[.;])', ''),
            (r',?\s+wie ' + CH + r' (?:berichtete|meldete|schrieb)(?=[.;])', ''),
            (S + CH + r' berichtete(?: zudem| außerdem| auch)?,? dass ', r'\1Es wurde berichtet, dass '),
        ]
    if lang == 'es':
        return [
            (S + r'(?:Según|Como informó|Según informó) ' + CH + r',\s*', r'\1@@CAP@@'),
            (r',?\s+(?:según|informó|informaron|según informó|según publicó|publicó) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' (?:también informó de|añadió) que ', r'\1También se informó de que '),
            (S + CH + r' (?:informó|señaló|escribió) (?:de )?que ', r'\1Se informó de que '),
        ]
    if lang == 'tr':
        AP = r"['’](?:n?[ıiuü]n)"
        return [
            (S + CH + AP + r' (?:haberine|aktardığına|bildirdiğine|yazdığına) göre,?\s*', r'\1@@CAP@@'),
            (r',?\s+' + CH + AP + r' (?:haberine|aktardığına|bildirdiğine|yazdığına) göre(?=[.;])', ''),
            (S + r'(?:Devlet yayın kuruluşu |Devlet haber ajansı )?' + CH + r"['’]y?[ae] göre,?\s*", r'\1@@CAP@@'),
            (r',\s+(?:devlet yayın kuruluşu |devlet haber ajansı )?' + CH + r' (?:bildirdi|aktardı|yazdı|duyurdu)(?=\.)', ''),
            (r'[;,]\s+haberi (?:devlet yayın kuruluşu |devlet yayıncısı )?' + CH + r' verdi(?=\.)', ''),
        ]
    if lang == 'ar':
        PRE = r'(?:موقع |صحيفة |قناة |وكالة |شبكة |إذاعة |مجلة |موقع قناة )?'
        return [
            (r'(^|(?<=[.!؟])\s+|(?<=\n))و?(?:وفقًا|وفقا|وفقاً|بحسب|حسب) ل?' + PRE + CH + r'،\s*', r'\1@@CAP@@'),
            (r'،?\s+(?:بحسب|حسب|وفقًا ل|وفقا ل|وفقاً ل|كما أفاد|حسبما أفاد|حسبما ذكر|حسبما ذكرت|بحسب ما أفاد|بحسب ما أفادت|بحسب ما ذكر|بحسب ما ذكرت|بحسب ما أورد|بحسب ما أوردت|ل)?\s?' + PRE + CH + r'(?=\.)', ''),
        ]
    return []


URL = re.compile(r'\s*\(?(?:https?://|www\.)[^\s)<>]+\)?')
PROMO = re.compile(r'^\s*(?:Read more|Read the full (?:story|article)|Visit|Source|Sources|Isha|Ilaha|Akhri (?:wax badan|warka oo dhan)|Booqo|Lire la suite|Meer lezen|Leggi di più|Weiterlesen|Devamını oku|Leer más|Fuente|Quelle|Bron|Fonte|Kaynak)\b\s*[:\-–]?.*$', re.I)


_rx = {}


_known = None


def known_outlets():
    """every outlet name the articles use ("source", "alsoReportedBy"), read once: one set of patterns for all"""
    global _known
    if _known is None:
        names = set()
        for f in glob.glob(os.path.join(root, 'data', 'news', '*.json')):
            try:
                n = json.load(open(f, encoding='utf-8'))
            except Exception:
                continue
            if n.get('by') != 'admin' and n.get('source'):
                names.add(str(n['source']))
            for a in n.get('alsoReportedBy') or []:
                if isinstance(a, dict) and (a.get('name') or a.get('source')):
                    names.add(str(a.get('name') or a.get('source')))
        _known = sorted(names)
    return _known


def _compiled(lang, extra):
    extra = sorted(set(known_outlets()) | set(str(e).strip() for e in extra if e and str(e).strip()))
    amap, armap = _alias_map(extra)
    key = (lang, tuple(extra))
    if key not in _rx:
        names = list(armap) if lang == 'ar' else list(amap)
        one = '(?:' + _alt(names) + ')'
        if lang == 'ar':
            CH = '(?:' + one + r'(?:\s?و\s?' + one + r')*)'
        else:
            j = JOIN.get(lang, 'and')
            CH = r'(?<![\w])(?:' + ART + one + r'(?:(?:,| ' + j + r') ' + ART + one + r')*)' + (r'(?![\w])' if lang == 'tr' else r'(?![\w’\'])')
        _rx[key] = (names, re.compile(one), [(re.compile(p, re.M), r) for p, r in _rules(lang, CH)], armap if lang == 'ar' else amap)
        if len(_rx) > 4000:
            _rx.clear()
    return _rx[key]


def clean(text, lang='so', extra=()):
    """-> (clean text, [canonical outlet names removed from it])"""
    if not isinstance(text, str) or not text.strip():
        return text, []
    names, one_re, rules, mp = _compiled(lang, extra)
    found = []

    def note(m):
        for x in one_re.findall(m.group(0)):
            c = mp.get(x)
            if c and c not in found:
                found.append(c)

    out = text
    for rx, rep in rules:
        def sub(m, rep=rep):
            note(m)
            return m.expand(rep)
        out = rx.sub(sub, out)
    paras = []
    for p in out.split('\n'):
        if PROMO.match(p) and (URL.search(p) or any(a in p for a in names)):
            continue  # "Read more at …", "Source: Hiiraan Online" lines; the footer credits the source
        paras.append(URL.sub('', p) if not p.startswith('## ') else p)
    out = '\n'.join(paras)
    out = re.sub(r'[ \t]{2,}', ' ', out)
    out = re.sub(r'\s+([.,;])', r'\1', out)
    out = re.sub(r'\.\.(?!\.)', '.', out)
    # a sentence whose opening citation was removed starts with a capital letter (only there: "100. maçına" stays)
    out = re.sub(r'@@CAP@@(\s*)(.)', lambda m: m.group(1) + (('İ' if m.group(2) == 'i' else m.group(2).upper()) if lang == 'tr' else m.group(2).upper()), out)
    out = out.replace('@@CAP@@', '')
    return out.strip(), found


def own_story(n):
    return n.get('by') == 'admin' and (not n.get('source') or n.get('source') == BRAND)


def credit(n, found=()):
    """{"type", "sources": [{"name", "url"?}]} for the article's editorial footer."""
    t = n.get('attribution') if n.get('attribution') in TYPES else None
    explicit = [s for s in (n.get('sources') or []) if isinstance(s, dict) and str(s.get('name') or '').strip()]
    srcs = []

    def add(name, url=None):
        name = str(name or '').strip()
        if not name or not is_media(name) and not (t == 'official' and name != BRAND) or name == BRAND:
            return
        c = canon(name) if t != 'official' else name
        for s in srcs:
            if s['name'] == c or canon(s['name']) == c:
                if url and not s.get('url'):
                    s['url'] = url
                return
        srcs.append({'name': c, **({'url': url} if url else {})})
    if explicit:
        for s in explicit:
            add(s.get('name'), str(s.get('url') or '') or None)
    elif not (t is None and own_story(n)) and t != 'original':
        add(n.get('source'), n.get('sourceUrl') or None)
        also = {canon(a.get('name') or a.get('source')): a.get('url') for a in (n.get('alsoReportedBy') or []) if isinstance(a, dict)}
        for f in found:
            add(f, also.get(f))
    if t is None:
        if own_story(n) or n.get('by') == 'admin' and not srcs:
            t = 'original'
        elif not srcs:
            t = 'original' if n.get('by') == 'admin' else 'rewritten'
        else:
            t = 'multi' if len(srcs) > 1 else 'rewritten'
    if t == 'original':
        srcs = []
    out = {'type': t, 'sources': srcs}
    if n.get('attributionRequired') is True:
        out['link'] = True  # a licence requires a visible link to the source
    return out


LANG_KEYS = ('title', 'summary', 'body', 'imageAlt')


def apply(n, langs):
    """Clean an article (a data/news.json item, in place) and set n["credit"]. The newsroom's own /admin/ stories are
    the owner's words and are not cleaned."""
    found = []
    if not own_story(n) and n.get('by') != 'admin' and n.get('rewriteStatus') != 'locked':
        extra = [n.get('source')] + [a.get('name') or a.get('source') for a in (n.get('alsoReportedBy') or []) if isinstance(a, dict)]
        extra = [e for e in extra if e]
        for k in ('title', 'summary', 'body'):
            if isinstance(n.get(k), str):
                n[k], f = clean(n[k], 'so', extra)
                found += [x for x in f if x not in found]
        for lang in langs:
            t = n.get(lang)
            if isinstance(t, dict):
                for k in ('title', 'summary', 'body'):
                    if isinstance(t.get(k), str):
                        t[k], f = clean(t[k], lang, extra)
                        found += [x for x in f if x not in found]
    n['credit'] = credit(n, found)
    return n


def mentions(text, extra=(), lang='so'):
    """outlet names still written in a text (for the report and the news task check)"""
    if not isinstance(text, str):
        return []
    amap, armap = _alias_map(extra)
    mp = armap if lang == 'ar' else amap
    one = re.compile(r'(?<![\w])(?:' + _alt(list(mp)) + r')(?![\w])')
    return sorted({mp[x] for x in one.findall(text)})


def citations_left(text, extra=()):
    """outlets still cited as the reporter in a Somali text ("sida ay … X", "X ayaa werisay"); an interview or a
    quotation ("… u sheegay BBC") and a story ABOUT an outlet are not counted"""
    found = []
    for name in mentions(text, extra):
        al = [a for a, c in _alias_map(list(extra) + known_outlets())[0].items() if c == name]
        nm = '(?:' + _alt(al) + ')'
        if re.search(r'sida (?:ay|uu)[^.,;]{0,30}' + nm + r'|' + nm + r'[^.,;]{0,25}(?:ayaa (?:sheegtay|werisay|qortay|ku warantay)|werisay|wariyeen|wariyay|soo tebiyay)', text):
            found.append(name)
    return found


def report(news=None):
    """data/attribution-report.json: every published article's attribution status (shown in /admin/)."""
    if news is None:
        news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))['news']
    rows, counts = [], {t: 0 for t in TYPES}
    for n in news:
        c = n.get('credit') or credit(n)
        counts[c['type']] = counts.get(c['type'], 0) + 1
        extra = [n.get('source')] + [a.get('name') for a in (n.get('alsoReportedBy') or []) if isinstance(a, dict)]
        left = citations_left(' '.join(str(n.get(k) or '') for k in ('title', 'summary', 'body')), extra)
        rows.append({'id': n.get('id'), 'title': n.get('title'), 'publishedAt': n.get('publishedAt'), 'type': c['type'],
                     'sources': ', '.join(s['name'] for s in c['sources']), 'sourceUrl': n.get('sourceUrl') or '',
                     'rewriteStatus': n.get('rewriteStatus') or ('original' if c['type'] == 'original' else 'rewritten'),
                     'verificationStatus': n.get('verificationStatus') or ('verified' if c['type'] == 'verified' else 'multi-source' if n.get('verification') else 'not-recorded'),
                     'namesInText': ', '.join(sorted(set(left)))})
    review = [r for r in rows if r['namesInText'] or r['type'] != 'original' and not r['sources']]
    out = {'note': 'Built by tools/attribution.py at every publication. namesInText = outlets still named in the Somali text '
                   '(usually a quotation or interview, which keeps its attribution); check them in the article.',
           'counts': counts, 'total': len(rows), 'needsReview': len(review), 'review': review[:200]}
    p = os.path.join(root, 'data', 'attribution-report.json')
    txt = json.dumps(out, ensure_ascii=False, indent=1)
    if not os.path.exists(p) or open(p, encoding='utf-8').read() != txt:
        open(p, 'w', encoding='utf-8').write(txt)
    return out


def check_new(paths):
    """News task check: an article file whose Somali title or summary names an outlet, or whose body opens with a
    citation of an outlet, is refused (exit 1) so the writer fixes it before publishing."""
    bad = []
    for p in paths:
        n = json.load(open(p, encoding='utf-8'))
        if n.get('by') == 'admin':
            continue
        extra = [n.get('source')] + [a.get('name') for a in (n.get('alsoReportedBy') or []) if isinstance(a, dict)]
        for k in ('title', 'summary'):
            m = mentions(n.get(k), extra)
            if m:
                bad.append(f'{os.path.basename(p)}: {k} names {", ".join(m)} (credit goes in the footer, not the text)')
        b = str(n.get('body') or '')
        if re.match(r'\s*[Ss]ida (?:ay|uu) ', b) and mentions(b.split('.')[0], extra):
            bad.append(f'{os.path.basename(p)}: body opens with "Sida ay … <outlet>": start with the news itself')
        if n.get('attribution') and n['attribution'] not in TYPES:
            bad.append(f'{os.path.basename(p)}: attribution must be one of {", ".join(TYPES)}')
    for b in bad:
        print(b)
    return not bad


def _test():
    so, f = clean('Sida ay werisay Hiiraan Online, Sareeye Guuto Cabdalla ayaa is casilay. Puntland Post ayaa intaas ku dartay in uu '
                  'ku biirayo mucaaradka. Xukuumadda ayaa sheegtay in ay baari doonto, sida ay qortay Garowe Online.')
    assert so == 'Sareeye Guuto Cabdalla ayaa is casilay. Waxaa intaas lagu daray in uu ku biirayo mucaaradka. Xukuumadda ayaa sheegtay in ay baari doonto.', so
    assert sorted(f) == ['Garowe Online', 'Hiiraan Online', 'Puntland Post'], f
    so, f = clean('Wasiirka ayaa BBC Somali u sheegay in ay heshiis gaareen.')
    assert so == 'Wasiirka ayaa BBC Somali u sheegay in ay heshiis gaareen.' and not f, 'an interview keeps its attribution'
    so, _ = clean('Ugu yaraan 12 qof ayaa dhintay, sida ay werisay Reuters oo soo xigatay saraakiil caafimaad. Sida uu wariyay SONNA (warbaahinta dowladda), shirku wuu dhammaaday.')
    assert so == 'Ugu yaraan 12 qof ayaa dhintay, iyadoo la soo xiganayo saraakiil caafimaad. Shirku wuu dhammaaday.', so
    en, f = clean('According to Al Jazeera, the talks resumed. The ministry said 12 people died, Reuters reported.', 'en')
    assert en == 'The talks resumed. The ministry said 12 people died.' and sorted(f) == ['Al Jazeera', 'Reuters'], en
    en, _ = clean('IGAD said the summit will go ahead, according to IGAD.', 'en')
    assert 'IGAD' in en, 'an official body is not an outlet'
    de, _ = clean('Laut BBC Sport gewann Arsenal 2:0, berichtete The Athletic.', 'de')
    assert de == 'Laut Berichten gewann Arsenal 2:0.', de
    tr_, _ = clean("Hiiraan Online'ın haberine göre konferans yarın başlıyor.", 'tr')
    assert tr_ == 'Konferans yarın başlıyor.', tr_
    ar, f = clean('ووفقًا للغارديان، أبدى ماتوس رغبته في الانضمام. وفاز الفريق 2-0، بحسب بي بي سي سبورت.', 'ar')
    assert 'الغارديان' not in ar and 'بي بي سي' not in ar and sorted(f) == ['BBC Sport', 'The Guardian'], (ar, f)
    p, _ = clean('Kooxda ayaa guuleysatay.\nRead more at https://example.com/x')
    assert p == 'Kooxda ayaa guuleysatay.', p
    c = credit({'by': 'claude', 'source': 'Hiiraan Online', 'sourceUrl': 'https://h', 'alsoReportedBy': [{'name': 'Puntland Post', 'url': 'https://p'}]}, ['Puntland Post'])
    assert c == {'type': 'multi', 'sources': [{'name': 'Hiiraan Online', 'url': 'https://h'}, {'name': 'Puntland Post', 'url': 'https://p'}]}, c
    assert credit({'by': 'admin', 'source': 'Wartabiye TV'}) == {'type': 'original', 'sources': []}
    assert credit({'by': 'claude', 'source': 'BBC Sport'})['type'] == 'rewritten'
    assert credit({'by': 'claude', 'source': 'Wasaaradda Arrimaha Dibadda', 'attribution': 'official'})['sources'][0]['name'] == 'Wasaaradda Arrimaha Dibadda'
    assert credit({'by': 'claude', 'source': 'BBC', 'attribution': 'verified'}) == {'type': 'verified', 'sources': [{'name': 'BBC'}]}
    print('attribution: all tests passed')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'test'
    if cmd == 'test':
        _test()
    elif cmd == 'report':
        r = report()
        print(json.dumps({k: r[k] for k in ('counts', 'total', 'needsReview')}, ensure_ascii=False))
    elif cmd == 'check':
        files = [a for a in sys.argv[2:] if not a.startswith('--')]
        if '--new' in sys.argv and not files:
            import subprocess
            out = subprocess.run(['git', 'status', '--porcelain', '--', 'data/news'], cwd=root, capture_output=True, text=True).stdout
            files = [os.path.join(root, l[3:].strip()) for l in out.splitlines() if l[3:].strip().endswith('.json')]
        sys.exit(0 if check_new(files) else 1)
    elif cmd == 'show':
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from translations import LANGS
        n = json.load(open(sys.argv[2], encoding='utf-8'))
        apply(n, LANGS)
        print(json.dumps({k: n.get(k) for k in ('title', 'summary', 'body', 'credit')}, ensure_ascii=False, indent=1))
        for lang in sys.argv[3:]:
            print(lang, json.dumps(n.get(lang), ensure_ascii=False, indent=1))
    else:
        sys.exit('usage: attribution.py test | report | check [--new] [files] | show <file> [langs]')
