"""Automatic football RESULT reports for the Ciyaaraha section, written from verified match data, without any AI and
without the owner's Claude plan. Run every 5 minutes by the source-monitor loop (tools/fast_loop.sh sports_cycle).

What it publishes: one short report per FINISHED match of the competitions in RESULT_LEAGUES (Bundesliga and the UEFA
club competitions, from OpenLigaDB, the open football database the LIVE Sports page already uses), plus, when the secret
FOOTBALL_DATA_TOKEN feeds data/sports-feed/, the football-data.org results (Premier League, LaLiga, Serie A, Ligue 1).
  - only matches the data marks as finished, with a final score, that kicked off between MAX_AGE_H hours ago and
    SETTLE_MIN minutes before the end of a normal match (so late corrections in the data are not published);
  - every fact comes from the data: teams, score, half-time score, goal scorers and minutes (when the data has them),
    competition, round, stadium and kick-off time (Africa/Nairobi). Nothing is guessed, added or rounded;
  - written from fixed sentences in Somali and the eight other site languages (no machine translation);
  - the picture is the result card (both clubs' crests and the score, drawn by the page from the "result" block), never
    a photo, so there is no image licence question; the crests are matched by team id (assets/sports-src.js OL_FD);
  - never twice: skipped when the file exists, when the id was ever used (deleted ones included, tools/known_sources.py)
    or when a sports article of the last 3 days already names both clubs and the same score.

  python3 tools/sports_results.py            write the new report files (prints their ids)
  python3 tools/sports_results.py --dry      only list what would be written
  python3 tools/sports_results.py test       offline self-test
"""
import json, os, re, sys, glob, datetime, unicodedata, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translations import text_hash, LANGS

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS = os.path.join(root, 'data', 'news')
EAT = datetime.timezone(datetime.timedelta(hours=3))
OL = 'https://api.openligadb.de'
UA = 'WartabiyeTV-SportsResults/1.0 (+https://www.wartabiyetv.com/)'
MAX_AGE_H = 30          # a match that kicked off more than 30 hours ago is old news: never reported
SETTLE_MIN = 150        # kick-off + 150 min (90 + half-time + stoppage + data settling) before a result is reported
RESULT_LEAGUES = {'bl1': 'Bundesliga', 'ucl': 'UEFA Champions League', 'uel2026': 'UEFA Europa League', 'uecl2026': 'UEFA Conference League'}
FD_COMPS = {'PL': 'Premier League', 'PD': 'LaLiga', 'SA': 'Serie A', 'FL1': 'Ligue 1'}
FD_CREST = 'https://crests.football-data.org/'

# OpenLigaDB team id -> football-data.org team id, checked by eye on 9 Nov 2026 (same list as assets/sports-src.js)
OL_FD = {65: 1, 80: 28, 81: 15, 6: 3, 7: 4, 87: 18, 91: 19, 95: 16, 40: 5, 9: 6, 100: 7, 1635: 721, 112: 17, 31: 29, 134: 12, 175: 2, 16: 10,
         199: 44, 98: 20, 129: 36, 131: 11, 378: 100, 438: 58, 4241: 78, 8787: 7397, 2617: 57, 356: 81, 1210: 851, 370: 64, 375: 503,
         1770: 675, 5707: 5721, 2554: 610, 733: 108, 1204: 521, 4244: 65, 2556: 66, 2281: 524, 376: 674, 5962: 546, 1804: 90, 1133: 86,
         1186: 1887, 4578: 930, 1205: 498, 2331: 113, 382: 94, 441: 98, 369: 109, 1819: 523, 2557: 516, 1816: 1903, 1201: 1877,
         4606: 7283, 2547: 548, 455: 678}
