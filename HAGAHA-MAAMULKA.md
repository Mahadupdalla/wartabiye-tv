# Hagaha maamulka Wartabiye TV

Dashboard-ka maamulka: **https://www.wartabiyetv.com/admin/**

## Sida login-ku u shaqeeyo (amniga)

- Login-ku waa **GitHub**. Kaliya akoon leh ogolaansho qoris (write) oo ku jira repo-ga `Mahadupdalla/wartabiye-tv` ayaa wax kaydin kara. Hadda adiga oo kaliya ayaa leh.
- Ma jiro bog diiwaangelin (sign-up). Qof kale wuu furi karaa bogga `/admin/`, laakiin wuxuu arkaa oo kaliya "You don’t have access", wax kalena ma beddeli karo. GitHub ayaa diida qoraal kasta oo aan ka imaan akoon ogolaansho leh. Tan waa la tijaabiyay.
- Ma jiro password, furo (key) ama sir ku jirta koodhka bogga ama GitHub. Tan sidoo kale waa la tijaabiyay.
- Ha u dirin token-kaaga cid kale, ha ku qorin chat, hana gelin fayl. Kaliya waxaad ku dhejisaa sanduuqa login-ka ee dashboard-ka.

## Mar kaliya: samee token-kaaga GitHub

1. Gal GitHub, kadibna fur: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   (link toos ah: https://github.com/settings/personal-access-tokens/new)
2. **Token name:** `Wartabiye admin`. **Expiration:** 90 maalmood (markuu dhaco, mid cusub samee).
3. **Repository access:** dooro *Only select repositories*, kadib dooro `Mahadupdalla/wartabiye-tv` oo kaliya.
4. **Permissions → Repository permissions → Contents:** dooro **Read and write**. Wax kale ha beddelin.
5. Riix **Generate token**, kadibna koobi token-ka (wuxuu ku bilaabmaa `github_pat_`).
6. Fur dashboard-ka, riix **Sign In Using Access Token**, ku dheji token-ka, kadibna riix Enter.

Token-ku wuxuu ku kaydsan yahay browser-kaaga oo kaliya. Kombiyuutar dad kale wadaagaan, ka bax (menu-ga sare ee midig → Sign Out). Haddii aad u malaynayso in token-ku baxay, ka tirtir GitHub (isla bogga tokens) oo samee mid cusub.

Browser: isticmaal Chrome, Edge, Safari ama Firefox oo la cusboonaysiiyay (Chrome 140+, Safari 18.2+). Browser duug ah wuxuu muujinayaa "Your browser is not supported".

## Waxa aad samayn karto

**Wararka**
- **New:** war cusub. Buuxi cinwaanka, soo koobidda, qaybta iyo taariikhda. Sawir: riix *Browse*, kadib *Upload* (sawirka si toos ah ayaa loo yareeyaa oo webp loo beddelaa si mobile-ka ugu dhakhso badnaado).
- **La daabacay:** haddii aad damiso, warku waa *qabyo*. Wuu kaydsan yahay, laakiin bogga kama muuqdo. Shid marka aad diyaar tahay.
- **Preview:** dhinaca midig ee editor-ka ayaa muujinaya warka intaadan kaydin.
- **Beddel:** fur war kasta, beddel cinwaanka, qoraalka ama sawirka, kadibna riix **Save**.
- **Tirtir:** fur warka → ⋮ (sare, midig) → **Delete**.
- **Degdeg (12 saac):** wuxuu warka ku tusaa calaamad DEGDEG ah 12 saac.

- **Qaybta weyn (section):** Soomaaliya, Caalamka ama Ciyaaraha. Haddii aad banaanayso, qaybta (category) ayaa go'aamisa.
- **Ciyaaraha:** dooro **Nooca ciyaarta** (kubadda cagta, orodka, F1 …), **Tartanka** (Premier League, AFCON …) iyo **Nooca warka** (suuq-geynta, warbixin ciyaar, ciyaaryahan, koox). Bogga Ciyaaraha wuxuu ku shaandheeyaa.
- **Caalamka:** dooro **Gobolka** (Afrika, Bariga Dhexe …) iyo **Mawduuca** (siyaasadda, dhaqaalaha, caafimaadka …).
- **Muhiim:** warku wuxuu galaa "Kuwa la akhriyo" 72 saac (shuruud tifaftir, ma aha tiro been ah).
- **La kafaalaqaaday (sponsored):** shid, kuna qor magaca kafaala-qaadaha. Bogga wuxuu muujinayaa calaamad "Xayeysiis".

**Xayeysiisyada (Xayeysiis)**
- **New:** cinwaan, magaca xayeysiiyaha, qoraal gaaban, sawir (iyo sharaxaad sawir), link (https), ama link YouTube.
- **Meelaha:** bogga hore, sidebar, dhex-wararka, gudaha warka, mobile, kaar weyn, video. Xayeysiis kasta wuxuu leeyahay calaamad "Xayeysiis".
- **Taariikhda bilowga/dhammaadka:** xayeysiisku wuxuu muuqdaa kaliya inta u dhaxaysa. **Firfircoon** dami si aad u joojiso; **Delete** si aad u tirtirto.
- Repo-gu waa public: **ha ku qorin** telefoonka, email-ka ama qiimaha xayeysiiyaha halkan. Kuwaas waxay galaan maamulka gaarka ah (hoos eeg).
- **Muuqaal (.mp4):** kaliya muuqaal uu xayeysiiyuhu leeyahay ama oggolaansho laga haysto (ha isticmaalin xayeysiisyada TV-ga ee shirkadaha kale). H.264, 6–30 ilbiriqsi, ugu badnaan 15 MB. Cod la'aan ayuu ku ciyaaraa marka la arko (iPhone iyo Android) wuuna istaagaa qofkii dalbaday dhaqdhaqaaq yar.
- **Qoraalka badhanka:** tusaale "Ballanso hadda". Badhanku wuxuu muuqdaa kaliya haddii link jiro.
- **Eeg ka hor daabacaadda:** dami **Firfircoon**, **Save**, kadib fur `https://www.wartabiyetv.com/admin/xayeysiis/`. Waxaad arkaysaa xayeysiiska meel kasta oo aad dooratay, 9-ka luqadood, iyo hubin (sawir, link https, taariikhaha). Marka uu diyaar yahay, shid **Firfircoon**.
- **Tirakoobka (aragti iyo gujin):** isla bogga `/admin/xayeysiis/` → **Tirakoob**. Marka hore hal mar samee Worker-ka `workers/ad-stats/` (eeg README-ga), kadib **Dejinta → Tirakoobka xayeysiiska** geli cinwaankiisa oo shid. Aragti = kalabar xayeysiiska ayaa shaashadda ka muuqday 1 ilbiriqsi. Cookie, IP iyo aqoonsi booqde lama kaydiyo; kuwa dalbaday "Do Not Track" lama tiriyo.
- **Ogeysiiska Wartabiye TV ee sidebar-ka:** marka xayeysiis lacag leh oo sidebar ah uusan jirin, sidebar-ku wuxuu muujiyaa xayeysiis yar oo Wartabiye TV ah ("Ku Xayeysiiso…"). Dami: **Dejinta → "Dhinaca bannaan: muuji Ku xayeysiiso Wartabiye TV"**.
- Tusaalooyinka bogga **Xayeysiimaha** (TUSAALE / DEMO) waa sawirro furan (Wikimedia Commons) iyo qoraal guud; ma aha xayeysiis dhab ah, lagama muujiyo meelaha kale ee bogga.

**Boggaga (Nagu Saabsan, Anshaxa, Saxitaannada, Asturnaanta, Siyaasadda Xayeysiiska)**
- Qoraal kasta 9 luqadood. Beddel kadibna **Save**.

**Dejinta bogga**
- **Kuwa la akhriyo (trending):** dooro wararka aad rabto; haddii aad banaanayso, bogga wuxuu doortaa degdeg, muhiim (72 saac) iyo kuwa ugu cusub.
- **Baraha bulshada:** link-yada Facebook, TikTok, YouTube.
- **Foomamka:** furaha Web3Forms (hoos eeg).
- **Qiimaha xayeysiiska:** kaliya haddii aad shiddo **Muuji** ayuu bogga ka muuqdaa. Qiime been ah ha qorin.
- Magaalada, hal-ku-dhegga, qoraalka "ku saabsan", footer-ka.
- **Qaybaha** (categories) iyo **menu-ga** (nav links).
- **Ogeysiis:** xariijin buluug ah oo bogga sare ka muuqata (shid/dami).
- **Banner:** sanduuq madaxa bogga ah, oo leh sawir, cinwaan iyo link (shid/dami).
- **Degdeg ticker:** *Toos* (wararka ugu dambeeyay iyo qoraalladaada) ama *Gacan* (kaliya qoraalladaada).
- **Wararka la soo xulay:** kan koowaad wuxuu noqonayaa warka weyn ee bogga hore.
- **Qaybaha bogga hore:** shid/dami wararka waaweyn, liiska cusub, sidebar-ka, barnaamijyada iyo wararka footer-ka.
- **Barnaamijyada:** magac, sharaxaad iyo goor.

## Luqadaha (Soomaali, English, العربية, Français, Nederlands, Italiano, Deutsch, Türkçe, Español)

Booqdayaashu waxay luqadda ka doortaan badhanka calanka leh ee **midigta sare**. Soomaaligu waa luqadda caadiga ah; doorashada booqde kasta browser-kiisa ayaa xusuusta. Carabigu wuxuu u socdaa midig ilaa bidix (RTL).

- **War kasta** wuxuu leeyahay siddeed qaybood oo laalaab ah oo hoose: 🇬🇧 English, 🇸🇦 العربية, 🇫🇷 Français, 🇳🇱 Nederlands, 🇮🇹 Italiano, 🇩🇪 Deutsch, 🇹🇷 Türkçe, 🇪🇸 Español. Fur, beddel cinwaanka/soo koobidda/qoraalka, kadibna **Save**.
- Marka aad saxdo turjumaad otomaatig ah, **Xaaladda** u beddel **Gacan**. Bogga wuxuu ka saarayaa calaamadda "si otomaatig ah ayaa loo turjumay".
- **Eeg luqad kasta:** editor-ka ⋮ → **View on Live Site** wuxuu furaa warka bogga (xitaa qabyo), kadibna luqadda ka beddel midigta sare. Ama ku dar `?lang=en`, `?lang=ar`, `?lang=fr`, `?lang=nl`, `?lang=it`, `?lang=de`, `?lang=tr`, `?lang=es` link-ga bogga.
- **Hawsha wararka (saacad kasta)** waxay turjuntaa wararka cusub (Claude ayaa turjuma, adeeg lacag ah lama isticmaalo). Kaliya waxay buuxisaa turjumaad **maqan**; waligeed ma beddesho turjumaad jirta ama mid aad saxday. Si ay mar kale u turjunto, faaruqi cinwaanka luqaddaas.
- Haddii war aan weli la turjumin, bogga wuxuu muujinayaa qoraalka Soomaaliga oo leh calaamad cad ("weli lama turjumin").
- **Dejinta bogga** waxay leedahay qaybo 🇬🇧/🇸🇦/🇫🇷/🇳🇱/🇮🇹/🇩🇪/🇹🇷 ah: magaalada, hal-ku-dhegga, banner-ka, ogeysiiska, barnaamijyada. Menu-ga iyo lixda qaybood si toos ah ayaa loo turjumaa.

## Codsiyada xayeysiiska iyo fariimaha (gaar)

Foomka **Hadda Dalbo Xayeysiis** iyo foomka **Nala Soo Xiriir** waxay fariimaha u diraan **email-kaaga** iyada oo loo marayo Web3Forms (bilaash: 250 fariin bishii, kaarka bangiga looma baahna). Waxba lagama kaydiyo repo-ga public-ka ah.

1. Tag <https://web3forms.com>, geli email-kaaga, riix **Create Access Key**. Furaha email ayaa laguugu soo diraa.
2. `/admin/` → **Dejinta bogga** → **Foomamka** → ku dheji furaha → **Save**. (Furahani sir ma aha; wuxuu kaliya u oggolaanayaa in fariimo lagu soo diro email-kaaga.)
3. Ilaa furaha la geliyo, foomamku waxay muujinayaan "foomka weli lama furin" iyo email-kaaga link ahaan.

Ilaalinta spam-ka: god-dabin qarsoon (honeypot), hubin waqti (3 ilbiriqsi), hal fariin daqiiqaddii, iyo hubinta beeraha.

**Maamulka gaarka ah ee codsiyada:** `/admin/codsiyada/` wuxuu kaydiyaa codsiyada (xaaladda: cusub, la xiriiray, la oggolaaday, la diiday, dhammaaday), qiimaha la isku afgartay iyo xiriirka xayeysiiyayaasha, **repo private ah** dhexdiisa. Mar kaliya:
1. GitHub-ka ka samee repo cusub oo **Private** ah: `Mahadupdalla/wartabiye-codsiyada`.
2. Token-kaaga GitHub sii fasax repo-gaas (Contents: Read and write).
3. Fur `/admin/codsiyada/`, gal token-ka. Email kasta oo codsi ah halkaas ku dar.

Lacag-bixin online ah lama shidin.

## Goorma ayuu bogga isbeddelaa?

Marka aad riixdo **Save**, GitHub ayaa kaydiya. Workflow-ga **"Daabac bogga"** ayaa hubiya (taariikh, sawir, nuqul, xayeysiisyada), sameeya sawirro yaryar (webp), bog gaar ah war kasta (`war/<id>.html`), `sitemap.xml` iyo `rss.xml`, kadibna bogga cusbooneysiiya. Bogga tooska ahi wuxuu isbeddelaa **1–3 daqiiqo** gudahood. Haddii hubintu fashilanto (tusaale sawir maqan), bogga hore sidiisa ayuu ahaanayaa, GitHub-na wuxuu kuu soo diraa email.

## Hawsha wararka: saacad kasta, 24/7

Hawsha Claude waxay hadda socotaa **saacad kasta, 24 saac, 7 maalmood** (Africa/Nairobi, qiyaastii daqiiqadda :08, 24 orod maalintii; jadwalka claude.ai ma ballanqaado daqiiqad sax ah, orod wuu soo daahi karaa). GitHub Actions wuxuu ilaha akhriyaa saacad kasta qiyaastii :35 (cron `35 * * * *`), orod kasta ka hor. Orod kasta wuxuu qaadaa oo keliya wararka la daabacay tan iyo cusbooneysiintii u dambeysay ee guulaysatay; haddii aan war cusub oo la hubiyay jirin, wararka jira sidooda ayay ahaanayaan, bogga hore wuxuu muujinayaa waqtiga dhabta ah ee hubintii u dambeysay ("La cusbooneysiiyay: … · Wararka waxaa la hubiyaa saacad kasta").

**Dami saacadlaha:** /admin/ → *Ogeysiisyada: Settings …* → **Jadwalka wararka** → dami "Saacad kasta". Kadib kaliya orodyada 08:00 iyo 18:00 ayaa shaqeeya; kuwa kale isla markiiba way joogsadaan (laakiin weli way bilaabmaan oo wax yar ayay isticmaalaan). Si aad gebi ahaanba u beddesho jadwalka: claude.ai → **Scheduled tasks** → "Wartabiye TV – wararka saacad kasta 24/7" → Edit schedule.

**Kharashka Claude:** 24 orod maalintii, halkii 2. Taasi waxay isticmaashaa xadka isticmaalka Claude (usage) qiyaastii 12 jeer ka badan. Haddii xadka la gaaro, orodyadu way istaagaan ilaa xadku dib u furmo (sidii 6 Nofembar dhacday).

Hawshu waxay **kaliya ku daraysaa wararka cusub** (fayl cusub mid kasta) iyo turjumaadaha maqan. Waligeed ma beddesho, ma tirtirto, mana dib u qorto war jira, turjumaad jirta ama dejintaada. Sidaas darteed wax-ka-beddelkaaga gacanta waa ammaan. War aad tirtirto ama qabyo ka dhigto dib looma soo celiyo.

**Sugaya sawir:** war aan lahayn sawir u gaar ah oo sharci ah lama daabaco. Wuxuu ku jiraa /admin/ → Wararka → filter-ka **Sugaya sawir**. Si aad u daabacdo: ku dar sawir (iyo cidda leh iyo ruqsadda), dami "Sugaya sawir", shid "La daabacay", kadibna **Save**.

## Ogeysiisyada (gambaleelka 🔔 iyo push)

**Gambaleelka** (madaxa bogga, desktop iyo mobile) wuxuu muujiyaa wararka la daabacay 7-dii maalmood ee u dambeeyay (sawir, cinwaan, waqtiga daabacaadda, link), ogeysiisyadaada gacanta iyo LIVE TV marka baahinta la xaqiijiyo. Tirada cas = inta aan booqdaha akhrin. Booqdaha wuxuu riixi karaa "Dhammaan akhriyay" ama "Nadiifi"; browser-kiisa ayaa xasuusta. Booqde soo noqday wuxuu arkaa hal banner yar oo keliya marka war cusub jiro. Xogta: `data/notifications.json` (waxaa sameeya `tools/build_notifications.py` daabacaad kasta; kaliya warar la daabacay).

**Ogeysiis gacmeed / Degdeg:** /admin/ → **Ogeysiisyada (gambaleelka iyo push)** → New. Dooro warka la daabacay (ama bogga LIVE TV …), shid "U dir push", shid "Degdeg" kaliya war aad muhiim u ah. Save → 2–4 daqiiqo kadib (marka bogga cusub la daabaco) ayaa la dirayaa. Ogeysiis ku xiran war qabyo ah lama dirayo.

**Push (browser):** booqdaha ayaa riixa gambaleelka → "Shid ogeysiisyada" → kaliya markaas browser-ku oggolaansho ayuu weydiiyaa. Wuxuu dooran karaa qaybaha (Bariga Afrika, Caalamka, Ciyaaraha, LIVE TV); Degdeg had iyo jeer. iPhone/iPad: iOS 16.4+, marka hore "Add to Home Screen". Xadka (/admin/ → *Ogeysiisyada: Settings* → **Settings-ka push**): push caadi ah ugu badnaan 6 maalintii, 90 daqiiqo u dhexeeya, saacadaha aamusnaanta 23:00–06:00; Degdeg ugu badnaan 4 maalintii; war ka da' weyn 6 saac lama diro. Daabacaad kasta: Degdeg isla markiiba + ugu badnaan HAL war caadi ah.

**Xaaladda dirista:** /admin/ → *Ogeysiisyada: Settings …* → **Xaaladda dirista** (waxa la diray, inta loo diray, kuwa lama dirin iyo sababta, tirada dadka is-diiwaangeliyay).

**Diyaarinta push (mar kaliya, ~15 daqiiqo, bilaash):** push wuxuu u baahan yahay adeeg yar oo sirta haya (GitHub Pages sir ma qaadi karo):
1. `workers/push/README.md` raac: Cloudflare (bilaash) → KV → `node make-keys.mjs` → `wrangler secret put VAPID_PRIVATE_JWK` iyo `PUSH_ADMIN_TOKEN` → `wrangler deploy`.
2. GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret** `PUSH_ADMIN_TOKEN` (isla ereyga sirta ah ee 1).
3. /admin/ → **Settings-ka push**: geli cinwaanka Worker-ka iyo VAPID public key, shid "Push waa shidan yahay", Save.
Furaha qarsoon (VAPID_PRIVATE_JWK, PUSH_ADMIN_TOKEN) weligood ha gelin /admin/ ama repo-ga.

## Kharash

Dhammaan waa bilaash: GitHub Pages, Web3Forms (qorshaha bilaashka ah), GitHub Actions (repo public ah = daqiiqado aan xad lahayn), Sveltia CMS (MIT, bilaash) iyo token-ka GitHub. Wax adeeg lacag ah lama isticmaalin.

## Muuqaal Wararka, LIVE TV iyo Ciyaaraha Toos

GitHub Pages kaliya wuxuu bixiyaa faylal; ma noqon karo server baahin toos ah. Sidaa darteed muuqaal kasta wuxuu ka daarmayaa bixiye rasmi ah (YouTube, Vimeo, Dailymotion, Facebook, Cloudflare Stream, link .m3u8) ama fayl .mp4 oo aad leedahay. Bogga waligiis ma muujiyo baahin been ah, tirada daawadayaasha, ama natiijo aan xog rasmi ah ka imaan.

**Shid / dami qaybaha:** /admin/ → *Dejinta bogga → Bogga guud → Qaybaha bogga hore*: `Muuqaal Wararka`, `LIVE TV`, `Ciyaaraha Toos`. Marka la damiyo, menu-ga waa ka baxaa, boggana wuxuu sheegaa in qaybta la xiray.

### Muuqaal Wararka (/admin/ → Muuqaalada)
- **New:** cinwaan, soo koobid, sharaxaad buuxda, qaybta (Soomaaliya, Caalamka, Ciyaaraha, Wareysi, Warbixin, Barnaamij, Baahin hore), luqadda codka, taariikh.
- **Muuqaalka:** link YouTube, AMA link kale oo rasmi ah (Vimeo / Dailymotion / Facebook / Cloudflare Stream), AMA fayl .mp4. Fayl weyn (ka badan 50 MB) GitHub ha gelin: ku shub YouTube ama Vimeo kadibna link-ga geli.
- **Sawirka (thumbnail):** ikhtiyaari; YouTube si toos ah ayuu u keenaa.
- **Muuji bogga hore (Featured):** ilaa 4 muuqaal ayaa bogga hore ka muuqda.
- **Jadwal:** "soo bandhig laga bilaabo" – muuqaalku wuu qarsoon yahay ilaa waqtigaas.
- **Tirtir / qari:** *Delete* ama dami *Daabacan*.
- Turjumaadda (English, العربية, Français …) waa ikhtiyaari; meel banaan = Soomaali.
- Muuqaal qof kale leeyahay: kaliya haddii milkiiluhu oggol yahay embed (YouTube embed) ama oggolaansho qoran aad haysato. Mar kasta qor *Isha* iyo *Cidda leh*.

### Muuqaallada iyo wararka tooska ah ee wakaaladaha (otomaatig, 5 daqiiqo kasta)
/admin/ → *LIVE TV iyo Ciyaaraha Toos → Ilaha Muuqaallada iyo Wararka Tooska* (`data/media-sources.json`). Workflow-ga **Live feeds** (`.github/workflows/live-feeds.yml`) ayaa 5-tii daqiiqaba mar shaqeeya, Claude looma baahna, key-na looma baahna:
- **Muuqaallada (VIDEO NEWS):** muuqaallada cusub ee kanaalada YouTube ee rasmiga ah (BBC News Somali, Al Jazeera English, DW News, FRANCE 24, Associated Press, Reuters, BBC News). Muuqaal waxaa la muujiyaa kaliya marka YouTube xaqiijiyo in milkiiluhu oggol yahay embed. Waxaa lagu daawadaa ciyaartoyga YouTube-ka rasmiga ah; waxba lama soo dejiyo, dib looma shubo. Shorts iyo muuqaal ka da' weyn 7 maalmood lama muujiyo. Muuqaalladaada (Muuqaalada) way ka horreeyaan.
- **Wararka hadda soo dhacaya (LIVE News):** cinwaannada RSS-ka rasmiga ah ee BBC, BBC Somali, Al Jazeera, DW, France 24 iyo UN News: cinwaanka, cidda daabacday, waqtigooda asalka ah iyo link-ga warka buuxa. Qoraalka warka lama koobiyeeyo. Haddii wakaaladdu beddesho cinwaanka, kan cusub ayaa la muujiyaa iyo "la cusboonaysiiyay". Reuters iyo AP RSS furan ma laha (waxay u baahan yihiin heshiis lacag leh: Reuters Connect / AP Media API); muuqaalladooda YouTube ayaa la isticmaalaa.
- **Kanaalada tooska ah:** Al Jazeera English, DW News, FRANCE 24 oo ku jira ciyaartoyga tooska ah ee YouTube. Bogga ma qoro "LIVE" isagoo aan hubin; YouTube ayaa sheegaya haddii kanaalku hadda baahinayo.
- Xogta waxay galaysaa laanta `live-data` (si aysan u buuxin xadka dhismaha GitHub Pages); saacad kasta nuqul ayaa lagu keydiyaa `data/live-feeds/`.
- **Xaaladda ilaha:** https://www.wartabiyetv.com/#ilaha-xaaladda — il kasta: hubintii ugu dambeysay, guushii ugu dambeysay, tirada, waxa ugu cusub iyo khaladka. Haddii xogtu ka duug tahay 30 daqiiqo, bogga Wararka Tooska ah wuxuu si cad u sheegaa.
- Il cusub: ku dar *Kanaal* (YouTube channel ID `UC…`) ama *Ilaha RSS* (link `https://` ee wakaaladda rasmiga ah). Dami *Shid* si aad il u joojiso.

### LIVE TV (/admin/ → LIVE TV iyo Ciyaaraha Toos → LIVE TV)
1. **Link-ga baahinta rasmiga ah:** link-ga YouTube Live-kaaga (ama `https://www.youtube.com/channel/UC…`), ama Vimeo / Facebook Live / Cloudflare Stream / .m3u8.
2. **Sidee loo xaqiijiyaa?**
   - **Otomaatig (la doorbiday, YouTube):** geli *YouTube channel ID* (UC…). Kadibna mar kaliya samee furaha YouTube: Google Cloud Console → samee project → *Enable* "YouTube Data API v3" → *Credentials → Create API key* (ku xir *API restrictions: YouTube Data API v3*). Ku dar GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**, magaca `YOUTUBE_API_KEY`, qiimaha furaha. Furahan waligiis bogga public-ka ah kuma jiro. Workflow-ga `LIVE TV xaqiijin` wuxuu hubiyaa 10-kii daqiiqaba mar; calaamadda LIVE waxay muuqataa kaliya marka YouTube sheego in kanaalkaagu hadda toos yahay (hubin ka yar 60 daqiiqo).
   - **Gacan (bixiye kale):** dooro *Gacan*, shid **Hadda waa toos** oo qor **waqtiga dhammaadka**. LIVE wuu baaba'aa marka waqtigaas la gaaro. Dami marka baahintu dhammaato.
3. **Jadwalka baahinta:** ku dar barnaamij kasta (magac, bilow, dhammaad, luqad). Baahinta YouTube ee jadwalaysan (upcoming) si toos ah ayay ugu soo baxaan habka otomaatigga.
4. **Wada-sheekeysiga:** shid si aad u muujiso chat-ka YouTube Live (kaliya YouTube).
5. Marka aan baahin jirin, bogga wuxuu muujiyaa "Hadda baahin ma jirto", baahinta xigta iyo muuqaalladii ugu dambeeyay.

### Ciyaaraha Toos (/admin/ → LIVE TV iyo Ciyaaraha Toos → Ciyaaraha Toos)
Bogga wuxuu xogta ka helaa saddex il, mid kasta oo sharci ah. Furaha API-ga **bogga lama gelin karo** (qof kasta ayuu arki lahaa).

**1. Xog furan (OpenLigaDB) – hadda shaqaynaysa, key looma baahna.** OpenLigaDB (api.openligadb.de) waa kayd xog kubadda cagta oo furan oo qof kasta si bilaash ah u isticmaali karo. Browser-ka booqdaha ayaa si toos ah u akhriya, sidaa darteed natiijadu waxay cusboonaysaa daqiiqad gudaheed. Horyaallada la dejiyay (8 Nov 2026 la hubiyay inay dhammaystiran yihiin): Champions League, Bundesliga, Europa League, Conference League, 2. Bundesliga, DFB-Pokal. Waxay bixisaa natiijada, goolasha (cidda dhalisay, daqiiqadda, rigoore, is-dhalin), ciyaaraha soo socda, natiijooyinka iyo kala sarreynta. Kaararka, beddelaadda iyo tirakoobku kuma jiraan. OpenLigaDB saacad ciyaareed ma bixiso: ciyaar waxaa loo muujiyaa "Toos" kaliya laga bilaabo bilowga ilaa xogtu sheegto inay dhammaatay (ugu badnaan 150 daqiiqo); haddii ay dhaafto oo aan weli la xaqiijin, waxaa lagu qoraa "Natiijada weli lama xaqiijin". **Julaay kasta** cusboonaysii *Xilliga* (tusaale 2027) iyo gaaban-ka Europa/Conference League (tusaale `uel2027`). Horyaal kale (Premier League, LaLiga) OpenLigaDB-ga si buuxda ugama jiraan, sidaa darteed lama shidin.

**2. football-data.org iyada oo loo marayo GitHub (Premier League, LaLiga, Serie A, Ligue 1) – hal secret oo kaliya.**
1. Is-diiwaangeli bilaash: https://www.football-data.org/client/register → email-ka ayaa lagu soo diraa *API token*.
2. GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**, magaca `FOOTBALL_DATA_TOKEN`, qiimaha token-ka.
3. Workflow-ga *Ciyaaraha xog (sports feed)* wuxuu 10-kii daqiiqaba mar xogta ku keydiyaa `data/sports-feed/`. Bogga wuxuu tartamada si toos ah ugu daraa. Qorshaha bilaashka ah natiijadu way dib u dhici kartaa; ciyaar looma muujiyo "Toos" haddii xogtu ka duug tahay 25 daqiiqo.

**3. Proxy (ikhtiyaari, xog degdeg ah oo qorshe lacag leh):** `workers/sports-api/` (Cloudflare Worker, eeg README-ga). Marka *Cinwaanka adeegga* la geliyo, bogga kaliya proxy-ga ayuu isticmaalaa.

**Halkee lagu daawan karaa:** link-yada rasmiga ah ee telefishinnada xuquuqda leh.
**Baahinta ciyaaraha:** ku dar KALIYA haddii Wartabiye TV haysato xuquuqda baahinta ama oggolaansho qoran. Waa in aad shiddaa *Xuquuqda waa la xaqiijiyay*, qortaa *cidda xuquuqda leh* iyo *oggolaanshaha*. Haddii mid maqan yahay, baahintu ma muuqato. Waligaa ha gelin baahin la xaday ama dib-u-baahin.

Haddii ilaha oo dhan la damiyo, bogga Ciyaaraha Toos wuxuu si daacad ah u sheegaa "Natiijooyinka tooska ah weli lama xirin" wuxuuna muujiyaa macluumaadka daawashada rasmiga ah iyo wararka ciyaaraha.
