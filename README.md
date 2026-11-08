# Wartabiye TV

Website wararka Soomaaliga ah. Bogga public-ka ah waxaa lagu martigeliyaa GitHub Pages (bilaash).

| Qayb | Waxa ay tahay |
|---|---|
| `index.html`, `assets/` | Bogga (naqshadda Wartabiye TV): `app.js` (bogagga, raadinta, kaydsan, wadaagista), `site.css`, `i18n.js` (9 luqadood) |
| `data/news/<id>.json` | War kasta fayl gaar ah (maamulka iyo hawsha wararka (08:00 iyo 18:00) ayaa qora) → `tools/build_news.py` → `data/news.json` |
| `data/ads/`, `data/pages.json` | Xayeysiisyada iyo boggaga macluumaadka (maamulka ayaa qora) |
| `tools/build_pages.py` | `war/<id>.html`, boggaga qaybaha (`ciyaaraha/`, `caalamka/` …), `sitemap.xml`, `rss.xml` |
| `tools/make_thumbs.py` | Sawirro yaryar 480px webp (`img/news/w480/`) |
| `admin/`, `admin/codsiyada/` | Maamulka (Sveltia CMS, login GitHub) iyo maamulka gaarka ah ee codsiyada xayeysiiska (repo private) |
| `img/news/` | Sawirrada wararka (Wikimedia Commons / VOA, liisan sharci ah) |
| `tools/translations.py` | Turjumaadda wararka (en/ar/fr/nl/it/de/tr): liiska kuwa maqan, ku darid aan waxba dib u qorin, hubin |
| `tools/lang_test.js` | Tijaabada badhanka luqadda (9 luqadood, desktop + mobile, RTL) |
| `tools/check_site.py` | Hubinta: JSON sax ah, taariikh sax ah, URL aan labanlaabmin, sawir kasta wuu jiraa, qaybaha iyo xayeysiisyada |
| `tools/live_test.js` | Tijaabada browser-ka: bogga hore, war kasta, qaybaha, Ciyaaraha, Caalamka, Xayeysiimaha, boggaga |
| `assets/media.js`, `assets/media-i18n.js` | Muuqaal Wararka (`#muuqaal`, `muuqaal/<id>.html`), LIVE TV (`#toos`), Ciyaaraha Toos (`#ciyaaraha-toos`), 9 luqadood |
| `data/videos/`, `data/live.json`, `data/sports.json` | Muuqaallada, baahinta tooska ah iyo jadwalka, adeegga xogta ciyaaraha iyo baahinta xuquuqda la haysto (maamulka ayaa qora) |
| `tools/live_status.py`, `.github/workflows/live-status.yml` | Xaqiijinta LIVE: YouTube Data API (secret `YOUTUBE_API_KEY`) → `data/live-status.json` |
| `workers/sports-api/` | Proxy Cloudflare oo furaha xogta ciyaaraha qariya (football-data.org / API-Football) |
| `tools/media_test.py`, `tools/media_test.js` | Tijaabooyinka muuqaalka, LIVE iyo ciyaaraha (desktop + mobile) |
| `.github/workflows/check-news.yml` | GitHub Actions: hubinta mar kasta oo wax la shubo iyo 10:20 + 20:20 Nairobi (kadib cusbooneysiin kasta) |

## Cusbooneysiinta maalinlaha
Hawl jadwal ah oo Claude ah ayaa socota laba jeer maalintii, **08:00 iyo 18:00 (Africa/Nairobi)** = 05:00 iyo 15:00 UTC, cloud-ka Anthropic dhexdiisa (laptop looma baahna).
Waxay ururisaa wararka la hubiyey, waxay soo dejisaa sawirro sharci ah, kadibna `data/news.json` iyo `img/news/` ayay ku shubtaa repo-gan.
GitHub Pages ayaa si toos ah u cusbooneysiiya bogga.

Orod kasta wuxuu qaadaa oo keliya wararka la daabacay tan iyo cusbooneysiintii u dambeysay ee guulaysatay (`lastRunAt` ee `data/status.json`). Nuqul lama daabaco: `tools/known_sources.py` wuxuu liis gareeyaa war kasta oo bogga weligiis ku jiray, kuwa aad tirtirtay ama qabyo ka dhigtay ku jiraan, si aan dib loogu soo celin. War aan sawir sharci ah lahayn wuxuu ku sugaa /admin/ → **Sugaya sawir**.

Jadwalka keliya ee wararka ururiya waa hawsha Claude. GitHub Actions ma laha jadwal wararka ururiya (kaliya daabacaad marka wax la shubo iyo hubin), sidaa darteed orod labanlaab ah ma dhaco.

## Wararka Caalamka: siddeed ilood
`data/world/sources.json` (lagu beddeli karo /admin/ → **Wararka Caalamka: xaaladda iyo ilaha**) waa siddeedda ilood ee Wararka Caalamka: Türkiye Today, Daily Sabah, CNN, Euronews, IGAD iyo saddex ilood oo la sugayo cinwaankooda.
1. `.github/workflows/world-feeds.yml` (07:20 iyo 17:20 Nairobi) wuxuu akhriyaa RSS / news sitemap / bogga isha kasta (robots.txt waa la ixtiraamaa), wuxuu furaa maqaal kasta (canonical URL, waqtiga asalka ah, sawirka Open Graph iyo cidda sawirka leh), wuxuu saaraa nuqullada, kadibna liiska wuxuu dhigaa branch-ka `world-feed`. Waxba ma daabaco.
2. `tools/world_news.py dedup` wuxuu isbarbardhigaa URL-ka, canonical URL-ka, cinwaanka, qoraalka, magacyada (higaad kasta), meelaha iyo taariikhda, isagoo la barbardhigaya warar kasta oo bogga weligiis ku jiray (kuwa la tirtiray iyo qabyada ku jiraan). Hal war oo keliya ayaa dhacdo kasta laga daabacaa; ilaha kale waxay galaan `alsoReportedBy`. Tijaabo: `python3 tools/world_news_test.py`.
3. Hawsha Claude (08:00 iyo 18:00) waxay qortaa warka Soomaali iyo 7 turjumaad, waxay raadisaa sawir sharci ah (sawirrada daabacayaasha iyo wakaaladaha AP/AFP/Reuters/Getty lama isticmaalo), haddii aan la helinna warku wuxuu galaa **Sugaya sawir**. Kadib `tools/world_news.py status` wuxuu qoraa `data/world/status.json` (ilaha shaqeeya, tirooyinka, nuqullada, khaladaadka) oo ka muuqda /admin/.
