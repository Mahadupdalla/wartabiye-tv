"""Editorial attribution and branding.

OWNER'S RULE OF 23 NOVEMBER 2026 (replaces the source note of 19 November 2026): every article on Wartabiye TV is
published under the WARTABIYE TV identity only. No published text, footer, byline, app screen or page metadata names,
credits, links to or promotes another media outlet (newspaper, website, TV/radio channel, news agency). The line under
the title is "Warkaan waxaa daabacay Wartabiye TV" on every article, and the editorial footer shows only WARBIXINTA /
TAARIIKHDA / QAYBTA. The outlets a story was researched from stay INTERNAL: in the article file ("source", "sourceUrl",
"sources", "alsoReportedBy") and in /admin/ (data/attribution-report.json), never on the public site.

Wartabiye TV is never presented as having witnessed, investigated or verified something it did not: a claim that only a
media report makes is written neutrally ("Waxaa la sheegay in …", "Wararka la helay ayaa sheegaya …"); statements are
attributed to the people and institutions who made them (a ministry, a police force, a club are not media outlets).
When naming an outlet is genuinely necessary (a licence that requires a link, an exclusive that must be credited, a story
ABOUT an outlet) it is not removed silently: the article is held for editorial review ("published": false,
"heldBy": "attribution-review", the reason in "attributionNote") and listed in /admin/.

This module is the ONE place that decides it, used by tools/build_news.py (everything public is built from its output:
the page, the prerendered articles, RSS, the app feed), by the automatic writers (tools/news_writer.py,
tools/sports_writer.py, tools/live_updates.py) and by the scheduled news task (`check --new`):

  clean(text, lang)  removes citation phrases that name an outlet in all 9 languages ("Sida ay werisay Hiiraan Online, …",
                     "…, according to Al Jazeera.", "Puntland Post ayaa sheegtay in …" → "Waxaa la sheegay in …",
                     "…ayaa BBC Somali u sheegay in" → "…ayaa sheegay in", "told Reuters" → "said"), "Read more at …"
                     lines and every link, and returns the outlets it removed (kept internally).
  residual(n)        outlet names still left anywhere in the public text after clean() (all languages).
  gate(n)            for a NEW article file: clean it, and hold it for editorial review when a name is still left.
  credit(n)          the INTERNAL source record {"type", "sources"} for /admin/; public_credit() is what the site gets.
  report()           data/attribution-report.json for /admin/ (status of every article, what still needs review).

Attribution types (admin field "attribution"; derived when empty): original | rewritten | multi | official | verified.
Publicly only "verified" (set by the owner) adds a line, "Xogtan waxaa xaqiijiyay tifaftirka Wartabiye TV.", and
"official" names the issuing institution when it is NOT a media outlet ("… war rasmi ah oo ay soo saartay Wasaaradda X").
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
    # added 23 Nov 2026 (names found in published texts)
    'Sky Sports News': [], 'Dallas Morning News': [], '247Sports': [], 'Africa Intelligence': [], 'Minnesota Star Tribune': ['Star Tribune'],
    'Izvestia': [], 'Pro Football Rumors': [], 'Al-Riyadiya': [], 'Bloomberg': [], 'Financial Times': [], 'The New York Times': ['New York Times'],
    'The Washington Post': ['Washington Post'], 'The Wall Street Journal': ['Wall Street Journal'], 'Politico': [], 'Axios': [], 'NBC News': [],
    'NBC Sports': [], 'Fox News': [], 'Fox Sports': [], 'CNBC': [], 'Le Monde': [], 'El País': [], 'Hürriyet': [], 'Kyiv Independent': [],
    'Meduza': [], 'Interfax': [], 'RIA Novosti': [], 'Xinhua': [], 'Kyodo': [], 'Yonhap': [], 'EFE': [], 'ANSA': [], 'Infobae': [],
    'Eurosport': [], 'Arab News': [], 'Asharq Al-Awsat': [], 'The Telegraph': ['Daily Telegraph'], 'Daily Mail': [], 'The Times': [],
    'The Independent': [], 'TMZ': [], 'Cadena SER': [], 'COPE': [], 'Flashscore': [], 'Motorsport.com': [], 'Front Office Sports': [],
    'Africa Soccer': ['Africasoccer'], 'Foot Africa': [], 'Foot Afrique': [], 'Eastleigh Voice': [], 'Adom Online': [], 'Business Day': [],
    'The Athletic (NYT)': [], 'Sweden Herald': [], 'TT': [], 'IOL': [], 'Naharnet': [], 'Malay Mail': [], 'Taipei Times': [], 'News24': [],
    'Somali National News Agency': [], 'Radio Kulmiye': [], 'Mogadishu Times': [], 'Tasnim': ['Tasnim News'], 'Evrensel': [], 'KPRC2': ['KPRC 2'],
    'La Vanguardia': [], 'The National': [], 'New York Post': [], 'Houston Chronicle': [], 'Colorado Politics': [], 'Manchester Evening News': [],
    'Izvestiya': [], 'Al Arabiya': [], 'Sky News': [], 'Sky News Arabia': [], 'Al-Ain': [], 'Somali Cable TV': [],
    'SNTV': ['Somali National Television'], 'RTD': [], 'Dalsan TV': [], 'Bulinews': [], 'Eurohoops': [],
}
# how some outlets are written in the Arabic translations
OUTLETS_AR = {
    'Puntland Post': ['بونتلاند بوست'], 'Garowe Online': ['غاروي أونلاين', 'جاروي أونلاين'],
    'Caasimada Online': ['العاصمة أونلاين', 'كاسيمادا'], 'Shabelle Media Network': ['شبيلي', 'شبيلي ميديا'],
    'Dawan Africa': ['داوان أفريكا', 'داوان أفريقيا', 'داوان'], 'Horseed Media': ['هورسيد ميديا', 'هورسيد'], 'Somali Guardian': ['صومالي غارديان'],
    'BBC Sport': ['بي بي سي سبورت'], 'BBC': ['بي بي سي', 'هيئة الإذاعة البريطانية'], 'Reuters': ['رويترز'], 'AFP': ['فرانس برس', 'الفرنسية'],
    'Associated Press': ['أسوشيتد برس'], 'Al Jazeera': ['الجزيرة'], 'CNN': ['سي إن إن'], 'France 24': ['فرانس 24'], 'Euronews': ['يورونيوز'],
    'DW': ['دويتشه فيله'], 'Anadolu Agency': ['الأناضول'], 'Daily Sabah': ['ديلي صباح'], 'The Athletic': ['ذا أثلتيك', 'ذي أثلتيك'],
    'Sky Sports': ['سكاي سبورتس'], 'Sky Sport Italia': ['سكاي سبورت إيطاليا'], 'ESPN': ['إي إس بي إن'], 'CBS Sports': ['سي بي إس سبورتس'],
    'The Guardian': ['الغارديان', 'الجارديان'], "L'Équipe": ['ليكيب'], 'RMC Sport': ['آر إم سي سبورت', 'آر إم سي'], 'AS': ['آس'],
    'Mundo Deportivo': ['موندو ديبورتيفو'], 'Marca': ['ماركا'], 'kicker': ['كيكر'], 'La Gazzetta dello Sport': ['غازيتا ديلو سبورت', 'لا غازيتا ديلو سبورت'],
    'Corriere dello Sport': ['كورييري ديلو سبورت', 'كوريري ديلو سبورت'], 'Tuttosport': ['توتو سبورت', 'توتوسبورت'], 'Capital FM Kenya': ['كابيتال إف إم كينيا', 'كابيتال إف إم'],
    'Nile Post': ['نايل بوست'], 'Eye Radio': ['آي راديو'], 'Radio Tamazuj': ['راديو تمازج'], 'Daily News': ['ديلي نيوز'], 'Le Parisien': ['لو باريزيان'],
    'Goobjoog News': ['غوبجوغ نيوز', 'غوبجوغ', 'جوبجوج', 'غوب جوغ نيوز', 'غوب جوغ'], 'Hiiraan Online': ['هيران أونلاين', 'هيران اونلاين'],
    'Radio Muqdisho': ['راديو مقديشو', 'إذاعة مقديشو'], 'SONNA': ['سونا', 'وكالة الأنباء الصومالية'], 'Türkiye Today': ['تركيا اليوم'],
    'Africa Intelligence': ['أفريكا إنتليجنس'], 'Foot Mercato': ['فوت ميركاتو'], 'Pro Football Rumors': ['برو فوتبول رومرز'], 'TASS': ['تاس'],
    'Middle East Eye': ['ميدل إيست آي'], 'Sky Sport Italia': ['سكاي سبورت إيطاليا'], 'CNN': ['سي إن إن', 'سي ان ان'], 'ESPN': ['إي إس بي إن', 'اي اس بي ان'],
    'Bloomberg': ['بلومبرغ'], 'Xinhua': ['شينخوا'], 'Arab News': ['عرب نيوز'], 'The Moscow Times': ['موسكو تايمز'],
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


# clubs, leagues, governments and institutions that are recorded as a story's "source": they are NOT media outlets and a
# statement by them keeps its attribution in the text ("Liverpool FC ayaa sheegtay", "Wasaaradda ayaa sheegtay")
NOT_OUTLET = re.compile(r'\b(?:FC|CF|AFC|SC|SSC|AC|Club|United|official|rasmi|rasmiga|bayaan|Federation|Federación|Fédération|Association|'
                        r'League|Liga|LaLiga|Bundesliga|Premier League|Serie A|Ligue 1|Tour|Ministry|Wasaaradda|Dowladda|Government|GOV\.UK|'
                        r'FIFA|UEFA|CAF|CONCACAF|FIA|FAW|FFF|IGAD|FIFPRO|Formula 1|Olympic|Committee|Golaha|Madaxtooyada|Police|Booliska|'
                        r'Basketball|Mavericks|Juventus|Bayern|Dortmund|Girona|Blackpool|Glentoran|Greenpeace|Africa CDC|ATP|WTA|NBA|NFL|'
                        r'regjeringen|socceroos|OpenLigaDB|Moeve|Xisbiga|Party|MLS|NHL|MLB|PGA|WPBSA|ICC|IOC|World Athletics|World Rugby|Eng)\b', re.I)


def is_outlet(name):
    """a media outlet (newspaper, website, TV, radio, agency) and not a club, league, government or institution"""
    s = str(name or '').strip()
    if not is_media(s):
        return False
    c = canon(s)
    if c in OUTLETS:
        return True
    return not NOT_OUTLET.search(s)


# names that are also ordinary words or other things ("AS Roma", "caasimada Muqdisho", "the nation", "الجزيرة العربية"):
# never searched on their own when looking for names left in a text (they are still cleaned in a citation phrase)
AMBIG = {'AS', 'Nation', 'Caasimada', 'Dalsan', 'Horseed', 'Fana', 'Bild', 'Guardian', 'The Standard', 'The Citizen', 'Daily News',
         'Sky Sport', 'Capital FM', 'RMC', 'Equipe', 'Gazzetta', 'La Nation', 'Marca', 'kicker', 'Kicker', 'Daily Sun', 'Mirror',
         'Nation (Kenya)', 'News.GP', 'Shabait', 'Radio47', 'The National', 'The Times', 'The Independent', 'Politico', 'Axios', 'Ria',
         'الجزيرة', 'الفرنسية', 'الأناضول', 'آس', 'شبيلي', 'داوان', 'هورسيد', 'كيكر', 'ماركا', 'ديلي نيوز', 'آر إم سي'}


_cache = {}


_fast = {}


def _alias_map(extra=()):
    raw = tuple(extra)
    try:
        if raw in _fast:
            return _fast[raw]
    except TypeError:
        raw = None
    out = _alias_map_build(raw if raw is not None else extra)
    if raw is not None:
        if len(_fast) > 4000:
            _fast.clear()
        _fast[raw] = out
    return out


def _alias_map_build(extra=()):
    extra = [str(e).strip() for e in extra if e and str(e).strip()]
    key = tuple(sorted(set(extra)))
    if key in _cache:
        return _cache[key]
    m = {}
    for c, al in OUTLETS.items():
        for a in [c] + al:
            m[a] = c
    for e in extra:
        if is_outlet(e):
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
            # owner's rule of 23 Nov 2026: no outlet named anywhere, interviews included
            # "Wasiirka ayaa BBC Somali u sheegay in …" -> "Wasiirka ayaa sheegay in …"; "… u sheegay Reuters in" -> "… sheegay in"
            (r' ayaa ' + CHs + r' u (sheegay|sheegtay|sheegeen|xaqiijiyay|xaqiijisay|xaqiijiyeen|waramay|warantay)\b', r' ayaa \1'),
            (r'\bu (sheegay|sheegtay|sheegeen|xaqiijiyay|xaqiijisay|xaqiijiyeen) ' + CHs + r'(?=[ ,.;]|$)', r'\1'),
            (r'\bwareysi (uu|ay) (?:la )?(?:siiyay|siisay|siiyeen|yeeshay|yeelatay|yeesheen) ' + CHs + r'(?=[ ,.;]|$)', r'wareysi \1 bixiyay'),
            (r'\bwareysi (?:ay|uu) ' + CHs + r' la (?:yeelatay|yeeshay) ', r'wareysi la yeeshay '),
            (r'\bwareysi (?:la yeeshay|lala yeeshay|ay siisay|uu siiyay) ' + CHs + r'(?=[ ,.;]|$)', r'wareysi'),
            # "Iyadoo lagu salaynayo warbixin ay baahisay X." (the old footer wording, never in the text)
            (S + r'(?:WARTABIYE TV — )?[Ii]yadoo lagu salaynayo (?:warbixin|warbixinno|warbixino|warar) (?:ay|uu) (?:baahisay|baahiyeen|baahiyay|daabacday|daabaceen|qortay|faafisay|hore u baahiyeen) ' + CHs + r'[.,]?\s*', r'\1@@CAP@@'),
            # a whole sentence that is only the citation: "Sida ay qortay BBC Sport."
            (S + r'[Ss]ida (?:ay|uu) ' + W2 + SO_V + r' ' + CHs + TAIL + r'\.\s*', r'\1@@CAP@@'),
            # "Warbixin ay baahisay X ayaa sheegtay" -> "Warbixin la baahiyay ayaa sheegtay"
            (r'\b([Ww]arbixin(?:no|nno|ta|tii)?) (?:ay|uu) (?:baahisay|baahiyeen|daabacday|daabaceen|qortay|qoreen|faafisay|faafiyeen|soo saartay) ' + CHs + r'(?=[ ,.;]|$)', r'\1 la baahiyay'),
            # state media: "Warbaahinta dowladda ee Radio Muqdisho ayaa …" -> "Warbaahinta dowladda ayaa …"
            (r'\b([Ww]arbaahinta dowladda|[Ww]akaaladda wararka ee dowladda|[Ii]daacadda dowladda) (?:ee |oo ah )' + CH + r'(?=[ ,.;]|$)', r'\1'),
            (r'(?<= )(?:ay|uu) (?:ka |kula |la )?(?:hadashay|hadlay|hadleen) ' + CHs + r'(?=[ ,.;]|$)', r'la hadlay warbaahinta'),
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
            (r' (?:told|was quoted by|said to) ' + ART + CH + r'(?: news agency| newspaper| television| radio)?(?= that|[ ,.;]|$)', ' said'),
            (r',? in (?:an|a recent|an exclusive) interview with ' + ART + CH + r'(?=[ ,.;]|$)', ' in an interview'),
            (r'\b(?:in )?an interview (?:with|to) ' + ART + CH + r'(?=[ ,.;]|$)', 'an interview'),
            (S + r'(?:Speaking|Talking) to ' + ART + CH + r',\s*', r'\1@@CAP@@'),
            (r'\b(?:a |the )?report (?:by|from|published by|in) ' + ART + CH + r'(?=[ ,.;]|$)', 'a report'),
            (r'\b(?:first |exclusively |also )?reported by ' + ART + CH + r'(?=[ ,.;]|$)', 'reported'),
            (r'\b(?:the )?(?:state|government|state-owned|state-run) (?:broadcaster|news agency|media|radio|television|TV) ' + ART + CH + r'(?=[ ,.;]|$)', 'state media'),
        ]
    if lang == 'fr':
        return [
            (S + r"(?:Selon|D'après|D’après) " + CH + r',\s*', r'\1@@CAP@@'),
            (r',?\s+(?:a rapporté|ont rapporté|rapporte|selon|d\'après|d’après|a indiqué|a écrit) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' a (?:également (?:rapporté|indiqué|écrit|souligné)|ajouté) que ', r'\1Il a également été rapporté que '),
            (S + CH + r' (?:a rapporté|a indiqué|a écrit|a souligné|rapporte) que ', r'\1Il a été rapporté que '),
            (r'\b(a déclaré|a affirmé|a indiqué|a confié|a dit|a expliqué|a assuré|ont déclaré|ont affirmé) (?:à |au |aux |à la )' + ART + CH + r'(?=[ ,.;]|$)', r'\1'),
            (r',? (?:dans|lors d\'|lors d’)(?: un| une)? (?:entretien|interview) (?:accordée? |accordé )?(?:à |au |avec )' + ART + CH + r'(?=[ ,.;]|$)', ' dans un entretien'),
        ]
    if lang == 'nl':
        return [
            (S + r'(?:Volgens|Zoals gemeld door) ' + CH + r',\s*', r'\1@@CAP@@'),
            (S + r'Volgens ' + CH + r' ', r'\1Volgens berichten '),
            (r',?\s+(?:meldde|meldden|schreef|schreven|aldus|volgens) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' (?:meldde ook|voegde eraan toe|voegde daaraan toe) dat ', r'\1Er werd ook gemeld dat '),
            (S + CH + r' (?:meldde|schreef|merkte op) dat ', r'\1Er werd gemeld dat '),
            (r'\b(zei|zeiden|vertelde|vertelden|verklaarde|bevestigde) (?:tegen |aan )' + ART + CH + r'(?=[ ,.;]|$)', r'\1'),
            (r',? in een (?:interview|gesprek) met ' + ART + CH + r'(?=[ ,.;]|$)', ' in een interview'),
        ]
    if lang == 'it':
        return [
            (S + r'(?:Secondo|Come riportato da|Come riferito da|Secondo quanto riportato da) ' + CH + r',\s*', r'\1@@CAP@@'),
            (r',?\s+(?:come riportato da|come riferito da|secondo quanto riportato da|secondo|ha riferito|hanno riferito|ha scritto|riferisce|riporta) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' ha (?:anche (?:riferito|scritto|osservato|precisato|sottolineato)|aggiunto) che ', r'\1È stato anche riferito che '),
            (S + CH + r' ha (?:riferito|scritto|osservato|precisato|sottolineato) che ', r'\1È stato riferito che '),
            (r'\b(ha detto|ha dichiarato|ha affermato|ha confermato|ha spiegato|hanno detto|hanno dichiarato) (?:a |ad |alla |al |all\'|all’)' + ART + CH + r'(?=[ ,.;]|$)', r'\1'),
            (r',? in un\'?’?(?:intervista|intervista) (?:a |alla |al |con |rilasciata a )' + ART + CH + r'(?=[ ,.;]|$)', ' in un\'intervista'),
        ]
    if lang == 'de':
        return [
            (S + r'Wie ' + CH + r' (?:berichtete|berichteten|meldete|schrieb),\s*', r'\1@@CAP@@'),
            (S + r'(?:Laut|Nach Angaben von|Nach Angaben des|Nach Angaben der) ' + CH + r'(?=[ ,])', r'\1Laut Berichten'),
            (r',?\s+(?:berichtete|berichteten|meldete|schrieb|so) ' + CH + r'(?=[.;])', ''),
            (r',?\s+wie ' + CH + r' (?:berichtete|meldete|schrieb)(?=[.;])', ''),
            (S + CH + r' berichtete(?: zudem| außerdem| auch)?,? dass ', r'\1Es wurde berichtet, dass '),
            (r'\b(sagte|sagten|erklärte|erklärten|bestätigte|bestätigten) (?:dem |der |den |gegenüber (?:dem |der |den )?)' + CH + r'(?=[ ,.;]|$)', r'\1'),
            (r'\b(sagte|sagten|erklärte|erklärten|bestätigte|bestätigten) ' + CH + r'(?=[ ,.;]|$)', r'\1'),
            (r',? in einem (?:Interview|Gespräch) mit (?:dem |der |den )?' + CH + r'(?=[ ,.;]|$)', ' in einem Interview'),
            (r'\b(?:dem |der )?(?:Staatssender|staatlichen Sender|staatlichen Nachrichtenagentur|Nachrichtenagentur) ' + CH + r'(?=[ ,.;]|$)', 'staatlichen Medien'),
        ]
    if lang == 'es':
        return [
            (S + r'(?:Según|Como informó|Según informó) ' + CH + r',\s*', r'\1@@CAP@@'),
            (r',?\s+(?:según|informó|informaron|según informó|según publicó|publicó) ' + CH + r'(?=[.;])', ''),
            (S + CH + r' (?:también informó de|añadió) que ', r'\1También se informó de que '),
            (S + CH + r' (?:informó|señaló|escribió) (?:de )?que ', r'\1Se informó de que '),
            (r'\b(dijo|declaró|afirmó|aseguró|confirmó|explicó|dijeron|declararon) (?:a |al |a la )' + ART + CH + r'(?=[ ,.;]|$)', r'\1'),
            (r',? en (?:una )?entrevista (?:con |a |al |concedida a )' + ART + CH + r'(?=[ ,.;]|$)', ' en una entrevista'),
        ]
    if lang == 'tr':
        AP = r"['’](?:n?[ıiuü]n)"
        return [
            (S + CH + AP + r' (?:haberine|aktardığına|bildirdiğine|yazdığına) göre,?\s*', r'\1@@CAP@@'),
            (r',?\s+' + CH + AP + r' (?:haberine|aktardığına|bildirdiğine|yazdığına) göre(?=[.;])', ''),
            (S + r'(?:Devlet yayın kuruluşu |Devlet haber ajansı )?' + CH + r"['’]y?[ae] göre,?\s*", r'\1@@CAP@@'),
            (r',\s+(?:devlet yayın kuruluşu |devlet haber ajansı )?' + CH + r' (?:bildirdi|aktardı|yazdı|duyurdu)(?=\.)', ''),
            (r'[;,]\s+haberi (?:devlet yayın kuruluşu |devlet yayıncısı )?' + CH + r' verdi(?=\.)', ''),
            (r'\b' + CH + r"['’]y?[ae] (?:konuşan|açıklama yapan|demeç veren) ", ''),
            (r'\b' + CH + r"['’]y?[ae] (?:verdiği (?:demeçte|röportajda|mülakatta)|yaptığı açıklamada)", 'yaptığı açıklamada'),
            (r'\b' + CH + AP + r' (?:haberine|aktardığına|bildirdiğine|yazdığına) göre,?\s*', ''),
        ]
    if lang == 'ar':
        PRE = r'(?:موقع |صحيفة |قناة |وكالة |شبكة |إذاعة |مجلة |موقع قناة )?'
        return [
            (r'(^|(?<=[.!؟])\s+|(?<=\n))و?(?:وفقًا|وفقا|وفقاً|بحسب|حسب) ل?' + PRE + CH + r'،\s*', r'\1@@CAP@@'),
            (r'\s*(?:،\s*)?(?:نقلا |نقلاً )?عن ' + PRE + CH + r'(?=\.)', ''),
            (r'،?\s+(?:بحسب|حسب|وفقًا ل|وفقا ل|وفقاً ل|كما أفاد|حسبما أفاد|حسبما ذكر|حسبما ذكرت|بحسب ما أفاد|بحسب ما أفادت|بحسب ما ذكر|بحسب ما ذكرت|بحسب ما أورد|بحسب ما أوردت|ل)?\s?' + PRE + CH + r'(?=\.)', ''),
            (r'((?:قال|قالت|قالوا|صرح|صرحت|أكد|أكدت|أوضح|أوضحت|أفاد|أفادت|ذكر|ذكرت)(?:\s+[^\s،.]+){0,3}?)\s+(?:ل(?:(?:موقع|صحيفة|قناة|وكالة|شبكة|إذاعة|مجلة) )?|(?=لل))' + CH + r'(?=[\s،.]|$)', r'\1'),
            (r'(?:،\s*)?في (تصريح|تصريحات|مقابلة|حديث) (?:مع |ل|إلى )?' + PRE + CH + r'(?=[\s،.]|$)', r' في \1'),
            (r'(?:،\s*)?(?:الذي|التي) (?:نشرت?ه?ا?|أوردت?ه?ا?|بثت?ه?ا?) ' + PRE + CH + r'(?=[\s،.]|$)', ''),
        ]
    return []


URL = re.compile(r'\s*\(?(?:https?://|www\.)[^\s)<>]+\)?')
PROMO = re.compile(r'^\s*(?:Read more|Read the full (?:story|article)|Visit|Source|Sources|Isha|Ilaha|Akhri (?:wax badan|warka oo dhan)|Booqo|Lire la suite|Meer lezen|Leggi di più|Weiterlesen|Devamını oku|Leer más|Fuente|Quelle|Bron|Fonte|Kaynak)\b\s*[:\-–]?.*$', re.I)


# "… Akhri wax badan: https://…" / "Read more at www.…" inside a paragraph: the words and the link go
PROMO_INLINE = re.compile(r'[ \t]*(?:Read more(?: at| on| here)?|Read the full (?:story|article)(?: at| on)?|Visit|Source|Isha|Akhri (?:wax badan|warka oo dhan)|Booqo|'
                          r'Lire la suite|Meer lezen|Leggi di più|Weiterlesen|Devamını oku|Leer más|اقرأ المزيد|المصدر)\s*[:\-–]?\s*\(?(?:https?://|www\.)[^\s)<>]+\)?\.?', re.I)
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
    kn = known_outlets()
    extra = kn + sorted(set(str(e).strip() for e in extra if e and str(e).strip()) - set(kn))
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


# ---------- the last step of clean(): every outlet name the rules did not remove becomes a neutral generic word ----------
# "The Athletic ayaa xaqiijisay" -> "Warbaahinta ayaa xaqiijisay", "as France 24 and Türkiye Today reported" -> "as the press
# reported", "laut Al Jazeera" -> "laut der Presse". The claim stays attributed to media reporting (never to Wartabiye TV),
# no fact changes, and no outlet is named. Not used on a story ABOUT an outlet (its name in the headline): that one is
# held or listed for an editor instead.
GENERIC = {'so': 'warbaahinta', 'en': 'the press', 'fr': 'la presse', 'nl': 'de pers', 'it': 'la stampa', 'de': 'die Presse',
           'es': 'la prensa', 'tr': 'basın', 'ar': 'وسائل الإعلام'}
_gen = {}


def _generic_rx(lang, extra):
    key = (lang, tuple(sorted(set(extra))))
    if key in _gen:
        return _gen[key]
    amap, armap = _alias_map(extra)
    mp = dict(amap)
    if lang == 'ar':
        mp.update(armap)
    allnames = [a for a in mp if len(a) > 1]
    strict = [a for a in allnames if a not in AMBIG and len(a) > 2]
    NA, N = '(?:' + _alt(allnames) + ')', '(?:' + _alt(strict) + ')'
    if lang == 'ar':
        AR_D = r'(?:(?:وكالة|وكالتا|وكالتي|صحيفة|صحيفتا|صحيفتي|صحف|موقع|موقعا|موقعي|مواقع|شبكة|شبكتي|قناة|قناتا|قناتي|إذاعة|مجلة|تلفزيون|هيئة)(?: الأنباء)?(?: [^\s،.]{2,12}ية)? )'
        one = r'(?:' + AR_D + r'?ل?' + NA + r')'
        chain = one + r'(?:\s*(?:،|و)\s*' + one + r')*'
        rx = r'(?<![\w])(?P<p>و?[لب]?)' + r'(?:' + AR_D + r'(?P<l1>ل)?' + NA + r'|(?P<l0>ل)?' + N + r')(?:\s*(?:،\s*|\s+و\s*|\s*و)' + one + r')*' \
             + r'(?:\s*،?\s*(?:نقلا|نقلاً) عن ' + chain + r')?(?:\s*\([^)]{0,40}\))?(?![\w])'
        _gen[key] = re.compile(rx)
        return _gen[key]
    W = r'[\w’\'-]'
    J = {'so': 'iyo', 'en': 'and', 'fr': 'et', 'nl': 'en', 'it': 'e', 'de': 'und', 'tr': 've', 'es': 'y'}[lang]
    if lang == 'so':
        D = r'(?:(?:[Ww]argeysyada|[Ww]argeyska|[Ww]argeys|[Ww]akaaladda(?: wararka)?|[Ww]akaaladaha|[Ii]daacadda|[Tt]elefishinka|[Tt]elefishanka|[Bb]ogga|[Ss]habakadda|[Kk]anaalka|[Ww]arbaahinta|[Mm]areegta|[Ww]ebsite-ka)(?: (?:isboortiga|wararka|caalamiga|dowladda|internetka|[A-Z][\w’\'-]+))?(?: ee [A-Z][\w’\'-]+)?(?: ee)? )'
        pre, art = '', ''
        post = r'(?: ee [A-Z][\w’\'-]+)?(?: \([^)]{0,60}\))?'
        cite = r'(?:,? oo (?:soo |ka soo )?xigan(?:aysa|aya|ayay|atay|tay)|,? oo soo xigatay|,? iyadoo (?:la )?soo xiganay(?:o|sa))'
        suf = r'(?P<suf>-?na)?'
    else:
        if lang == 'en':
            D = r'(?:(?:the |a |an )?(?:(?:[A-Z][a-z]+|state|state-owned|state-run|sports|local|regional|news|online) ){0,2}(?:newspapers?|dailies|daily|outlets?|broadcasters?|news agenc(?:y|ies)|agenc(?:y|ies)|websites?|sites?|networks?|channels?|magazines?|radio|television|stations?|publications?|portals?) )'
            pre, art = r'(?P<prep>)', r'(?:the |The )?'
            cite = r'(?:,? (?:citing|quoting|via|according to)|,? which cited)'
        elif lang == 'fr':
            D = r'(?:(?:le |la |les |l\'|l’)?(?:quotidien|quotidiens|journal|journaux|site|sites|chaîne|chaînes|agence(?: de presse)?|radio|télévision|média|médias|magazine|hebdomadaire|diffuseur)(?: (?:sportif|sportive|espagnol|italien|italienne|français|française|britannique|américain|américaine|allemand|turc|qatari|qatarie|public|publique|d\'État|d’État|kényan|somalien|en ligne))? )'
            pre = r'(?P<prep>\b(?:de|du|des|à|au|aux|par|selon|d\'après|d’après|pour)\s+)?'
            art = r'(?:le |la |les |l\'|l’|Le |La |Les |L\'|L’)?'
            cite = r'(?:,? citant|,? qui cite)'
        elif lang == 'it':
            D = r'(?:(?:il |lo |la |l\'|l’|i |gli |le )?(?:quotidiano|quotidiani|giornale|giornali|sito|emittente|agenzia(?: di stampa)?|rete|canale|radio|televisione|testata|rivista)(?: (?:sportivo|sportiva|spagnolo|francese|inglese|italiano|britannico|americano|tedesco|statunitense|pubblica|di Stato|online))? )'
            pre = r'(?P<prep>\b(?:a|ad|al|alla|allo|ai|alle|all\'|all’|da|dal|dalla|dallo|dai|dall\'|dall’|di|del|della|dello|dei|dell\'|dell’|secondo|su|sul|sulla|per|con)\s*)?'
            art = r'(?:il |lo |la |l\'|l’|i |gli |le |Il |Lo |La |L\'|L’)?'
            cite = r'(?:,? citando|,? che cita)'
        elif lang == 'es':
            D = r'(?:(?:el |la |los |las )?(?:diario|diarios|periódico|periódicos|sitio|cadena|agencia(?: de noticias)?|emisora|radio|televisión|medio|medios|revista|portal)(?: (?:deportivo|deportiva|español|española|francés|francesa|italiano|italiana|británico|británica|estadounidense|alemán|turco|público|pública|estatal|digital))? )'
            pre = r'(?P<prep>\b(?:a|al|de|del|según|por|en|con|para)\s+)?'
            art = r'(?:el |la |los |las |El |La |Los |Las )?'
            cite = r'(?:,? citando a|,? citando|,? que cita a)'
        elif lang == 'de':
            D = r'(?:(?:der |die |das |dem |den |des )?(?:(?:britischen?|französischen?|spanischen?|italienischen?|amerikanischen?|US-|türkischen?|staatlichen?|katarischen?|kenianischen?|somalischen?) ?)?(?:Zeitung|Sportzeitung|Tageszeitung|Sender|Rundfunk|Nachrichtenagentur|Agentur|Website|Portal|Fachblatt|Magazin|Staatssender|Rundfunksender|Nachrichtenseite|Sportsender|Blatt)(?:en|s)? )'
            pre = r'(?P<prep>\b(?:laut|von|vom|mit|bei|beim|nach|gegenüber|zufolge|unter Berufung auf|auf)\s+)?'
            art = r'(?P<art>der |die |das |dem |den |des |Der |Die |Das |Dem |Den |Des )?'
            cite = r'(?: unter Berufung auf| mit Verweis auf)'
        elif lang == 'nl':
            D = r'(?:(?:de |het )?(?:krant|kranten|zender|omroep|persbureau|nieuwsagentschap|website|site|nieuwssite|tijdschrift|sportkrant|dagblad|media)(?: (?:sportkrant|Britse|Franse|Spaanse|Italiaanse|Amerikaanse|Duitse|Turkse|staats))? )'
            pre = r'(?P<prep>\b(?:volgens|door|van|aan|tegen|bij|met|in|op)\s+)?'
            art = r'(?:de |het |De |Het )?'
            cite = r'(?:,? (?:onder verwijzing naar|citerend|dat zich baseert op))'
        else:  # tr
            D = r'(?:(?:[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ )?(?:spor gazetesi|gazetesi|gazeteleri|kanalı|haber ajansı|ajansı|haber sitesi|sitesi|yayın kuruluşu|televizyonu|radyosu|devlet yayın kuruluşu) )'
            pre, art = r'(?P<prep>)', ''
            cite = r'(?:,? (?:ise )?)'
        post = r'(?: (?:gazetesi|kanalı|ajansı|sitesi|televizyonu|yayın kuruluşu))?' if lang == 'tr' else r'(?: \([^)]{0,60}\))?'
        suf = r"(?:['’](?P<suf>[a-zçğıöşü]+))?" if lang == 'tr' else r"(?P<suf>['’]s?)?"
    art0 = art.replace('?P<art>', '')
    one = r'(?:' + D + r'?' + art0 + NA + r')'
    chain_tail = r'(?:(?:,\s*|\s+' + J + r'\s+|\s*/\s*)' + art0 + D + r'?' + art0 + NA + r')*'
    head = r'(?:' + art + r'(?:' + D + art0 + NA + r'|' + N + r'))'
    cite_part = r'(?:' + cite + r' ' + one + chain_tail + r')?' if lang != 'tr' else ''
    rx = r'(?<![\w])' + pre + head + chain_tail + post + cite_part + suf + r'(?![\w’\'])'
    _gen[key] = re.compile(rx)
    return _gen[key]


_PLURAL = {
    'fr': lambda p: {'de': 'des médias', 'du': 'des médias', 'des': 'des médias', 'à': 'aux médias', 'au': 'aux médias', 'aux': 'aux médias',
                     'par': 'par les médias', 'selon': 'selon les médias', "d'après": "d'après les médias", 'd’après': 'd’après les médias',
                     'pour': 'pour les médias'}.get(p, 'les médias'),
    'it': lambda p: ('ai media' if p in ('a', 'ad', 'al', 'alla', 'allo', 'ai', 'alle', "all'", 'all’') else 'dai media' if p.startswith('da')
                     else 'dei media' if p.startswith('d') else 'secondo i media' if p == 'secondo' else (p + ' i media') if p else 'i media'),
    'es': lambda p: {'a': 'a los medios', 'al': 'a los medios', 'de': 'de los medios', 'del': 'de los medios', 'según': 'según los medios',
                     'por': 'por los medios', 'en': 'en los medios', 'con': 'con los medios', 'para': 'para los medios'}.get(p, 'los medios'),
    'de': lambda p: {'laut': 'laut Medienberichten', 'von': 'von Medien', 'vom': 'von Medien', 'nach': 'nach Medienberichten',
                     'zufolge': 'Medienberichten zufolge', 'bei': 'bei Medien', 'beim': 'bei Medien', 'mit': 'mit Medien',
                     'gegenüber': 'gegenüber Medien', 'unter berufung auf': 'unter Berufung auf Medien', 'auf': 'auf Medien'}.get(p, 'Medien'),
    'nl': lambda p: (p + ' de media') if p else 'de media',
}
_jobs_rx = {}


def _jobs(text, lang, mp, found, key=()):
    """'falanqeeyaha ESPN' -> 'falanqeeyaha', 'the ESPN analyst' -> 'the analyst', 'AFP muhabirine' -> 'muhabirine'"""
    if (lang, key) not in _jobs_rx:
        _jobs_rx[(lang, key)] = [(re.compile(p), r) for p, r in _jobs_pats(lang, mp)]
        if len(_jobs_rx) > 2000:
            _jobs_rx.clear()
    for p, r in _jobs_rx.get((lang, key), []):
        def sub(m, r=r):
            for a in sorted(mp, key=len, reverse=True):
                if a in m.group(0) and mp[a] not in found:
                    found.append(mp[a])
                    break
            return r(m) if callable(r) else m.expand(r)
        text = p.sub(sub, text)
    return text


def _jobs_pats(lang, mp):
    names = [a for a in mp if len(a) > 1]
    NA = '(?:' + _alt(names) + ')'
    pats = {
        'so': [(r'\b(falanqeeyaha|falanqeeyayaasha|wariyaha|weriyaha|wariyeyaasha|weriyeyaasha|suxufiga|saxafiga|tifaftiraha|faallo-bixiyaha|wariye|weriye)'
                r'(?: ka tirsan| ee| u shaqeeya| u shaqeysa)? (?:[Ww]argeyska |[Ww]akaaladda (?:wararka )?|[Ii]daacadda |[Tt]elefishinka |[Bb]ogga )?' + NA + r'(?![\w’\'])', r'\1')],
        'en': [(r'\b(?:the |a |an |The |A |An )?' + NA + r' (analysts?|pundits?|journalists?|reporters?|commentators?|correspondents?|presenters?|columnists?|editors?|insiders?)\b',
                lambda m: ('The ' if m.group(0)[:1].isupper() and m.start() == 0 else 'the ') + m.group(1))],
        'fr': [(r"\b(journalistes?|correspondante?s?|consultante?s?|chroniqueur|chroniqueuse|reporters?|envoyée? spéciale?)(?: de | du | d'| d’)(?:l'|l’|la |le )?" + NA + r"(?![\w’'])", r'\1')],
        'it': [(r"\b(giornalist[ai]|corrispondent[ei]|inviat[oa]|opinionista|commentator[ei])(?: di| del| della| dello|dell'| dell’)? ?" + NA + r"(?![\w’'])", r'\1')],
        'es': [(r'\b(periodistas?|corresponsal(?:es)?|comentaristas?|analistas?|reporter[oa]s?)(?: de| del| de la)? ' + NA + r"(?![\w’'])", r'\1')],
        'de': [(r'\b(Reporter(?:in)?|Korrespondent(?:in|en)?|Journalist(?:in|en)?|Experte|Experten|Analyst(?:in|en)?|Kommentator(?:in|en)?)(?: von| vom| des| der| beim)? ' + NA + r"(?![\w’'])", r'\1')],
        'nl': [(r'\b(verslaggever|correspondent|journalist|analist|commentator)(?: van| bij)? (?:de |het )?' + NA + r"(?![\w’'])", r'\1')],
        'tr': [(r"(?<![\w])" + NA + r"(?:['’][a-zçğıöşü]+)? (muhabir\w*|editör\w*|yorumcu\w*|yazar\w*|spiker\w*)", r'\1')],
        'ar': [(r'(مراسلو|مراسلي|مراسلة|مراسل|محلل|معلق|الصحفي|صحفي)(?: موقع| صحيفة| شبكة| قناة| وكالة)? ل?' + NA + r'(?![\w])', r'\1')],
    }
    return pats.get(lang, [])


# tidy-ups after the generic word: a citation of the generic word by the generic word, "including the press", commas
_POST = {
    'so': [(r',? oo (?:soo |ka soo )?xigan(?:aysa|aya|ayay|atay|tay) warbaahinta\b', ''), (r',? oo ay ku jiraan warbaahinta\b,?', ''),
           (r'\b(warbaahinta dowladda) warbaahinta\b', r'\1')],
    'en': [(r'\b([Tt]he press), (said|reported|added|wrote|noted|confirmed)\b', r'\1 \2'), (r',? (?:citing|quoting) the press\b', ''),
           (r',? including the press,?', ','), (r'\b(state media|state-run media) the press\b', r'\1'), (r',,', ',')],
    'fr': [(r'\b([Ll]a presse|[Ll]es médias), (a|ont) ', r'\1 \2 '), (r',? citant (?:la presse|les médias)\b', ''),
           (r',? (?:dont|notamment) (?:la presse|les médias),?', ',')],
    'de': [(r'(?<=\w) unter Berufung auf (?:die Presse|Medien)\b', ''), (r',? darunter (?:die Presse|Medien),?', ','),
           (r'\b[Dd]ie Presse zufolge\b', 'Medienberichten zufolge'), (r'\b(staatliche Medium|staatlichen Medien) die Presse\b', r'\1'),
           (r'(^|[.!?]\s+)Medienberichten', r'\1Medienberichten')],
    'it': [(r',? citando (?:la stampa|i media)\b', ''), (r',? tra cui (?:la stampa|i media),?', ',')],
    'es': [(r',? citando (?:a )?(?:la prensa|los medios)\b', ''), (r',? entre ellos (?:la prensa|los medios),?', ',')],
    'nl': [(r',? onder verwijzing naar (?:de pers|de media)\b', ''), (r',? waaronder (?:de pers|de media),?', ',')],
    'tr': [(r'\b(Basın|basın)(?:ın|ının)? basın\b', r'\1')],
    'ar': [(r'(وسائل الإعلام)(?:\s*(?:،|و)\s*وسائل الإعلام)+', r'\1'), (r'(وسائل الإعلام) عن وسائل الإعلام', r'\1'), (r'(?:نقلا|نقلاً) عن وسائل الإعلام', '')],
}

_TR_SUF = [(r'^n?[ıiuü]n$', 'basının'), (r'^y?[ae]$|^n[ae]$', 'basına'), (r'^[dt][ae]n$', 'basından'), (r'^[dt][ae]$', 'basında'),
           (r'^(?:y|n)?[ıiuü]$', 'basını'), (r'^(?:y)?l[ae]$', 'basınla')]
_PREP_OUT = {
    'fr': lambda p: {'de': 'de la presse', 'du': 'de la presse', 'des': 'de la presse', 'à': 'à la presse', 'au': 'à la presse',
                     'aux': 'à la presse', 'par': 'par la presse', 'selon': 'selon la presse', "d'après": "d'après la presse",
                     'd’après': 'd’après la presse', 'pour': 'pour la presse'}.get(p, 'la presse'),
    'it': lambda p: ('alla stampa' if p in ('a', 'ad', 'al', 'alla', 'allo', 'ai', 'alle', "all'", 'all’') else
                     'dalla stampa' if p.startswith('da') else 'della stampa' if p.startswith('d') else
                     'sulla stampa' if p.startswith('su') else 'secondo la stampa' if p == 'secondo' else
                     'per la stampa' if p == 'per' else 'con la stampa' if p == 'con' else 'la stampa'),
    'es': lambda p: {'a': 'a la prensa', 'al': 'a la prensa', 'de': 'de la prensa', 'del': 'de la prensa', 'según': 'según la prensa',
                     'por': 'por la prensa', 'en': 'en la prensa', 'con': 'con la prensa', 'para': 'para la prensa'}.get(p, 'la prensa'),
    'nl': lambda p: (p + ' de pers') if p else 'de pers',
}


def neutralize(text, lang='so', extra=()):
    """replace every outlet name still in a text by the generic word of its language -> (text, [outlets replaced])"""
    if not isinstance(text, str) or not text.strip() or lang not in GENERIC:
        return text, []
    kn = known_outlets()
    ex = sorted(set(str(e).strip() for e in extra if e and str(e).strip()) - set(kn))  # usually empty: one compiled pattern
    rx = _generic_rx(lang, kn + ex)
    amap, armap = _alias_map(kn + ex)
    mp = dict(amap)
    mp.update(armap)
    found = []
    text = _jobs(text, lang, mp, found, tuple(ex))

    def sub(m):
        g = m.groupdict()
        for a in sorted(mp, key=len, reverse=True):
            if a in m.group(0) and mp[a] not in found:
                found.append(mp[a])
                break
        start = m.start() == 0 or bool(re.search(r'(?:[.!?…:]\s+|\n)$', text[max(0, m.start() - 3):m.start()]))
        names_in = len(re.findall(r'(?:,\s*|\s(?:and|et|en|e|und|y|iyo)\s)', m.group(0))) > 0
        if names_in and lang in _PLURAL:
            out = _PLURAL[lang]((g.get('prep') or '').strip().lower())
            if lang == 'de' and out == 'Medien' and (g.get('art') or '').strip().lower() in ('der', 'des', 'dem', 'die', 'den'):
                out = {'der': 'der Medien', 'des': 'der Medien', 'dem': 'den Medien', 'die': 'die Medien', 'den': 'die Medien'}[(g.get('art') or '').strip().lower()]
            return out[0].upper() + out[1:] if start else out
        if lang == 'so':
            out = 'warbaahintana' if g.get('suf') else 'warbaahinta'
        elif lang == 'ar':
            p = g.get('p') or ''
            lam = 'ل' in p or g.get('l0') or g.get('l1') or re.match(r'\s*لل', m.group(0)[len(p):])
            out = ('و' if p.startswith('و') else '') + ('ب' if 'ب' in p else 'ل' if lam else '') + 'وسائل الإعلام'
        elif lang == 'tr':
            suf = g.get('suf') or ''
            out = 'basın' + ("'" + suf if suf and not any(re.match(r, suf) for r, _ in _TR_SUF) else '')
            for r, w in _TR_SUF:
                if suf and re.match(r, suf):
                    out = w
                    break
        elif lang == 'de':
            prep = (g.get('prep') or '').strip()
            a = (g.get('art') or '').strip().lower()
            if prep in ('vom', 'beim'):
                out = {'vom': 'von', 'beim': 'bei'}[prep] + ' der Presse'
            elif prep in ('unter Berufung auf', 'auf'):
                out = prep + ' die Presse'
            elif prep:
                out = prep + ' der Presse'
            else:
                out = 'der Presse' if a in ('dem', 'des') else 'die Presse'
        elif lang in _PREP_OUT:
            out = _PREP_OUT[lang]((g.get('prep') or '').strip().lower())
        else:  # en
            out = 'the press' + ("'" if g.get('suf') else '')
        if start and lang not in ('ar',):
            out = out[0].upper() + out[1:]
        return out
    out = rx.sub(sub, text)
    if lang == 'so':
        out = re.sub(r'\b([Ww]arbaahinta),\s+ayaa\b', r'\1 ayaa', out)
        out = re.sub(r'\b([Ww]arbixin(?:ta|tii|ada|nada|no|nno)?) warbaahinta\b(?! (?:ayaa|ma|kuma|lagu|laguma))', r'\1', out)
        out = re.sub(r'\b([Ww]arbixin(?:ta|tii)?) warbaahinta (?=ayaa|ma |kuma |lagu|laguma)', r'\1 ', out)
        out = re.sub(r' \(warbaahinta(?: dowladda)?\)', '', out)
        out = re.sub(r'\bwarbaahinta(?:,| iyo) warbaahinta\b', 'warbaahinta', out)
    for a_, b_ in _POST.get(lang, []):
        out = re.sub(a_, b_, out)
    if lang == 'en':
        out = re.sub(r"\bthe press' (report|reporting|story|article|coverage|analysis|sources)\b", r'media \1', out)
        out = re.sub(r'\b[Aa]n? the press\b', 'the press', out)
    return out, found


def clean(text, lang='so', extra=(), generic=True):
    """-> (clean text, [canonical outlet names removed from it]). generic=False keeps names the rules did not remove
    (a story ABOUT an outlet)."""
    if not isinstance(text, str) or not text.strip():
        return text, []
    names, one_re, rules, mp = _compiled(lang, extra)
    found = []

    def note(m):
        for x in one_re.findall(m.group(0)):
            c = mp.get(x)
            if c and c not in found:
                found.append(c)

    out = PROMO_INLINE.sub('', text)
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
    if generic:
        out, f2 = neutralize(out, lang, extra)
        found += [x for x in f2 if x not in found]
    return out.strip(), found


def own_story(n):
    return n.get('by') == 'admin' and (not n.get('source') or n.get('source') == BRAND)


def credit(n, found=()):
    """The INTERNAL source record {"type", "sources": [{"name", "url"?}]} (for /admin/ and the report; never public)."""
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


def public_credit(c):
    """What the public site, the app and the page metadata get (owner's rule of 23 Nov 2026): the type only, and a name
    only for an official statement by an institution that is not a media outlet. Never an outlet, never a link."""
    c = c or {}
    t = c.get('type') if c.get('type') in TYPES else 'rewritten'
    srcs = [{'name': x['name']} for x in c.get('sources') or [] if t == 'official' and isinstance(x, dict) and x.get('name')
            and not is_outlet(x['name']) and x['name'] != BRAND]
    return {'type': t, 'sources': srcs}


_internal = {}  # article id -> internal credit of the last apply() (for report())


def _extra(n):
    return [e for e in [n.get('source')] + [a.get('name') or a.get('source') for a in (n.get('sources') or []) + (n.get('alsoReportedBy') or [])
                                             if isinstance(a, dict)] if e]


def about_outlet(n):
    """a story ABOUT a media outlet (its name in the Somali or English headline, e.g. "Trump oo dacweeyay BBC"): its name
    is part of the news and is never replaced automatically"""
    return bool(mentions(n.get('title'), _extra(n), 'so', strict=True) or
                mentions((n.get('en') or {}).get('title') if isinstance(n.get('en'), dict) else '', _extra(n), 'en', strict=True))


def clean_article(n, langs):
    """clean title/summary/body/imageAlt of the Somali text and every translation in place -> outlets removed"""
    extra, found = _extra(n), []
    gen = not about_outlet(n)
    for k in ('title', 'summary', 'body', 'imageAlt'):
        if isinstance(n.get(k), str):
            n[k], f = clean(n[k], 'so', extra, gen)
            found += [x for x in f if x not in found]
    for lang in langs:
        t = n.get(lang)
        if isinstance(t, dict):
            for k in ('title', 'summary', 'body', 'imageAlt'):
                if isinstance(t.get(k), str):
                    t[k], f = clean(t[k], lang, extra, gen)
                    found += [x for x in f if x not in found]
    return found


def apply(n, langs):
    """Clean an article (a data/news.json item, in place) and set its PUBLIC n["credit"]. The newsroom's own /admin/
    stories are the owner's words and are not rewritten (names left in them are listed in the report)."""
    found = []
    if not own_story(n) and n.get('by') != 'admin' and n.get('rewriteStatus') != 'locked':
        found = clean_article(n, langs)
    internal = credit(n, found)
    if n.get('id'):
        _internal[n['id']] = internal
    n['credit'] = public_credit(internal)
    return n


_mentions_rx = {}


def mentions(text, extra=(), lang='so', strict=False):
    """outlet names still written in a text. strict=True (the residual check) leaves out names that are also ordinary
    words (AMBIG) and links count as a mention ("link")."""
    if not isinstance(text, str) or not text.strip():
        return []
    if strict:  # every outlet the articles use, plus this article's own: one compiled pattern for nearly every article
        kn = known_outlets()
        extra = kn + sorted(set(str(e).strip() for e in extra if e and str(e).strip()) - set(kn))
    key = (lang, strict, tuple(extra))
    if key not in _mentions_rx:
        amap, armap = _alias_map(extra)
        mp = dict(armap) if lang == 'ar' else dict(amap)
        if lang == 'ar':  # translations keep Latin names too ("BBC")
            mp.update(amap)
        if strict:
            mp = {a: c for a, c in mp.items() if a not in AMBIG and len(a) > 2}
        if len(_mentions_rx) > 4000:
            _mentions_rx.clear()
        _mentions_rx[key] = (mp, re.compile(r'(?<![\w])(?:' + _alt(list(mp)) + r')(?![\w])') if mp else None)
    mp, one = _mentions_rx[key]
    if one is None:
        return []
    out = {mp[x] for x in one.findall(text)}
    if strict and URL.search(text):
        out.add('link')
    return sorted(out)


def residual(n, langs=None):
    """outlet names (and links) still in an article's public text after clean(), in every language:
    [{"lang", "field", "names"}]. Empty = nothing names another outlet."""
    if langs is None:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from translations import LANGS as langs
    extra, out = _extra(n), []
    for lang in ('so',) + tuple(langs):
        t = n if lang == 'so' else n.get(lang)
        if not isinstance(t, dict):
            continue
        for k in ('title', 'summary', 'body', 'imageAlt'):
            m = mentions(t.get(k), extra, lang, strict=True)
            if m:
                out.append({'lang': lang, 'field': k, 'names': m})
    return out


def gate(n, langs=None):
    """Pre-publish check of a NEW article written by an automatic writer (owner's rule of 23 Nov 2026): clean every
    language in place; when an outlet is still named (or linked), hold the article for editorial review instead of
    publishing it or deleting the name: "published": false, "heldBy": "attribution-review", "attributionNote".
    -> the residual list (empty = clear to publish)."""
    if langs is None:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from translations import LANGS as langs
    clean_article(n, langs)
    left = residual(n, langs)
    if left:
        n['published'] = False
        n['heldBy'] = 'attribution-review'
        n['attributionNote'] = ('Magac warbaahin kale ayaa ku jira qoraalka: ' + '; '.join(
            f"{x['lang']}/{x['field']}: {', '.join(x['names'])}" for x in left))[:400]
    return left


def citations_left(text, extra=()):
    """outlets still cited as the reporter in a Somali text ("sida ay … X", "X ayaa werisay")"""
    found = []
    for name in mentions(text, extra):
        al = [a for a, c in _alias_map(list(extra) + known_outlets())[0].items() if c == name]
        nm = '(?:' + _alt(al) + ')'
        if re.search(r'sida (?:ay|uu)[^.,;]{0,30}' + nm + r'|' + nm + r'[^.,;]{0,25}(?:ayaa (?:sheegtay|werisay|qortay|ku warantay)|werisay|wariyeen|wariyay|soo tebiyay)', text):
            found.append(name)
    return found


def report(news=None):
    """data/attribution-report.json: every published article's attribution status (shown in /admin/). "sources" are the
    INTERNAL record (never shown to readers); "namesInText" = outlet names or links still in the public text, in any
    language: these need an editor."""
    if news is None:
        news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))['news']
    rows, counts = [], {t: 0 for t in TYPES}
    for n in news:
        c = _internal.get(n.get('id')) or credit(n)
        counts[c['type']] = counts.get(c['type'], 0) + 1
        left = residual(n)
        rows.append({'id': n.get('id'), 'title': n.get('title'), 'publishedAt': n.get('publishedAt'), 'type': c['type'],
                     'sources': ', '.join(s['name'] for s in c['sources']), 'sourceUrl': n.get('sourceUrl') or '',
                     'rewriteStatus': n.get('rewriteStatus') or ('original' if c['type'] == 'original' else 'rewritten'),
                     'verificationStatus': n.get('verificationStatus') or ('verified' if c['type'] == 'verified' else 'multi-source' if n.get('verification') else 'not-recorded'),
                     'namesInText': '; '.join(f"{x['lang']}/{x['field']}: {', '.join(x['names'])}" for x in left)})
    review = [r for r in rows if r['namesInText']]
    out = {'note': 'Built by tools/attribution.py at every publication. Readers never see the sources: no outlet is named on '
                   'the site (owner\'s rule of 23 Nov 2026). namesInText = outlet names or links still in the public text '
                   '(a quotation, an exclusive, or a story about an outlet): an editor rewrites it in /admin/ or confirms it.',
           'counts': counts, 'total': len(rows), 'needsReview': len(review), 'review': review[:300]}
    p = os.path.join(root, 'data', 'attribution-report.json')
    txt = json.dumps(out, ensure_ascii=False, indent=1)
    if not os.path.exists(p) or open(p, encoding='utf-8').read() != txt:
        open(p, 'w', encoding='utf-8').write(txt)
    return out


