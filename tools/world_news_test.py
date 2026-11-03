"""Duplicate-detection tests for tools/world_news.py (real headlines from 2-3 Nov 2026).
  python3 tools/world_news_test.py   -> prints OK or the failing cases"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world_news as w


def item(src, title, desc, at):
    return {'source': src, 'sourceName': src, 'url': f'https://{src}.example/{abs(hash(title))}', 'title': title, 'description': desc, 'publishedAt': at}


CASES = [
    # same event, different publishers and spellings -> duplicate
    ('duplicate', item('dailysabah', "Iotova wins runoff to become Bulgaria's 1st elected woman president",
                       "Iliana Iotova won Bulgaria's presidential runoff, defeating Andrey Gyurov.", '2026-11-02T13:52:00+03:00'),
                  item('turkiyetoday', "Meet Iliana Yotova, Bulgaria's first elected woman president pushing for Russia reset",
                       "Iliana Yotova, 62, won Bulgaria's presidential runoff with 57.6% of the vote, defeating Andrey Gyurov.", '2026-11-02T17:48:00+03:00')),
    ('duplicate', item('dailysabah', 'Iran offers to reopen Hormuz in 2 days as draft US deal circulates',
                       'Iran said it could reopen the Strait of Hormuz within two days if Washington meets its demands, spokesperson Esmaeil Baghaei said.', '2026-11-02T12:49:00+03:00'),
                  item('euronews', 'Iran says it can reopen Hormuz in two days if US meets conditions',
                       "Iran's foreign ministry spokesman Esmaeil Baghaei said Tehran could reopen the Strait of Hormuz within two days if Washington accepts its conditions.", '2026-11-02T14:48:15+03:00')),
    ('duplicate', item('cnn', 'Trump says US is cutting off aid to Israel at year’s end because ‘they don’t need it’',
                       'President Donald Trump said the United States will stop its annual military aid to Israel at the end of 2026.', '2026-11-03T17:21:00+03:00'),
                  item('dailysabah', 'US to stop $3.8B military aid to Israel by end of 2026: Trump',
                       'US President Donald Trump said Washington will end its $3.8 billion yearly military aid to Israel by the end of 2026.', '2026-11-03T17:40:00+03:00')),
    # same ongoing story, separate development -> not a duplicate
    (None, item('euronews', 'US midterm elections 2026: What are they and when will we know the results?',
                'Americans vote on Tuesday in midterm elections for the House and the Senate.', '2026-11-02T16:20:00+03:00'),
           item('euronews', "US strikes Iran's Qeshm Island ahead of midterm elections",
                'The US military struck targets on Qeshm Island in Iran, officials said.', '2026-11-03T07:00:00+03:00')),
    (None, item('dailysabah', "18 killed in Russian strikes in Ukraine's Zaporizhzhia",
                'Russian strikes on Zaporizhzhia killed 18 people, Ukrainian officials said.', '2026-11-02T20:25:00+03:00'),
           item('cnn', 'At least 33 dead after Russia drops nine bombs on a Ukrainian school building',
                'Russian glide bombs hit a school building in Ukraine, killing at least 33 people, officials said.', '2026-11-03T14:26:00+03:00')),
    (None, item('igad', 'IGAD Calls for Stronger Alignment of National and Regional Migration Policies in Djibouti',
                'IGAD took part in a workshop in Djibouti on aligning national and regional migration strategies.', '2026-11-03T12:31:00+03:00'),
           item('igad', 'IGAD Calls for Stronger Coordination and Complementarity in Migration Governance.',
                'IGAD urged member states to coordinate migration governance at a regional meeting in Nairobi.', '2026-11-01T08:18:00+03:00')),
    # unrelated stories with similar-looking headlines -> never merged
    (None, item('cnn', 'Florida weather may impact voters', 'Storms in Florida could affect turnout on election day.', '2026-11-03T18:58:00+03:00'),
           item('dailysabah', '9 killed as business jet crashes into Florida neighborhood', 'A business jet crashed into homes in Florida, killing 9 people.', '2026-11-02T17:25:00+03:00')),
]

fails = []
docs = [x for c in CASES for x in c[1:]]
for x in docs: x['_f'] = w.features(x)
df = {}
for x in docs:
    for t in set(x['_f']['cw']): df[t] = df.get(t, 0) + 1
idf = {t: math.log((1 + len(docs)) / (1 + n)) + 1 for t, n in df.items()}
for want, a, b in CASES:
    got, sc, why = w.compare(a, b, idf)
    ok = (got == 'duplicate') == (want == 'duplicate')
    print(('ok  ' if ok else 'FAIL'), f'{want or "separate":<10} got {got or "separate":<10} {sc:.2f}  {a["title"][:50]} | {b["title"][:50]}')
    if not ok: fails.append(a['title'])
print('OK' if not fails else f'{len(fails)} failing'); sys.exit(1 if fails else 0)