# OpenLigaDB writes club names in German ("Inter Mailand", "FC Arsenal"): the usual international name, by team id
NAMES = {1217: 'AEK Athens', 378: 'AS Roma', 438: 'Aston Villa', 4241: 'Atlético Madrid', 7: 'Borussia Dortmund', 8787: 'Como',
         2617: 'Arsenal', 356: 'Barcelona', 40: 'Bayern Munich', 1210: 'Club Brugge', 370: 'Liverpool', 375: 'Porto', 366: 'Fenerbahçe',
         1770: 'Feyenoord', 5707: 'Bodø/Glimt', 2554: 'Galatasaray', 733: 'Inter Milan', 5139: 'LASK', 1204: 'Lille', 4244: 'Manchester City',
         2556: 'Manchester United', 2281: 'Paris Saint-Germain', 376: 'PSV Eindhoven', 1635: 'RB Leipzig', 5962: 'Lens', 1804: 'Real Betis',
         1133: 'Real Madrid', 8798: 'Sabah', 1186: 'Shakhtar Donetsk', 4578: 'Slavia Prague', 5699: 'Slovan Bratislava', 1205: 'Sporting CP',
         2331: 'Napoli', 16: 'VfB Stuttgart', 1484: 'Viking', 382: 'Villarreal', 441: 'AC Milan', 2942: 'Bournemouth', 727: 'AZ Alkmaar',
         6: 'Bayer Leverkusen', 1816: 'Benfica', 1837: 'Beşiktaş', 2175: 'Celta Vigo', 2804: 'Celtic', 2489: 'Crystal Palace',
         1208: 'Dinamo Zagreb', 5250: 'Ferencváros', 369: 'Juventus', 449: 'Lech Poznań', 1206: 'Levski Sofia', 443: 'NEC Nijmegen',
         436: 'Olympiacos', 1819: 'Lyon', 2557: 'Marseille', 5705: 'Omonia Nicosia', 1201: 'Red Bull Salzburg', 1275: 'Real Sociedad',
         1216: 'Anderlecht', 4199: 'Sparta Prague', 4639: 'Rennes', 2491: 'Sturm Graz', 546: 'Sunderland', 175: 'Hoffenheim',
         4825: 'Union Saint-Gilloise', 4468: 'Viktoria Plzeň', 455: 'Ajax', 2547: 'Monaco', 1807: 'Atalanta', 4572: 'Brighton & Hove Albion',
         1141: 'Getafe', 453: 'FC Copenhagen', 1207: 'Gent', 5702: 'Heart of Midlothian', 374: 'Panathinaikos', 4606: 'Red Star Belgrade',
         112: 'SC Freiburg', 4202: 'Braga', 320: 'Trabzonspor', 1227: 'CSKA Sofia', 65: '1. FC Köln', 80: 'Union Berlin', 81: 'Mainz 05',
         87: "Borussia Mönchengladbach", 91: 'Eintracht Frankfurt', 95: 'FC Augsburg', 9: 'Schalke 04', 100: 'Hamburger SV',
         31: 'SC Paderborn', 198: 'SV Elversberg', 134: 'Werder Bremen'}

MONTHS = {'so': ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maajo', 'Juun', 'Luuliyo', 'Agoosto', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Diseembar'],
          'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
          'ar': ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
          'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
          'nl': ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
          'it': ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
          'de': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
          'tr': ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
          'es': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']}