def check_new(paths):
    """News task check (pre-publish, owner's rule of 23 Nov 2026): a new article file that still names another media
    outlet or contains a link anywhere in its title, summary, body or photo description, in Somali or any translation,
    is refused (exit 1), unless it is held for editorial review ("published": false with "attributionNote" saying why
    naming the outlet is necessary). The writer rewrites the sentence neutrally or holds the article."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from translations import LANGS
    bad = []
    for p in paths:
        n = json.load(open(p, encoding='utf-8'))
        if n.get('by') == 'admin':
            continue
        held = n.get('published') is False and str(n.get('attributionNote') or '').strip()
        test = json.loads(json.dumps(n))
        clean_article(test, LANGS)  # what the site would publish
        left = residual(test, LANGS)
        if left and not held:
            for x in left:
                bad.append(f'{os.path.basename(p)}: {x["lang"]} {x["field"]} names {", ".join(x["names"])} (write it neutrally: '
                           '"Waxaa la sheegay in …", or attribute it to the person or institution; if naming the outlet is '
                           'really necessary set "published": false and "attributionNote": "<why>" for editorial review)')
        for k in ('title', 'summary'):
            m = mentions(n.get(k), _extra(n), strict=True)
            if m and not held:
                bad.append(f'{os.path.basename(p)}: {k} names {", ".join(m)}')
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
    assert so == 'Wasiirka ayaa sheegay in ay heshiis gaareen.' and f == ['BBC Somali'], ('no outlet named, interviews included', so)
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
    _test_23nov()
    print('attribution: all tests passed')


def _test_23nov():
    """owner's rule of 23 Nov 2026: multi-source articles in all 9 languages publish with no outlet named anywhere"""
    LG = ('en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es')
    # the article of the screenshot: built on two Somali outlets
    so, _ = clean('WARTABIYE TV — Iyadoo lagu salaynayo warbixinno ay baahiyeen Hiiraan Online iyo Caasimada Online. Cali Cosoble ayaa geeriyooday.')
    assert so == 'Cali Cosoble ayaa geeriyooday.', so
    cases = {
        'so': ('Sida ay werisay Hiiraan Online, shirka ayaa furmay. Warbixin ay baahisay Caasimada Online ayaa sheegtay in 3 qof dhinteen. '
               'Wasiirka ayaa Garowe Online u sheegay in ay heshiis gaareen. Warbaahinta dowladda ee Radio Muqdisho ayaa sheegtay in shirku dhammaaday. '
               'Sida ay qortay BBC Sport. Akhri wax badan: https://hiiraan.com/x'),
        'en': ('According to Reuters, the talks resumed. The minister told Al Jazeera that a deal was close. In an interview with the BBC, '
               'he said 3 people died. The state broadcaster SONNA said the meeting ended, AFP reported.'),
        'fr': ("Selon Reuters, les pourparlers ont repris. Le ministre a déclaré à France 24 qu'un accord était proche, a rapporté l'AFP."),
        'nl': 'Volgens Reuters zijn de gesprekken hervat. De minister zei tegen Al Jazeera dat een akkoord dichtbij was, meldde AFP.',
        'it': "Secondo Reuters, i colloqui sono ripresi. Il ministro ha detto ad Al Jazeera che un accordo era vicino, ha riferito AFP.",
        'de': 'Laut Reuters wurden die Gespräche wieder aufgenommen. Der Minister sagte Al Jazeera, eine Einigung sei nahe, berichtete AFP.',
        'tr': "Reuters'ın haberine göre görüşmeler yeniden başladı. Bakan Al Jazeera'ya konuşan bir açıklamada anlaşmanın yakın olduğunu söyledi.",
        'es': 'Según Reuters, las conversaciones se reanudaron. El ministro dijo a Al Jazeera que un acuerdo estaba cerca, informó AFP.',
        'ar': 'ووفقًا لرويترز، استؤنفت المحادثات. وقال الوزير للجزيرة إن الاتفاق قريب. وقتل 3 أشخاص، بحسب فرانس برس.',
    }
    art = {'id': 't-multi', 'by': 'claude', 'source': 'Hiiraan Online', 'sourceUrl': 'https://hiiraan.com/x', 'title': 'Shirka oo furmay',
           'summary': 'Shirka ayaa furmay.', 'body': cases['so'],
           'alsoReportedBy': [{'name': 'Caasimada Online', 'url': 'https://c'}, {'name': 'Garowe Online', 'url': 'https://g'}],
           'sources': [{'name': 'Hiiraan Online', 'url': 'https://hiiraan.com/x'}, {'name': 'Caasimada Online'}, {'name': 'Garowe Online'}]}
    for lang in LG:
        art[lang] = {'title': 'T', 'summary': 'S', 'body': cases[lang]}
    import copy
    a2 = apply(copy.deepcopy(art), LG)
    left = residual(a2, LG)
    assert not left, (left, {l: (a2 if l == 'so' else a2[l])['body'] for l in ('so',) + LG})
    assert a2['credit'] == {'type': 'multi', 'sources': []}, a2['credit']
    assert 'Wasiirka ayaa sheegay in' in a2['body'] and 'Warbaahinta dowladda ayaa sheegtay' in a2['body'], a2['body']
    assert 'http' not in a2['body'], a2['body']
    # the internal record keeps every outlet for /admin/
    assert [x['name'] for x in _internal['t-multi']['sources']] == ['Hiiraan Online', 'Caasimada Online', 'Garowe Online'], _internal['t-multi']
    # an official statement keeps the institution; a club statement keeps the club; an outlet as "official" is dropped
    assert public_credit({'type': 'official', 'sources': [{'name': 'Wasaaradda Arrimaha Dibadda'}]})['sources'] == [{'name': 'Wasaaradda Arrimaha Dibadda'}]
    assert public_credit({'type': 'official', 'sources': [{'name': 'SONNA'}]})['sources'] == []
    assert public_credit({'type': 'rewritten', 'sources': [{'name': 'BBC', 'url': 'https://bbc'}], 'link': True}) == {'type': 'rewritten', 'sources': []}
    so, f = clean('Liverpool FC ayaa sheegtay in Salah uu dhaawacmay.', 'so', ['Liverpool FC'])
    assert so.startswith('Liverpool FC ayaa sheegtay') and not f, so
    # a story ABOUT an outlet is not rewritten silently: the gate holds it for an editor
    about = {'id': 't-about', 'by': 'claude', 'source': 'Goobjoog News', 'title': 'Wariye ka tirsan Radio Shabelle oo la xiray',
             'summary': 'Wariye ka tirsan Radio Shabelle ayaa la xiray.', 'body': 'Wariye ka tirsan Radio Shabelle ayaa Muqdisho lagu xiray.'}
    assert gate(about, LG) and about['published'] is False and about['heldBy'] == 'attribution-review' and 'Shabelle' in about['attributionNote']
    clear = {'id': 't-ok', 'by': 'claude', 'source': 'Hiiraan Online', 'title': 'Roob', 'summary': 'Roob ayaa da\'ay.',
             'body': 'Sida ay werisay Hiiraan Online, roob culus ayaa da\'ay. AS Roma ayaa guuleysatay.'}
    assert not gate(clear, LG) and clear.get('published') is not False and clear['body'] == "Roob culus ayaa da'ay. AS Roma ayaa guuleysatay.", clear


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
