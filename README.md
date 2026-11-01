# Wartabiye TV

Website wararka Soomaaliga ah. Bogga public-ka ah waxaa lagu martigeliyaa GitHub Pages (bilaash).

| Qayb | Waxa ay tahay |
|---|---|
| `index.html` | Bogga (naqshadda Wartabiye TV, aan la beddelin) |
| `data/news.json` | Dhammaan wararka (keyd joogto ah, taariikhdu waxay ku jirtaa git) |
| `img/news/` | Sawirrada wararka (Wikimedia Commons / VOA, liisan sharci ah) |
| `tools/translations.py` | Turjumaadda wararka (en/ar/fr): liiska kuwa maqan, ku darid aan waxba dib u qorin, hubin |
| `tools/lang_test.js` | Tijaabada badhanka luqadda (4 luqadood, desktop + mobile, RTL) |
| `tools/check_site.py` | Hubinta: JSON sax ah, taariikh sax ah, URL aan labanlaabmin, sawir kasta wuu jiraa |
| `.github/workflows/check-news.yml` | GitHub Actions: hubinta mar kasta oo wax la shubo iyo 10:20 + 20:20 Nairobi (kadib cusbooneysiin kasta) |

## Cusbooneysiinta maalinlaha
Hawl jadwal ah oo Claude ah ayaa socota laba jeer maalintii, **08:00 iyo 18:00 (Africa/Nairobi)** = 05:00 iyo 15:00 UTC, cloud-ka Anthropic dhexdiisa (laptop looma baahna).
Waxay ururisaa wararka la hubiyey, waxay soo dejisaa sawirro sharci ah, kadibna `data/news.json` iyo `img/news/` ayay ku shubtaa repo-gan.
GitHub Pages ayaa si toos ah u cusbooneysiiya bogga.

Orod kasta wuxuu qaadaa oo keliya wararka la daabacay tan iyo cusbooneysiintii u dambeysay ee guulaysatay (`lastRunAt` ee `data/status.json`). Nuqul lama daabaco: `tools/known_sources.py` wuxuu liis gareeyaa war kasta oo bogga weligiis ku jiray, kuwa aad tirtirtay ama qabyo ka dhigtay ku jiraan, si aan dib loogu soo celin. War aan sawir sharci ah lahayn wuxuu ku sugaa /admin/ → **Sugaya sawir**.

Jadwalka keliya ee wararka ururiya waa hawsha Claude. GitHub Actions ma laha jadwal wararka ururiya (kaliya daabacaad marka wax la shubo iyo hubin), sidaa darteed orod labanlaab ah ma dhaco.