# fixed sentences, one set per language. {h}/{a} home/away club, {w}/{l} winner/loser, {s} winner-loser score,
# {d} "8 November", {r} round sentence part, {c} competition, {v} stadium part
T = {
 'so': {'win': '{c}: {w} oo {s} ku garaacday {l}', 'draw': '{c}: {h} iyo {a} oo {s} barbar dhacay',
        'swin': '{w} ayaa {s} ku garaacday {l} kulankii {c}{r} ee {d}{v}.', 'sdraw': '{h} iyo {a} ayaa {s} ku kala tagay kulankii {c}{r} ee {d}{v}.',
        'r': ' (wareegga {n}aad)', 'v': ', garoonka {v}', 'ht': 'Qeybtii hore waxay ku dhammaatay {x}.', 'goals': 'Goolasha:', 'nogoals': 'Xogta kulanka kuma jiraan magacyada goolasha dhaliyay.',
        'pen': 'rigoore', 'own': 'is-dhalin', 'src': 'Natiijada waxaa laga soo qaatay {p}. Natiijooyinka tooska ah, ciyaaraha soo socda iyo kala sarreynta waxaad ka heleysaa bogga Ciyaaraha Toos ee Wartabiye TV.'},
 'en': {'win': '{c}: {w} beat {l} {s}', 'draw': '{c}: {h} and {a} draw {s}',
        'swin': '{w} beat {l} {s} in the {c}{r} on {d}{v}.', 'sdraw': '{h} and {a} drew {s} in the {c}{r} on {d}{v}.',
        'r': ' (matchday {n})', 'v': ', at {v}', 'ht': 'The half-time score was {x}.', 'goals': 'Goals:', 'nogoals': 'The match data does not include the goal scorers.',
        'pen': 'penalty', 'own': 'own goal', 'src': 'Result from {p}. Live scores, fixtures and tables are on the Wartabiye TV Live Sports page.'},
 'ar': {'win': '{c}: {w} يفوز على {l} {s}', 'draw': '{c}: تعادل {h} و{a} {s}',
        'swin': 'فاز {w} على {l} بنتيجة {s} في {c}{r} يوم {d}{v}.', 'sdraw': 'تعادل {h} و{a} بنتيجة {s} في {c}{r} يوم {d}{v}.',
        'r': ' (الجولة {n})', 'v': '، على ملعب {v}', 'ht': 'وانتهى الشوط الأول بنتيجة {x}.', 'goals': 'الأهداف:', 'nogoals': 'لا تتضمن بيانات المباراة أسماء الهدافين.',
        'pen': 'ركلة جزاء', 'own': 'هدف عكسي', 'src': 'النتيجة من {p}. النتائج المباشرة والمباريات القادمة والترتيب في صفحة الرياضة المباشرة على Wartabiye TV.'},
 'fr': {'win': '{c} : {w} bat {l} {s}', 'draw': '{c} : {h} et {a} font match nul {s}',
        'swin': '{w} a battu {l} {s} en {c}{r} le {d}{v}.', 'sdraw': '{h} et {a} ont fait match nul {s} en {c}{r} le {d}{v}.',
        'r': ' ({n}e journée)', 'v': ', au stade {v}', 'ht': 'Le score à la mi-temps était de {x}.', 'goals': 'Buts :', 'nogoals': 'Les données du match ne donnent pas les buteurs.',
        'pen': 'penalty', 'own': 'contre son camp', 'src': 'Résultat : {p}. Scores en direct, calendrier et classements sur la page Sport en direct de Wartabiye TV.'},
 'nl': {'win': '{c}: {w} wint van {l} met {s}', 'draw': '{c}: {h} en {a} spelen {s} gelijk',
        'swin': '{w} won met {s} van {l} in de {c}{r} op {d}{v}.', 'sdraw': '{h} en {a} speelden {s} gelijk in de {c}{r} op {d}{v}.',
        'r': ' (speelronde {n})', 'v': ', in {v}', 'ht': 'De ruststand was {x}.', 'goals': 'Doelpunten:', 'nogoals': 'De wedstrijdgegevens bevatten de doelpuntenmakers niet.',
        'pen': 'strafschop', 'own': 'eigen doelpunt', 'src': 'Uitslag van {p}. Live uitslagen, wedstrijden en standen staan op de Live sport-pagina van Wartabiye TV.'},
 'it': {'win': '{c}: il {w} batte il {l} {s}', 'draw': '{c}: {h} e {a} pareggiano {s}',
        'swin': 'Il {w} ha battuto il {l} {s} in {c}{r} il {d}{v}.', 'sdraw': '{h} e {a} hanno pareggiato {s} in {c}{r} il {d}{v}.',
        'r': ' ({n}ª giornata)', 'v': ', allo stadio {v}', 'ht': 'Il primo tempo è finito {x}.', 'goals': 'Gol:', 'nogoals': 'I dati della partita non indicano i marcatori.',
        'pen': 'rigore', 'own': 'autogol', 'src': 'Risultato da {p}. Risultati in diretta, calendario e classifiche nella pagina Sport live di Wartabiye TV.'},
 'de': {'win': '{c}: {w} schlägt {l} {s}', 'draw': '{c}: {h} und {a} trennen sich {s}',
        'swin': '{w} hat {l} am {d} in der {c}{r} mit {s} geschlagen{v}.', 'sdraw': '{h} und {a} haben sich am {d} in der {c}{r} {s} getrennt{v}.',
        'r': ' ({n}. Spieltag)', 'v': ' ({v})', 'ht': 'Zur Pause stand es {x}.', 'goals': 'Tore:', 'nogoals': 'Die Spieldaten nennen keine Torschützen.',
        'pen': 'Elfmeter', 'own': 'Eigentor', 'src': 'Ergebnis: {p}. Live-Ergebnisse, Spielplan und Tabellen auf der Live-Sport-Seite von Wartabiye TV.'},
 'tr': {'win': '{c}: {w}, {l} karşısında {s} kazandı', 'draw': '{c}: {h} ile {a} {s} berabere kaldı',
        'swin': '{w}, {d} tarihinde {c}{r} maçında {l} takımını {s} yendi{v}.', 'sdraw': '{h} ile {a}, {d} tarihinde {c}{r} maçında {s} berabere kaldı{v}.',
        'r': ' ({n}. hafta)', 'v': ' ({v})', 'ht': 'İlk yarı {x} sona erdi.', 'goals': 'Goller:', 'nogoals': 'Maç verilerinde gol atan oyuncular yer almıyor.',
        'pen': 'penaltı', 'own': 'kendi kalesine', 'src': 'Sonuç kaynağı: {p}. Canlı skorlar, fikstür ve puan durumu Wartabiye TV Canlı Spor sayfasında.'},
 'es': {'win': '{c}: el {w} vence al {l} por {s}', 'draw': '{c}: {h} y {a} empatan {s}',
        'swin': 'El {w} venció al {l} por {s} en la {c}{r} el {d}{v}.', 'sdraw': '{h} y {a} empataron {s} en la {c}{r} el {d}{v}.',
        'r': ' (jornada {n})', 'v': ', en el estadio {v}', 'ht': 'Al descanso el marcador era {x}.', 'goals': 'Goles:', 'nogoals': 'Los datos del partido no incluyen a los goleadores.',
        'pen': 'penalti', 'own': 'en propia puerta', 'src': 'Resultado: {p}. Resultados en directo, calendario y clasificaciones en la página Deportes en vivo de Wartabiye TV.'},
}
ALT = {'so': 'Kaarka natiijada: astaanta {h} iyo {a} iyo natiijada {x}', 'en': 'Result card: {h} and {a} crests and the {x} score',
       'ar': 'بطاقة النتيجة: شعارا {h} و{a} والنتيجة {x}', 'fr': 'Carte du résultat : écussons de {h} et {a} et le score {x}',
       'nl': 'Uitslagkaart: logo’s van {h} en {a} en de uitslag {x}', 'it': 'Scheda del risultato: stemmi di {h} e {a} e il punteggio {x}',
       'de': 'Ergebniskarte: Wappen von {h} und {a} und das Ergebnis {x}', 'tr': 'Sonuç kartı: {h} ve {a} armaları ve {x} skor',
       'es': 'Tarjeta del resultado: escudos de {h} y {a} y el marcador {x}'}


