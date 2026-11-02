# Hagaha maamulka Wartabiye TV

Dashboard-ka maamulka: **https://mahadupdalla.github.io/wartabiye-tv/admin/**

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

**Boggaga (Nagu Saabsan, Anshaxa, Saxitaannada, Asturnaanta, Siyaasadda Xayeysiiska)**
- Qoraal kasta 8 luqadood. Beddel kadibna **Save**.

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

## Luqadaha (Soomaali, English, العربية, Français, Nederlands, Italiano, Deutsch, Türkçe)

Booqdayaashu waxay luqadda ka doortaan badhanka calanka leh ee **midigta sare**. Soomaaligu waa luqadda caadiga ah; doorashada booqde kasta browser-kiisa ayaa xusuusta. Carabigu wuxuu u socdaa midig ilaa bidix (RTL).

- **War kasta** wuxuu leeyahay toddoba qaybood oo laalaab ah oo hoose: 🇬🇧 English, 🇸🇦 العربية, 🇫🇷 Français, 🇳🇱 Nederlands, 🇮🇹 Italiano, 🇩🇪 Deutsch, 🇹🇷 Türkçe. Fur, beddel cinwaanka/soo koobidda/qoraalka, kadibna **Save**.
- Marka aad saxdo turjumaad otomaatig ah, **Xaaladda** u beddel **Gacan**. Bogga wuxuu ka saarayaa calaamadda "si otomaatig ah ayaa loo turjumay".
- **Eeg luqad kasta:** editor-ka ⋮ → **View on Live Site** wuxuu furaa warka bogga (xitaa qabyo), kadibna luqadda ka beddel midigta sare. Ama ku dar `?lang=en`, `?lang=ar`, `?lang=fr`, `?lang=nl`, `?lang=it`, `?lang=de`, `?lang=tr` link-ga bogga.
- **Hawsha 08:00 / 18:00** waxay turjuntaa wararka cusub (Claude ayaa turjuma, adeeg lacag ah lama isticmaalo). Kaliya waxay buuxisaa turjumaad **maqan**; waligeed ma beddesho turjumaad jirta ama mid aad saxday. Si ay mar kale u turjunto, faaruqi cinwaanka luqaddaas.
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

## Hawsha 08:00 iyo 18:00

Hawsha socota maalin kasta 08:00 iyo 18:00 (Nairobi) waxay **kaliya ku daraysaa wararka cusub** (fayl cusub mid kasta) iyo turjumaadaha maqan. Waligeed ma beddesho, ma tirtirto, mana dib u qorto war jira, turjumaad jirta ama dejintaada. Sidaas darteed wax-ka-beddelkaaga gacanta waa ammaan. War aad tirtirto ama qabyo ka dhigto dib looma soo celiyo.

**Sugaya sawir:** war aan lahayn sawir u gaar ah oo sharci ah lama daabaco. Wuxuu ku jiraa /admin/ → Wararka → filter-ka **Sugaya sawir**. Si aad u daabacdo: ku dar sawir (iyo cidda leh iyo ruqsadda), dami "Sugaya sawir", shid "La daabacay", kadibna **Save**.

## Kharash

Dhammaan waa bilaash: GitHub Pages, Web3Forms (qorshaha bilaashka ah), GitHub Actions (repo public ah = daqiiqado aan xad lahayn), Sveltia CMS (MIT, bilaash) iyo token-ka GitHub. Wax adeeg lacag ah lama isticmaalin.
