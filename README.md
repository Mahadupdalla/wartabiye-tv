# Wartabiye TV

Website wararka Soomaaliga ah. Bogga public-ka ah waxaa lagu martigeliyaa GitHub Pages (bilaash).

| Qayb | Waxa ay tahay |
|---|---|
| `index.html`, `assets/` | Bogga (naqshadda Wartabiye TV): `app.js` (bogagga, raadinta, kaydsan, wadaagista), `site.css`, `i18n.js` (4 luqadood) |
| `data/news/<id>.json` | War kasta fayl gaar ah (maamulka iyo hawsha 06:00 ayaa qora) → `tools/build_news.py` → `data/news.json` |
| `data/ads/`, `data/pages.json` | Xayeysiisyada iyo boggaga macluumaadka (maamulka ayaa qora) |
| `tools/build_pages.py` | `war/<id>.html`, boggaga qaybaha (`ciyaaraha/`, `caalamka/` …), `sitemap.xml`, `rss.xml` |
| `tools/make_thumbs.py` | Sawirro yaryar 480px webp (`img/news/w480/`) |
| `admin/`, `admin/codsiyada/` | Maamulka (Sveltia CMS, login GitHub) iyo maamulka gaarka ah ee codsiyada xayeysiiska (repo private) |
| `img/news/` | Sawirrada wararka (Wikimedia Commons / VOA, liisan sharci ah) |
| `tools/translations.py` | Turjumaadda wararka (en/ar/fr): liiska kuwa maqan, ku darid aan waxba dib u qorin, hubin |
| `tools/lang_test.js` | Tijaabada badhanka luqadda (4 luqadood, desktop + mobile, RTL) |
| `tools/check_site.py` | Hubinta: JSON sax ah, taariikh sax ah, URL aan labanlaabmin, sawir kasta wuu jiraa, qaybaha iyo xayeysiisyada |
| `tools/live_test.js` | Tijaabada browser-ka: bogga hore, war kasta, qaybaha, Ciyaaraha, Caalamka, Xayeysiimaha, boggaga |
| `.github/workflows/check-news.yml` | GitHub Actions: hubinta mar kasta oo wax la shubo iyo 06:45 Nairobi maalin kasta |

## Cusbooneysiinta maalinlaha
Hawl jadwal ah oo Claude ah ayaa socota 06:00 (Africa/Nairobi) maalin kasta, cloud-ka Anthropic dhexdiisa (laptop looma baahna).
Waxay ururisaa wararka la hubiyey, waxay soo dejisaa sawirro sharci ah, kadibna `data/news.json` iyo `img/news/` ayay ku shubtaa repo-gan.
GitHub Pages ayaa si toos ah u cusbooneysiiya bogga.

Orod kasta wuxuu qaadaa wararka la daabacay laga bilaabo 06:00 shalay ilaa hadda, sidaa darteed wararka 06:00 kadib soo baxa lama seego.