def now(): return datetime.datetime.now(EAT).replace(microsecond=0)


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:28].strip('-')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode('utf-8'))


def parse(s):
    try: return datetime.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except Exception: return None


def ol_crest(team):
    f = OL_FD.get(team.get('teamId'))
    if f: return f'{FD_CREST}{f}.png'
    u = str(team.get('teamIconUrl') or '')
    return u if re.match(r'^https://upload\.wikimedia\.org/[^\s"\'<>]+$', u) else None


def ol_match(m, lg, name):
    """OpenLigaDB match -> result dict, or None when it is not a clean finished result."""
    if not m.get('matchIsFinished'): return None
    res = m.get('matchResults') or []
    fin = next((r for r in res if r.get('resultTypeID') == 2), None)
    ht = next((r for r in res if r.get('resultTypeID') == 1), None)
    if not fin or fin.get('pointsTeam1') is None or fin.get('pointsTeam2') is None: return None
    t1, t2 = m.get('team1') or {}, m.get('team2') or {}
    goals = sorted(m.get('goals') or [], key=lambda g: (g.get('matchMinute') or 0, g.get('goalID') or 0))
    # the goals must add up to the final score, otherwise the scorer list is incomplete and is left out
    if goals and (goals[-1].get('scoreTeam1'), goals[-1].get('scoreTeam2')) != (fin['pointsTeam1'], fin['pointsTeam2']): goals = []
    g = (m.get('group') or {})
    rnd = g.get('groupOrderID') if re.search(r'spieltag', str(g.get('groupName') or ''), re.I) else None
    loc = m.get('location') or {}
    return {'source': 'openligadb', 'matchId': m.get('matchID'), 'competition': name, 'league': lg, 'round': rnd,
            'utcDate': m.get('matchDateTimeUTC'), 'venue': (str(loc.get('locationStadium') or '').strip() or None),
            'home': {'id': t1.get('teamId'), 'name': NAMES.get(t1.get('teamId')) or t1.get('teamName'), 'crest': ol_crest(t1)},
            'away': {'id': t2.get('teamId'), 'name': NAMES.get(t2.get('teamId')) or t2.get('teamName'), 'crest': ol_crest(t2)},
            'score': {'home': fin['pointsTeam1'], 'away': fin['pointsTeam2']},
            'halfTime': {'home': ht['pointsTeam1'], 'away': ht['pointsTeam2']} if ht and ht.get('pointsTeam1') is not None else None,
            'goals': [{'minute': x.get('matchMinute'), 'player': (x.get('goalGetterName') or '').strip() or None,
                       'team': 'home' if x.get('scoringTeamId') == t1.get('teamId') else 'away',
                       'detail': 'own' if x.get('isOwnGoal') else 'pen' if x.get('isPenalty') else None} for x in goals],
            'provider': 'OpenLigaDB', 'providerUrl': f"https://api.openligadb.de/getmatchdata/{m.get('matchID')}"}


