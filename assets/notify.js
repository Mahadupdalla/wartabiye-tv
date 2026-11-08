/* Wartabiye TV notification bell, update banner and optional browser push (Web Push).
   Reads data/notifications.json (built by tools/build_notifications.py from PUBLISHED articles and the owner's alerts)
   and the verified LIVE TV status (assets/media.js). Never shows anything that is not a real page of the site.
   What the visitor has read or cleared stays in this browser only (localStorage "wartabiye-nt"); no account, no tracking.
   Push: the browser asks for permission ONLY after the visitor presses "Enable notifications". The subscription is sent to
   the Wartabiye TV push service (a Cloudflare Worker, address in /admin/ -> Ogeysiisyada); it can be turned off here. */
(function(){
  'use strict';
  var T={
    so:{news:'Wararka',bell:'Ogeysiisyada',markAll:'Dhammaan akhriyay',clear:'Nadiifi',empty:'Ogeysiis cusub ma jiro.',lastUpdate:'Cusbooneysiintii u dambeysay: {t}',hourly:'Wararka waxaa la hubiyaa saacad kasta.',
      breaking:'Degdeg',eastAfrica:'Bariga Afrika',world:'Caalamka',sports:'Ciyaaraha',live:'LIVE TV',unread:'{n} aan la akhrin',banner:'{n} war cusub tan iyo booqashadaadii u dambeysay',bannerOne:'War cusub: {t}',
      show:'Eeg',close:'Xir',liveNow:'Hadda waa toos: {t}',pushTitle:'Ogeysiisyada browser-ka',enable:'Shid ogeysiisyada',disable:'Dami ogeysiisyada',
      pushIntro:'Hel wararka muhiimka ah xitaa marka bogga xiran yahay. Browser-ku wuxuu oggolaansho ku weydiinayaa kaliya marka aad badhanka riixdo.',
      pushOn:'Ogeysiisyadu way shidan yihiin. Degdeg had iyo jeer; dooro qaybaha kale:',pushNA:'Ogeysiisyada browser-ka weli lama diyaarin. Wararka cusub waxay ka muuqanayaan gambaleelka.',
      unsupported:'Browser-kan ma taageero ogeysiisyada.',denied:'Ogeysiisyada waa la xannibay. Si aad u oggolaato, fur goobaha (settings) browser-ka ee wartabiyetv.com.',
      ios:'iPhone / iPad (iOS 16.4 ama ka dambe): riix Share (□↑) → "Add to Home Screen", ka fur Wartabiye TV shaashadda hore, kadibna riix "Shid ogeysiisyada".',
      err:'Lama shidi karin: {e}',limits:'Dhowr ogeysiis oo keliya maalintii; Degdeg kaliya ayaa isla markiiba la diraa.',now:'hadda',min:'{n} daqiiqo kahor',hr:'{n} saac kahor',day:'{n} maalin kahor',busy:'Fadlan sug…'},
    en:{news:'News',bell:'Notifications',markAll:'Mark all as read',clear:'Clear',empty:'No new notifications.',lastUpdate:'Last update: {t}',hourly:'News is checked every hour.',
      breaking:'Breaking',eastAfrica:'East Africa',world:'World',sports:'Sport',live:'LIVE TV',unread:'{n} unread',banner:'{n} new stories since your last visit',bannerOne:'New: {t}',
      show:'View',close:'Close',liveNow:'Live now: {t}',pushTitle:'Browser alerts',enable:'Enable notifications',disable:'Turn off notifications',
      pushIntro:'Get important stories even when the site is closed. Your browser asks for permission only after you press the button.',
      pushOn:'Notifications are on. Breaking news always; choose other sections:',pushNA:'Browser alerts are not available yet. New stories still appear in the bell.',
      unsupported:'This browser does not support notifications.',denied:'Notifications are blocked. To allow them, open your browser\'s site settings for wartabiyetv.com.',
      ios:'iPhone / iPad (iOS 16.4 or later): tap Share (□↑) → "Add to Home Screen", open Wartabiye TV from your Home Screen, then tap "Enable notifications".',
      err:'Could not turn on: {e}',limits:'Only a few alerts a day; only breaking news is sent immediately.',busy:'Please wait…'},
    ar:{news:'أخبار',bell:'الإشعارات',markAll:'تحديد الكل كمقروء',clear:'مسح',empty:'لا توجد إشعارات جديدة.',lastUpdate:'آخر تحديث: {t}',hourly:'يتم التحقق من الأخبار كل ساعة.',
      breaking:'عاجل',eastAfrica:'شرق أفريقيا',world:'العالم',sports:'الرياضة',live:'بث مباشر',unread:'{n} غير مقروءة',banner:'{n} أخبار جديدة منذ زيارتك الأخيرة',bannerOne:'جديد: {t}',
      show:'عرض',close:'إغلاق',liveNow:'مباشر الآن: {t}',pushTitle:'تنبيهات المتصفح',enable:'تفعيل الإشعارات',disable:'إيقاف الإشعارات',
      pushIntro:'تلقَّ الأخبار المهمة حتى عندما يكون الموقع مغلقًا. يطلب المتصفح الإذن فقط بعد الضغط على الزر.',
      pushOn:'الإشعارات مفعّلة. الأخبار العاجلة دائمًا؛ اختر أقسامًا أخرى:',pushNA:'تنبيهات المتصفح غير متاحة بعد. تظهر الأخبار الجديدة في الجرس.',
      unsupported:'هذا المتصفح لا يدعم الإشعارات.',denied:'الإشعارات محظورة. للسماح بها افتح إعدادات الموقع wartabiyetv.com في المتصفح.',
      ios:'آيفون / آيباد (iOS 16.4 أو أحدث): اضغط مشاركة (□↑) ← "إضافة إلى الشاشة الرئيسية"، افتح Wartabiye TV من الشاشة الرئيسية، ثم اضغط "تفعيل الإشعارات".',
      err:'تعذّر التفعيل: {e}',limits:'عدد قليل من التنبيهات يوميًا؛ الأخبار العاجلة فقط تُرسل فورًا.',busy:'يرجى الانتظار…'},
    fr:{news:'Actualités',bell:'Notifications',markAll:'Tout marquer comme lu',clear:'Effacer',empty:'Aucune nouvelle notification.',lastUpdate:'Dernière mise à jour : {t}',hourly:'Les actualités sont vérifiées toutes les heures.',
      breaking:'Urgent',eastAfrica:'Afrique de l\'Est',world:'Monde',sports:'Sport',live:'LIVE TV',unread:'{n} non lues',banner:'{n} nouveaux articles depuis votre dernière visite',bannerOne:'Nouveau : {t}',
      show:'Voir',close:'Fermer',liveNow:'En direct : {t}',pushTitle:'Alertes du navigateur',enable:'Activer les notifications',disable:'Désactiver les notifications',
      pushIntro:'Recevez les informations importantes même lorsque le site est fermé. Le navigateur demande l\'autorisation seulement après avoir appuyé sur le bouton.',
      pushOn:'Les notifications sont activées. Les urgences toujours ; choisissez d\'autres rubriques :',pushNA:'Les alertes du navigateur ne sont pas encore disponibles. Les nouveaux articles apparaissent dans la cloche.',
      unsupported:'Ce navigateur ne prend pas en charge les notifications.',denied:'Les notifications sont bloquées. Pour les autoriser, ouvrez les paramètres du site wartabiyetv.com dans votre navigateur.',
      ios:'iPhone / iPad (iOS 16.4 ou plus récent) : touchez Partager (□↑) → « Sur l\'écran d\'accueil », ouvrez Wartabiye TV depuis l\'écran d\'accueil, puis touchez « Activer les notifications ».',
      err:'Activation impossible : {e}',limits:'Quelques alertes par jour seulement ; seules les urgences sont envoyées immédiatement.',busy:'Veuillez patienter…'},
    nl:{news:'Nieuws',bell:'Meldingen',markAll:'Alles als gelezen markeren',clear:'Wissen',empty:'Geen nieuwe meldingen.',lastUpdate:'Laatste update: {t}',hourly:'Het nieuws wordt elk uur gecontroleerd.',
      breaking:'Breaking',eastAfrica:'Oost-Afrika',world:'Wereld',sports:'Sport',live:'LIVE TV',unread:'{n} ongelezen',banner:'{n} nieuwe berichten sinds je laatste bezoek',bannerOne:'Nieuw: {t}',
      show:'Bekijken',close:'Sluiten',liveNow:'Nu live: {t}',pushTitle:'Browsermeldingen',enable:'Meldingen inschakelen',disable:'Meldingen uitschakelen',
      pushIntro:'Ontvang belangrijk nieuws ook als de site gesloten is. Je browser vraagt pas toestemming nadat je op de knop drukt.',
      pushOn:'Meldingen staan aan. Breaking news altijd; kies andere rubrieken:',pushNA:'Browsermeldingen zijn nog niet beschikbaar. Nieuwe berichten verschijnen in de bel.',
      unsupported:'Deze browser ondersteunt geen meldingen.',denied:'Meldingen zijn geblokkeerd. Open de site-instellingen van wartabiyetv.com in je browser om ze toe te staan.',
      ios:'iPhone / iPad (iOS 16.4 of nieuwer): tik op Deel (□↑) → "Zet op beginscherm", open Wartabiye TV vanaf je beginscherm en tik op "Meldingen inschakelen".',
      err:'Inschakelen mislukt: {e}',limits:'Slechts enkele meldingen per dag; alleen breaking news wordt direct verstuurd.',busy:'Even geduld…'},
    it:{news:'Notizie',bell:'Notifiche',markAll:'Segna tutte come lette',clear:'Cancella',empty:'Nessuna nuova notifica.',lastUpdate:'Ultimo aggiornamento: {t}',hourly:'Le notizie vengono controllate ogni ora.',
      breaking:'Ultim\'ora',eastAfrica:'Africa orientale',world:'Mondo',sports:'Sport',live:'LIVE TV',unread:'{n} non lette',banner:'{n} nuove notizie dall\'ultima visita',bannerOne:'Nuovo: {t}',
      show:'Vedi',close:'Chiudi',liveNow:'In diretta ora: {t}',pushTitle:'Avvisi del browser',enable:'Attiva le notifiche',disable:'Disattiva le notifiche',
      pushIntro:'Ricevi le notizie importanti anche quando il sito è chiuso. Il browser chiede il permesso solo dopo che premi il pulsante.',
      pushOn:'Le notifiche sono attive. Ultim\'ora sempre; scegli altre sezioni:',pushNA:'Gli avvisi del browser non sono ancora disponibili. Le nuove notizie compaiono nella campanella.',
      unsupported:'Questo browser non supporta le notifiche.',denied:'Le notifiche sono bloccate. Per consentirle apri le impostazioni del sito wartabiyetv.com nel browser.',
      ios:'iPhone / iPad (iOS 16.4 o successivo): tocca Condividi (□↑) → "Aggiungi alla schermata Home", apri Wartabiye TV dalla schermata Home, poi tocca "Attiva le notifiche".',
      err:'Impossibile attivare: {e}',limits:'Solo pochi avvisi al giorno; solo l\'ultim\'ora viene inviata subito.',busy:'Attendere…'},
    de:{news:'Nachrichten',bell:'Benachrichtigungen',markAll:'Alle als gelesen markieren',clear:'Löschen',empty:'Keine neuen Benachrichtigungen.',lastUpdate:'Letzte Aktualisierung: {t}',hourly:'Die Nachrichten werden stündlich geprüft.',
      breaking:'Eilmeldung',eastAfrica:'Ostafrika',world:'Welt',sports:'Sport',live:'LIVE TV',unread:'{n} ungelesen',banner:'{n} neue Meldungen seit Ihrem letzten Besuch',bannerOne:'Neu: {t}',
      show:'Ansehen',close:'Schließen',liveNow:'Jetzt live: {t}',pushTitle:'Browser-Benachrichtigungen',enable:'Benachrichtigungen aktivieren',disable:'Benachrichtigungen deaktivieren',
      pushIntro:'Erhalten Sie wichtige Meldungen auch bei geschlossener Seite. Der Browser fragt erst nach Ihrer Erlaubnis, wenn Sie auf die Schaltfläche tippen.',
      pushOn:'Benachrichtigungen sind aktiv. Eilmeldungen immer; weitere Rubriken wählen:',pushNA:'Browser-Benachrichtigungen sind noch nicht verfügbar. Neue Meldungen erscheinen in der Glocke.',
      unsupported:'Dieser Browser unterstützt keine Benachrichtigungen.',denied:'Benachrichtigungen sind blockiert. Erlauben Sie sie in den Website-Einstellungen Ihres Browsers für wartabiyetv.com.',
      ios:'iPhone / iPad (iOS 16.4 oder neuer): Teilen (□↑) → „Zum Home-Bildschirm“, Wartabiye TV vom Home-Bildschirm öffnen und dann „Benachrichtigungen aktivieren“ tippen.',
      err:'Aktivierung fehlgeschlagen: {e}',limits:'Nur wenige Hinweise pro Tag; nur Eilmeldungen werden sofort gesendet.',busy:'Bitte warten…'},
    tr:{news:'Haberler',bell:'Bildirimler',markAll:'Tümünü okundu say',clear:'Temizle',empty:'Yeni bildirim yok.',lastUpdate:'Son güncelleme: {t}',hourly:'Haberler her saat kontrol edilir.',
      breaking:'Son dakika',eastAfrica:'Doğu Afrika',world:'Dünya',sports:'Spor',live:'LIVE TV',unread:'{n} okunmamış',banner:'Son ziyaretinizden bu yana {n} yeni haber',bannerOne:'Yeni: {t}',
      show:'Gör',close:'Kapat',liveNow:'Şimdi canlı: {t}',pushTitle:'Tarayıcı bildirimleri',enable:'Bildirimleri aç',disable:'Bildirimleri kapat',
      pushIntro:'Site kapalıyken bile önemli haberleri alın. Tarayıcınız izni yalnızca düğmeye bastıktan sonra ister.',
      pushOn:'Bildirimler açık. Son dakika her zaman; diğer bölümleri seçin:',pushNA:'Tarayıcı bildirimleri henüz kullanılamıyor. Yeni haberler zil simgesinde görünür.',
      unsupported:'Bu tarayıcı bildirimleri desteklemiyor.',denied:'Bildirimler engellendi. İzin vermek için tarayıcınızda wartabiyetv.com site ayarlarını açın.',
      ios:'iPhone / iPad (iOS 16.4 veya üstü): Paylaş (□↑) → "Ana Ekrana Ekle"ye dokunun, Wartabiye TV\'yi ana ekrandan açın, ardından "Bildirimleri aç"a dokunun.',
      err:'Açılamadı: {e}',limits:'Günde yalnızca birkaç bildirim; yalnızca son dakika haberleri hemen gönderilir.',busy:'Lütfen bekleyin…'},
    es:{news:'Noticias',bell:'Notificaciones',markAll:'Marcar todo como leído',clear:'Borrar',empty:'No hay notificaciones nuevas.',lastUpdate:'Última actualización: {t}',hourly:'Las noticias se revisan cada hora.',
      breaking:'Última hora',eastAfrica:'África Oriental',world:'Mundo',sports:'Deportes',live:'LIVE TV',unread:'{n} sin leer',banner:'{n} noticias nuevas desde tu última visita',bannerOne:'Nuevo: {t}',
      show:'Ver',close:'Cerrar',liveNow:'En directo: {t}',pushTitle:'Avisos del navegador',enable:'Activar notificaciones',disable:'Desactivar notificaciones',
      pushIntro:'Recibe las noticias importantes incluso con la web cerrada. El navegador pide permiso solo después de pulsar el botón.',
      pushOn:'Las notificaciones están activadas. Última hora siempre; elige otras secciones:',pushNA:'Los avisos del navegador aún no están disponibles. Las noticias nuevas aparecen en la campana.',
      unsupported:'Este navegador no admite notificaciones.',denied:'Las notificaciones están bloqueadas. Para permitirlas, abre la configuración del sitio wartabiyetv.com en tu navegador.',
      ios:'iPhone / iPad (iOS 16.4 o posterior): toca Compartir (□↑) → "Añadir a pantalla de inicio", abre Wartabiye TV desde la pantalla de inicio y toca "Activar notificaciones".',
      err:'No se pudo activar: {e}',limits:'Solo unos pocos avisos al día; solo la última hora se envía al momento.',busy:'Espera…'}
  };
  var KINDS=['breaking','eastAfrica','world','sports','live'];
  var LSK='wartabiye-nt', POLL_MS=5*60e3, FIRST_WINDOW=24*3600e3;
  var $=function(id){return document.getElementById(id)};
  function L(){var l=document.documentElement.lang;return T[l]?l:'so'}
  function tr(k,o){var s=(T[L()]&&T[L()][k])||T.so[k]||k;return o?s.replace(/\{(\w+)\}/g,function(_,x){return o[x]!=null?o[x]:''}):s}
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
  function ms(t){var d=new Date(t);return isNaN(d)?NaN:d.getTime()}
  function load(){try{var s=JSON.parse(localStorage.getItem(LSK)||'{}');return s&&typeof s==='object'?s:{}}catch(e){return {}}}
  function save(){try{localStorage.setItem(LSK,JSON.stringify(S))}catch(e){}}
  var S=load();var now=Date.now();
  if(!S.first)S.first=now;if(!Array.isArray(S.read))S.read=[];
  var prevVisit=S.lastVisit||0;S.lastVisit=now;save();
  var FEED=null,LIVE=null,ITEMS=[],shownBanner=false,knownIds=null;

  function ago(t){var d=(Date.now()-ms(t))/1000;if(isNaN(d))return '';var l=L();
    if(l==='so'){if(d<90)return tr('now');if(d<3600)return tr('min',{n:Math.round(d/60)});if(d<86400)return tr('hr',{n:Math.round(d/3600)});return tr('day',{n:Math.round(d/86400)})}
    try{var rf=new Intl.RelativeTimeFormat(l==='ar'?'ar-u-nu-latn':l,{numeric:'auto'});if(d<60)return rf.format(0,'second');if(d<3600)return rf.format(-Math.round(d/60),'minute');if(d<86400)return rf.format(-Math.round(d/3600),'hour');return rf.format(-Math.round(d/86400),'day')}catch(e){return new Date(ms(t)).toLocaleString()}}
  function clock(t){try{return new Intl.DateTimeFormat(L()==='ar'?'ar-u-nu-latn':(L()==='so'?'en-GB':L()),{timeZone:'Africa/Nairobi',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(ms(t)))+' EAT'}catch(e){return ''}}
  function txt(it){var x=it.t&&it.t[L()];return x&&x.title?{title:x.title,summary:x.summary||'',so:false}:{title:it.title,summary:it.summary||'',so:L()!=='so'}}
  function added(it){var a=ms(it.addedAt||it.time);return isNaN(a)?0:a}
  function visible(it){return added(it)>(S.cleared||0)}
  function unread(it){return visible(it)&&S.read.indexOf(it.id)<0&&added(it)>S.first-FIRST_WINDOW}
  function href(u){try{return new URL(u,document.baseURI).href}catch(e){return u}}

  // ---------- data ----------
  function fetchFeed(){return fetch('data/notifications.json?v='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
  function liveItem(){if(!LIVE||!LIVE.live)return null;var since=LIVE.since||LIVE.status&&LIVE.status.checkedAt||new Date().toISOString();
    var vid=LIVE.status&&LIVE.status.videoId||(LIVE.pv&&LIVE.pv.id)||since;
    return {id:'live-'+vid,kind:'live',title:tr('liveNow',{t:LIVE.title||'Wartabiye TV'}),summary:'',t:null,url:'toos/',time:since,addedAt:since,live:true}}
  function rebuild(){var list=(FEED&&Array.isArray(FEED.items)?FEED.items:[]).filter(function(i){return i&&i.id&&i.title&&i.url&&KINDS.indexOf(i.kind)>=0&&!isNaN(ms(i.time))});
    var lv=liveItem();ITEMS=(lv?[lv]:[]).concat(list);
    // keep the read list small: only ids that still exist
    var ids=ITEMS.map(function(i){return i.id});S.read=S.read.filter(function(id){return ids.indexOf(id)>=0}).slice(0,200);save()}
  function refresh(first){
    var p=[fetchFeed().then(function(j){FEED=j}).catch(function(e){console.warn('Wartabiye notifications:',e)})];
    if(window.WT_MEDIA&&WT_MEDIA.liveState)p.push(WT_MEDIA.liveState().then(function(s){LIVE=s}).catch(function(){}));
    return Promise.all(p).then(function(){rebuild();badge();if(!panel.hidden)draw();announce(first)})}

  // ---------- bell ----------
  var btn=$('bellBtn');if(!btn)return;
  var badgeEl=btn.querySelector('.badge');
  var panel=el('div','ntpanel');panel.id='ntPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');
  document.body.append(panel);
  function badge(){var n=ITEMS.filter(unread).length;badgeEl.textContent=n>9?'9+':String(n);badgeEl.hidden=!n;
    var lab=tr('bell')+(n?' ('+tr('unread',{n:n})+')':'');btn.setAttribute('aria-label',lab);btn.title=lab;btn.classList.toggle('has',!!n)}
  function place(){var r=btn.getBoundingClientRect();var nav=document.querySelector('nav.menu');var nb=nav?nav.getBoundingClientRect().bottom:r.bottom;
    panel.style.top=Math.max(0,Math.round(nb))+'px';panel.style.left=panel.style.right='';
    if(innerWidth<=640){panel.style.left='0';panel.style.right='0';return}
    if(document.documentElement.dir==='rtl')panel.style.left=Math.max(8,Math.round(r.left))+'px';else panel.style.right=Math.max(8,Math.round(innerWidth-r.right))+'px'}
  function open(v){panel.hidden=!v;btn.setAttribute('aria-expanded',String(v));if(v){draw();place();var f=panel.querySelector('button,a');if(f)f.focus({preventScroll:true})}}
  btn.addEventListener('click',function(e){e.stopPropagation();open(panel.hidden)});
  // (a button inside the panel may already be redrawn and detached: only a click on the page outside closes it)
  document.addEventListener('click',function(e){if(!panel.hidden&&document.contains(e.target)&&!panel.contains(e.target)&&!e.target.closest('#bellBtn'))open(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden){open(false);btn.focus()}});
  window.addEventListener('resize',function(){if(!panel.hidden)place()});
  window.addEventListener('scroll',function(){if(!panel.hidden)place()},{passive:true});

  function markRead(id){if(S.read.indexOf(id)<0){S.read.unshift(id);save()}badge()}
  function draw(){
    panel.innerHTML='';panel.setAttribute('aria-label',tr('bell'));
    var hd=el('div','nthead');hd.append(el('h2',null,tr('bell')));
    var acts=el('div','ntacts');
    var bAll=el('button','ntlink',tr('markAll'));bAll.type='button';bAll.addEventListener('click',function(){ITEMS.forEach(function(i){if(S.read.indexOf(i.id)<0)S.read.unshift(i.id)});save();badge();draw()});
    var bClr=el('button','ntlink',tr('clear'));bClr.type='button';bClr.addEventListener('click',function(){S.cleared=Date.now();S.read=[];save();badge();draw()});
    var bX=el('button','ntx');bX.type='button';bX.setAttribute('aria-label',tr('close'));bX.title=tr('close');bX.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';bX.addEventListener('click',function(){open(false);btn.focus()});
    acts.append(bAll,bClr,bX);hd.append(acts);panel.append(hd);
    var list=ITEMS.filter(visible);
    if(!list.length)panel.append(el('p','ntempty',tr('empty')));
    else{var ul=el('ul','ntlist');list.slice(0,30).forEach(function(it){var li=el('li'+'');var a=el('a','ntitem'+(unread(it)?' unread':'')+' k-'+it.kind);a.href=href(it.url);
      var x=txt(it);var th=el('span','ntth');if(it.thumb&&/^img\//.test(it.thumb)){var im=new Image();im.src=encodeURI(it.thumb);im.alt='';im.loading='lazy';im.decoding='async';th.append(im)}else{th.classList.add('none');th.innerHTML=it.kind==='live'?'<i class="ntlive"></i>':'<img src="img/logo.png" alt="">'}
      var bd=el('span','ntbd');var tag=el('span','nttag',tr(it.tag==='news'?'news':it.kind));bd.append(tag);var h=el('b','nth',x.title);if(x.so){h.lang='so';h.dir='ltr'}bd.append(h);
      var tm=el('time','nttime');tm.dateTime=it.time;tm.textContent=it.live?clock(it.time):ago(it.time);tm.title=clock(it.time);bd.append(tm);
      a.append(th,bd);if(unread(it)){var dot=el('span','ntdot');dot.setAttribute('aria-label',tr('unread',{n:1}));a.append(dot)}
      a.addEventListener('click',function(){markRead(it.id);open(false)});li.append(a);ul.append(li)});panel.append(ul)}
    var ft=el('div','ntfoot');var lu=FEED&&(FEED.lastSuccessAt||FEED.lastRunAt);
    if(lu)ft.append(el('p','ntupd',tr('lastUpdate',{t:clock(lu)+' · '+ago(lu)})));ft.append(el('p','ntupd',tr('hourly')));panel.append(ft);
    panel.append(pushBox());
  }

  // ---------- banner (only for genuinely new content, once) ----------
  var bar=null;
  function banner(text,url){if(bar)bar.remove();bar=el('div','ntbanner');bar.setAttribute('role','status');var p=el('span',null,text);
    var v=el('a','ntbtn',tr('show'));v.href=url?href(url):'#';v.addEventListener('click',function(e){if(!url){e.preventDefault();open(true)}bar.remove();bar=null});
    var x=el('button','ntx');x.type='button';x.setAttribute('aria-label',tr('close'));x.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';x.addEventListener('click',function(){bar.remove();bar=null});
    bar.append(el('i','ntbell'),p,v,x);document.body.append(bar);setTimeout(function(){if(bar){bar.classList.add('out');setTimeout(function(){if(bar){bar.remove();bar=null}},400)}},12000)}
  function announce(first){var ids=ITEMS.map(function(i){return i.id});
    if(first){knownIds=ids;if(shownBanner||!prevVisit)return;
      var fresh=ITEMS.filter(function(i){return unread(i)&&added(i)>prevVisit&&!i.live});
      if(fresh.length){shownBanner=true;var x=txt(fresh[0]);banner(fresh.length===1?tr('bannerOne',{t:x.title}):tr('banner',{n:fresh.length}),fresh.length===1?fresh[0].url:null)}return}
    // while the page is open: a story that just arrived
    var nw=ITEMS.filter(function(i){return knownIds&&knownIds.indexOf(i.id)<0&&unread(i)});knownIds=ids;
    if(nw.length){var y=txt(nw[0]);banner(nw.length===1?tr('bannerOne',{t:y.title}):tr('banner',{n:nw.length}),nw.length===1?nw[0].url:null)}}

  // ---------- push ----------
  function pushCfg(){var p=FEED&&FEED.push;return p&&p.enabled&&p.workerUrl&&p.publicKey?p:null}
  function ios(){var u=navigator.userAgent||'';return /iPad|iPhone|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)}
  function standalone(){try{return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches}catch(e){return false}}
  function supported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
  function key(b){var p='='.repeat((4-b.length%4)%4);var s=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));var a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
  function api(path,body){var p=pushCfg();return fetch(p.workerUrl.replace(/\/+$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));return j})})}
  function cats(){var c=Array.isArray(S.cats)?S.cats:['eastAfrica'];var allowed=pushCfg()?pushCfg().categories||KINDS:KINDS;return c.filter(function(k){return allowed.indexOf(k)>=0})}
  var busy=false,msg='';
  function swReg(){return navigator.serviceWorker.register('sw.js',{scope:'./'}).then(function(){return navigator.serviceWorker.ready})}
  function enable(){if(busy)return;busy=true;msg='';draw();
    Notification.requestPermission().then(function(perm){if(perm!=='granted')throw new Error(perm==='denied'?'denied':'dismissed');return swReg()})
      .then(function(reg){return reg.pushManager.getSubscription().then(function(s){return s||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(pushCfg().publicKey)})})})
      .then(function(sub){return api('/v1/subscribe',{subscription:sub.toJSON(),categories:cats(),lang:L()}).then(function(j){S.push=true;S.cats=j.categories.filter(function(k){return k!=='breaking'});save()})})
      .catch(function(e){msg=e&&e.message==='denied'?tr('denied'):e&&e.message==='dismissed'?'':tr('err',{e:e&&e.message||e})})
      .then(function(){busy=false;if(!panel.hidden)draw()})}
  function disable(){if(busy)return;busy=true;draw();
    navigator.serviceWorker.getRegistration('./').then(function(reg){return reg&&reg.pushManager.getSubscription()}).then(function(sub){if(!sub)return;var ep=sub.endpoint;return sub.unsubscribe().then(function(){return api('/v1/unsubscribe',{endpoint:ep}).catch(function(){})})})
      .catch(function(e){msg=tr('err',{e:e&&e.message||e})}).then(function(){S.push=false;save();busy=false;if(!panel.hidden)draw()})}
  function setCats(k,on){var c=cats().filter(function(x){return x!==k});if(on)c.push(k);S.cats=c;save();
    if(!S.push)return;navigator.serviceWorker.getRegistration('./').then(function(reg){return reg&&reg.pushManager.getSubscription()}).then(function(sub){if(sub)return api('/v1/subscribe',{subscription:sub.toJSON(),categories:c,lang:L()})}).catch(function(e){msg=tr('err',{e:e&&e.message||e});draw()})}
  function pushBox(){var b=el('div','ntpush');b.append(el('h3',null,tr('pushTitle')));
    var cfg=pushCfg();
    if(!cfg){b.append(el('p',null,tr('pushNA')));return b}
    if(ios()&&!standalone()){b.append(el('p',null,tr('pushIntro')),el('p','ntios',tr('ios')));return b}
    if(!supported()){b.append(el('p',null,tr('unsupported')));return b}
    if(Notification.permission==='denied'){b.append(el('p','nterr',tr('denied')));return b}
    var on=S.push&&Notification.permission==='granted';
    if(!on){b.append(el('p',null,tr('pushIntro')));var e=el('button','ntbtn',busy?tr('busy'):tr('enable'));e.type='button';e.disabled=busy;e.addEventListener('click',enable);b.append(e)}
    else{b.append(el('p',null,tr('pushOn')));var g=el('div','ntcats');(cfg.categories||KINDS).filter(function(k){return k!=='breaking'}).forEach(function(k){var lab=el('label');var c=document.createElement('input');c.type='checkbox';c.checked=cats().indexOf(k)>=0;c.addEventListener('change',function(){setCats(k,c.checked)});lab.append(c,document.createTextNode(' '+tr(k)));g.append(lab)});b.append(g);
      var d=el('button','ntlink',busy?tr('busy'):tr('disable'));d.type='button';d.disabled=busy;d.addEventListener('click',disable);b.append(d)}
    b.append(el('p','ntsmall',tr('limits')));if(msg)b.append(el('p','nterr',msg));return b}

  // a visitor who already subscribed: keep the service worker registered (no prompt is shown)
  if(S.push&&supported()&&Notification.permission==='granted'){try{navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(function(){})}catch(e){}}
  if(supported()&&S.push&&Notification.permission!=='granted'){S.push=false;save()}

  // language change: re-label
  new MutationObserver(function(){badge();if(!panel.hidden)draw()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  badge();
  refresh(true);
  setInterval(function(){if(document.visibilityState==='visible')refresh(false)},POLL_MS);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&FEED&&Date.now()-ms(FEED.generatedAt||0)>POLL_MS)refresh(false)});
  window.WT_NOTIFY={refresh:refresh,items:function(){return ITEMS},open:open};
})();
