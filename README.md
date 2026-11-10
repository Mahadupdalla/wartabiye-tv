# Wartabiye TV

Website wararka Soomaaliga ah. Bogga public-ka ah waxaa lagu martigeliyaa GitHub Pages (bilaash).

| Qayb | Waxa ay tahay |
|---|---|
| `index.html`, `assets/` | Bogga (naqshadda Wartabiye TV): `app.js` (bogagga, raadinta, kaydsan, wadaagista), `site.css`, `i18n.js` (9 luqadood) |
| `data/news/<id>.json` | War kasta fayl gaar ah (maamulka iyo hawsha wararka (saacad kasta) ayaa qora) → `tools/build_news.py` → `data/news.json` |
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
| `assets/sports-src.js`, `data/sports-feed/` | Ilaha xogta Ciyaaraha Toos: OpenLigaDB (xog furan, key la'aan) iyo football-data.org oo GitHub Actions (`sports-feed.yml`, secret `FOOTBALL_DATA_TOKEN`) ku keydiyo |
| `tools/live_feeds.py`, `data/media-sources.json`, `.github/workflows/live-feeds.yml` | 5 daqiiqo kasta: muuqaallada kanaalada YouTube ee rasmiga ah (embed la oggol yahay kaliya), cinwaannada RSS-ka wakaaladaha (BBC, BBC Somali, Al Jazeera, DW, France 24, UN News) iyo xaaladda ilaha → laanta `live-data` (saacad kasta nuqul `data/live-feeds/`). Xaaladda: `#ilaha-xaaladda` |
| `tools/live_updates.py` | Wararka Tooska (`#wararka-tooska`) gudaha bogga: 5 daqiiqo kasta, war cusub oo ka yimid RSS-ka wakaaladaha rasmiga ah wuxuu noqdaa warbixin gaaban oo Soomaali ah (iyo 8 turjumaad) oo Wartabiye TV ay ereyadeeda ku qortay, waqtiga isha asalka ah. Isla dhacdo ilo kale ka yimid waxay ku darsamaan warbixinta (lama labanlaabo). Ilaha, link-yada iyo waqtiyada asalka ah: `live-updates.json` (laanta `live-data`) iyo `#ilaha-xaaladda`. Kharashka: secret `ANTHROPIC_API_KEY`, xadka maalinlaha `LIVE_UPDATES_DAILY_USD` (default $1), `LIVE_UPDATES_MODE=off` wuu joojiyaa |
| Natiijooyinka ciyaaraha | Qaybta natiijooyinka dadweynaha waa la xiray (9 Nov 2026): /admin/ → Bogga → "Ciyaaraha Toos" = off. Warbixinnada natiijada (`*-natiijo-*`) iyo xogta kulamada waa la hayaa gudaha (`data/news/`), laakiin bogga kama muuqdaan. Kaararka iyo boggaga wararka ciyaaraha ma muujiyaan magaca isha; isha iyo link-ga waxay ku jiraan maamulka (`attributionRequired: true` = isha waa la muujinayaa) |
| `workers/sports-api/` | Proxy Cloudflare oo furaha xogta ciyaaraha qariya (football-data.org / API-Football) |
| `tools/media_test.py`, `tools/media_test.js` | Tijaabooyinka muuqaalka, LIVE iyo ciyaaraha (desktop + mobile) |
| `.github/workflows/check-news.yml` | GitHub Actions: hubinta mar kasta oo wax la shubo iyo 3-dii saacadoodba mar |
| `assets/notify.js`, `sw.js`, `manifest.webmanifest` | Gambaleelka ogeysiisyada, banner-ka wararka cusub iyo push (browser) |
| `tools/build_notifications.py`, `tools/push_send.py`, `data/alerts/`, `data/notify-settings.json` | Feed-ka gambaleelka (`data/notifications.json`), ogeysiisyada gacanta iyo xeerarka push (kadib marka bogga la daabaco) |
| `workers/push/` | Adeegga push (Cloudflare Worker): furaha VAPID iyo is-diiwaangelinta, sirta kuma jirto repo-ga |
| `mobile/`, `app/` | **App-ka Wartabiye TV** (Android, iPhone iyo web app `/app/`), React Native + Expo. Wuxuu akhriyaa wararka isku midka ah ee bogga, ma laha database u gaar ah. Faahfaahin: `mobile/README.md` |
| `tools/build_app_api.py`, `api/v1/` | Feed-ka app-ka (`meta.json`, `feed/<luqad>.json`, `a/<id>.json`, `ids.json`), waxaa laga dhisaa `data/news.json` mar kasta oo bogga la daabaco (publish.yml). Wax lagu beddelo /admin/ (war cusub, sixid, sawir cusub, qabyo ka dhigis) isla daabacaadda ayuu app-ka ku gaaraa. Ma jiro kharash AI |
| `.github/workflows/mobile-app.yml` | Tijaabooyinka app-ka (isku xirka, 9 luqadood, bogga tooska ah) iyo dhismaha Android (APK + AAB) |
| `tools/notify_test.js` | Tijaabada gambaleelka (desktop + mobile, RTL, link kasta war dhab ah) |

## Cusbooneysiinta saacad kasta
Hawl jadwal ah oo Claude ah ayaa socota **saacad kasta, 24 saac, 7 maalmood (Africa/Nairobi, qiyaastii daqiiqadda :08)**, cloud-ka Anthropic dhexdiisa (laptop looma baahna). Jadwalku ma ballanqaado daqiiqad sax ah.
Waxay ururisaa wararka la hubiyey, waxay soo dejisaa sawirro sharci ah, kadibna `data/news/` iyo `img/news/` ayay ku shubtaa repo-gan.
GitHub Pages ayaa si toos ah u cusbooneysiiya bogga, kadibna gambaleelka iyo push-ka (`tools/push_send.py`). /admin/ → Ogeysiisyada → Jadwalka ayaa saacadlaha dami kara (kaliya 08:00 iyo 18:00).

Orod kasta wuxuu qaadaa oo keliya wararka la daabacay tan iyo cusbooneysiintii u dambeysay ee guulaysatay (`lastRunAt` ee `data/status.json`). Nuqul lama daabaco: `tools/known_sources.py` wuxuu liis gareeyaa war kasta oo bogga weligiis ku jiray, kuwa aad tirtirtay ama qabyo ka dhigtay ku jiraan, si aan dib loogu soo celin. War aan sawir sharci ah lahayn wuxuu ku sugaa /admin/ → **Sugaya sawir**.

Jadwalka keliya ee wararka ururiya waa hawsha Claude. GitHub Actions ma laha jadwal wararka ururiya (kaliya daabacaad marka wax la shubo iyo hubin), sidaa darteed orod labanlaab ah ma dhaco.

## Wararka Caalamka: siddeed ilood
`data/world/sources.json` (lagu beddeli karo /admin/ → **Wararka Caalamka: xaaladda iyo ilaha**) waa siddeedda ilood ee Wararka Caalamka: Türkiye Today, Daily Sabah, CNN, Euronews, IGAD iyo saddex ilood oo la sugayo cinwaankooda.
1. `.github/workflows/world-feeds.yml` (saacad kasta qiyaastii :35, 24/7) wuxuu akhriyaa RSS / news sitemap / bogga isha kasta (robots.txt waa la ixtiraamaa), wuxuu furaa maqaal kasta (canonical URL, waqtiga asalka ah, sawirka Open Graph iyo cidda sawirka leh), wuxuu saaraa nuqullada, kadibna liiska wuxuu dhigaa branch-ka `world-feed`. Waxba ma daabaco.
2. `tools/world_news.py dedup` wuxuu isbarbardhigaa URL-ka, canonical URL-ka, cinwaanka, qoraalka, magacyada (higaad kasta), meelaha iyo taariikhda, isagoo la barbardhigaya warar kasta oo bogga weligiis ku jiray (kuwa la tirtiray iyo qabyada ku jiraan). Hal war oo keliya ayaa dhacdo kasta laga daabacaa; ilaha kale waxay galaan `alsoReportedBy`. Tijaabo: `python3 tools/world_news_test.py`.
3. Hawsha Claude (saacad kasta) waxay qortaa warka Soomaali iyo 7 turjumaad, waxay raadisaa sawir sharci ah (sawirrada daabacayaasha iyo wakaaladaha AP/AFP/Reuters/Getty lama isticmaalo), haddii aan la helinna warku wuxuu galaa **Sugaya sawir**. Kadib `tools/world_news.py status` wuxuu qoraa `data/world/status.json` (ilaha shaqeeya, tirooyinka, nuqullada, khaladaadka) oo ka muuqda /admin/.