FAILED = []   # competitions whose data could not be read in this check (for the status file)


def collect_ol(t):
    out = []
    for lg, name in RESULT_LEAGUES.items():
        try:
            g = int(get(f'{OL}/getcurrentgroup/{lg}').get('groupOrderID') or 1)
            season = next((x.get('season') for x in json.load(open(os.path.join(root, 'data', 'sports.json')))['openData']['leagues'] if x.get('id') == lg), 2026)
            for n in (g - 1, g):
                if n < 1: continue
                for m in get(f'{OL}/getmatchdata/{lg}/{season}/{n}') or []:
                    r = ol_match(m, lg, name)
                    if r: out.append(r)
        except Exception as e:
            FAILED.append(name)
            print(f'sports results: {lg} unavailable ({e})')
    return out


def collect_fd():
    out = []
    for f in glob.glob(os.path.join(root, 'data', 'sports-feed', 'results-*.json')):
        try: d = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        for m in d.get('matches') or []:
            c = str((m.get('competition') or {}).get('id') or '')
            s = m.get('score') or {}
            if c not in FD_COMPS or m.get('status') != 'FT' or s.get('home') is None or s.get('away') is None: continue
            ht = s.get('halfTime') or {}
            out.append({'source': 'football-data', 'matchId': m.get('id'), 'competition': FD_COMPS[c], 'league': c,
                        'round': (m.get('round') or {}).get('matchday') if isinstance(m.get('round'), dict) else None,
                        'utcDate': m.get('utcDate'), 'venue': m.get('venue'),
                        'home': {k: (m.get('home') or {}).get(k) for k in ('id', 'name', 'crest')},
                        'away': {k: (m.get('away') or {}).get(k) for k in ('id', 'name', 'crest')},
                        'score': {'home': s['home'], 'away': s['away']},
                        'halfTime': {'home': ht['home'], 'away': ht['away']} if ht.get('home') is not None else None,
                        'goals': [], 'provider': 'football-data.org', 'providerUrl': f"https://api.football-data.org/v4/matches/{m.get('id')}"})
    return out


def date_txt(lang, d):
    m = MONTHS[lang][d.month - 1]
    return f'{d.day} {m}' if lang != 'de' else f'{d.day}. {m}'


