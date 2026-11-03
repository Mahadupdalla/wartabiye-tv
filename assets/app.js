/* Wartabiye TV public site. Reads data/news.json (articles), data/site.json (settings), data/pages.json (About, policies)
   and data/ads.json (approved adverts) from this GitHub Pages site. No tracking, no accounts, no third-party scripts.
   Visitor preferences (language, theme, text size, saved articles) stay in the visitor's own browser (localStorage). */
(function(){
  'use strict';
  var I18N=window.WT_I18N, TAX=window.WT_TAX;
  var CATS=['Siyaasadda','Amniga','Bulshada','Dhaqaalaha','Adduunka','Ciyaaraha'];
  var DAYS=['Axad','Isniin','Talaado','Arbaco','Khamiis','Jimce','Sabti'];
  var MONTHS=['Janaayo','Febraayo','Maarso','Abriil','Maajo','Juun','Luulyo','Ogost','Sebtembar','Oktoobar','Nofembar','Desembar'];
  var $=function(id){return document.getElementById(id)};
  var LANGS={so:{name:'Soomaali',code:'SO',flag:'img/flags/so.svg',dir:'ltr',loc:'so',i:0},en:{name:'English',code:'EN',flag:'img/flags/gb.svg',dir:'ltr',loc:'en-GB',i:1},
    ar:{name:'العربية',code:'AR',flag:'img/flags/sa.png',dir:'rtl',loc:'ar-u-nu-latn',i:2},fr:{name:'Français',code:'FR',flag:'img/flags/fr.svg',dir:'ltr',loc:'fr-FR',i:3},
    nl:{name:'Nederlands',code:'NL',flag:'img/flags/nl.svg',dir:'ltr',loc:'nl-NL',i:4},it:{name:'Italiano',code:'IT',flag:'img/flags/it.svg',dir:'ltr',loc:'it-IT',i:5},
    de:{name:'Deutsch',code:'DE',flag:'img/flags/de.svg',dir:'ltr',loc:'de-DE',i:6},tr:{name:'Türkçe',code:'TR',flag:'img/flags/tr.svg',dir:'ltr',loc:'tr-TR',i:7}};
  var CATN={en:{Siyaasadda:'Politics',Amniga:'Security',Bulshada:'Society',Dhaqaalaha:'Economy',Adduunka:'World',Ciyaaraha:'Sport',Aragtida:'Opinion',Wararka:'News'},
    ar:{Siyaasadda:'السياسة',Amniga:'الأمن',Bulshada:'المجتمع',Dhaqaalaha:'الاقتصاد',Adduunka:'العالم',Ciyaaraha:'الرياضة',Aragtida:'رأي',Wararka:'الأخبار'},
    fr:{Siyaasadda:'Politique',Amniga:'Sécurité',Bulshada:'Société',Dhaqaalaha:'Économie',Adduunka:'Monde',Ciyaaraha:'Sport',Aragtida:'Opinion',Wararka:'Actualités'},
    nl:{Siyaasadda:'Politiek',Amniga:'Veiligheid',Bulshada:'Samenleving',Dhaqaalaha:'Economie',Adduunka:'Wereld',Ciyaaraha:'Sport',Aragtida:'Opinie',Wararka:'Nieuws'},
    it:{Siyaasadda:'Politica',Amniga:'Sicurezza',Bulshada:'Società',Dhaqaalaha:'Economia',Adduunka:'Mondo',Ciyaaraha:'Sport',Aragtida:'Opinione',Wararka:'Notizie'},
    de:{Siyaasadda:'Politik',Amniga:'Sicherheit',Bulshada:'Gesellschaft',Dhaqaalaha:'Wirtschaft',Adduunka:'Welt',Ciyaaraha:'Sport',Aragtida:'Meinung',Wararka:'Nachrichten'},
    tr:{Siyaasadda:'Siyaset',Amniga:'Güvenlik',Bulshada:'Toplum',Dhaqaalaha:'Ekonomi',Adduunka:'Dünya',Ciyaaraha:'Spor',Aragtida:'Görüş',Wararka:'Haberler'}};
  var LS={lang:'wartabiye-lang',theme:'wartabiye-theme',fs:'wartabiye-fs',saved:'wartabiye-saved',sent:'wartabiye-sent'};
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  var PARAMS=new URLSearchParams(location.search);
  var L=(function(){var u=PARAMS.get('lang');if(LANGS[u])return u;var s=lsGet(LS.lang);return LANGS[s]?s:'so'})();
  function tr(k){var D=I18N[L]||I18N.so;return D[k]!=null&&D[k]!==''?D[k]:I18N.so[k]}
  function trf(k,o){return String(tr(k)).replace(/\{(\w+)\}/g,function(_,x){return o[x]!=null?o[x]:''})}
  function taxName(kind,key){var t=TAX[kind]&&TAX[kind][key];return t?(t[LANGS[L].i]||t[0]):key}
  function catName(k){if(L==='so'||!k)return k;var o=SITE&&SITE[L];if(o&&Array.isArray(o.categories)){var m=o.categories.find(function(c){return c&&c.so===k&&c.name});if(m)return m.name}return CATN[L]&&CATN[L][k]||k}
  function trOf(it){var x=L!=='so'&&it&&it[L];return x&&typeof x==='object'&&typeof x.title==='string'&&x.title.trim()?x:null}
  function F(it,f){var x=trOf(it);if(x)return typeof x[f]==='string'?x[f]:'';return typeof it[f]==='string'?it[f]:''}
  function isSo(it){return L!=='so'&&!trOf(it)}
  function soAttr(e,on){if(on){e.lang='so';e.dir='ltr'}else{e.removeAttribute('lang');e.removeAttribute('dir')}return e}
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
  function tEl(tag,cls,it,f){return soAttr(el(tag,cls,F(it,f)),isSo(it))}
  function soBadge(it){return isSo(it)?el('span','olang',tr('somaliOnly')):null}
  function svg(path,cls){var s='<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'><path d="'+path+'"/></svg>';return s}
  function safeUrl(u){return typeof u==='string'&&/^https?:\/\//.test(u)?u:null}
  function safeLink(u){u=String(u||'');return /^(#|https?:\/\/|mailto:|tel:)/.test(u)?u:'#hoyga'}
  function imgUrl(u){if(typeof u!=='string'||!u)return null;u=u.replace(/^\//,'');if(/^(img\/|https:\/\/)/.test(u))return u;return null}
  function slug(c){return String(c||'').toLowerCase()}
  function href(it){return '#war-'+encodeURIComponent(it._id)}
  function articleUrl(it){try{return new URL('war/'+encodeURIComponent(it._id)+'.html',document.baseURI).href}catch(e){return location.href}}

  // ---------- dates (Mogadishu time) ----------
  function parts(d){
    try{var p={};new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Mogadishu',weekday:'short',day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d).forEach(function(x){p[x.type]=x.value});
      return {wd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),d:+p.day,m:+p.month-1,y:+p.year,t:(p.hour==='24'?'00':p.hour)+':'+p.minute}}
    catch(e){return {wd:d.getDay(),d:d.getDate(),m:d.getMonth(),y:d.getFullYear(),t:''}}
  }
  function ymd(d){var p=parts(d);return p.y+'-'+String(p.m+1).padStart(2,'0')+'-'+String(p.d).padStart(2,'0')}
  function fmt(d,o){try{return new Intl.DateTimeFormat(LANGS[L].loc,Object.assign({timeZone:'Africa/Mogadishu'},o)).format(d)}catch(e){return d.toDateString()}}
  function fullDate(d){if(L!=='so')return fmt(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'});var p=parts(d);return DAYS[p.wd]+', '+p.d+' '+MONTHS[p.m]+' '+p.y}
  function dayMonthYear(d){if(L!=='so')return fmt(d,{day:'numeric',month:'long',year:'numeric'});var p=parts(d);return p.d+' '+MONTHS[p.m]+' '+p.y}
  function dayMonth(d){if(L!=='so')return fmt(d,{day:'numeric',month:'long'});var p=parts(d);return p.d+' '+MONTHS[p.m]}
  function ago(iso){
    var d=new Date(iso);if(isNaN(d))return '';
    var m=Math.round((Date.now()-d.getTime())/60000);if(m<2)return tr('now');
    var h=Math.round(m/60),dd=Math.round(h/24);
    if(L!=='so'){try{var rf=new Intl.RelativeTimeFormat(LANGS[L].loc,{numeric:'always'});if(m<60)return rf.format(-m,'minute');if(h<24)return rf.format(-h,'hour');if(dd<7)return rf.format(-dd,'day')}catch(e){}return dayMonthYear(d)}
    if(m<60)return m+' daqiiqo kahor';if(h<24)return h+' saac kahor';if(dd<7)return dd+' maalin kahor';return dayMonthYear(d);
  }

  // ---------- state ----------
  var items=[],SITE=null,PAGES=null,ADS=[],loaded=false,loadError='',query='';
  // which hub an article belongs to: explicit "section" or derived from the category (old articles have no section)
  function section(it){if(it.section==='sports'||it.section==='world'||it.section==='somalia')return it.section;if(it.category==='Ciyaaraha')return 'sports';if(it.category==='Adduunka')return 'world';return 'somalia'}
  function tags(it){return Array.isArray(it.tags)?it.tags:(typeof it.tags==='string'&&it.tags?[it.tags]:[])}
  var BREAK_MS=12*3600e3;
  function isBreaking(it){if(!it.breaking)return false;var d=new Date(it.publishedAt);return !isNaN(d)&&Date.now()-d.getTime()<BREAK_MS}
  function catTag(it){if(it.sponsored)return el('span','cat spon',tr('sponsored'));if(isBreaking(it))return el('span','cat red',tr('breaking'));
    var s=section(it);if(s==='sports'||s==='world')return el('span','cat',tr(s));
    return it.category?el('span','cat',catName(it.category)):null}
  function whenText(it){var d=new Date(it.publishedAt);if(isNaN(d))return tr('timeUnknown');if(it.timeVerified===false)return dayMonth(d)+' · '+tr('timeUnverified');return ago(it.publishedAt)}
  function meta(it,withSrc){
    var m=el('div','meta');m.append(el('b',null,'Wartabiye TV'));var w=whenText(it);if(w)m.append(el('span','dot',w));
    if(withSrc&&it.source&&it.source!=='Wartabiye TV'){var s=el('span','dot',tr('sources')+': ');var su=safeUrl(it.sourceUrl);if(su){var a=el('a',null,it.source);a.href=su;a.target='_blank';a.rel='noopener';s.append(a)}else s.append(it.source);m.append(s)}
    return m;
  }

  // ---------- images: real <img> (lazy, small version when available); on error the category placeholder ----------
  var broken={};
  var ICONS={Siyaasadda:'M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2 10l10-6 10 6z',Amniga:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    Bulshada:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15.5c.6-.3 1.3-.5 2-.5 3 0 6 2 6 5',
    Dhaqaalaha:'M3 20h18M6 17v-4M11 17V9M16 17v-6M4 9l5-4 4 3 7-5',Adduunka:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18',
    Ciyaaraha:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5l4 2.9-1.5 4.6h-5L8 10.4z',_:'M3 7h18v13H3zM8 3l4 4 4-4'};
  var SPORT_IC={football:ICONS.Ciyaaraha,basketball:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3v18M5.6 5.6c3 2.6 3 10.2 0 12.8M18.4 5.6c-3 2.6-3 10.2 0 12.8',
    tennis:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5 5.5c3.5 3.5 3.5 9.5 0 13M19 5.5c-3.5 3.5-3.5 9.5 0 13',formula1:'M3 16h18M5 16l2-5h7l3 5M7 16a2 2 0 1 0 0 .1M17 16a2 2 0 1 0 0 .1M14 11l2-3h3',
    motorsport:'M3 16h18M5 16l2-5h7l3 5M7 16a2 2 0 1 0 0 .1M17 16a2 2 0 1 0 0 .1',boxing:'M7 4h7a4 4 0 0 1 4 4v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2zM8 16v4h8v-4M10 9h5',
    athletics:'M13 4a2 2 0 1 0 0 .1M8 21l3-6 3 2v4M6 12l3-4 4 1 3 3 3-1',cricket:'M4 20l9-9 3 3-9 9zM14 10l5-5M17 18a2 2 0 1 0 0 .1',volleyball:ICONS.Adduunka,rugby:'M5 19C3 13 8 5 19 5c2 6-3 14-14 14zM8 16l8-8M10 10l4 4',
    swimming:'M2 18c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1M7 13l4-4 3 2 4-3M16 6a2 2 0 1 0 0 .1',cycling:'M5 17a3 3 0 1 0 0 .1M19 17a3 3 0 1 0 0 .1M5 17l4-7h6l4 7M12 10l-2-4h-2',
    baseball:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM7 5c1.5 4 1.5 10 0 14M17 5c-1.5 4-1.5 10 0 14',golf:'M8 21V3l8 4-8 4M5 21h10',handball:ICONS.Ciyaaraha,badminton:'M6 18l6-6M12 12l5-8 3 3-8 5zM5 19a1.5 1.5 0 1 0 0 .1',
    olympics:'M5 10a3 3 0 1 0 0 .1M12 10a3 3 0 1 0 0 .1M19 10a3 3 0 1 0 0 .1M8.5 14a3 3 0 1 0 0 .1M15.5 14a3 3 0 1 0 0 .1',esports:'M6 9h12a3 3 0 0 1 3 3v2a3 3 0 0 1-5 2l-1-1H9l-1 1a3 3 0 0 1-5-2v-2a3 3 0 0 1 3-3zM8 11v3M6.5 12.5h3M16 12h.1M18 13h.1',other:'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'};
  function ph(it,cls,big){
    var s=el('span','ph s-'+section(it)+(cls?' '+cls:''));var cn=catName(it.category)||tr('news');
    var full=imgUrl(it.image),small=imgUrl(it.thumb);var iu=big?full:(small||full);var has=false;
    if(iu&&!broken[it._id]){
      var im=document.createElement('img');im.loading='lazy';im.decoding='async';im.alt=F(it,'imageAlt')||F(it,'title');
      if(big&&small&&full){im.srcset=small+' 480w, '+full+' 1200w';im.sizes='(max-width:1000px) 100vw, 860px'}
      var FOC={top:'50% 15%',bottom:'50% 85%',left:'20% 50%',right:'80% 50%'};if(FOC[it.imageFocus])im.style.objectPosition=FOC[it.imageFocus];
      im.addEventListener('error',function(){im.remove();s.classList.add('none');var ill=s.querySelector('.illus');if(ill)ill.remove();s.querySelector('.phc').hidden=false;s.append(el('span','illus phtag',tr('phTag')));if(!broken[it._id]){broken[it._id]=1}});
      im.src=iu;s.append(im);has=true;if(it.imageKind==='illustrative')s.append(el('span','illus',tr('illus')));
    }else{s.classList.add('none');s.setAttribute('role','img');s.setAttribute('aria-label',cn+': '+tr('phTag'));s.append(el('span','illus phtag',tr('phTag')))}
    var c=el('span','phc');if(has)c.hidden=true;c.setAttribute('aria-hidden','true');
    var icon=section(it)==='sports'&&it.sport&&SPORT_IC[it.sport]||ICONS[it.category]||ICONS._;c.innerHTML=svg(icon);c.append(el('b',null,cn),el('i',null,tr('noImg')));s.append(c);
    return s;
  }

  // ---------- saved articles (this browser only) ----------
  function savedIds(){try{var a=JSON.parse(lsGet(LS.saved)||'[]');return Array.isArray(a)?a.filter(function(x){return typeof x==='string'}):[]}catch(e){return []}}
  function isSaved(id){return savedIds().indexOf(id)>=0}
  function toggleSaved(id){var a=savedIds();var i=a.indexOf(id);if(i>=0)a.splice(i,1);else a.unshift(id);lsSet(LS.saved,JSON.stringify(a.slice(0,200)));updSavedBadge();return i<0}
  function updSavedBadge(){var b=$('savedBadge');if(!b)return;var n=savedIds().filter(function(id){return items.some(function(x){return x._id===id})}).length;b.textContent=n;b.hidden=!n}
  var BM='M6 3h12v18l-6-4-6 4z';
  function bmBtn(it,withLabel){var b=el('button','bm');b.type='button';var on=isSaved(it._id);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?tr('savedBtn'):tr('save'));b.title=b.getAttribute('aria-label');b.innerHTML=svg(BM);
    if(withLabel){b.className='';b.append(on?tr('savedBtn'):tr('save'))}
    b.addEventListener('click',function(e){e.preventDefault();var now=toggleSaved(it._id);b.setAttribute('aria-pressed',String(now));b.setAttribute('aria-label',now?tr('savedBtn'):tr('save'));b.title=b.getAttribute('aria-label');if(withLabel)b.lastChild.textContent=now?tr('savedBtn'):tr('save')});return b}

  // ---------- adverts: only approved, active, inside their dates; always labelled ----------
  function adText(a,f){var t=L!=='so'&&a[L]&&typeof a[L][f]==='string'&&a[L][f].trim()?a[L][f]:a[f];return typeof t==='string'?t:''}
  function liveAds(pos){var today=ymd(new Date());return ADS.filter(function(a){return a&&a.active!==false&&Array.isArray(a.positions)&&a.positions.indexOf(pos)>=0&&(!a.start||String(a.start).slice(0,10)<=today)&&(!a.end||String(a.end).slice(0,10)>=today)})}
  function ytId(u){var m=String(u||'').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);return m?m[1]:null}
  function adSlot(pos,cls){
    var list=liveAds(pos);if(!list.length)return null;var a=list[Math.floor(Math.random()*list.length)];
    var box=el('aside','adslot '+(cls||''));box.setAttribute('aria-label',tr('adLabel'));box.append(el('span','adtag',tr('adLabel')));
    var vid=pos==='video'&&ytId(a.video);
    if(vid){var b=el('button','advideo');b.type='button';b.setAttribute('aria-label',adText(a,'title')||tr('adLabel'));b.innerHTML=svg('M8 5v14l11-7z');
      b.addEventListener('click',function(){var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+vid+'?autoplay=1&rel=0';f.allow='autoplay; encrypted-media; picture-in-picture';f.allowFullscreen=true;f.title=adText(a,'title')||'video';b.innerHTML='';b.append(f)},{once:true});box.append(b)}
    var link=safeUrl(a.link);var w=link?el('a'):el('div');if(link){w.href=link;w.target='_blank';w.rel='noopener sponsored'}
    var img=imgUrl(a.image);if(img&&!vid){var im=el('img');im.src=img;im.alt=adText(a,'imageAlt')||adText(a,'title')||a.advertiser||'';im.loading='lazy';w.append(im)}
    var t=adText(a,'title'),x=adText(a,'text');if(t||x||a.advertiser){var tx=el('div','adtx');if(t)tx.append(el('b',null,t));if(x)tx.append(el('span',null,x));if(a.advertiser)tx.append(el('span',null,tr('sponsoredBy')+': '+a.advertiser));w.append(tx)}
    box.append(w);return box;
  }

  // ---------- ticker ----------
  var tickPaused=false;
  function renderTicker(){
    var t=$('tick');var pool=items.filter(function(x){return !x.sponsored});
    var tk=pool.filter(isBreaking).concat(pool.filter(function(x){return !isBreaking(x)})).slice(0,8).map(function(x){return {title:F(x,'title'),link:href(x),so:isSo(x)}});
    var bk=SITE&&SITE.breaking||{};if(bk.mode==='manual')tk=[];
    if(Array.isArray(bk.items))tk=bk.items.filter(function(x){return x&&x.text}).map(function(x){var o=L!=='so'&&typeof x[L]==='string'&&x[L].trim();return {title:o||x.text,link:x.link||'#hoyga',so:L!=='so'&&!o}}).concat(tk);
    t.innerHTML='';if(!tk.length){t.append(el('a',null,tr('tickLoading')));return}
    [0,1].forEach(function(k){tk.forEach(function(x){var a=soAttr(el('a',null,x.title),x.so);a.href=safeLink(x.link);if(k){a.setAttribute('aria-hidden','true');a.tabIndex=-1}t.append(a)})});
  }

  // ---------- trending: editor's choice (data/site.json "trending"), else breaking + flagged "important" + newest per section ----------
  function trendingList(){
    var pick=[],seen={};function add(x){if(x&&!seen[x._id]&&!x.sponsored){seen[x._id]=1;pick.push(x)}}
    var ed=SITE&&Array.isArray(SITE.trending)?SITE.trending:[];
    ed.forEach(function(f){var id=typeof f==='string'?f:f&&f.article;add(items.find(function(x){return x._id===id}))});
    var editor=pick.length>0;var now=Date.now();
    items.filter(isBreaking).forEach(add);
    items.filter(function(x){return x.important&&now-new Date(x.publishedAt).getTime()<72*3600e3}).forEach(add);
    ['somalia','world','sports'].forEach(function(s){add(items.find(function(x){return section(x)===s}))});
    items.slice(0,6).forEach(add);
    return {list:pick.slice(0,5),editor:editor};
  }

  // ---------- sidebars + footer ----------
  // Wartabiye TV's own accounts. data/site.json (admin: Dejinta) can change them; these are the fallbacks.
  var SOC_URL={fb:'https://www.facebook.com/share/18bkUUeoJx/?mibextid=wwXIfr',yt:'https://www.youtube.com/@WarTabiye-channel',tt:'https://www.tiktok.com/@wartabiyetv'};
  var SOC_KEY={fb:'facebook',yt:'youtube',tt:'tiktok'};
  // Official brand marks (shapes from Simple Icons, CC0), in their own colours.
  var SOC_ICON={"fb": "<svg class=\"bi\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"11.6\" style=\"fill:#fff\"/><path style=\"fill:#0866FF\" d=\"M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z\"/></svg>", "yt": "<svg class=\"bi\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path style=\"fill:#FF0000\" d=\"M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z\"/><path style=\"fill:#fff\" d=\"M9.545 15.568V8.432L15.818 12z\"/></svg>", "tt": "<svg class=\"bi\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect width=\"24\" height=\"24\" rx=\"5.5\" style=\"fill:#000\"/><g transform=\"translate(5.05 5.05) scale(.58)\"><path style=\"fill:#25F4EE\" transform=\"translate(-.9 -.9)\" d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/><path style=\"fill:#FE2C55\" transform=\"translate(.9 .9)\" d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/><path style=\"fill:#fff\" d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/></g></svg>"};
  var SOC=[['fb','Facebook'],['yt','YouTube'],['tt','TikTok']];
  var FB_MONO='M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z';
  function socUrl(k){var s=SITE&&SITE.social||{};return safeUrl(s[SOC_KEY[k]])||SOC_URL[k]}
  function head(t,cls,allHref){var h=el('div','blockhead'+(cls?' '+cls:''));h.append(el('h2',null,t));if(allHref){var a=el('a','all',tr('seeAll')+' →');a.href=allHref;h.append(a)}return h}
  function box(t,cls){var d=el('div');d.append(head(t,cls));return d}
  function sideFollow(){var f=box(tr('follow'));var fl=el('div','follow');SOC.forEach(function(s){var a=el('a',s[0]);a.dataset.soc=s[0];a.href=socUrl(s[0]);a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Wartabiye TV · '+s[1]);a.innerHTML=SOC_ICON[s[0]];a.append(el('span',null,s[1]));fl.append(a)});f.append(fl);return f}
  function sideTrending(){var T=trendingList();if(!T.list.length)return null;var d=box(tr('trending'),'red');var ol=el('ol','trend');
    T.list.forEach(function(it){var li=el('li');var w=el('div');var a=tEl('a',null,it,'title');a.href=href(it);w.append(a,meta(it));li.append(w);ol.append(li)});
    d.append(ol,el('p','trend-note',T.editor?tr('trendingNote'):tr('trendingAuto')));return d}
  function sideLatest(list){if(!list.length||!sec('sidebarLatest'))return null;var l=box(tr('latestShort'));var mi=el('div','mini');
    list.slice(0,5).forEach(function(it){var a=el('a');a.href=href(it);var tx=el('span');tx.append(tEl('h4',null,it,'title'),meta(it));a.append(ph(it),tx);mi.append(a)});l.append(mi);return l}
  function sideCats(){var c=box(tr('categories'));var cl=el('div','cats');
    CATS.forEach(function(k){var n=items.filter(function(x){return x.category===k}).length;var a=el('a');a.href='#qayb-'+slug(k);a.append(catName(k),el('span',null,String(n)));cl.append(a)});c.append(cl);return c}
  function fillSide(S,parts){S.innerHTML='';parts.forEach(function(p){if(p)S.append(p)})}
  function renderSidebars(){
    document.querySelectorAll('[data-side]').forEach(function(S){fillSide(S,[sideFollow(),sideTrending(),adSlot('sidebar'),sideLatest(items),adSlot('video'),sideCats()])});
    var ft=$('ftrend');ft.innerHTML='';items.slice(0,3).forEach(function(it){var a=el('a');a.href=href(it);a.append(tEl('span',null,it,'title'),el('small',null,ago(it.publishedAt)));ft.append(a)});
    var fc=$('fcats');fc.innerHTML='';CATS.forEach(function(k){var a=el('a');a.href='#qayb-'+slug(k);a.append(catName(k),el('span',null,String(items.filter(function(x){return x.category===k}).length)));fc.append(a)});
    updSavedBadge();
  }

  // ---------- cards ----------
  function row(it){
    var r=el('article','row');
    var pa=el('a');pa.href=href(it);pa.tabIndex=-1;pa.setAttribute('aria-hidden','true');var p=ph(it);var ct=catTag(it);if(ct)p.append(ct);pa.append(p);
    var tx=el('div','tx');var h=el('h3');var a=tEl('a',null,it,'title');a.href=href(it);h.append(a);var mt=meta(it,true);var sb=soBadge(it);if(sb)mt.append(sb);tx.append(h,mt);
    if(F(it,'summary'))tx.append(tEl('p',null,it,'summary'));
    var mo=el('div','more');var rd=el('a',null,tr('readMore'));rd.href=href(it);mo.append(rd);
    var ou=safeUrl(it.sourceUrl);if(ou&&it.source!=='Wartabiye TV'){var oa=el('a','orig',tr('original')+': '+(it.source||tr('sourceWord'))+' ↗');oa.href=ou;oa.target='_blank';oa.rel='noopener';mo.append(oa)}
    mo.append(bmBtn(it));tx.append(mo);r.append(pa,tx);return r;
  }
  function card(it,lead){
    var a=el('a','card'+(lead?' lead':''));a.href=href(it);var p=ph(it,null,lead);var ct=catTag(it);if(ct)p.append(ct);
    var cb=el('div','cb');cb.append(tEl('h3',null,it,'title'));if(F(it,'summary'))cb.append(tEl('p',null,it,'summary'));var mt=meta(it,true);var sb=soBadge(it);if(sb)mt.append(sb);cb.append(mt);
    a.append(p,cb);return a;
  }
  function cardsGrid(list,withLead,cls){var g=el('div','cards'+(cls?' '+cls:''));list.forEach(function(it,i){g.append(card(it,withLead&&i===0))});return g}

  // ---------- HOME ----------
  function leadOf(list){return list.find(function(x){return imgUrl(x.image)&&!broken[x._id]&&!x.sponsored})||list[0]}
  function renderHome(cat){
    var list=items;
    if(cat)list=list.filter(function(x){return slug(x.category)===cat});
    if(query)list=list.filter(function(x){return matches(x,query)});
    var M=$('mosaic'),LI=$('list');
    var showMosaic=!cat&&!query&&list.length>0&&sec('featured');
    M.hidden=!showMosaic&&loaded;
    var rest=list;
    if(showMosaic){
      M.innerHTML='';var fe=(SITE&&Array.isArray(SITE.featured)?SITE.featured:[]).map(function(f){var id=typeof f==='string'?f:f&&f.article;return list.find(function(x){return x._id===id})}).filter(Boolean);
      // the front page leads with Somali news; Sports and World have their own blocks further down
      var so=list.filter(function(x){return section(x)==='somalia'});var pool=so.length>=5?so:list;
      var lead=fe[0]||leadOf(pool);var others=fe.slice(1).concat(pool.filter(function(x){return fe.indexOf(x)<0&&x!==lead&&!x.sponsored}));
      [lead].concat(others.slice(0,4)).forEach(function(it,i){
        var a=el('a','tile'+(i===0?' big':''));a.href=href(it);var inn=el('span','in');var ct=catTag(it);if(ct)inn.append(ct);
        inn.append(tEl(i===0?'h2':'h3',null,it,'title'));if(i===0){if(F(it,'summary'))inn.append(tEl('p',null,it,'summary'));inn.append(meta(it))}
        a.append(ph(it,null,i===0),inn);M.append(a);
      });
      rest=list.filter(function(x){return x!==lead&&others.slice(0,4).indexOf(x)<0&&(pool===list||section(x)==='somalia')});
    }
    var catSo=cat?CATS.find(function(k){return slug(k)===cat}):null;
    $('listTitle').textContent=query?tr('searchResults'):(catSo?catName(catSo):tr('latest'));
    LI.innerHTML='';
    var home=!cat&&!query;
    if(sec('latest')||cat||query){var shown=rest.slice(0,home?10:40);shown.forEach(function(it,i){LI.append(row(it));if(home&&i===3){var ad=adSlot('card');if(ad)LI.append(ad)}})}
    var em=$('empty');em.hidden=!loaded||rest.length>0||(showMosaic&&list.length>0);
    if(loadError){em.hidden=false;em.textContent=tr('loadError').replace('{e}',loadError)}else em.textContent=(cat||query)&&!list.length?tr('noMatch'):tr('noNews');
    $('updated').textContent=items[0]?tr('updated')+ago(items[0].publishedAt):tr('updatedDaily');
    // ad slots + section blocks on the homepage only
    var top=$('adTop');top.innerHTML='';var mob=$('adMob');mob.innerHTML='';var B=$('blocks');B.innerHTML='';
    if(home&&loaded){
      var at=adSlot('home','ad-home');if(at)top.append(at);var am=adSlot('mobile','ad-mobile');if(am)mob.append(am);
      var sp=adSlot('spotlight');if(sp){var sd=el('section','secblock');sd.append(head(tr('adLabel')),sp);B.append(sd)}
      [['world','worldBlock','navy','#caalamka'],['sports','sportsBlock','green','#ciyaaraha'],['somalia','somaliaBlock','','#qayb-siyaasadda']].forEach(function(b){
        var l=items.filter(function(x){return section(x)===b[0]&&!x.sponsored});if(!l.length)return;
        if(b[0]==='somalia')return; // Somali news already fills the main list
        var s=el('section','secblock');s.append(head(tr(b[1]),b[2],b[3]),cardsGrid(l.slice(0,3)));B.append(s)});
    }
  }
  function matches(x,q){var t=x[L]&&typeof x[L]==='object'?x[L]:{};return [x.title,x.summary,x.body,t.title,t.summary,catName(x.category),x.source,x.sport&&taxName('sport',x.sport),x.region&&taxName('region',x.region),x.competition&&taxName('competition',x.competition)].join(' ').toLowerCase().indexOf(q)>=0}

  // ---------- ARTICLE ----------
  function readMinutes(it){var w=[F(it,'title'),F(it,'summary'),F(it,'body')].join(' ').split(/\s+/).filter(Boolean).length;return Math.max(1,Math.round(w/200))}
  function relatedOf(it){
    var kw={};F(it,'title').toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function(w){if(w.length>4)kw[w]=1});
    return items.filter(function(x){return x!==it&&!x.sponsored}).map(function(x){var s=0;
      if(section(x)===section(it))s+=3;if(x.category===it.category)s+=2;if(it.sport&&x.sport===it.sport)s+=4;if(it.competition&&x.competition===it.competition)s+=3;if(it.region&&x.region===it.region)s+=3;
      tags(it).forEach(function(t){if(tags(x).indexOf(t)>=0)s+=1});
      F(x,'title').toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function(w){if(kw[w])s+=2});
      var age=Math.abs(new Date(x.publishedAt)-new Date(it.publishedAt))/864e5;s-=Math.min(2,age/7);return {x:x,s:s}})
      .filter(function(o){return o.s>2}).sort(function(a,b){return b.s-a.s}).slice(0,3).map(function(o){return o.x});
  }
  function fsGet(){var v=parseInt(lsGet(LS.fs),10);return v>=15&&v<=24?v:0}
  function fsApply(){var v=fsGet();document.documentElement.style.setProperty('--fs-article',v?v+'px':'')}
  function renderStory(id){
    var it=items.find(function(x){return x._id===id});
    var A=$('story');A.innerHTML='';fillSide($('storySide'),[]);
    if(!it){A.append(el('p','empty',loaded?tr('notFound'):tr('loadingStory')));var b0=el('a','back',tr('back'));b0.href='#hoyga';A.append(b0);return}
    setTitle(F(it,'title'));
    if(it._preview)A.append(el('div','pvbar','MUUQAAL HORE (preview) · '+(it.published===false?'Qabyo: warkan bogga weli kama muuqdo.':'Warkan waa la daabacay.')+' Luqadda ka beddel midigta sare si aad u eegto turjumaad kasta.'));
    var cr=el('nav','crumbs');cr.setAttribute('aria-label','breadcrumb');var h0=el('a',null,tr('home'));h0.href='#hoyga';cr.append(h0,el('span',null,tr('sep')));
    var s=section(it);if(s!=='somalia'){var hs=el('a',null,tr(s==='sports'?'sports':'world'));hs.href=s==='sports'?'#ciyaaraha':'#caalamka';cr.append(hs,el('span',null,tr('sep')))}
    if(it.category){var c0=el('a',null,catName(it.category));c0.href='#qayb-'+slug(it.category);cr.append(c0)}
    A.append(cr);
    var ct=catTag(it);if(ct)A.append(ct);
    if(it.sponsored)A.append(el('p','spon-note',tr('sponsored')+(it.sponsor?' · '+tr('sponsoredBy')+': '+it.sponsor:'')));
    var tx=trOf(it);
    if(L!=='so'&&(!tx||tx.status!=='manual')){var nt=el('p','trnote');nt.append(el('span',null,tx?tr('autoTr'):tr('noTr')));
      if(tx){var rs=el('button',null,tr('readSo'));rs.type='button';rs.lang='so';rs.addEventListener('click',function(){setLang('so')});nt.append(rs)}A.append(nt)}
    A.append(tEl('h1',null,it,'title'));
    var body=F(it,'body').trim(),sum=F(it,'summary').trim();
    if(body&&sum)A.append(tEl('p','lede',it,'summary'));
    var by=el('div','byline');var lg=el('img');lg.src='img/logo.png';lg.alt='';lg.width=36;lg.height=36;by.append(lg);
    var m=el('div','meta');m.append(el('b',null,'Wartabiye TV'));var d=new Date(it.publishedAt);
    if(!isNaN(d)){if(it.timeVerified===false)m.append(el('span','dot',fullDate(d)+' · '+tr('timeUnverifiedLong')));else{var tm=el('time','dot',fullDate(d)+(parts(d).t?' · '+parts(d).t:''));tm.dateTime=it.publishedAt;m.append(tm,el('span','dot',ago(it.publishedAt)))}}
    m.append(el('span','dot',trf('readTime',{n:readMinutes(it)})));by.append(m);
    var rt=el('div','rtools');rt.setAttribute('role','group');rt.setAttribute('aria-label',tr('textSize'));
    var sm=el('button',null,'A−');sm.type='button';sm.setAttribute('aria-label',tr('smaller'));sm.title=tr('smaller');
    var lgB=el('button',null,'A+');lgB.type='button';lgB.setAttribute('aria-label',tr('larger'));lgB.title=tr('larger');
    function step(k){var cur=fsGet()||(innerWidth<=640?17:18);var v=Math.max(15,Math.min(24,cur+k));lsSet(LS.fs,String(v));fsApply()}
    sm.addEventListener('click',function(){step(-1)});lgB.addEventListener('click',function(){step(1)});
    rt.append(sm,lgB,bmBtn(it,true));by.append(rt);A.append(by);
    // share: the article's own page on Wartabiye TV
    var url=articleUrl(it),title=F(it,'title'),enc=encodeURIComponent(url),txt=encodeURIComponent(title+' — Wartabiye TV');
    var sh=el('div','share');sh.setAttribute('aria-label',tr('share'));
    function sbtn(cls,label,u,path){var a=el('a',cls);a.href=u;a.target='_blank';a.rel='noopener';a.innerHTML=svg(path);a.append(label);sh.append(a)}
    sbtn('fb','Facebook','https://www.facebook.com/sharer/sharer.php?u='+enc,FB_MONO);
    sbtn('wa','WhatsApp','https://wa.me/?text='+txt+'%20'+enc,'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.1.1.7-.1 1.3z');
    sbtn('x','X','https://x.com/intent/post?text='+txt+'&url='+enc,'M18.2 2H21l-6.5 7.4L22 22h-6l-4.7-6.2L5.9 22H3.1l7-8L2 2h6.1l4.3 5.7zm-1 18h1.6L7 3.7H5.3z');
    sbtn('tg','Telegram','https://t.me/share/url?url='+enc+'&text='+txt,'M21.5 3.5 2.8 10.7c-1.3.5-1.2 1.3-.2 1.6l4.8 1.5 1.8 5.6c.2.7.4.9.9.9.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.6zM8.9 13.4l9.3-5.9c.4-.3.8-.1.5.2l-7.9 7.2-.3 3.2z');
    sbtn('li','LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url='+enc,'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6c.5-1 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z');
    var cp=el('button','cp');cp.type='button';cp.innerHTML=svg('M8 3h11a2 2 0 0 1 2 2v11h-2V5H8zM4 7h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z');cp.append(tr('copy'));
    cp.addEventListener('click',function(){var done=function(){cp.lastChild.textContent=tr('copied')};try{navigator.clipboard.writeText(url).then(done,function(){})}catch(e){}});sh.append(cp);
    if(navigator.share){var ns=el('button','ns');ns.type='button';ns.innerHTML=svg('M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4');ns.append(tr('shareMore'));ns.addEventListener('click',function(){navigator.share({title:title,url:url}).catch(function(){})});sh.append(ns)}
    A.append(sh);
    var fig=el('figure','figure');fig.append(ph(it,'hero',true));
    if(imgUrl(it.image)){var fc=el('figcaption');if(it.imageKind==='illustrative')fc.append(el('b',null,tr('illus')),tr('illusNote'));
      var cr2=typeof it.imageCredit==='string'&&it.imageCredit?it.imageCredit:(it.by==='admin'?'Wartabiye TV':'');
      if(cr2){fc.append(tr('photo')+': ');var iu2=safeUrl(it.imageSourceUrl);if(iu2){var ca=el('a',null,cr2);ca.href=iu2;ca.target='_blank';ca.rel='noopener';fc.append(ca)}else fc.append(cr2);if(it.imageLicense)fc.append(' · '+it.imageLicense)}
      if(fc.childNodes.length)fig.append(fc)}
    else{var fn=el('figcaption');fn.append(tr('noImg')+(L==='so'&&typeof it.imageNote==='string'&&it.imageNote?': '+it.imageNote:'.'));fig.append(fn)}
    A.append(fig);
    var bd=soAttr(el('div','body'),isSo(it));var txt2=(body||sum||F(it,'title'));
    txt2.split(/\n+/).forEach(function(p){if(p.trim())bd.append(el('p',null,p.trim()))});A.append(bd);
    var su=safeUrl(it.sourceUrl);
    if(it.source&&it.source!=='Wartabiye TV'){var sb=el('div','srcbox');sb.append(el('span',null,trf('srcNote',{src:it.source})));
      if(su){var a2=el('a',null,tr('readOriginal')+' ('+it.source+') ↗');a2.href=su;a2.target='_blank';a2.rel='noopener';sb.append(a2)}A.append(sb)}
    var ad=adSlot('article');if(ad){ad.style.marginTop='24px';A.append(ad)}
    // previous / next in the same section
    var sl=items.filter(function(x){return section(x)===s});var i=sl.indexOf(it);
    if(sl.length>1){var pg=el('nav','pager');pg.setAttribute('aria-label',tr('prev')+' / '+tr('next'));
      var nw=sl[i-1],old=sl[i+1];if(old){var pa=el('a','pv');pa.href=href(old);pa.append(el('small',null,'← '+tr('prev')),tEl('b',null,old,'title'));pg.append(pa)}else pg.append(el('span'));
      if(nw){var na=el('a','nx');na.href=href(nw);na.append(el('small',null,tr('next')+' →'),tEl('b',null,nw,'title'));pg.append(na)}A.append(pg)}
    var rel=relatedOf(it);if(rel.length<3)rel=rel.concat(items.filter(function(x){return x!==it&&rel.indexOf(x)<0&&section(x)===s&&!x.sponsored}).slice(0,3-rel.length));
    if(rel.length){var r=el('section','related');r.append(head(tr('related')));var g=el('div','rgrid');
      rel.forEach(function(x){var a=el('a');a.href=href(x);var c=catTag(x);a.append(ph(x));if(c)a.append(c);a.append(tEl('h4',null,x,'title'),meta(x));g.append(a)});r.append(g);A.append(r)}
    var bk=el('a','back',tr('back'));bk.href='#hoyga';A.append(bk);
    fillSide($('storySide'),[sideTrending(),adSlot('sidebar'),sideLatest(items.filter(function(x){return x!==it})),sideFollow()]);
  }

  // ---------- HUBS: Sport and World ----------
  function hashParams(h){var i=h.indexOf('?');var o={};if(i>=0)new URLSearchParams(h.slice(i+1)).forEach(function(v,k){o[k]=v});return o}
  function hubHash(base,o){var q=new URLSearchParams();Object.keys(o).forEach(function(k){if(o[k])q.set(k,o[k])});var s=q.toString();return '#'+base+(s?'?'+s:'')}
  function chip(label,on,hrefTo,count,icon){var a=el('a','chip');a.href=hrefTo;a.setAttribute('aria-pressed',String(!!on));a.setAttribute('role','button');if(icon)a.innerHTML=svg(icon);a.append(label);if(count!=null)a.append(el('small',null,String(count)));return a}
  function chipRow(labelTxt,nodes){var w=el('div');var k=el('label','k',labelTxt);var r=el('div','chips');nodes.forEach(function(n){r.append(n)});w.append(k,r);return w}
  var DECO={sports:'M100 10a90 90 0 1 0 0 180 90 90 0 0 0 0-180zM100 55l43 31-16 50H73L57 86zM100 10v45M143 86l42-14M127 136l26 38M73 136l-26 38M57 86L15 72',
    world:'M100 10a90 90 0 1 0 0 180 90 90 0 0 0 0-180zM10 100h180M100 10c40 40 40 140 0 180M100 10c-40 40-40 140 0 180M24 55h152M24 145h152'};
  function hubHead(kind){var h=el('section','hubhead '+kind);var w=el('div','wrap');var t=el('h1');t.append(tr(kind==='sports'?'sportsTitle':'worldTitle'));
    w.append(t,el('p',null,tr(kind==='sports'?'sportsSub':'worldSub')));h.innerHTML='<svg class="deco" viewBox="0 0 200 200" aria-hidden="true"><path d="'+DECO[kind]+'"/></svg>';h.append(w);return h}
  // One unified feed per hub (owner's decision, 2026-11-01): no leagues, sports, regions or topic filters. Newest first.
  function renderHub(kind,h){
    var V=$('pageView');V.innerHTML='';var P=hashParams(h);
    setTitle(tr(kind==='sports'?'sportsTitle':'worldTitle'));
    var list=items.filter(function(x){return section(x)===kind}).sort(function(a,b){return (b.publishedAt||'')<(a.publishedAt||'')?-1:1});
    var lay=el('div','wrap layout');var main=el('div');var side=el('aside','sidebar');lay.append(main,side);
    function draw(){main.innerHTML='';var q='';var l=list;
      if(!l.length){main.append(head(tr(kind==='sports'?'latestSports':'latestWorld')),el('p','empty',loaded?(q?tr('noMatch'):tr(kind==='sports'?'noSports':'noWorld')):tr('loadingStory')));return}
      var lead=l[0];var rest=l.slice(1);
      main.append(head(tr(kind==='sports'?'latestSports':'latestWorld')),cardsGrid([lead],true,'one'));
      if(rest.length){var s2=el('section','secblock');s2.append(cardsGrid(rest));main.append(s2)}}
    draw();
    fillSide(side,[adSlot('sidebar'),sideLatest(items.filter(function(x){return section(x)!==kind})),sideFollow()]);
    V.append(hubHead(kind),lay);
  }

  // ---------- VIDEOS (#muuqaal) ----------
  // data/videos.json is edited in /admin/ ("Muuqaalada"). Only videos Wartabiye TV may show: its own uploads, official
  // YouTube embeds (embedding allowed by the channel, played from youtube-nocookie.com) and public-domain VOA videos.
  // Nothing is downloaded or re-hosted from other publishers; every card names the source and credit.
  var VIDEOS=null;
  function loadVideos(cb){if(VIDEOS)return cb(VIDEOS);getJSON('data/videos.json').then(function(d){VIDEOS=(d&&Array.isArray(d.videos)?d.videos:[]).filter(function(v){return v&&v.published!==false&&(ytId(v.youtube)||/^(https:\/\/|videos\/)[^\s"'<>]+\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(v.file||''))});
    VIDEOS.sort(function(a,b){return (b.publishedAt||'')<(a.publishedAt||'')?-1:1});cb(VIDEOS)}).catch(function(){VIDEOS=[];cb(VIDEOS)})}
  function vText(v,f){return adText(v,f)}
  function videoCard(v){
    var c=el('article','vcard');var id=ytId(v.youtube);var thumb=imgUrl(v.thumbnail)||(id?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':'');
    var b=el('button','vplay');b.type='button';b.setAttribute('aria-label',tr('playVideo')+': '+vText(v,'title'));
    if(thumb){var im=el('img');im.src=thumb;im.alt=vText(v,'title');im.loading='lazy';b.append(im)}
    var ic=el('span','vicon');ic.innerHTML=svg('M8 5v14l11-7z');b.append(ic);if(v.duration)b.append(el('span','vdur',v.duration));
    b.addEventListener('click',function(){var box=el('div','vframe');
      if(id){var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.title=vText(v,'title');f.loading='lazy';box.append(f)}
      else{var vd=document.createElement('video');vd.controls=true;vd.autoplay=true;vd.preload='metadata';vd.playsInline=true;vd.src=v.file;if(thumb)vd.poster=thumb;box.append(vd)}
      b.replaceWith(box)},{once:true});
    var t=el('div','vtx');if(v.kind)t.append(el('span','vkind',tr('vk_'+v.kind)||v.kind));t.append(el('h3',null,vText(v,'title')));
    var s=vText(v,'summary');if(s)t.append(el('p',null,s));
    var m=el('div','vmeta');var d=new Date(v.publishedAt);if(!isNaN(d))m.append(el('time',null,dayMonthYear(d)));
    var src=el('span');var su=safeUrl(v.sourceUrl);if(su){var a=el('a',null,v.source||tr('sourceWord'));a.href=su;a.target='_blank';a.rel='noopener';src.append(tr('sources')+': ',a)}else if(v.source)src.append(tr('sources')+': '+v.source);m.append(src);
    if(v.credit)m.append(el('span',null,tr('videoCredit')+': '+v.credit));if(v.license)m.append(el('span',null,v.license));
    t.append(m);c.append(b,t);return c}
  function renderVideos(){
    var V=$('pageView');V.innerHTML='';setTitle(tr('videosTitle'));
    var h=el('section','hubhead videos');var w=el('div','wrap');var t=el('h1');t.append(tr('videosTitle'));t.append(el('span',null,L==='so'?'VIDEOS':'MUUQAALADA'));
    w.append(t,el('p',null,tr('videosSub')));h.append(w);
    var lay=el('div','wrap layout');var main=el('div');var side=el('aside','sidebar');lay.append(main,side);
    main.append(head(tr('latestVideos')));var g=el('div','vgrid');main.append(g,el('p','vnote',tr('videoRule')));
    g.append(el('p','empty',tr('loadingStory')));
    loadVideos(function(list){g.innerHTML='';if(!list.length){g.append(el('p','empty',tr('noVideos')));return}list.forEach(function(v){g.append(videoCard(v))})});
    fillSide(side,[adSlot('sidebar'),sideLatest(items),sideFollow()]);
    V.append(h,lay)}

  // ---------- ADVANCED SEARCH ----------
  function renderSearch(h){
    var V=$('pageView');V.innerHTML='';var P=hashParams(h);setTitle(tr('advSearch'));
    var w=el('div','wrap page');w.append(head(tr('advSearch')));
    var f=el('form','sform');f.setAttribute('role','search');
    function fld(lab,node){var l=el('label');l.append(lab,node);return l}
    var q=el('input');q.type='search';q.value=P.q||'';q.name='q';
    var c=el('select');c.name='c';[['',tr('any')]].concat(CATS.map(function(k){return [k,catName(k)]})).forEach(function(o){var op=el('option',null,o[1]);op.value=o[0];if(P.c===o[0])op.selected=true;c.append(op)});
    var s=el('select');s.name='s';[['',tr('any')],['somalia',tr('somalia')],['world',tr('world')],['sports',tr('sports')]].forEach(function(o){var op=el('option',null,o[1]);op.value=o[0];if(P.s===o[0])op.selected=true;s.append(op)});
    var fd=el('input');fd.type='date';fd.name='f';fd.value=P.f||'';var td=el('input');td.type='date';td.name='to';td.value=P.to||'';
    var go=el('button',null,tr('doSearch'));go.type='submit';
    f.append(fld(tr('keyword'),q),fld(tr('category'),c),fld(tr('section'),s),fld(tr('fromDate'),fd),fld(tr('toDate'),td),go);
    var clr=el('a','clr',tr('clear'));clr.href='#raadi';
    f.addEventListener('submit',function(e){e.preventDefault();location.hash=hubHash('raadi',{q:q.value.trim(),c:c.value,s:s.value,f:fd.value,to:td.value}).slice(1)});
    w.append(f);
    var qq=(P.q||'').trim().toLowerCase();var res=items.filter(function(x){
      if(qq&&!matches(x,qq))return false;if(P.c&&x.category!==P.c)return false;if(P.s&&section(x)!==P.s)return false;
      var d=new Date(x.publishedAt);if(isNaN(d))return !(P.f||P.to);var dd=ymd(d);if(P.f&&dd<P.f)return false;if(P.to&&dd>P.to)return false;return true});
    var info=el('div','blockhead');info.append(el('h2',null,trf('results',{n:res.length})));if(qq||P.c||P.s||P.f||P.to)info.append(clr);w.append(info);
    var LI=el('div','list');res.slice(0,60).forEach(function(it){LI.append(row(it))});w.append(LI);if(!res.length)w.append(el('p','empty',tr('noMatch')));
    V.append(w);
  }

  // ---------- SAVED ----------
  function renderSaved(){
    var V=$('pageView');V.innerHTML='';setTitle(tr('saved'));var w=el('div','wrap page');w.append(head(tr('saved')),el('p','trend-note',tr('savedNote')));
    var ids=savedIds();var l=ids.map(function(id){return items.find(function(x){return x._id===id})}).filter(Boolean);
    if(!l.length)w.append(el('p','empty',tr('savedEmpty')));else w.append(cardsGrid(l,false,'c4'));V.append(w);
  }

  // ---------- STATIC PAGES (data/pages.json, editable in /admin/) ----------
  var PAGE_ROUTES={'nagu-saabsan':'about',asturnaanta:'privacy',anshaxa:'editorial','siyaasadda-xayeysiiska':'adpolicy',saxitaannada:'corrections'};
  function pageText(p){if(!p)return null;var t=p[L]&&p[L].title?p[L]:p.so;return t?{t:t,so:t===p.so&&L!=='so'}:null}
  function renderStatic(key){
    var V=$('pageView');V.innerHTML='';var w=el('div','wrap page');var d=el('article','doc');w.append(d);V.append(w);
    var x=pageText(PAGES&&PAGES[key]);if(!x){d.append(el('p','empty',loaded?tr('notFound'):tr('loadingStory')));return}
    var t=x.t;soAttr(d,x.so);setTitle(t.title);d.append(el('h1',null,t.title));if(t.intro)d.append(el('p','intro',t.intro));
    (t.sections||[]).forEach(function(s){if(s.h)d.append(el('h2',null,s.h));String(s.p||'').split(/\n+/).forEach(function(line){line=line.trim();if(!line)return;
      if(/^[-•] /.test(line)){var ul=d.lastChild&&d.lastChild.tagName==='UL'?d.lastChild:d.appendChild(el('ul'));ul.append(el('li',null,line.slice(2)))}else d.append(el('p',null,line))})});
    if(PAGES.updated)d.append(el('p','upd',(L==='so'?'La cusbooneysiiyay: ':L==='ar'?'آخر تحديث: ':L==='fr'?'Mis à jour : ':L==='nl'?'Laatst bijgewerkt: ':L==='it'?'Ultimo aggiornamento: ':L==='de'?'Zuletzt aktualisiert: ':L==='tr'?'Son güncelleme: ':'Last updated: ')+dayMonthYear(new Date(PAGES.updated+'T12:00:00+03:00'))));
    var c=el('p');var a=el('a','btn primary',tr('contact'));a.href='#xiriir';c.append(a);c.style.marginTop='22px';d.append(c);
  }

  // ---------- FORMS (contact + advertising request): validation, honeypot, timing check; sent privately to the form service ----------
  function formCfg(){var f=SITE&&SITE.forms||{};return {key:typeof f.accessKey==='string'?f.accessKey.trim():'',endpoint:safeUrl(f.endpoint)||'https://api.web3forms.com/submit'}}
  function field(type,name,label,req,extra){
    var l=el('label');var lab=el('span',null,label);if(!req)lab.append(' ',el('small',null,tr('fOptional')));l.append(lab);
    var i=type==='textarea'?el('textarea'):type==='select'?el('select'):el('input');if(type!=='textarea'&&type!=='select')i.type=type;i.name=name;if(req)i.required=true;
    if(extra)Object.keys(extra).forEach(function(k){if(k==='options')extra.options.forEach(function(o){var op=el('option',null,o[1]);op.value=o[0];i.append(op)});else i.setAttribute(k,extra[k])});
    var er=el('span','err');er.id='e-'+name+'-'+Math.random().toString(36).slice(2,7);i.setAttribute('aria-describedby',er.id);l.append(i,er);return l;
  }
  function buildForm(kind,fields,subjectFn,sendLabel){
    var f=el('form','form');f.noValidate=true;var started=Date.now();
    fields.forEach(function(x){f.append(x)});
    var hp=el('label','hp');hp.setAttribute('aria-hidden','true');var hpi=el('input');hpi.type='checkbox';hpi.name='botcheck';hpi.tabIndex=-1;hpi.autocomplete='off';hp.append('Do not tick',hpi);f.append(hp);
    var cs=el('label','chk');var cb=el('input');cb.type='checkbox';cb.name='consent';cb.required=true;cs.append(cb,el('span',null,tr('fConsent')));var cer=el('span','err');f.append(cs,cer);
    var pv=el('p','priv');pv.innerHTML=svg('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z');pv.append(tr('fPrivate'));
    var pl=el('a',null,' '+tr('privacy')+' →');pl.href='#asturnaanta';pl.style.color='var(--link)';pv.append(pl);f.append(pv);
    var btn=el('button','send',sendLabel||tr('fSend'));btn.type='submit';var st=el('p','status');st.hidden=true;st.setAttribute('role','status');f.append(btn,st);
    var cfg=formCfg();if(!cfg.key){var off=el('p','status bad',tr('fOff'));off.setAttribute('role','note');f.append(off)}
    function check(){var ok=true;f.querySelectorAll('input,textarea,select').forEach(function(i){if(i.name==='botcheck')return;var er=i.type==='checkbox'?cer:document.getElementById(i.getAttribute('aria-describedby'));var v=(i.type==='checkbox'?(i.checked?'1':''):i.value.trim());var m='';
      if(i.required&&!v)m=tr('fRequired');else if(v&&i.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))m=tr('fBadEmail');else if(v&&i.type==='tel'&&!/^\+?[0-9 ()-]{7,20}$/.test(v))m=tr('fBadPhone');
      if(i.maxLength>0&&v.length>i.maxLength)m=tr('fRequired');i.setAttribute('aria-invalid',m?'true':'false');if(er)er.textContent=m;if(m&&ok){ok=false;i.focus()}});return ok}
    f.addEventListener('submit',async function(e){e.preventDefault();st.hidden=true;if(!check())return;
      if(hpi.checked)return; // a bot ticked the hidden box: drop silently
      if(Date.now()-started<3000){st.hidden=false;st.className='status bad';st.textContent=tr('fTooFast');return}
      var last=parseInt(lsGet(LS.sent),10)||0;if(Date.now()-last<60000){st.hidden=false;st.className='status bad';st.textContent=tr('fTooFast');return}
      var cfg=formCfg();if(!cfg.key){st.hidden=false;st.className='status bad';st.textContent=tr('fOff');return}
      var data={access_key:cfg.key,from_name:'Wartabiye TV website',botcheck:false,form:kind,language:L,page:location.href.split('#')[0]};
      f.querySelectorAll('input,textarea,select').forEach(function(i){if(i.name&&i.name!=='botcheck'&&i.name!=='consent')data[i.name]=i.value.trim()});
      data.subject=subjectFn(data);if(data.email)data.replyto=data.email;
      btn.disabled=true;btn.textContent=tr('fSending');
      try{var r=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data)});var j=await r.json().catch(function(){return {}});
        if(!r.ok||j.success===false)throw new Error(j.message||('HTTP '+r.status));
        lsSet(LS.sent,String(Date.now()));f.reset();st.hidden=false;st.className='status ok';st.textContent=tr('fSent');started=Date.now()}
      catch(err){st.hidden=false;st.className='status bad';st.textContent=tr('fError')}
      btn.disabled=false;btn.textContent=sendLabel||tr('fSend')});
    return f;
  }

  // ---------- CONTACT ----------
  function renderContact(){
    var V=$('pageView');V.innerHTML='';setTitle(tr('contactTitle'));var w=el('div','wrap page');
    var hd=el('div','doc');hd.style.maxWidth='none';hd.append(el('h1',null,tr('contactTitle')),el('p','intro',tr('contactSub')));
    var g=el('div','contactgrid');
    var topics=tr('contactTopics').split('|').map(function(x){return [x,x]});
    var f=buildForm('contact',[el('div','grid2'),field('textarea','message',tr('fMessage'),true,{rows:'6',maxlength:'4000'})],function(d){return 'Wartabiye TV · '+(d.topic||'Fariin')+' · '+(d.name||'')});
    var g2=f.firstChild;g2.append(field('text','name',tr('fName'),true,{maxlength:'120',autocomplete:'name'}),field('email','email',tr('fEmail'),true,{maxlength:'160',autocomplete:'email'}),
      field('tel','phone',tr('fPhone'),false,{maxlength:'20',autocomplete:'tel'}),field('select','topic',tr('fSubject'),true,{options:topics}));
    var side=el('div','sidebar');var s1=sideFollow();var s2=box(tr('policies'));var fl=el('div','cats');
    [['#saxitaannada','corrections'],['#anshaxa','editorial'],['#asturnaanta','privacy'],['#xayeysiimaha','advertise']].forEach(function(x){var a=el('a',null,tr(x[1]));a.href=x[0];fl.append(a)});s2.append(fl);side.append(s1,s2);
    g.append(f,side);hd.append(g);w.append(hd);V.append(w);
  }

  // ---------- ADVERTISING PAGE: placement diagrams ----------
  var AD_PV={ // simple original previews of each placement; sample businesses are clearly marked as examples
    home:'<rect x="4" y="4" width="312" height="172" rx="8" fill="var(--surface)" stroke="var(--line-2)"/><rect x="4" y="4" width="312" height="18" rx="4" fill="#037BDC"/><rect x="16" y="32" width="288" height="44" rx="6" fill="#F2060A" opacity=".9"/><text x="160" y="59" fill="#fff" font-size="13" font-weight="800" text-anchor="middle" font-family="Archivo,Arial">{S}</text><rect x="16" y="86" width="170" height="80" rx="6" fill="var(--chip)"/><rect x="196" y="86" width="108" height="36" rx="6" fill="var(--chip)"/><rect x="196" y="130" width="108" height="36" rx="6" fill="var(--chip)"/>',
    sidebar:'<rect x="4" y="4" width="312" height="172" rx="8" fill="var(--surface)" stroke="var(--line-2)"/><rect x="16" y="16" width="190" height="20" rx="4" fill="var(--chip)"/><rect x="16" y="44" width="190" height="56" rx="6" fill="var(--chip)"/><rect x="16" y="108" width="190" height="56" rx="6" fill="var(--chip)"/><rect x="218" y="16" width="86" height="148" rx="6" fill="#037BDC"/><text x="261" y="86" fill="#fff" font-size="11" font-weight="800" text-anchor="middle" font-family="Archivo,Arial">{S1}</text><text x="261" y="102" fill="#fff" font-size="11" font-weight="800" text-anchor="middle" font-family="Archivo,Arial">{S2}</text>',
    article:'<rect x="4" y="4" width="312" height="172" rx="8" fill="var(--surface)" stroke="var(--line-2)"/><rect x="16" y="16" width="70" height="14" rx="3" fill="#F2060A"/><rect x="16" y="38" width="250" height="14" rx="3" fill="var(--fg)" opacity=".8"/><rect x="16" y="58" width="200" height="14" rx="3" fill="var(--fg)" opacity=".8"/><rect x="16" y="82" width="288" height="8" rx="3" fill="var(--chip)"/><rect x="16" y="96" width="288" height="8" rx="3" fill="var(--chip)"/><rect x="16" y="110" width="250" height="8" rx="3" fill="var(--chip)"/><rect x="16" y="130" width="288" height="34" rx="6" fill="var(--chip)"/>',
    card:'<rect x="4" y="4" width="312" height="172" rx="8" fill="var(--surface)" stroke="var(--line-2)"/><rect x="16" y="14" width="288" height="40" rx="6" fill="var(--chip)"/><rect x="16" y="64" width="288" height="52" rx="6" fill="#ffffff" stroke="#BDBEC0"/><circle cx="42" cy="90" r="16" fill="#F2060A"/><text x="70" y="88" font-size="12" font-weight="800" fill="#0b1c33" font-family="Archivo,Arial">{S}</text><rect x="70" y="96" width="150" height="8" rx="3" fill="#BDBEC0"/><rect x="16" y="126" width="288" height="40" rx="6" fill="var(--chip)"/>',
    video:'<rect x="4" y="4" width="312" height="172" rx="8" fill="#0b1c33"/><circle cx="160" cy="90" r="30" fill="#F2060A"/><path d="M152 76v28l24-14z" fill="#fff"/><text x="160" y="150" fill="#fff" font-size="12" font-weight="800" text-anchor="middle" font-family="Archivo,Arial">{S}</text>',
    mobile:'<rect x="110" y="4" width="100" height="172" rx="14" fill="var(--surface)" stroke="var(--line-2)" stroke-width="2"/><rect x="118" y="18" width="84" height="12" rx="3" fill="#037BDC"/><rect x="118" y="38" width="84" height="40" rx="5" fill="var(--chip)"/><rect x="118" y="86" width="84" height="40" rx="5" fill="var(--chip)"/><rect x="118" y="134" width="84" height="30" rx="5" fill="#F2060A"/><text x="160" y="153" fill="#fff" font-size="9" font-weight="800" text-anchor="middle" font-family="Archivo,Arial">{S}</text>',
    spotlight:'<rect x="4" y="4" width="312" height="172" rx="8" fill="var(--surface)" stroke="var(--line-2)"/><rect x="16" y="16" width="288" height="148" rx="8" fill="#0263b3"/><circle cx="72" cy="90" r="38" fill="#037BDC"/><path d="M58 92l10 10 20-24" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><text x="126" y="80" fill="#fff" font-size="14" font-weight="900" font-family="Archivo,Arial">{S}</text><rect x="126" y="92" width="150" height="8" rx="3" fill="#ffffff55"/><rect x="126" y="108" width="110" height="8" rx="3" fill="#ffffff55"/><rect x="126" y="126" width="70" height="20" rx="5" fill="#F2060A"/>',
    campaign:'<rect x="4" y="4" width="312" height="172" rx="8" fill="var(--surface)" stroke="var(--line-2)"/><rect x="16" y="16" width="288" height="28" rx="5" fill="#F2060A" opacity=".85"/><rect x="16" y="54" width="186" height="110" rx="6" fill="var(--chip)"/><rect x="212" y="54" width="92" height="52" rx="6" fill="#037BDC"/><rect x="212" y="112" width="92" height="52" rx="6" fill="#ffffff" stroke="#BDBEC0"/><text x="160" y="35" fill="#fff" font-size="11" font-weight="800" text-anchor="middle" font-family="Archivo,Arial">{S}</text>'
  };
  // ---------- ADVERTISING PAGE (Xayeysiimaha) ----------
  // Everything visual on this page is HTML, CSS and inline SVG drawn for Wartabiye TV: no photos, no video files, no sound.
  // Every word comes from WT_ADDEMO (assets/i18n.js), so it follows the site language and mirrors in Arabic.
  function AD(){return window.WT_ADDEMO&&(window.WT_ADDEMO[L]||window.WT_ADDEMO.so)||{}}
  function ad(k){var D=window.WT_ADDEMO||{};var x=(D[L]||{})[k];return escapeXml(x!=null?x:((D.so||{})[k]||''))}
  function escapeXml(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  var ADI={ // small stroke icons used inside the demo adverts
    arr:'<svg class="arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    ok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h4v16H7zM13 4h4v16h-4z"/></svg>',
    replay:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5"/></svg>'
  };
  // business icons (24px stroke drawings) used in the promo and in the category cards
  var BI={
    office:'<path d="M4 21V5l8-2v18M12 8h8v13M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2M2 21h20"/>',
    corp:'<path d="M3 8h18v12H3zM9 8V5h6v3M3 13h18M11 13v2h2v-2"/>',
    shop:'<path d="M3 9l2-5h14l2 5M4 9h16v11H4zM9 20v-6h6v6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
    cart:'<path d="M2 4h3l2.6 11h10.2L20 7H6.2"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
    food:'<path d="M6 3v6a2 2 0 0 0 4 0V3M8 11v10M17 21V3c-2.5 1.5-3.5 5-3.5 8H17"/>',
    cafe:'<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-1 1.2 1 2 0 3.5M12 3c-1 1.2 1 2 0 3.5"/>',
    hotel:'<path d="M3 19V6M3 14h18v5M21 19v-5a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="11" r="1.8"/>',
    tech:'<path d="M5 5h14v10H5zM2 19h20l-2-4H4zM10 9l-2 1.5L10 12M14 9l2 1.5-2 1.5"/>',
    estate:'<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
    school:'<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
    health:'<path d="M4 4h16v16H4zM12 8v8M8 12h8"/>',
    truck:'<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    fashion:'<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
    online:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    ecom:'<path d="M4 4h16v11H4zM8 20h8M12 15v5M9 8h6l-1 4h-4z"/>',
    pro:'<path d="M12 3v18M7 21h10M4 7h16M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z"/>',
    sme:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16.5 11a2.5 2.5 0 1 0 0-5M16 14a5 5 0 0 1 5 6"/>',
    other:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5"/>',
    idea:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
    box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
    hand:'<path d="M3 12l4-4 4 2 2-1 6 3M3 12l6 6 2-1 2 1 6-6M9 14l2 2M12 12l2 2"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  function bi(k){return '<svg class="bi" viewBox="0 0 24 24" aria-hidden="true">'+(BI[k]||'')+'</svg>'}
  var CAT_ICONS=['corp','shop','hotel','school','tech','estate','truck','ecom','pro','sme','other'];
  // original illustrations for the six demo adverts (no text inside, so nothing to translate)
  var ART={
    shop:'<svg class="ill" viewBox="0 0 250 180" aria-hidden="true"><ellipse cx="118" cy="170" rx="104" ry="7" fill="#0b1c33" opacity=".25"/>'+
      '<rect x="26" y="58" width="184" height="108" rx="6" fill="#fff"/><rect x="20" y="44" width="196" height="18" rx="5" fill="#0b1c33"/>'+
      '<path d="M18 62h200l-6 20H24z" fill="#F2060A"/><path d="M48 62h20l-2 20H46zM88 62h20v20H88zM128 62h20l2 20h-22zM168 62h20l4 20h-22z" fill="#fff"/>'+
      '<rect x="36" y="94" width="96" height="62" rx="4" fill="#e3f0fc"/><path d="M36 116h96M36 137h96" stroke="#BDBEC0" stroke-width="2"/>'+
      '<rect x="44" y="100" width="12" height="16" rx="2" fill="#F2060A"/><rect x="60" y="104" width="10" height="12" rx="2" fill="#037BDC"/><rect x="74" y="98" width="14" height="18" rx="2" fill="#0b1c33"/><rect x="92" y="102" width="12" height="14" rx="2" fill="#F2060A"/><rect x="108" y="100" width="16" height="16" rx="2" fill="#037BDC"/>'+
      '<circle cx="50" cy="129" r="6" fill="#037BDC"/><circle cx="66" cy="129" r="6" fill="#F2060A"/><rect x="78" y="121" width="16" height="16" rx="3" fill="#0b1c33"/><rect x="98" y="123" width="26" height="14" rx="3" fill="#037BDC"/>'+
      '<rect x="44" y="141" width="20" height="15" rx="2" fill="#0263b3"/><rect x="70" y="143" width="18" height="13" rx="2" fill="#F2060A"/><rect x="94" y="141" width="30" height="15" rx="2" fill="#0b1c33"/>'+
      '<rect x="144" y="94" width="56" height="72" rx="4" fill="#037BDC"/><rect x="150" y="100" width="44" height="30" rx="3" fill="#cfe6fb"/><circle cx="188" cy="140" r="3" fill="#fff"/>'+
      '<g class="bob"><path d="M196 8h40l5 44h-50z" fill="#F2060A"/><path d="M206 18v-5a10 10 0 0 1 20 0v5" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M216 26l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z" fill="#fff"/></g>'+
      '<path class="tw" d="M14 14l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff"/><path class="tw t2" d="M176 18l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="#fff"/></svg>',
    clinic:'<svg class="ill" viewBox="0 0 240 130" aria-hidden="true"><rect y="116" width="240" height="14" fill="#fff" opacity=".22"/>'+
      '<rect x="70" y="40" width="100" height="80" rx="4" fill="#fff"/><rect x="98" y="18" width="44" height="30" rx="4" fill="#fff"/><path d="M120 24v18M111 33h18" stroke="#F2060A" stroke-width="6" stroke-linecap="round"/>'+
      '<g fill="#cfe6fb"><rect x="80" y="56" width="16" height="14" rx="2"/><rect x="102" y="56" width="16" height="14" rx="2"/><rect x="124" y="56" width="16" height="14" rx="2"/><rect x="146" y="56" width="16" height="14" rx="2"/><rect x="80" y="80" width="16" height="14" rx="2"/><rect x="146" y="80" width="16" height="14" rx="2"/></g>'+
      '<rect x="106" y="90" width="28" height="30" rx="2" fill="#037BDC"/>'+
      '<path class="beat" d="M38 62c-8-10-24-2-16 12l16 14 16-14c8-14-8-22-16-12z" fill="#F2060A"/>'+
      '<path class="pulse" d="M176 70h12l6-14 8 28 6-14h24" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cafe:'<svg class="ill" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>'+
      '<linearGradient id="adCfW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a24"/><stop offset="1" stop-color="#2b1a10"/></linearGradient>'+
      '<linearGradient id="adCfT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9875b"/><stop offset="1" stop-color="#7d5231"/></linearGradient>'+
      '<radialGradient id="adCfL" cx=".72" cy=".2" r=".65"><stop offset="0" stop-color="#ffe7b8" stop-opacity=".5"/><stop offset="1" stop-color="#ffe7b8" stop-opacity="0"/></radialGradient></defs>'+
      '<rect width="400" height="200" fill="url(#adCfW)"/><rect x="250" y="14" width="124" height="98" rx="4" fill="#9fd0f5" opacity=".5"/><path d="M312 14v98M250 63h124" stroke="#3b2516" stroke-width="5"/>'+
      '<path d="M84 0v26" stroke="#1a0f08" stroke-width="2"/><path d="M66 42a18 15 0 0 1 36 0z" fill="#F2060A"/><circle cx="84" cy="44" r="5" fill="#ffe7b8"/>'+
      '<rect width="400" height="200" fill="url(#adCfL)"/><rect y="138" width="400" height="62" fill="url(#adCfT)"/><rect y="135" width="400" height="5" fill="#d9a877"/>'+
      '<ellipse cx="170" cy="152" rx="64" ry="12" fill="#f4f7fb"/><ellipse cx="170" cy="150" rx="46" ry="7" fill="#dfe6ef"/>'+
      '<path d="M128 92h84l-8 52a8 8 0 0 1-8 6h-52a8 8 0 0 1-8-6z" fill="#fff"/><path d="M211 104h10a14 14 0 0 1 0 28h-14" stroke="#fff" stroke-width="7" fill="none"/>'+
      '<path d="M131 110h78l-1.6 11h-74.8z" fill="#F2060A"/><ellipse cx="170" cy="94" rx="42" ry="7" fill="#6b3f1f"/><ellipse cx="164" cy="93" rx="16" ry="3" fill="#c98e5a" opacity=".85"/>'+
      '<g class="steam" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"><path d="M152 80c-8-10 8-16 0-28"/><path d="M172 78c-8-10 8-16 0-30"/><path d="M192 80c-8-10 8-16 0-28"/></g>'+
      '<g fill="#3b2314"><ellipse cx="262" cy="160" rx="9" ry="6" transform="rotate(-20 262 160)"/><ellipse cx="284" cy="170" rx="9" ry="6" transform="rotate(25 284 170)"/><ellipse cx="250" cy="178" rx="9" ry="6" transform="rotate(10 250 178)"/></g>'+
      '<ellipse cx="344" cy="168" rx="46" ry="8" fill="#f4f7fb" opacity=".92"/><path d="M310 158c10-24 58-24 68 0-8 8-21 10-34 10s-26-2-34-10z" fill="#e0a458"/><path d="M327 147l6 17M344 143v21M361 147l-6 17" stroke="#b97a35" stroke-width="3" stroke-linecap="round"/></svg>',
    food:'<svg class="ill" viewBox="0 0 200 90" aria-hidden="true"><ellipse cx="88" cy="82" rx="54" ry="5" fill="#0b1c33" opacity=".2"/>'+
      '<path d="M50 44c4-22 72-22 76 0z" fill="#f6d28b"/><circle cx="72" cy="34" r="6.5" fill="#2e9e5b"/><circle cx="92" cy="29" r="6.5" fill="#F2060A"/><circle cx="110" cy="35" r="5.5" fill="#2e9e5b"/><rect x="80" y="35" width="13" height="7" rx="2" fill="#a0522d"/><rect x="98" y="38" width="10" height="5" rx="2" fill="#a0522d"/>'+
      '<path d="M44 44h88a44 36 0 0 1-88 0z" fill="#fff"/><path d="M52 52h72" stroke="#037BDC" stroke-width="4" stroke-linecap="round"/>'+
      '<g class="steam" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"><path d="M78 20c-5-6 5-10 0-17"/><path d="M98 18c-5-6 5-10 0-17"/></g>'+
      '<g class="ride"><rect x="148" y="36" width="22" height="18" rx="3" fill="#fff"/><path d="M146 66h24l8-18h9" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="152" cy="70" r="8" fill="none" stroke="#fff" stroke-width="4"/><circle cx="184" cy="70" r="8" fill="none" stroke="#fff" stroke-width="4"/></g></svg>',
    bread:'<svg viewBox="0 0 80 60" aria-hidden="true"><ellipse cx="40" cy="54" rx="30" ry="3" fill="#0b1c33" opacity=".12"/><path d="M10 42c0-18 14-25 30-25s30 7 30 25v8H10z" fill="#d99a4e"/><path d="M24 25l6 10M38 21l4 12M52 23l2 12" stroke="#a8692b" stroke-width="3" stroke-linecap="round"/></svg>',
    cake:'<svg viewBox="0 0 80 60" aria-hidden="true"><ellipse cx="40" cy="54" rx="28" ry="3" fill="#0b1c33" opacity=".12"/><rect x="16" y="26" width="48" height="26" rx="3" fill="#fff8ee"/><rect x="16" y="35" width="48" height="6" fill="#F2060A"/><path d="M16 28c0-6 48-6 48 0v3H16z" fill="#ffd1dc"/><circle cx="40" cy="17" r="5.5" fill="#F2060A"/><path d="M40 12c1-4 4-6 7-6" stroke="#2e9e5b" stroke-width="2" fill="none"/></svg>',
    croissant:'<svg viewBox="0 0 80 60" aria-hidden="true"><ellipse cx="40" cy="54" rx="30" ry="3" fill="#0b1c33" opacity=".12"/><path d="M6 46c12-28 56-28 68 0-10 7-22 9-34 9s-24-2-34-9z" fill="#e0a458"/><path d="M24 34l6 16M40 30v20M56 34l-6 16" stroke="#b97a35" stroke-width="3" stroke-linecap="round"/></svg>',
    phone:'<svg class="ill" viewBox="0 0 160 200" aria-hidden="true"><g class="cwave" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="7"><path class="w1" d="M26 40a72 72 0 0 1 108 0"/><path class="w2" d="M44 58a46 46 0 0 1 72 0"/></g><circle cx="80" cy="76" r="7" fill="#fff"/>'+
      '<rect x="44" y="92" width="72" height="106" rx="12" fill="#0b1c33"/><rect x="50" y="102" width="60" height="82" rx="6" fill="#fff"/><rect x="56" y="108" width="48" height="10" rx="3" fill="#037BDC"/>'+
      '<rect x="56" y="124" width="48" height="28" rx="4" fill="#F2060A"/><path d="M76 130v16l12-8z" fill="#fff"/><rect x="56" y="158" width="36" height="6" rx="3" fill="#BDBEC0"/><rect x="56" y="168" width="24" height="6" rx="3" fill="#BDBEC0"/></svg>'
  };
  function adTag(){return '<span class="dtag">'+escapeXml(tr('adLabel'))+'</span>'}
  function demo(cls,title,size,body){return '<figure class="dm '+cls+'"><figcaption><b>'+escapeXml(title)+'</b><span class="sz" dir="ltr">'+size+'</span></figcaption>'+
    '<div class="stage"><span class="ribbon">'+escapeXml(tr('adExample'))+'</span>'+body+'</div></figure>'}
  function demoGallery(){
    var T={};tr('adTypes').forEach(function(t){T[t[0]]=t[1]});
    var banner='<div class="d-ban">'+adTag()+'<span class="shine"></span><div class="bill">'+ART.shop+'</div>'+
      '<div class="txt"><span class="k">'+ad('p4')+'</span><strong>'+ad('p1')+'</strong><p>'+ad('p2')+' · '+ad('hbSub')+'</p></div>'+
      '<span class="cta">'+ad('p5')+ADI.arr+'</span></div>';
    var side='<div class="d-side">'+adTag()+'<div class="sbart">'+ART.clinic+'</div><div class="sbin"><div class="sbtop"><span class="ic">'+ADI.plus+'</span><b>'+ad('sbBrand')+'</b></div>'+
      '<strong>'+ad('sbHead')+'</strong><ul><li>'+ADI.ok+ad('sbL1')+'</li><li>'+ADI.ok+ad('sbL2')+'</li><li>'+ADI.ok+ad('sbL3')+'</li></ul>'+
      '<span class="cta">'+ad('sbCta')+ADI.arr+'</span></div></div>';
    var post='<article class="d-post"><div class="pimg">'+ART.cafe+adTag()+'</div><div class="bd">'+
      '<span class="spon">'+escapeXml(tr('sponsoredBy'))+' <b>'+ad('spBrand')+'</b></span><strong>'+ad('spHead')+'</strong><p>'+ad('spText')+'</p>'+
      '<span class="pmore">'+ad('spMore')+ADI.arr+'</span></div></article>';
    var mob='<div class="d-mob"><div class="scr"><div class="mh"><img src="img/logo.png" alt="" width="18" height="18"><b dir="ltr">WARTABIYE<span>TV</span></b></div>'+
      '<div class="ml"><span class="mlab">'+ad('news')+'</span><s></s><s class="sh"></s><u></u><s></s><s class="sh"></s></div>'+
      '<div class="mad">'+adTag()+'<div class="mart">'+ART.food+'</div><div class="mtx"><b>'+ad('mbBrand')+'</b><strong>'+ad('mbHead')+'</strong><small>'+ad('mbText')+'</small></div><span class="cta">'+ad('mbCta')+'</span></div></div></div>';
    var spot='<div class="d-spot">'+adTag()+'<span class="rib">'+ADI.star+ad('slTag')+'</span><div class="sprow"><span class="slogo">'+ART.bread+'</span>'+
      '<div><b>'+ad('slBrand')+'</b><span class="loc">'+ADI.pin+ad('slLoc')+'</span></div></div><strong>'+ad('slHead')+'</strong><p>'+ad('slText')+'</p>'+
      '<div class="prods" dir="ltr"><span>'+ART.bread+'<i>$1.50</i></span><span>'+ART.cake+'<i>$12</i></span><span>'+ART.croissant+'<i>$1</i></span></div>'+
      '<div class="spchips"><span>'+ADI.ok+ad('slF1')+'</span><span>'+ADI.ok+ad('slF2')+'</span><span>'+ADI.ok+ad('slF3')+'</span></div>'+
      '<span class="cta">'+ADI.phone+ad('slCta')+'</span></div>';
    var camp='<div class="d-camp">'+adTag()+'<span class="stripes"></span><div class="ctx"><span class="k">'+ad('cpKick')+'</span>'+
      '<div class="cbrand"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.5" r="1.2"/></svg></span><b>'+ad('cpBrand')+'</b></div><strong>'+ad('cpHead')+'</strong><p>'+ad('cpText')+'</p>'+
      '<span class="cta">'+ad('cpCta')+ADI.arr+'</span><span class="plan">'+ad('cpPlan')+'</span></div><div class="cart">'+ART.phone+'<span class="cbadge" dir="ltr">'+ad('cpBadge')+'</span>'+
      '<i class="cf c1"></i><i class="cf c2"></i><i class="cf c3"></i><i class="cf c4"></i></div></div>';
    return '<div class="adgal">'+demo('g-ban',T.home,'970 × 250',banner)+demo('g-post',T.article,'640 × 360',post)+demo('g-side',T.sidebar,'300 × 600',side)+
      demo('g-mob',T.mobile,'320 × 100',mob)+demo('g-spot',T.spotlight,'600 × 400',spot)+demo('g-camp',T.campaign,'1200 × 628',camp)+'</div>'}

  // ----- animated promo presentation (web animation, not a video file; no sound) -----
  var PROMO={i:0,t:0,playing:null,cc:false,tok:0,seen:false};var SCN_MS=4600,SCN_N=6;
  function reduceMotion(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}}
  function words(s){ // one animated span per word; runs of Latin words (e.g. "Wartabiye TV") stay together so their order is right inside Arabic
    var out=[];s.split(/\s+/).forEach(function(w){var lat=/^[A-Za-z0-9’'.,!?:-]+$/.test(w);if(lat&&out.length&&out[out.length-1].lat)out[out.length-1].t+=' '+w;else out.push({t:w,lat:lat})});
    return out.map(function(o,i){return '<span class="w" style="--i:'+i+'"'+(o.lat&&L==='ar'?' dir="ltr"':'')+'>'+escapeXml(o.t)+'</span>'}).join(' ')}
  function promoArt(n,D){
    if(n===0){var B=[[8,74,150,'#0263b3'],[86,56,214,'#037BDC'],[146,84,124,'#0b1c33'],[234,62,244,'#0263b3'],[300,98,176,'#037BDC'],[402,60,226,'#0b1c33'],[466,86,146,'#0263b3'],[556,78,196,'#037BDC']];
      return '<svg class="sky" viewBox="0 0 640 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><pattern id="adPw" width="14" height="16" patternUnits="userSpaceOnUse"><rect x="3" y="3" width="7" height="8" rx="1" fill="#cfe6fb" opacity=".8"/></pattern></defs>'+
        '<circle class="sun" cx="520" cy="118" r="36" fill="#F2060A" opacity=".9"/>'+
        B.map(function(b,k){return '<g class="bld" style="--i:'+k+'"><rect x="'+b[0]+'" y="'+(300-b[2])+'" width="'+b[1]+'" height="'+b[2]+'" rx="3" fill="'+b[3]+'"/><rect x="'+(b[0]+8)+'" y="'+(312-b[2])+'" width="'+(b[1]-16)+'" height="'+(b[2]-30)+'" fill="url(#adPw)"/></g>'}).join('')+'</svg>'}
    if(n===1){var s='<div class="cust"><span class="ring"></span><span class="ring r2"></span><span class="hub">'+bi('shop')+'</span>';
      for(var k=0;k<8;k++)s+='<i style="--a:'+(k*45)+'deg;--i:'+k+'"><span>'+bi('person')+'</span></i>';return s+'</div>'}
    if(n===2)return '<div class="opp"><span class="rays"></span><span class="lg"><img src="img/logo.png" alt="" width="140" height="140"></span><span class="star">'+ADI.star+'</span><span class="star s2">'+ADI.star+'</span></div>';
    if(n===3)return '<div class="shw">'+[['office',D.wCo],['box',D.wPr],['hand',D.wSv]].map(function(c,k){return '<div class="sc" style="--i:'+k+'"><span>'+bi(c[0])+'</span><b>'+escapeXml(c[1])+'</b><s></s><s class="sh"></s></div>'}).join('')+'</div>';
    if(n===4)return '<div class="bgrid">'+['office','corp','shop','cart','food','cafe','hotel','tech','estate','school','health','truck','fashion','online','idea'].map(function(k,i){return '<span style="--i:'+i+'">'+bi(k)+'</span>'}).join('')+'</div>';
    return '<div class="fin"><span class="flg"><img src="img/logo.png" alt="" width="110" height="110"></span><strong>'+words(D.v6)+'</strong><a class="pcta" href="#adForm" data-promo-cta>'+escapeXml(D.vCta)+ADI.arr+'</a></div>'}
  function buildPromo(toForm){
    var D=AD();var txt=[D.v1,D.v2,D.v3,D.v4,D.v5,D.v6];
    var box=el('div','adshow');box.setAttribute('role','region');box.setAttribute('aria-roledescription','carousel');box.setAttribute('aria-label',D.promoTitle||'Wartabiye TV');
    var screen=el('div','pscreen');
    txt.forEach(function(t,n){var sc=el('div','ps s'+(n+1));sc.innerHTML='<div class="part">'+promoArt(n,D)+'</div>'+(n<5?'<p class="ptx">'+words(t)+'</p>':'');screen.append(sc)});
    var brand=el('div','pbrand');brand.innerHTML='<img src="img/logo.png" alt="" width="22" height="22"><b dir="ltr">WARTABIYE<span>TV</span></b>';screen.append(brand);
    var cc=el('p','pcc');cc.setAttribute('aria-live','polite');screen.append(cc);
    var bar=el('div','pbar');var segs=[];for(var n=0;n<SCN_N;n++){var g=el('span');g.append(el('i'));segs.push(g);bar.append(g)}
    var ctl=el('div','pctl');
    var bPlay=el('button','pb');bPlay.type='button';var bRe=el('button','pb');bRe.type='button';bRe.innerHTML=ADI.replay;bRe.setAttribute('aria-label',D.replay);bRe.title=D.replay;
    var dots=el('div','pdots');var dotB=[];for(n=0;n<SCN_N;n++){(function(n){var d=el('button');d.type='button';d.textContent=String(n+1);d.setAttribute('aria-label',(D.scene||'')+' '+(n+1));d.addEventListener('click',function(){go(n)});dotB.push(d);dots.append(d)})(n)}
    var bCC=el('button','pb cc');bCC.type='button';bCC.textContent='CC';bCC.setAttribute('aria-label',D.cc);bCC.title=D.cc;
    ctl.append(bPlay,bRe,dots,bCC);
    var note=el('p','pnote',D.promoNote);
    box.append(screen,bar,ctl);
    var scenes=screen.querySelectorAll('.ps');
    function paint(){var p=Math.min(1,PROMO.t/SCN_MS);segs.forEach(function(g,k){g.firstChild.style.width=(k<PROMO.i?100:k===PROMO.i?p*100:0)+'%'})}
    function go(n){PROMO.i=n;PROMO.t=0;scenes.forEach(function(s,k){s.classList.remove('on');s.setAttribute('aria-hidden',String(k!==n));if(k!==n)s.setAttribute('inert','');else s.removeAttribute('inert')});
      void screen.offsetWidth;scenes[n].classList.add('on');dotB.forEach(function(d,k){d.setAttribute('aria-current',k===n?'true':'false')});cc.textContent=txt[n];paint()}
    function setPlaying(v){PROMO.playing=v;box.classList.toggle('paused',!v);bPlay.innerHTML=v?ADI.pause:ADI.play;bPlay.setAttribute('aria-label',v?D.pause:D.play);bPlay.title=v?D.pause:D.play}
    function setCC(v){PROMO.cc=v;box.classList.toggle('nocc',!v);bCC.setAttribute('aria-pressed',String(v))}
    bPlay.addEventListener('click',function(){if(!PROMO.playing&&PROMO.i===SCN_N-1&&PROMO.t>=SCN_MS)go(0);setPlaying(!PROMO.playing)});
    bRe.addEventListener('click',function(){go(0);setPlaying(true)});bCC.addEventListener('click',function(){setCC(!PROMO.cc)});
    screen.addEventListener('click',function(e){var a=e.target.closest('[data-promo-cta]');if(a)toForm(e)});
    var tok=++PROMO.tok,last=0;
    function loop(now){if(tok!==PROMO.tok||!document.body.contains(box))return;var dt=last?Math.min(now-last,100):0;last=now;
      if(PROMO.playing){PROMO.t+=dt;if(PROMO.t>=SCN_MS){if(PROMO.i<SCN_N-1)go(PROMO.i+1);else{PROMO.t=SCN_MS;setPlaying(false)}}paint()}
      requestAnimationFrame(loop)}
    setCC(PROMO.cc);go(PROMO.i);var t0=PROMO.t;PROMO.t=t0;
    // autoplay once, when the presentation first comes into view (the page can be re-rendered before that, e.g. when settings load)
    setPlaying(PROMO.playing===true);if(PROMO.io){PROMO.io.disconnect();PROMO.io=null}
    if(!PROMO.seen&&!reduceMotion()){
      if('IntersectionObserver' in window){var io=PROMO.io=new IntersectionObserver(function(es){if(es[0].isIntersecting&&!PROMO.seen){PROMO.seen=true;setPlaying(true);io.disconnect()}},{threshold:.35});io.observe(box)}else{PROMO.seen=true;setPlaying(true)}}
    requestAnimationFrame(loop);
    var wrapEl=el('div','adshow-wrap');wrapEl.append(box,note);return wrapEl}

  function renderAdsPage(){
    var V=$('pageView');V.innerHTML='';setTitle(tr('adHero'));var D=AD();
    function toForm(e){if(e)e.preventDefault();var t=$('adForm');if(t){t.scrollIntoView({behavior:reduceMotion()?'auto':'smooth'});var i=t.querySelector('input');if(i)setTimeout(function(){i.focus({preventScroll:true})},500)}}
    function ctaPair(){var c=el('div','ctas');var b1=el('a','btn primary',tr('adOrder'));b1.href='#xayeysiimaha';b1.addEventListener('click',toForm);
      var b2=el('a','btn ghost',tr('adContact'));b2.href='#xiriir';c.append(b1,b2);return c}
    // 1. hero with the animated presentation
    var hero=el('section','adhero adpromo');var hw=el('div','wrap');var l=el('div','htext');l.append(el('span','kick',tr('advertise')),el('h1',null,tr('adHero')),el('p',null,tr('adHeroSub')),ctaPair());
    hw.append(l,buildPromo(toForm));hero.append(hw);V.append(hero);
    var w=el('div','wrap page');
    // 2. why Wartabiye TV
    var why=el('section');why.append(head(tr('adWhy')));var wg=el('div','adwhy');
    [['adWhy1','M4 5h16v11H4zM8 20h8M12 16v4M7 9h4M7 12h7'],['adWhy2','M7 3h10v18H7zM11 18h2'],['adWhy3','M4 7h16v10H4zM8 12h8M4 7l4-4h8l4 4'],['adWhy4','M4 6h16v14H4zM4 10h16M9 3v5M15 3v5']].forEach(function(x){var d=el('div');d.innerHTML=svg(x[1]);d.append(el('b',null,tr(x[0])),el('span',null,tr(x[0]+'t')));wg.append(d)});
    why.append(wg);w.append(why);
    // 3. six demo adverts, with a quick language switch so the visitor can see the text change
    var gs=el('section','secblock');gs.id='adDemos';gs.append(head(D.gallery||'','red'));
    var gi=el('div','adgal-intro');var gp=el('p','trend-note',D.gallerySub||'');var sw=el('div','langsw');sw.append(el('span',null,D.tryLang||''));
    Object.keys(LANGS).forEach(function(k){var b=el('button',k===L?'on':null,LANGS[k].name);b.type='button';b.lang=k;b.setAttribute('aria-pressed',String(k===L));
      b.addEventListener('click',function(){if(k===L)return;var y=$('adDemos').getBoundingClientRect().top;setLang(k);function keep(){var n=$('adDemos');if(n)window.scrollTo(0,window.scrollY+n.getBoundingClientRect().top-y)}keep();requestAnimationFrame(keep);setTimeout(keep,250)});sw.append(b)});
    gi.append(gp,sw);gs.append(gi);var gw=el('div');gw.innerHTML=demoGallery();gs.append(gw.firstChild);w.append(gs);
    // 4. who can advertise
    var cs=el('section','secblock');cs.append(head(D.catTitle||''),el('p','trend-note',D.catSub||''));var cg=el('div','adcats');
    (D.cats||[]).forEach(function(c,i){var d=el('div','acat');d.style.setProperty('--i',i);var ic=el('span','aci');ic.innerHTML=bi(CAT_ICONS[i]||'other');d.append(ic,el('b',null,c[0]),el('span',null,c[1]));cg.append(d)});
    cs.append(cg);w.append(cs);
    // 5. placements: where each format appears on the page (diagrams only, no text inside)
    var op=el('section','secblock');op.append(head(tr('adOptions'),'red'),el('p','trend-note',tr('adOptionsSub')));var og=el('div','adopts');
    var prices=SITE&&SITE.adPrices||{};var showP=prices.show===true&&Array.isArray(prices.items);
    tr('adTypes').forEach(function(t,i){var c=el('article','adopt');var pv=el('div','pv');
      var art=(AD_PV[t[0]]||'').replace(/<text[^>]*>[^<]*<\/text>/g,'');
      pv.innerHTML='<svg viewBox="0 0 320 180" role="img" aria-label="'+escapeXml(t[1])+'">'+art+'</svg>';pv.append(el('span','ex',D.where||''));
      var ob=el('div','ob');ob.append(el('span','num',String(i+1).padStart(2,'0')),el('b',null,t[1]),el('span',null,t[2]));
      var pr=showP&&prices.items.find(function(p){return p&&p.type===t[0]&&p.price});ob.append(el('span','pr',pr?tr('price')+': '+pr.price+(pr.period?' / '+pr.period:''):tr('priceOnRequest')));
      c.append(pv,ob);og.append(c)});
    op.append(og);w.append(op);
    // 6. how it works
    var hs=el('section','secblock');hs.append(head(D.howTitle||''));var hg=el('ol','adsteps');
    ['h1','h2','h3'].forEach(function(k,i){var li=el('li');li.append(el('span','n',String(i+1)),el('b',null,D[k]||''),el('span',null,D[k+'t']||''));hg.append(li)});
    hs.append(hg);w.append(hs);
    // 7. call-to-action band
    var cb=el('section','adband');var ct=el('div');ct.append(el('span','k',D.p4||''),el('h2',null,D.p1||''),el('p',null,(D.p2||'')+' · '+(D.p3||'')));cb.append(ct,ctaPair());w.append(cb);
    // 8. request form (sent privately by Web3Forms to the owner's email once the key is set in /admin/; otherwise it says it is not open yet)
    var fs=el('section','secblock adformbox');fs.id='adForm';fs.append(head(tr('adFormTitle'),'red'),el('p','trend-note',tr('adFormSub')));
    var types=tr('adTypes').map(function(t){return [t[1],t[1]]});var periods=tr('aPeriodOpts').split('|').map(function(x){return [x,x]});var cats=(D.cats||[]).map(function(c){return [c[0],c[0]]});
    var g1=el('div','grid2'),g2=el('div','grid2'),g3=el('div','grid2'),g4=el('div','grid2');
    g1.append(field('text','business',tr('aBiz'),true,{maxlength:'160',autocomplete:'organization'}),field('text','name',tr('aPerson'),true,{maxlength:'120',autocomplete:'name'}));
    g2.append(field('email','email',tr('fEmail'),true,{maxlength:'160',autocomplete:'email'}),field('tel','phone',tr('fPhone'),true,{maxlength:'20',autocomplete:'tel'}));
    g3.append(field('select','category',D.fCat||'',true,{options:cats}),field('select','ad_type',tr('aType'),true,{options:types}));
    g4.append(field('select','period',tr('aPeriod'),true,{options:periods}));
    var f=buildForm('advertising',[g1,g2,g3,g4,field('textarea','message',D.fMsg||tr('aMsg'),true,{rows:'5',maxlength:'3000'})],function(d){return 'Wartabiye TV · Codsi xayeysiis · '+(d.business||'')},tr('adOrder'));
    var alt=el('a','btn ghost-dark',tr('adContact'));alt.href='#xiriir';var send=f.querySelector('.send');if(send){var row=el('div','sendrow');send.replaceWith(row);row.append(send,alt)}
    fs.append(f,el('p','trend-note',tr('adNote')));var pl=el('a',null,tr('adPolicy')+' →');pl.href='#siyaasadda-xayeysiiska';pl.style.color='var(--link)';pl.style.fontWeight='700';fs.append(pl);w.append(fs);V.append(w);
  }

  // ---------- routing ----------
  var DEFAULT_TITLE='Wartabiye TV';
  function setTitle(t){document.title=t?t+' | Wartabiye TV':DEFAULT_TITLE}
  var lastKey=null;
  function route(){
    var h=decodeURIComponent((location.hash||'').slice(1));
    if(!h&&window.WARTABIYE_STORY)h='war-'+window.WARTABIYE_STORY;
    if(!h&&window.WARTABIYE_ROUTE)h=window.WARTABIYE_ROUTE;
    var base=h.split('?')[0];
    var story=base.indexOf('war-')===0?h.slice(4):null;
    var cat=base.indexOf('qayb-')===0?base.slice(5):null;
    var page=!story&&!cat&&['ciyaaraha','caalamka','muuqaal','raadi','kaydsan','xiriir','xayeysiimaha'].concat(Object.keys(PAGE_ROUTES)).indexOf(base)>=0?base:null;
    var isHome=!story&&!page;
    $('homeView').hidden=!isHome;$('storyView').hidden=!story;$('pageView').hidden=!page;$('barnaamijyada').hidden=!isHome||!sec('programmes');
    var navKey=story?'':cat?'qayb-'+cat:page?page:(base===''||base==='hoyga'?'hoyga':'');
    document.querySelectorAll('[data-nav]').forEach(function(a){a.classList.toggle('on',a.dataset.nav===navKey);if(a.dataset.nav===navKey)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
    var key=story?'s:'+story:page?'p:'+base:'h:'+(cat||'');
    if(story)renderStory(story);
    else if(page==='muuqaal')renderVideos();else if(page==='ciyaaraha')renderHub('sports',h);else if(page==='caalamka')renderHub('world',h);
    else if(page==='raadi')renderSearch(h);else if(page==='kaydsan')renderSaved();else if(page==='xiriir')renderContact();else if(page==='xayeysiimaha')renderAdsPage();
    else if(page)renderStatic(PAGE_ROUTES[page]);
    else{setTitle(cat?catName(CATS.find(function(k){return slug(k)===cat})||cat):'');renderHome(cat);var target=h&&!cat&&h!=='hoyga'?document.getElementById(h):null;if(target)target.scrollIntoView();else if(cat||h==='hoyga')window.scrollTo(0,0)}
    if(key!==lastKey&&(story||page)){window.scrollTo(0,0)}lastKey=key;
    progress();
  }
  window.addEventListener('hashchange',route);

  // ---------- site settings (data/site.json) ----------
  function sec(k){return !(SITE&&SITE.sections&&SITE.sections[k]===false)}
  var NAVMAP={'#hoyga':'home','#ciyaaraha':'sports','#caalamka':'world','#muuqaal':'videosNav','#xayeysiimaha':'advertise','#nagu-saabsan':'aboutUs','#xiriir':'contact','#kaydsan':'saved','#raadi':'advSearch'};
  function applySite(){
    if(!SITE)return;var S=SITE;var T=L!=='so'&&S[L]&&typeof S[L]==='object'?S[L]:{};
    function v(k,so){var t=T[k];if(L!=='so'&&typeof t==='string'&&t.trim())return {t:t,so:false};return {t:so,so:L!=='so'}}
    function put(id,k,so){var x=v(k,so);if(typeof x.t==='string'&&x.t.trim()&&$(id)){$(id).textContent=x.t;soAttr($(id),x.so)}}
    if(Array.isArray(S.categories)){var cs=S.categories.map(function(c){return typeof c==='string'?c:c&&c.name}).filter(Boolean);if(cs.length)CATS=cs}
    put('city','city',S.city);put('tagline','tagline',S.tagline);put('about','about',S.about);
    var mt=v('motto',S.motto);if(typeof mt.t==='string'&&mt.t.trim()){renderMotto(mt.t);soAttr($('motto'),mt.so)}
    put('tickLab','breakingLabel',S.breaking&&S.breaking.label);
    if(Array.isArray(S.nav)&&S.nav.length){var Ln=$('links');Ln.innerHTML='';S.nav.forEach(function(n){if(!n||!n.label)return;var u=safeLink(n.link);
      var lab=n.label,so=false;if(L!=='so'){var ck=/^#qayb-/.test(u)?CATS.find(function(k){return '#qayb-'+slug(k)===u}):null;
        if(NAVMAP[u])lab=tr(NAVMAP[u]);else if(ck)lab=catName(ck);else if(u==='#barnaamijyada')lab=v('programmesTitle','').t||tr('programmes');else so=true}
      var a=soAttr(el('a',null,lab),so);a.href=u;if(/^#/.test(u)&&u!=='#barnaamijyada')a.dataset.nav=u.slice(1);if(u==='#xayeysiimaha')a.className='ad-link';if(/^https?:/.test(u)){a.target='_blank';a.rel='noopener'}Ln.append(a)})}
    var nb=S.announcement||{};$('notice').hidden=!(nb.enabled&&nb.text);if(!$('notice').hidden){put('noticeLab','announcementLabel',nb.label);var nx=v('announcementText',nb.text);var nt=$('noticeText');nt.innerHTML='';soAttr(nt,nx.so);if(nb.link){var na=el('a',null,nx.t);na.href=safeLink(nb.link);nt.append(na)}else nt.textContent=nx.t}
    var bn=S.banner||{},old=document.querySelector('.logoband .promo');if(old)old.remove();
    if(bn.enabled&&bn.style==='calan'){var CA=window.WT_CALAN||{},cz=CA[L]||CA.so;if(cz){var pr=el('section','promo calan');pr.setAttribute('aria-label',cz.title);
      var fg=el('span','flag');var fi=el('img');fi.src='img/flags/so.svg';fi.alt=cz.flagAlt;fi.width=150;fi.height=100;fi.decoding='async';fg.append(fi);
      var cin=el('div','in');cin.append(el('h3',null,cz.title));var dl=el('dl','facts');cz.facts.forEach(function(f,i){var d=el('div','fact'+(i===cz.facts.length-1?' wide':''));d.append(el('dt',null,f[0]),el('dd',null,f[1]));dl.append(d)});cin.append(dl);
      pr.append(fg,cin);document.querySelector('.logoband .wrap').append(pr)}}
    else if(bn.enabled&&bn.title){var pr=el('a','promo');pr.href=safeLink(bn.link||'#hoyga');var bt=v('bannerTitle',bn.title);var bimg=imgUrl(String(bn.image||''));if(bimg){var bi=el('span','ph');bi.style.backgroundImage='url("'+bimg.replace(/["\\()]/g,'')+'")';bi.setAttribute('role','img');bi.setAttribute('aria-label',bt.t);pr.append(bi)}
      var bin=el('span','in');if(bn.label){var bl=v('bannerLabel',bn.label);bin.append(soAttr(el('span','soon',bl.t),bl.so))}bin.append(soAttr(el('h3',null,bt.t),bt.so));if(bn.text){var bx=v('bannerText',bn.text);bin.append(soAttr(el('p',null,bx.t),bx.so))}pr.append(bin);document.querySelector('.logoband .wrap').append(pr)}
    var pg=$('barnaamijyada');if(pg){put('progTitle','programmesTitle',S.programmesTitle);put('progSub','programmesSubtitle',S.programmesSubtitle);
      if(Array.isArray(S.programmes)&&S.programmes.length){var P=$('progs');var icons=[].map.call(P.querySelectorAll('.ic'),function(x){return x.innerHTML});if(icons.length)window.__progIcons=icons;icons=window.__progIcons||icons;P.innerHTML='';var TP=Array.isArray(T.programmes)?T.programmes:[];
        S.programmes.forEach(function(g,i){if(!g||!g.title)return;var tg=L!=='so'&&TP[i]&&TP[i].title?TP[i]:null;var so=L!=='so'&&!tg;var x=tg||g;var c=soAttr(el('div','prog'),so);var ic=el('div','ic');ic.innerHTML=icons[i%icons.length]||'';c.append(ic,el('h3',null,x.title));if(x.text)c.append(el('p',null,x.text));if(x.when)c.append(el('span','when',x.when));P.append(c)})}}
    document.querySelectorAll('[data-side]').forEach(function(x){x.hidden=!sec('sidebar')});
    document.querySelectorAll('#homeView .layout').forEach(function(x){x.classList.toggle('noside',!sec('sidebar'))});
    var ftr=$('ftrend');if(ftr)ftr.parentNode.hidden=!sec('footerLatest');
    // mobile menu: the same three official accounts at the bottom of the drawer
    var Lk=$('links');if(Lk){var ms=Lk.querySelector('.msoc');if(!ms){ms=el('div','msoc');ms.append(el('span'));SOC.forEach(function(s){var a=el('a',s[0]);a.dataset.soc=s[0];a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Wartabiye TV · '+s[1]);a.title='Wartabiye TV · '+s[1];a.innerHTML=SOC_ICON[s[0]];ms.append(a)});Lk.append(ms)}ms.firstChild.textContent=tr('follow')}
    document.querySelectorAll('a[data-soc]').forEach(function(a){a.href=socUrl(a.dataset.soc)});
  }

  // ---------- language ----------
  function renderMotto(txt){var mo=$('motto');mo.innerHTML='';String(txt).split('·').map(function(w){return w.trim()}).filter(Boolean).forEach(function(w,i){if(i)mo.append(el('i',null,'◆'));mo.append(w)})}
  function applyLang(){
    var H=document.documentElement;H.lang=L;H.dir=LANGS[L].dir;
    var md=document.querySelector('meta[name=description]');if(md&&!window.WARTABIYE_STORY)md.content=tr('desc');
    document.querySelectorAll('[data-i18n]').forEach(function(e){e.textContent=tr(e.dataset.i18n)});
    document.querySelectorAll('[data-i18n-ph]').forEach(function(e){e.placeholder=tr(e.dataset.i18nPh)});
    document.querySelectorAll('[data-i18n-aria]').forEach(function(e){e.setAttribute('aria-label',tr(e.dataset.i18nAria));if(e.title)e.title=tr(e.dataset.i18nAria)});
    renderMotto(tr('motto'));$('today').textContent=fullDate(new Date());
    $('langFlag').src=LANGS[L].flag;$('langName').textContent=LANGS[L].name;$('langCode').textContent=LANGS[L].code;
    $('langName').lang=L;$('langMenu').querySelectorAll('[data-lang]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.lang===L))});
    themeBtn();tickBtn();
  }
  function setLang(l){if(!LANGS[l])return;L=l;lsSet(LS.lang,l);
    if(PARAMS.has('lang')){PARAMS.delete('lang');var qs=PARAMS.toString();try{history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+location.hash)}catch(e){}}
    applyLang();applySite();renderAll()}
  var lb=$('langBtn'),lm=$('langMenu');
  function langMenu(open){lm.hidden=!open;lb.setAttribute('aria-expanded',String(open));if(open){var c=lm.querySelector('[aria-checked=true]');if(c)c.focus()}}
  lb.addEventListener('click',function(e){e.stopPropagation();langMenu(lm.hidden)});
  lm.addEventListener('click',function(e){var b=e.target.closest('[data-lang]');if(!b)return;langMenu(false);lb.focus();setLang(b.dataset.lang)});
  lm.addEventListener('keydown',function(e){var bs=[].slice.call(lm.querySelectorAll('[data-lang]')),i=bs.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();bs[(i+(e.key==='ArrowDown'?1:bs.length-1))%bs.length].focus()}});
  document.addEventListener('click',function(e){if(!lm.hidden&&!e.target.closest('#lang'))langMenu(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(!lm.hidden){langMenu(false);lb.focus()}if(links.classList.contains('open')){links.classList.remove('open');mb.setAttribute('aria-expanded','false');mb.focus()}}});

  // ---------- theme (light / dark) ----------
  function curTheme(){return document.documentElement.dataset.theme==='dark'?'dark':'light'}
  function themeBtn(){var b=$('themeBtn');if(!b)return;var d=curTheme()==='dark';b.setAttribute('aria-pressed',String(d));b.setAttribute('aria-label',tr('theme')+': '+(d?tr('themeDark'):tr('themeLight')));b.title=b.getAttribute('aria-label');
    b.innerHTML=d?svg('M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'):svg('M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4')}
  $('themeBtn').addEventListener('click',function(){var n=curTheme()==='dark'?'light':'dark';document.documentElement.dataset.theme=n;lsSet(LS.theme,n);themeBtn()});

  // ---------- menu, search, ticker, progress, back to top ----------
  var mb=$('menuBtn'),links=$('links');
  mb.addEventListener('click',function(){var o=links.classList.toggle('open');mb.setAttribute('aria-expanded',String(o))});
  links.addEventListener('click',function(e){if(e.target.tagName==='A'){links.classList.remove('open');mb.setAttribute('aria-expanded','false')}});
  var sb=$('searchBtn'),sbar=$('searchBar'),q=$('q');
  sb.addEventListener('click',function(){sbar.hidden=!sbar.hidden;sb.setAttribute('aria-expanded',String(!sbar.hidden));if(!sbar.hidden)q.focus();else{q.value='';query='';route()}});
  q.addEventListener('input',function(){query=q.value.trim().toLowerCase();var b=location.hash.split('?')[0];if(b.indexOf('#war-')===0||(b&&b!=='#hoyga'&&b.indexOf('#qayb-')!==0)){location.hash='hoyga'}else route()});
  q.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();location.hash=hubHash('raadi',{q:q.value.trim()}).slice(1)}});
  function tickBtn(){var b=$('tickBtn');if(!b)return;b.setAttribute('aria-pressed',String(tickPaused));b.setAttribute('aria-label',tr(tickPaused?'playTicker':'pauseTicker'));b.title=b.getAttribute('aria-label');b.innerHTML=tickPaused?svg('M8 5v14l11-7z'):svg('M7 5h4v14H7zM13 5h4v14h-4z')}
  $('tickBtn').addEventListener('click',function(){tickPaused=!tickPaused;$('tick').classList.toggle('paused',tickPaused);tickBtn()});
  var pb=$('progress'),tt=$('toTop');
  function progress(){var st=$('storyView');if(st.hidden){pb.style.width='0';return}var a=$('story');var r=a.getBoundingClientRect();var total=a.offsetHeight-innerHeight;var p=total>0?Math.min(1,Math.max(0,-r.top/total)):1;pb.style.width=(p*100)+'%'}
  window.addEventListener('scroll',function(){progress();tt.classList.toggle('on',scrollY>900)},{passive:true});
  tt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
  $('yr').textContent=new Date().getFullYear();

  function renderAll(){renderTicker();renderSidebars();route()}
  fsApply();applyLang();renderAll();

  // ---------- load data ----------
  function getJSON(u){return fetch(u+(u.indexOf('?')<0?'?':'&')+'v='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status+' '+u);return r.json()})}
  (async function(){
    var res=await Promise.allSettled([getJSON('data/news.json'),getJSON('data/site.json'),getJSON('data/pages.json'),getJSON('data/ads.json')]);
    if(res[0].status==='fulfilled'){var j=res[0].value;items=(Array.isArray(j)?j:j.news||[]).map(function(o){o=Object.assign({},o);o._id=o._id||o.id;return o}).filter(function(o){return typeof o.title==='string'&&o.title}).sort(function(a,b){return a.publishedAt<b.publishedAt?1:-1});if(j.lastRunAt)window.WARTABIYE_LAST_RUN=j.lastRunAt}
    else{console.error('Wartabiye: news.json load failed',res[0].reason);loadError=String(res[0].reason&&res[0].reason.message||res[0].reason)}
    if(res[1].status==='fulfilled'){SITE=res[1].value}else console.error('Wartabiye: site.json load failed',res[1].reason);
    if(res[2].status==='fulfilled')PAGES=res[2].value;
    if(res[3].status==='fulfilled'){var ad=res[3].value;ADS=Array.isArray(ad)?ad:(ad&&ad.ads)||[]}
    // admin preview link (?preview=<article id>): shows that article, even a draft, straight from data/news/<id>.json
    var pv=(PARAMS.get('preview')||'').replace(/\.json$/,'');
    if(/^[a-z0-9-]+$/i.test(pv)){try{var po=await getJSON('data/news/'+pv+'.json');po._id=po.id=pv;po._preview=true;
      items=items.filter(function(x){return x._id!==pv}).concat([po]).sort(function(a,b){return a.publishedAt<b.publishedAt?1:-1});if(location.hash.indexOf('#war-')!==0)history.replaceState(null,'',location.pathname+location.search+'#war-'+encodeURIComponent(pv))}catch(e){console.error('Wartabiye: preview load failed',e)}}
    loaded=true;applySite();renderAll();
  })();
})();
