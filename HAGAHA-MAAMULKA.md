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

**Dejinta bogga**
- Magaalada, hal-ku-dhegga, qoraalka "ku saabsan", footer-ka.
- **Qaybaha** (categories) iyo **menu-ga** (nav links).
- **Ogeysiis:** xariijin buluug ah oo bogga sare ka muuqata (shid/dami).
- **Banner:** sanduuq madaxa bogga ah, oo leh sawir, cinwaan iyo link (shid/dami).
- **Degdeg ticker:** *Toos* (wararka ugu dambeeyay iyo qoraalladaada) ama *Gacan* (kaliya qoraalladaada).
- **Wararka la soo xulay:** kan koowaad wuxuu noqonayaa warka weyn ee bogga hore.
- **Qaybaha bogga hore:** shid/dami wararka waaweyn, liiska cusub, sidebar-ka, barnaamijyada iyo wararka footer-ka.
- **Barnaamijyada:** magac, sharaxaad iyo goor.

## Goorma ayuu bogga isbeddelaa?

Marka aad riixdo **Save**, GitHub ayaa kaydiya. Workflow-ga **"Daabac bogga"** ayaa hubiya (taariikh, sawir, nuqul) oo bogga cusbooneysiiya. Bogga tooska ahi wuxuu isbeddelaa **1–3 daqiiqo** gudahood. Haddii hubintu fashilanto (tusaale sawir maqan), bogga hore sidiisa ayuu ahaanayaa, GitHub-na wuxuu kuu soo diraa email.

## Hawsha 06:00

Hawsha maalinlaha ah ee 06:00 waxay **kaliya ku daraysaa wararka cusub** (fayl cusub mid kasta). Waligeed ma beddesho, ma tirtirto, mana dib u qorto war jira ama dejintaada. Sidaas darteed wax-ka-beddelkaaga gacanta waa ammaan.

## Kharash

Dhammaan waa bilaash: GitHub Pages, GitHub Actions (repo public ah = daqiiqado aan xad lahayn), Sveltia CMS (MIT, bilaash) iyo token-ka GitHub. Wax adeeg lacag ah lama isticmaalin.