def texts(r, lang):
    L = T[lang]
    k = parse(r['utcDate']).astimezone(EAT)
    h, a = r['home']['name'], r['away']['name']
    sh, sa = r['score']['home'], r['score']['away']
    rt = L['r'].format(n=r['round']) if r.get('round') else ''
    vt = L['v'].format(v=r['venue']) if r.get('venue') else ''
    base = {'c': r['competition'], 'r': rt, 'v': vt, 'd': date_txt(lang, k), 'h': h, 'a': a}
    if sh == sa:
        title = L['draw'].format(s=f'{sh}-{sa}', **base); summ = L['sdraw'].format(s=f'{sh}-{sa}', **base)
    else:
        w, l, s = (h, a, f'{sh}-{sa}') if sh > sa else (a, h, f'{sa}-{sh}')
        title = L['win'].format(w=w, l=l, s=s, **base); summ = L['swin'].format(w=w, l=l, s=s, **base)
    body = []
    if r.get('halfTime'): body.append(L['ht'].format(x=f"{r['halfTime']['home']}-{r['halfTime']['away']}"))
    if r.get('goals'):
        parts = []
        for g in r['goals']:
            if not g.get('player') or g.get('minute') is None: parts = None; break
            d = f" ({L[g['detail']]})" if g.get('detail') else ''
            parts.append(f"{g['minute']}' {g['player']}{d}")
        body.append(f"{L['goals']} {', '.join(parts)}." if parts else L['nogoals'])
    elif sh + sa > 0: body.append(L['nogoals'])
    body.append(L['src'].format(p=r['provider']))
    alt = ALT[lang].format(h=h, a=a, x=f'{sh}-{sa}')
    return {'title': title, 'summary': summ, 'body': '\n'.join(body), 'imageAlt': alt}


def article(r, at):
    k = parse(r['utcDate']).astimezone(EAT)
    so = texts(r, 'so')
    doc_id = f"{k.date().isoformat()}-natiijo-{slug(r['home']['name'])}-{slug(r['away']['name'])}"
    n = {'id': doc_id, 'category': 'Ciyaaraha', 'section': 'sports', 'sport': 'football',
         'source': r['provider'], 'sourceUrl': r['providerUrl'], 'title': so['title'], 'summary': so['summary'], 'body': so['body'],
         'publishedAt': at.isoformat(), 'timeVerified': True, 'image': None, 'imageAlt': so['imageAlt'], 'imageKind': 'result-card',
         'imageCredit': 'Wartabiye TV', 'imageLicense': 'Kaarka natiijada (crests: football-data.org / OpenLigaDB)',
         'result': {k2: r[k2] for k2 in ('competition', 'round', 'utcDate', 'venue', 'home', 'away', 'score', 'halfTime', 'goals', 'provider', 'source', 'matchId')},
         'breaking': False, 'important': False, 'by': 'auto-results', 'published': True}
    for lang in LANGS:
        t = texts(r, lang); t['status'] = 'auto'; t['hash'] = text_hash(t); n[lang] = t
    return n


def existing_sports(days=3):
    out, t = [], now()
    for f in glob.glob(os.path.join(NEWS, '*.json')):
        try: n = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        if n.get('category') != 'Ciyaaraha': continue
        p = parse(n.get('publishedAt'))
        if p and (t - p).total_seconds() < days * 86400:
            out.append(' '.join(str(n.get(k) or '') for k in ('title', 'summary', 'originalTitle')).lower())
    return out


def key_words(name):
    w = [x for x in re.split(r'[\s.\-/]+', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()) if len(x) > 3 and x not in ('borussia', 'united', 'city', 'real', 'sporting', 'club')]
    return w or [name.lower()]


def already_reported(r, texts_):
    s = f"{r['score']['home']}-{r['score']['away']}", f"{r['score']['away']}-{r['score']['home']}"
    for t in texts_:
        tt = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
        if any(w in tt for w in key_words(r['home']['name'])) and any(w in tt for w in key_words(r['away']['name'])) and any(x in tt for x in s):
            return True
    return False


def plan(results, t, known_ids, texts_):
    keep, seen = [], set()
    for r in results:
        k = parse(r.get('utcDate'))
        if not k or not r['home'].get('name') or not r['away'].get('name'): continue
        age = (t - k).total_seconds() / 60
        if age < SETTLE_MIN or age > MAX_AGE_H * 60: continue
        n = article(r, t)
        if n['id'] in seen or n['id'] in known_ids or os.path.exists(os.path.join(NEWS, n['id'] + '.json')) or already_reported(r, texts_): continue
        seen.add(n['id']); keep.append(n)
    return keep


def known_ids():
    """every article id the site has ever had, deleted and unpublished ones included (git history of data/news)"""
    import subprocess
    ids = {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(NEWS, '*.json'))}
    try:
        log = subprocess.run(['git', 'log', '--format=', '--name-only', '--diff-filter=AD', '--', 'data/news/'], cwd=root, capture_output=True, text=True, timeout=60).stdout
        ids |= {os.path.basename(x)[:-5] for x in log.split() if x.endswith('.json')}
    except Exception as e:
        print('sports results: git history unavailable,', e)
    return ids


def run(dry=False):
    t = now()
    results = collect_ol(t) + collect_fd()
    new = plan(results, t, known_ids(), existing_sports())
    for n in new:
        if dry: print('would write', n['id'], '|', n['title']); continue
        with open(os.path.join(NEWS, n['id'] + '.json'), 'w', encoding='utf-8') as f:
            json.dump(n, f, ensure_ascii=False, indent=2); f.write('\n')
        print('wrote', n['id'], '|', n['title'])
    print(f'sports results: {len(results)} finished matches in the data, {len(new)} new report(s)')
    if not dry:
        write_status(t, results, new)
    return new


STATUS = os.environ.get('SPORTS_RESULTS_STATUS') or os.path.join(root, 'data', 'world', 'sports-results-status.json')


def write_status(t, results, new):
    """the last check, for /admin/ and the owner: when the data was read, what failed, what was published"""
    try: s = json.load(open(STATUS, encoding='utf-8'))
    except Exception: s = {}
    at = t.isoformat(timespec='seconds')
    comps = list(RESULT_LEAGUES.values()) + (sorted({r['competition'] for r in results if r.get('source') == 'football-data'}) or [])
    ok = [c for c in RESULT_LEAGUES.values() if c not in FAILED]
    day = t.strftime('%Y-%m-%d')
    days = s.get('days', {}); days[day] = days.get(day, 0) + len(new)
    recent = ([{'at': at, 'id': n['id'], 'title': n['title'], 'source': n.get('result', {}).get('provider') or n.get('source')} for n in new]
              + s.get('recent', []))[:40]
    out = {'about': 'Automatic match-result reports (tools/sports_results.py), checked every 5 minutes. Africa/Nairobi times.',
           'lastCheckAt': at, 'lastSuccessAt': at if ok else s.get('lastSuccessAt'),
           'dataSources': {'OpenLigaDB (open data)': ok, 'football-data.org': 'on' if glob.glob(os.path.join(root, 'data', 'sports-feed', 'results-*.json')) else 'off (needs the secret FOOTBALL_DATA_TOKEN)'},
           'failed': list(FAILED), 'competitions': comps, 'finishedMatchesInData': len(results), 'newReports': len(new),
           'lastReportAt': at if new else s.get('lastReportAt'), 'reportsPerDay': dict(sorted(days.items())[-14:]), 'recent': recent}
    try:
        with open(STATUS, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    except Exception as e:
        print('sports results: status not saved,', e)


def self_test():
    from translations import numbers
    t = datetime.datetime(2026, 11, 9, 12, 0, tzinfo=EAT)
    m = {'matchID': 1, 'matchIsFinished': True, 'matchDateTimeUTC': '2026-11-08T16:30:00Z', 'group': {'groupName': '9. Spieltag', 'groupOrderID': 9},
         'team1': {'teamId': 40, 'teamName': 'FC Bayern München', 'teamIconUrl': 'https://i.imgur.com/x.png'}, 'team2': {'teamId': 7, 'teamName': 'Borussia Dortmund'},
         'matchResults': [{'resultTypeID': 1, 'pointsTeam1': 1, 'pointsTeam2': 0}, {'resultTypeID': 2, 'pointsTeam1': 2, 'pointsTeam2': 1}],
         'goals': [{'goalID': 1, 'matchMinute': 12, 'goalGetterName': 'H. Kane', 'scoringTeamId': 40, 'isPenalty': True, 'scoreTeam1': 1, 'scoreTeam2': 0},
                   {'goalID': 2, 'matchMinute': 70, 'goalGetterName': 'J. Musiala', 'scoringTeamId': 40, 'scoreTeam1': 2, 'scoreTeam2': 0},
                   {'goalID': 3, 'matchMinute': 88, 'goalGetterName': 'S. Guirassy', 'scoringTeamId': 7, 'scoreTeam1': 2, 'scoreTeam2': 1}],
         'location': {'locationStadium': 'Allianz Arena'}}
    r = ol_match(m, 'bl1', 'Bundesliga')
    assert r['home']['name'] == 'Bayern Munich' and r['home']['crest'] == FD_CREST + '5.png' and r['away']['crest'] == FD_CREST + '4.png', r
    n = article(r, t)
    assert n['id'] == '2026-11-08-natiijo-bayern-munich-borussia-dortmund', n['id']
    assert n['title'] == 'Bundesliga: Bayern Munich oo 2-1 ku garaacday Borussia Dortmund', n['title']
    assert "12' H. Kane (rigoore)" in n['body'] and 'Qeybtii hore waxay ku dhammaatay 1-0.' in n['body'], n['body']
    for lang in LANGS:
        for f in ('title', 'summary', 'body', 'imageAlt'):
            assert numbers(n[lang][f]) == numbers(n[f]), (lang, f, n[lang][f], n[f])
    assert n['en']['title'] == 'Bundesliga: Bayern Munich beat Borussia Dortmund 2-1'
    # away win and draw
    m2 = dict(m, matchResults=[{'resultTypeID': 2, 'pointsTeam1': 0, 'pointsTeam2': 3}], goals=[])
    assert 'Borussia Dortmund oo 3-0 ku garaacday Bayern Munich' in article(ol_match(m2, 'bl1', 'Bundesliga'), t)['title']
    m3 = dict(m, matchResults=[{'resultTypeID': 2, 'pointsTeam1': 1, 'pointsTeam2': 1}], goals=[])
    a3 = article(ol_match(m3, 'bl1', 'Bundesliga'), t)
    assert a3['title'] == 'Bundesliga: Bayern Munich iyo Borussia Dortmund oo 1-1 barbar dhacay' and 'magacyada goolasha' in a3['body']
    # goals that do not add up to the score are not listed
    m4 = dict(m, matchResults=[{'resultTypeID': 2, 'pointsTeam1': 3, 'pointsTeam2': 1}])
    assert ol_match(m4, 'bl1', 'Bundesliga')['goals'] == []
    # not finished / no result -> nothing
    assert ol_match(dict(m, matchIsFinished=False), 'bl1', 'x') is None and ol_match(dict(m, matchResults=[]), 'bl1', 'x') is None
    # timing: too early, too old, ok; duplicates
    early = dict(r, utcDate=(t - datetime.timedelta(minutes=100)).isoformat())
    old = dict(r, utcDate=(t - datetime.timedelta(hours=31)).isoformat())
    ok = dict(r, utcDate=(t - datetime.timedelta(hours=3)).isoformat())
    assert [x['id'] for x in plan([early, old], t, set(), [])] == []
    assert len(plan([ok, ok], t, set(), [])) == 1
    nid = article(ok, t)['id']
    assert plan([ok], t, {nid}, []) == [], 'an id ever used (deleted too) is never written again'
    assert plan([ok], t, set(), ['premier: bayern munchen oo 2-1 ku garaacday dortmund']) == [], 'already reported by the news task'
    assert len(plan([ok], t, set(), ['bayern 3-0 dortmund'])) == 1
    print('SPORTS RESULTS OK')


if __name__ == '__main__':
    if sys.argv[1:2] == ['test']: self_test()
    else: run(dry='--dry' in sys.argv)
