/* Wartabiye TV: Video News (#muuqaal), LIVE TV (#toos) and LIVE Sports (#ciyaaraha-toos).
   GitHub Pages only serves files: every player here is an embed from an authorised provider (YouTube, Vimeo,
   Dailymotion, Facebook, Cloudflare Stream, an HLS stream) or a video file Wartabiye TV owns.
   Nothing is invented: the LIVE badge appears only when a broadcast is verified (YouTube Data API check in
   data/live-status.json, or the admin's own "on air" switch with an end time); scores, fixtures and standings come
   only from the sports-data service set in /admin/ (data/sports.json → apiBase); no viewer counts are shown. */
(function(){
  'use strict';
  var C=null;               // helpers shared by assets/app.js (WT_MEDIA.init)
  function L(){return C.lang()}
  function el(t,c,x){return C.el(t,c,x)}
  function tr(k){return C.tr(k)}
  function trf(k,o){return C.trf(k,o)}

  // ---------- authorised players ----------
  // Same allow-list as tools/media_rules.py. Anything else is ignored (never turned into a player).
  function ytId(u){u=String(u||'');if(!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//.test(u))return null;
    var m=u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);return m?m[1]:null}
  function ytChannel(u){var m=String(u||'').match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/);return m?m[1]:null}
  function provider(u){
    u=String(u||'').trim();if(!u)return null;var m;
    if((m=ytId(u)))return {p:'youtube',id:m};
    if((m=ytChannel(u)))return {p:'youtube-channel',id:m};
    if((m=u.match(/^https:\/\/vimeo\.com\/event\/(\d+)/)))return {p:'vimeo-event',id:m[1]};
    if((m=u.match(/^https:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/)))return {p:'vimeo',id:m[1]};
    if((m=u.match(/^https:\/\/(?:www\.dailymotion\.com\/video\/|dai\.ly\/|geo\.dailymotion\.com\/player\.html\?video=)([A-Za-z0-9]+)/)))return {p:'dailymotion',id:m[1]};
    if(/^https:\/\/(?:www\.|web\.|m\.)?(?:facebook\.com\/[^\s"'<>]+\/videos\/|facebook\.com\/watch\/?\?v=|fb\.watch\/)[A-Za-z0-9_.-]+/.test(u))return {p:'facebook',id:u};
    if((m=u.match(/^https:\/\/((?:customer-[a-z0-9]+\.cloudflarestream\.com|iframe\.videodelivery\.net))\/([a-f0-9]{32})/)))return {p:'cloudflare',id:m[2],host:m[1]};
    if(/^https:\/\/[^\s"'<>]+\.m3u8(\?[^\s"'<>]*)?$/i.test(u))return {p:'hls',id:u};
    if(/^(https:\/\/|videos\/)[^\s"'<>]+\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(u))return {p:'file',id:u};
    return null}
  function embedSrc(pv,o){o=o||{};var ap=o.autoplay?1:0;
    switch(pv.p){
      case 'youtube':return 'https://www.youtube-nocookie.com/embed/'+pv.id+'?rel=0&playsinline=1&modestbranding=1&autoplay='+ap+(o.mute?'&mute=1':'');
      case 'youtube-channel':return 'https://www.youtube.com/embed/live_stream?channel='+pv.id+'&autoplay='+ap+(o.mute?'&mute=1':'');
      case 'vimeo':return 'https://player.vimeo.com/video/'+pv.id+'?dnt=1&autoplay='+ap;
      case 'vimeo-event':return 'https://vimeo.com/event/'+pv.id+'/embed?autoplay='+ap;
      case 'dailymotion':return 'https://geo.dailymotion.com/player.html?video='+pv.id+(ap?'&autoplay=1':'');
      case 'facebook':return 'https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(pv.id)+'&show_text=false&autoplay='+(ap?'true':'false');
      case 'cloudflare':return 'https://'+pv.host+'/'+pv.id+'/iframe'+(ap?'?autoplay=true':'');
    }return null}
  function videoLink(v){return provider(v.youtube)||provider(v.embed)||provider(v.file)}
  var hlsLoading=null;
  function loadHls(){if(window.Hls)return Promise.resolve(window.Hls);if(hlsLoading)return hlsLoading;
    hlsLoading=new Promise(function(ok,no){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js';s.crossOrigin='anonymous';s.onload=function(){ok(window.Hls)};s.onerror=no;document.head.append(s)});return hlsLoading}
  // the player box: 16:9, full-screen allowed (mobile and desktop), keyboard accessible
  function playerBox(pv,o){o=o||{};var box=el('div','vframe');
    if(pv.p==='file'||pv.p==='hls'){var vd=document.createElement('video');vd.controls=true;vd.playsInline=true;vd.preload='metadata';if(o.autoplay)vd.autoplay=true;if(o.poster)vd.poster=o.poster;vd.setAttribute('aria-label',o.title||'video');
      if(pv.p==='file')vd.src=pv.id;
      else if(vd.canPlayType('application/vnd.apple.mpegurl'))vd.src=pv.id;
      else loadHls().then(function(H){if(H&&H.isSupported()){var hl=new H({lowLatencyMode:true});hl.loadSource(pv.id);hl.attachMedia(vd)}}).catch(function(){box.append(el('p','vfail',tr('mPlayerFail')))});
      box.append(vd);return box}
    var f=document.createElement('iframe');f.src=embedSrc(pv,o);f.title=o.title||'video';f.loading=o.eager?'eager':'lazy';
    f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen; web-share';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';box.append(f);return box}
  function thumbOf(v){var pv=videoLink(v);var t=C.imgUrl(v.thumbnail);if(t)return t;if(pv&&pv.p==='youtube')return 'https://i.ytimg.com/vi/'+pv.id+'/hqdefault.jpg';return ''}

  // ---------- data ----------
  var cache={};
  function json(u,maxAge){var c=cache[u];if(c&&Date.now()-c.t<(maxAge||0))return Promise.resolve(c.d);
    return C.getJSON(u).then(function(d){cache[u]={t:Date.now(),d:d};return d})}
  function now(){return Date.now()}
  // still on this page? (hash route, or the static page /toos/ /ciyaaraha-toos/ before any hash is set)
  function onRoute(b){var h=(location.hash||'').slice(1).split('?')[0];return h?h===b:window.WARTABIYE_ROUTE===b}
  function tms(s){var d=new Date(s);return isNaN(d)?NaN:d.getTime()}

  // ---------- LIVE FEEDS (official publisher videos + newsroom headlines, .github/workflows/live-feeds.yml) ----------
  // Read from the "live-data" branch (updated every 5 minutes without rebuilding the site); if that cannot be reached,
  // from the hourly copy in data/live-feeds/. Each file carries "updatedAt", shown to visitors.
  var LIVE_DATA=window.WT_LIVE_DATA||'https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/';
  var feedCache={};
  function liveFeed(name,maxAge){var c=feedCache[name];if(c&&Date.now()-c.t<(maxAge||60000))return c.p;
    var p=fetch(LIVE_DATA+name+'?t='+Math.floor(Date.now()/60000),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
      .catch(function(){return C.getJSON('data/live-feeds/'+name+'?t='+Math.floor(Date.now()/600000))});
    feedCache[name]={t:Date.now(),p:p};p.catch(function(){delete feedCache[name]});return p}

  // ---------- VIDEO NEWS ----------
  // Wartabiye TV's own and admin-added videos (data/videos.json) first, then the newest videos from the publishers'
  // official YouTube channels whose embedding the publisher allows (checked with YouTube; never downloaded or re-uploaded).
  var VIDEOS=null,VIDEOS_AT=0;
  function okVideo(v){if(!v||v.published===false||!videoLink(v))return false;var pa=tms(v.publishAt);return isNaN(pa)||pa<=now()}
  function loadVideos(){if(VIDEOS&&Date.now()-VIDEOS_AT<5*60e3)return Promise.resolve(VIDEOS);
    return Promise.all([json('data/videos.json',60000).catch(function(){return null}),liveFeed('video-feed.json',5*60e3).catch(function(){return null})]).then(function(r){
      var own=(r[0]&&Array.isArray(r[0].videos)?r[0].videos:[]).filter(okVideo);
      var seen={};own.forEach(function(v){var pv=videoLink(v);if(pv)seen[pv.p+':'+pv.id]=1});
      var auto=(r[1]&&Array.isArray(r[1].videos)?r[1].videos:[]).filter(function(v){var pv=videoLink(v);return okVideo(v)&&v.auto&&pv&&pv.p==='youtube'&&!seen['youtube:'+pv.id]});
      var list=own.concat(auto);list.sort(function(a,b){return (b.publishedAt||'')<(a.publishedAt||'')?-1:1});
      VIDEOS=list;VIDEOS_AT=Date.now();VIDEO_FEED=r[1]||null;return list}).catch(function(){VIDEOS=[];return VIDEOS})}
  var VIDEO_FEED=null;
  function vT(v,f){return C.adText(v,f)}
  function vSo(v,f){var x=L()!=='so'&&v[L()]&&typeof v[L()][f]==='string'&&v[L()][f].trim();return L()!=='so'&&!x}
  function vEl(tag,cls,v,f){return C.soAttr(el(tag,cls,vT(v,f)),vSo(v,f))}
  var KINDS=['somalia','world','sports','interview','report','programme','live'];
  function kindName(k){var t=tr('vk_'+k);return t&&t!=='vk_'+k?t:k}
  function vHref(v){return '#muuqaal?v='+encodeURIComponent(v.id)}
  function vUrl(v){try{return v.auto?new URL('muuqaal/#muuqaal?v='+encodeURIComponent(v.id),document.baseURI).href:new URL('muuqaal/'+encodeURIComponent(v.id)+'.html',document.baseURI).href}catch(e){return location.href}}
  function vDate(v){var d=new Date(v.publishedAt);return isNaN(d)?null:d}
  function vMatch(v,q){var t=v[L()]&&typeof v[L()]==='object'?v[L()]:{};return [v.title,v.summary,v.body,t.title,t.summary,t.body,v.source,kindName(v.kind),(v.tags||[]).join(' ')].join(' ').toLowerCase().indexOf(q)>=0}
  function langName(code){var LG=C.LANGS[code];return LG?LG.name:code}
  function vCard(v,small){
    var a=el('a','vcard'+(small?' small':''));a.href=vHref(v);var th=el('span','vplay');var t=thumbOf(v);
    if(t){var im=el('img');im.src=t;im.alt=vT(v,'thumbnailAlt')||'';im.loading='lazy';im.decoding='async';im.width=480;im.height=270;im.onerror=function(){im.remove()};th.append(im)}
    var ic=el('span','vicon');ic.innerHTML=C.svg('M8 5v14l11-7z');th.append(ic);if(v.duration)th.append(el('span','vdur',v.duration));
    var x=el('span','vtx');if(v.kind)x.append(el('span','vkind',kindName(v.kind)));x.append(vEl(small?'h4':'h3',null,v,'title'));
    if(!small){var s=vT(v,'summary');if(s)x.append(vEl('p',null,v,'summary'))}
    var m=el('span','vmeta');if(v.auto&&v.source)m.append(el('span','vsrc',v.source));var d=vDate(v);if(d){var tm=el('time',null,v.auto?agoOrDate(d):C.dayMonthYear(d));tm.dateTime=v.publishedAt;m.append(tm)}
    if(v.language&&v.language!==L())m.append(el('span','vlang',langName(v.language)));x.append(m);a.append(th,x);return a}
  function agoOrDate(d){var m=Math.round((Date.now()-d.getTime())/60000);if(m>=0&&m<24*60){try{var rf=new Intl.RelativeTimeFormat(C.LANGS[L()]&&C.LANGS[L()].loc||'en',{numeric:'always'});return m<60?rf.format(-m,'minute'):rf.format(-Math.round(m/60),'hour')}catch(e){}}return C.dayMonthYear(d)}
  function related(v,list){var kw={};vT(v,'title').toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function(w){if(w.length>3)kw[w]=1});
    return list.filter(function(x){return x!==v}).map(function(x){var s=0;if(x.kind===v.kind)s+=3;(v.tags||[]).forEach(function(t){if((x.tags||[]).indexOf(t)>=0)s+=2});
      vT(x,'title').toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function(w){if(kw[w])s+=2});return {x:x,s:s}}).filter(function(o){return o.s>0})
      .sort(function(a,b){return b.s-a.s}).slice(0,6).map(function(o){return o.x})}
  function videoLd(v){if(v.auto){clearLd();return}var d={'@context':'https://schema.org','@type':'VideoObject',name:vT(v,'title'),description:vT(v,'summary')||vT(v,'title'),
      uploadDate:v.publishedAt,thumbnailUrl:thumbOf(v)?[new URL(thumbOf(v),document.baseURI).href]:undefined,url:vUrl(v),inLanguage:v.language||'so',
      publisher:{'@type':'NewsMediaOrganization',name:'Wartabiye TV',logo:{'@type':'ImageObject',url:new URL('img/logo.png',document.baseURI).href}}};
    var pv=videoLink(v);if(pv&&pv.p==='file')d.contentUrl=new URL(pv.id,document.baseURI).href;else if(pv){var e=embedSrc(pv,{});if(e)d.embedUrl=e}
    if(v.duration){var p=String(v.duration).split(':').map(Number);if(p.every(function(n){return !isNaN(n)})){var sec=p.reduce(function(a,n){return a*60+n},0);d.duration='PT'+Math.floor(sec/60)+'M'+(sec%60)+'S'}}
    var s=document.getElementById('wt-media-ld');if(!s){s=document.createElement('script');s.type='application/ld+json';s.id='wt-media-ld';document.head.append(s)}s.textContent=JSON.stringify(d)}
  function clearLd(){var s=document.getElementById('wt-media-ld');if(s)s.remove()}
  function off(V,titleKey){V.append(hub('videos',tr(titleKey),''));var w=el('div','wrap page');w.append(el('p','empty',tr('mSectionOff')));V.append(w)}
  function hub(kind,title,sub,badge){var h=el('section','hubhead '+kind);var w=el('div','wrap');var t=el('h1');t.append(title);if(badge)t.append(badge);w.append(t);if(sub)w.append(el('p',null,sub));h.append(w);return h}

  function renderVideos(h){
    var V=C.$('pageView');V.innerHTML='';clearLd();var P=C.hashParams(h);
    if(!C.sec('videos')){C.setTitle(tr('videoNewsNav'));off(V,'videoNewsNav');return}
    var lay=el('div','wrap layout');var main=el('div');var side=el('aside','sidebar');lay.append(main,side);
    main.append(el('p','empty',tr('loadingStory')));
    if(P.v){V.append(lay)}else{C.setTitle(tr('videoNewsTitle'));V.append(hub('videos',tr('videoNewsTitle'),tr('videoNewsSub')),lay)}
    loadVideos().then(function(list){main.innerHTML='';
      if(P.v){var v=list.find(function(x){return x.id===P.v});if(!v){C.setTitle(tr('videoNewsTitle'));main.append(el('p','empty',tr('mVideoMissing')),backLink());return}
        watchPage(main,side,v,list);return}
      // search + categories
      var q=(P.q||'').trim().toLowerCase(),k=P.k||'';
      var f=el('form','vsearch');f.setAttribute('role','search');var lab=el('label','sr',tr('search'));var inp=el('input');inp.type='search';inp.id='vq';lab.htmlFor='vq';inp.value=P.q||'';inp.placeholder=tr('mSearchVideos');inp.autocomplete='off';
      var bt=el('button',null,tr('doSearch'));bt.type='submit';f.append(lab,inp,bt);
      f.addEventListener('submit',function(e){e.preventDefault();location.hash=C.hubHash('muuqaal',{q:inp.value.trim(),k:k})});main.append(f);
      var kinds=KINDS.filter(function(x){return list.some(function(v){return v.kind===x})});
      if(kinds.length>1){var chips=[C.chip(tr('allSports'),!k,C.hubHash('muuqaal',{q:P.q}),list.length)].concat(kinds.map(function(x){return C.chip(kindName(x),k===x,C.hubHash('muuqaal',{q:P.q,k:x}),list.filter(function(v){return v.kind===x}).length)}));
        main.append(C.chipRow(tr('category'),chips))}
      var srcs=[];list.forEach(function(v){var n=v.auto?v.source:'Wartabiye TV';if(n&&srcs.indexOf(n)<0)srcs.push(n)});var sp=P.s||'';
      if(srcs.length>1){var sc=[C.chip(tr('allSports'),!sp,C.hubHash('muuqaal',{q:P.q,k:k}),list.length)].concat(srcs.map(function(n){return C.chip(n,sp===n,C.hubHash('muuqaal',{q:P.q,k:k,s:n}),list.filter(function(v){return (v.auto?v.source:'Wartabiye TV')===n}).length)}));main.append(C.chipRow(tr('sources'),sc))}
      var l=list.filter(function(v){return (!k||v.kind===k)&&(!q||vMatch(v,q))&&(!sp||(v.auto?v.source:'Wartabiye TV')===sp)});
      if(!list.length){main.append(C.head(tr('latestVideos')),el('p','empty',tr('noVideos')))}
      else if(!l.length){main.append(C.head(tr('searchResults')),el('p','empty',tr('noMatch')))}
      else{
        if(!q&&!k){var top=l.find(function(v){return v.featured})||l[0];var big=el('section','vfeature');var lk=vCard(top);lk.classList.add('big');big.append(C.head(tr('mFeaturedVideo')),lk);main.append(big);l=l.filter(function(v){return v!==top})}
        main.append(C.head(q?tr('searchResults'):tr('mRecentVideos')));var g=el('div','vgrid');l.forEach(function(v){g.append(vCard(v))});main.append(g)}
      main.append(el('p','vnote',tr('videoRule')));if(VIDEO_FEED&&VIDEO_FEED.updatedAt){var fu=new Date(VIDEO_FEED.updatedAt);if(!isNaN(fu))main.append(el('p','vnote',trf('vFeedChecked',{t:C.parts(fu).t+' (EAT)'})))}
      C.fillSide(side,[recentBox(list.slice(0,5)),C.adSlot('sidebar'),C.sideFollow()]);
    });
    if(!P.v)C.fillSide(side,[C.adSlot('sidebar'),C.sideFollow()]);
  }
  function backLink(){var a=el('a','back',tr('mBackVideos'));a.href='#muuqaal';return a}
  function recentBox(list){if(!list.length)return null;var b=el('section','box');b.append(el('h3',null,tr('mRecentVideos')));var w=el('div','vmini');list.forEach(function(v){w.append(vCard(v,true))});b.append(w);return b}
  function watchPage(main,side,v,list){
    window.scrollTo(0,0);C.setTitle(vT(v,'title'));videoLd(v);var md=document.querySelector('meta[name=description]');if(md)md.content=vT(v,'summary')||vT(v,'title');
    var pv=videoLink(v);var art=el('article','vwatch');
    art.append(playerBox(pv,{title:vT(v,'title'),poster:thumbOf(v),eager:true}));
    var tx=el('div','vwtx');if(v.kind){var kc=el('a','vkind',kindName(v.kind));kc.href=C.hubHash('muuqaal',{k:v.kind});tx.append(kc)}
    tx.append(vEl('h1',null,v,'title'));
    var m=el('div','vmeta');var d=vDate(v);if(d){var tm=el('time',null,C.fullDate(d)+(C.parts(d).t?' · '+C.parts(d).t:''));tm.dateTime=v.publishedAt;m.append(tm)}
    if(v.duration)m.append(el('span',null,tr('mDuration')+': '+v.duration));if(v.language)m.append(el('span','vlang',tr('mVideoLang')+': '+langName(v.language)));tx.append(m);
    var body=vT(v,'body')||vT(v,'summary');if(body){var bd=C.soAttr(el('div','vbody'),vSo(v,vT(v,'body')?'body':'summary'));String(body).split(/\n{2,}/).forEach(function(p){if(p.trim())bd.append(el('p',null,p.trim()))});tx.append(bd)}
    var cr=el('p','vcredit');var su=C.safeUrl(v.sourceUrl);cr.append(tr('sources')+': ');if(v.auto)cr.classList.add('auto');if(su){var a=el('a',null,v.source||tr('sourceWord'));a.href=su;a.target='_blank';a.rel='noopener';cr.append(a)}else cr.append(v.source||'Wartabiye TV');
    if(v.auto)cr.append(' · '+tr('vOfficialChannel'));else{if(v.credit)cr.append(' · '+tr('videoCredit')+': '+v.credit);if(v.license)cr.append(' · '+v.license)}tx.append(cr);
    if(v.auto){var yo=el('a','vyt',tr('vWatchOnYouTube'));yo.href=v.youtube;yo.target='_blank';yo.rel='noopener';tx.append(yo)}
    var sh=el('div','vshare');var cp=el('button',null,tr('copy'));cp.type='button';cp.addEventListener('click',function(){var u=vUrl(v);(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(function(){cp.textContent=tr('copied')}).catch(function(){prompt('',u)})});sh.append(cp);
    if(navigator.share){var sb=el('button',null,tr('share'));sb.type='button';sb.addEventListener('click',function(){navigator.share({title:vT(v,'title'),url:vUrl(v)}).catch(function(){})});sh.append(sb)}
    tx.append(sh);art.append(tx);main.append(art);
    var rel=related(v,list);if(rel.length){main.append(C.head(tr('mRelatedVideos')));var g=el('div','vgrid');rel.forEach(function(x){g.append(vCard(x))});main.append(g)}
    main.append(backLink());
    C.fillSide(side,[recentBox(list.filter(function(x){return x!==v}).slice(0,6)),C.adSlot('sidebar'),C.sideFollow()]);
  }
  // homepage: featured videos (admin: "Muuji bogga hore") and the LIVE banner when a verified broadcast is on
  function homeStrip(B){
    if(!B)return;var holder=el('div','vhome');B.prepend(holder);
    liveState().then(function(s){if(s.live&&C.sec('live')){var a=el('a','livebar');a.href='#toos';a.append(badge(),el('b',null,s.title||tr('liveTvNav')),el('span',null,tr('mWatchNow')+' →'));holder.prepend(a)}});
    if(!C.sec('videos'))return;
    loadVideos().then(function(list){var f=list.filter(function(v){return v.featured}).slice(0,4);if(!f.length)f=list.slice(0,4);if(!f.length)return;var s=el('section','secblock');s.append(C.head(tr('videoNewsNav'),'navy','#muuqaal'));
      var g=el('div','vgrid four');f.forEach(function(v){g.append(vCard(v))});s.append(g);holder.append(s)})}

  // ---------- LIVE TV ----------
  // Live only when verified: (1) "auto": data/live-status.json written by .github/workflows/live-status.yml from the
  // YouTube Data API says the official stream is live, checked within the last 60 minutes; or (2) "manual": the admin
  // switched "On air" on and the end time has not passed. Otherwise the page says "Currently offline".
  var FRESH_MS=60*60e3;
  function liveState(){
    return Promise.all([json('data/live.json',30000).catch(function(){return null}),json('data/live-status.json',30000).catch(function(){return null})]).then(function(r){
      var cfg=r[0]||{},st=r[1]||{};var out={cfg:cfg,status:st,live:false,pv:provider(cfg.streamUrl),title:cfg.title||cfg.channelName||''};
      if(cfg.statusMode==='manual'){var until=tms(cfg.onAirUntil);out.live=!!(cfg.onAir===true&&out.pv&&!isNaN(until)&&until>now());out.verifiedBy='manual';if(out.live)out.until=until}
      else{var fresh=st.checkedAt&&now()-tms(st.checkedAt)<FRESH_MS;out.live=!!(st.live===true&&fresh&&(out.pv||st.videoId));out.verifiedBy='api';
        if(out.live&&st.videoId)out.pv={p:'youtube',id:st.videoId};if(out.live&&st.title)out.title=st.title;if(out.live&&st.startedAt)out.since=st.startedAt}
      out.upcoming=upcoming(cfg,st);return out})}
  function upcoming(cfg,st){var t=now();var l=(Array.isArray(cfg.schedule)?cfg.schedule:[]).filter(function(x){if(!x||!x.title||x.published===false)return false;var s=tms(x.start),e=tms(x.end);return !isNaN(s)&&(isNaN(e)?s>t-3600e3:e>t)}).map(function(x){return {title:x.title,start:x.start,end:x.end,description:x.description,language:x.language,from:'admin'}});
    (Array.isArray(st.upcoming)?st.upcoming:[]).forEach(function(u){if(u&&u.title&&tms(u.scheduledStart)>t-3600e3&&!l.some(function(x){return x.title===u.title}))l.push({title:u.title,start:u.scheduledStart,videoId:u.videoId,from:'youtube'})});
    return l.sort(function(a,b){return tms(a.start)-tms(b.start)})}
  function badge(){var b=el('span','onair');b.append(el('i'),document.createTextNode('LIVE'));return b}
  function timeEAT(iso){var d=new Date(iso);if(isNaN(d))return '';return C.fullDate(d)+' · '+C.parts(d).t+' (EAT)'}
  var liveTimer=null;
  function renderLive(){
    var V=C.$('pageView');V.innerHTML='';clearLd();C.setTitle(tr('liveTvNav'));
    if(!C.sec('live')){off(V,'liveTvNav');return}
    var head=hub('livetv',tr('liveTvTitle'),tr('liveTvSub'));var lay=el('div','wrap livewrap');V.append(head,lay);lay.append(el('p','empty',tr('loadingStory')));
    function draw(s){lay.innerHTML='';var stage=el('div','livestage'+(s.live?' on':''));var main=el('div','livemain');stage.append(main);
      var h1=head.querySelector('h1');var ob=h1.querySelector('.onair');if(ob)ob.remove();if(s.live)h1.append(badge());
      if(s.live){main.append(playerBox(s.pv,{title:s.title||tr('liveTvNav'),autoplay:true,mute:true,eager:true}));
        var info=el('div','liveinfo');info.append(badge(),el('h2',null,s.title||tr('liveTvNav')));
        var m=el('p','vmeta');if(s.since)m.append(el('span',null,trf('mLiveSince',{t:C.parts(new Date(s.since)).t+' (EAT)'})));
        m.append(el('span',null,s.verifiedBy==='api'?tr('mVerifiedApi'):tr('mVerifiedAdmin')));info.append(m);main.append(info);
        var chatId=s.pv&&s.pv.p==='youtube'?s.pv.id:null;
        if(s.cfg.chat===true&&chatId){var ch=el('aside','livechat');var f=document.createElement('iframe');f.title=tr('mChat');f.loading='lazy';
          f.src='https://www.youtube.com/live_chat?v='+chatId+'&embed_domain='+encodeURIComponent(location.hostname);ch.append(el('h3',null,tr('mChat')),f,el('p','vnote',tr('mChatNote')));stage.append(ch)}}
      else{var offl=el('div','offline');offl.setAttribute('role','status');var ic=el('span','offic');ic.innerHTML=C.svg('M3 7h13v10H3zM16 10l5-3v10l-5-3M3 3l18 18');
        offl.append(ic,el('h2',null,tr('mOffline')),el('p',null,C.adText(s.cfg,'offlineMessage')||tr('mOfflineText')));
        var nx=s.upcoming[0];if(nx){var n=el('p','next');n.append(el('b',null,tr('mNextBroadcast')+': '),C.soAttr(el('span',null,nx.title),L()!=='so'),document.createTextNode(' · '+timeEAT(nx.start)));offl.append(n)}
        var a=el('a','mbtn',tr('mWatchVideos'));a.href='#muuqaal';offl.append(a);main.append(offl);
        if(!s.pv)main.append(el('p','vnote',tr('mNoStreamSet')))}
      lay.append(stage);
      // schedule
      var sch=el('section','schedule');sch.append(C.head(tr('mSchedule')));
      if(!s.upcoming.length)sch.append(el('p','empty',tr('mNoSchedule')));
      else{var ul=el('ol','schlist');s.upcoming.slice(0,12).forEach(function(x){var li=el('li');var d=new Date(x.start);var t=el('time');t.dateTime=x.start;t.append(el('b',null,C.parts(d).t),el('span',null,C.dayMonth(d)));
        var tx=el('div');tx.append(C.soAttr(el('h3',null,x.title),L()!=='so'));if(x.description)tx.append(C.soAttr(el('p',null,x.description),L()!=='so'));
        var mm=el('p','vmeta');if(x.end)mm.append(el('span',null,trf('mUntil',{t:C.parts(new Date(x.end)).t})));if(x.language)mm.append(el('span','vlang',langName(x.language)));mm.append(el('span',null,x.from==='youtube'?'YouTube':tr('mScheduled')));tx.append(mm);
        li.append(t,tx);ul.append(li)});sch.append(ul,el('p','vnote',tr('mTimesEAT')))}
      lay.append(sch,el('p','vnote',tr('mLiveRule')))}
    function tick(){if(!onRoute('toos')){clearInterval(liveTimer);liveTimer=null;return}
      cache['data/live.json']=cache['data/live-status.json']=null;liveState().then(function(s){draw(s);setBadge(s)})}
    liveState().then(function(s){draw(s);setBadge(s)});
    if(liveTimer)clearInterval(liveTimer);liveTimer=setInterval(tick,60000);
  }
  // header button: red "LIVE" with a dot only during a verified broadcast; otherwise a quiet "LIVE TV" link
  function setBadge(s){var b=document.getElementById('liveBtn');if(!b)return;b.hidden=!C.sec('live');var on=!!s.live;b.classList.toggle('on',on);
    var t=b.querySelector('span');if(t)t.textContent=on?'LIVE':tr('liveTvNav');b.setAttribute('aria-label',on?tr('mLiveNowAria'):tr('liveTvNav'))}
  function refreshBadge(){liveState().then(setBadge).catch(function(){});setTimeout(navFade,50)}

  // ---------- LIVE SPORTS ----------
  // Data comes only from the sources in data/sports.json, read by assets/sports-src.js: the Wartabiye sports proxy
  // ("apiBase", workers/sports-api), the open OpenLigaDB football data ("openData") and the football-data.org feed
  // written by GitHub Actions (data/sports-feed). With none of them the page says so and shows the official
  // viewing information; no score or fixture is ever typed in or made up here.
  var LIVE_ST={LIVE:1,IN_PLAY:1,PAUSED:1,HT:1,ET:1,BT:1,P:1};
  var sportsTimer=null,SPORTS=null;
  function sportsCfg(){return json('data/sports.json',60000).catch(function(){return {}})}
  function SRC(){return window.WT_SPORTS}
  function api(cfg,path){return SRC()?SRC().call(cfg,path):Promise.reject(new Error('not-configured'))}
  function roundTxt(m){var r=m&&m.round;if(!r)return '';if(typeof r==='object')return r.matchday?tr('sMatchday')+' '+r.matchday:'';var x=/^Matchday (\d+)$/.exec(r);return x?tr('sMatchday')+' '+x[1]:String(r)}
  function evDetail(d){if(d==='own'||d==='Own goal')return tr('sOwnGoal');if(d==='pen'||d==='Penalty')return tr('sPenalty');return d}
  function crest(u,alt){var s=C.safeUrl(u);if(!s)return el('span','crest none');var i=el('img','crest');i.src=s;i.alt=alt||'';i.loading='lazy';i.width=24;i.height=24;i.referrerPolicy='no-referrer';return i}
  function isLive(m){return !!(m&&LIVE_ST[m.status])}
  function stLabel(m){if(m&&m.status==='AWAIT')return tr('sAwait');if(isLive(m)){if(m.status==='HT'||m.status==='PAUSED')return tr('sHT');return m.minute?m.minute+"'":tr('sLive')}
    var k={FT:'sFT',FINISHED:'sFT',AET:'sAET',PEN:'sPEN',POSTPONED:'sPST',PST:'sPST',CANCELLED:'sCANC',CANC:'sCANC',SUSPENDED:'sSUSP',SUSP:'sSUSP',ABD:'sABD',AWARDED:'sFT'}[m.status];
    if(k)return tr(k);var d=new Date(m.utcDate);return isNaN(d)?'':C.parts(d).t}
  function score(m){var s=m.score||{};return (s.home!=null&&s.away!=null)?s.home+' – '+s.away:'–'}
  function mRow(m,cfg){var a=el('a','mrow'+(isLive(m)?' is-live':m.status==='AWAIT'?' is-await':''));a.href=C.hubHash('ciyaaraha-toos',{m:m.id});
    var st=el('span','mst');if(isLive(m))st.append(el('i','dot'));st.append(stLabel(m));
    var h=el('span','mteam home');h.append(crest(m.home&&m.home.crest),el('b',null,m.home&&m.home.name||''));
    var w=el('span','mteam away');w.append(crest(m.away&&m.away.crest),el('b',null,m.away&&m.away.name||''));
    var sc=el('span','msc',score(m));a.append(st,h,sc,w);
    var str=authStream(cfg,m);if(str)a.append(el('span','mtv',tr('sAuthStream')));a.setAttribute('aria-label',(m.home&&m.home.name)+' '+score(m)+' '+(m.away&&m.away.name)+', '+stLabel(m)+(roundTxt(m)?', '+roundTxt(m):''));return a}
  function groupByComp(list){var g={},o=[];list.forEach(function(m){var k=(m.competition&&m.competition.name)||'';if(!g[k]){g[k]=[];o.push(k)}g[k].push(m)});return o.map(function(k){return {name:k,comp:g[k][0].competition,list:g[k]}})}
  function mList(list,cfg,empty){var w=el('div','mlist');if(!list.length){w.append(el('p','empty',empty));return w}
    groupByComp(list).forEach(function(g){var s=el('section','mcomp');var hh=el('h3');hh.append(crest(g.comp&&g.comp.emblem),document.createTextNode(g.name+(g.comp&&g.comp.area?' · '+g.comp.area:'')));s.append(hh);g.list.forEach(function(m){s.append(mRow(m,cfg))});w.append(s)});return w}
  function authStream(cfg,m){var t=now();return (Array.isArray(cfg.streams)?cfg.streams:[]).find(function(s){
      if(!s||s.published===false||s.rightsConfirmed!==true||!String(s.rightsHolder||'').trim()||!String(s.authorization||'').trim()||!provider(s.url))return false;
      if(m&&String(s.matchId||'')!==String(m.id))return false;var st=tms(s.start),en=tms(s.end);return !isNaN(st)&&!isNaN(en)&&t>=st-30*60e3&&t<=en})}
  function streamsNow(cfg){var t=now();return (Array.isArray(cfg.streams)?cfg.streams:[]).filter(function(s){return s&&s.published!==false&&s.rightsConfirmed===true&&String(s.rightsHolder||'').trim()&&String(s.authorization||'').trim()&&provider(s.url)&&t>=tms(s.start)-30*60e3&&t<=tms(s.end)})}
  function viewingInfo(cfg){var l=Array.isArray(cfg.viewingInfo)?cfg.viewingInfo:[];if(!l.length)return null;var b=el('section','box viewinfo');b.append(el('h3',null,tr('sWhereWatch')));var ul=el('ul');
    l.forEach(function(v){if(!v)return;var li=el('li');var u=C.safeUrl(v.url);li.append(el('b',null,(v.competition||'')+': '));if(u){var a=el('a',null,v.text||u);a.href=u;a.target='_blank';a.rel='noopener';li.append(a)}else li.append(v.text||'');ul.append(li)});
    b.append(ul,el('p','vnote',tr('sWatchNote')));return b}
  function credit(d,cfg){var p=el('p','vnote dcredit');var name=(d&&d.provider)||cfg.providerName||'';if(name)p.append(tr('dataCredit')+' '+name);
    if(d&&d.updatedAt){var t=new Date(d.updatedAt);if(!isNaN(t))p.append(' · '+tr('dataUpdated')+' '+C.parts(t).t+' (EAT)')}
    if(d&&d.partial)p.append(' · '+tr('sPartial'));return p}
  var TABS=[['overview','sTabOverview'],['live','sTabLive'],['today','sTabToday'],['fixtures','fixtures'],['results','resultsTab'],['table','table']];
  function ymdLocal(d){return C.ymd(d)}
  function renderSports(h){
    var V=C.$('pageView');V.innerHTML='';clearLd();var P=C.hashParams(h);C.setTitle(tr('liveSportsNav'));
    if(!C.sec('liveSports')){off(V,'liveSportsNav');return}
    if(sportsTimer){clearInterval(sportsTimer);sportsTimer=null}
    var head=hub('sports',tr('liveSportsTitle'),tr('liveSportsSub'));var lay=el('div','wrap layout');var main=el('div','sportsmain');var side=el('aside','sidebar');lay.append(main,side);V.append(head,lay);
    main.append(el('p','empty',tr('loadingStory')));
    sportsCfg().then(function(cfg){SPORTS=cfg;main.innerHTML='';
      C.fillSide(side,[viewingInfo(cfg),C.sideLatest(C.items().filter(function(x){return C.section(x)==='sports'})),C.sideFollow()]);
      // authorised live match streams (only with confirmed broadcasting rights)
      var sn=P.m||P.t?[]:streamsNow(cfg);if(sn.length){var ss=el('section','authstreams');ss.append(C.head(tr('sAuthStreams')));sn.forEach(function(s){var c=el('div','authstream');c.append(playerBox(provider(s.url),{title:s.title}),el('h3',null,s.title||''),el('p','vnote',trf('sRightsBy',{h:s.rightsHolder})));ss.append(c)});main.append(ss)}
      Promise.all([SRC()?SRC().connected(cfg):Promise.resolve(false),SRC()?SRC().competitions(cfg):Promise.resolve([])]).then(function(r){
      if(!r[0]){var np=el('div','notconn');np.setAttribute('role','status');np.append(el('h2',null,tr('sNotConnected')),el('p',null,tr('sNotConnectedText')));
        var a=el('a','mbtn',tr('sSportsNews'));a.href='#ciyaaraha';np.append(a);main.append(np);var vi=viewingInfo(cfg);if(vi)main.append(vi);return}
      if(P.m)return matchPage(main,cfg,P.m);
      if(P.t)return teamPage(main,cfg,P.t);
      var tab=TABS.some(function(t){return t[0]===P.tab})?P.tab:'overview';var comps=r[1];
      var c=P.c&&comps.some(function(x){return String(x.id)===P.c})?P.c:(comps[0]&&String(comps[0].id))||'';
      var tl=el('div','stabs');tl.setAttribute('role','tablist');tl.setAttribute('aria-label',tr('liveSportsNav'));
      TABS.forEach(function(t){var b=el('a','stab',tr(t[1]));b.href=C.hubHash('ciyaaraha-toos',{tab:t[0]==='overview'?'':t[0],c:(t[0]==='live'||t[0]==='today'||t[0]==='overview')?'':c});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(t[0]===tab));tl.append(b)});main.append(tl);
      if((tab==='fixtures'||tab==='results'||tab==='table')&&comps.length>1){var sel=el('select','scomp');sel.setAttribute('aria-label',tr('compFilter'));comps.forEach(function(x){var o=el('option',null,x.name||x.id);o.value=x.id;if(String(x.id)===c)o.selected=true;sel.append(o)});
        sel.addEventListener('change',function(){location.hash=C.hubHash('ciyaaraha-toos',{tab:tab,c:sel.value})});var lb=el('label','scompl');lb.append(tr('compFilter')+' ',sel);main.append(lb)}
      var box=el('div','sbox');box.setAttribute('aria-live','polite');main.append(box);box.append(el('p','empty',tr('loadingStory')));
      if(tab==='overview')return overview(box,cfg);
      var path=tab==='live'?'/v1/live':tab==='today'?'/v1/matches?date='+ymdLocal(new Date()):tab==='fixtures'?'/v1/fixtures?competition='+encodeURIComponent(c):tab==='results'?'/v1/results?competition='+encodeURIComponent(c):'/v1/standings?competition='+encodeURIComponent(c);
      function load(){api(cfg,path).then(function(d){box.innerHTML='';
          if(tab==='table')box.append(table(d));
          else box.append(mList(Array.isArray(d.matches)?d.matches:[],cfg,tab==='live'?tr('sNoLive'):tr('noData')));
          box.append(credit(d,cfg))}).catch(function(e){box.innerHTML='';box.append(el('p','empty',tr('sUnavailable')))})}
      load();if(tab==='live'||tab==='today')sportsTimer=setInterval(function(){if(!onRoute('ciyaaraha-toos')){clearInterval(sportsTimer);sportsTimer=null;return}load()},Math.max(30,+cfg.refreshSeconds||60)*1000);
    })});
  }
  // overview (default): what is on now, today, coming up next and the latest results, across every connected league
  function overview(box,cfg){var useW=SRC()&&SRC().useWorker(cfg);
    var parts=[['/v1/live','sTabLive','sNoLive'],['/v1/matches?date='+ymdLocal(new Date()),'sTabToday','noData']].concat(useW?[]:[['/v1/upcoming','sUpNext','noData'],['/v1/recent','sRecentRes','noData']]);
    function load(){Promise.all(parts.map(function(p){return api(cfg,p[0]).catch(function(){return null})})).then(function(res){box.innerHTML='';box.classList.add('soverview');
      if(res.every(function(d){return !d})){box.append(el('p','empty',tr('sUnavailable')));return}
      var shown={};res.forEach(function(d,i){var l=(d&&Array.isArray(d.matches)?d.matches:[]);if(i>0)l=l.filter(function(m){return !shown[m.id]});l.forEach(function(m){shown[m.id]=1});
        if(i>=2&&!l.length)return;box.append(el('h3','sgh',tr(parts[i][1])));box.append(d?mList(l,cfg,tr(parts[i][2])):el('p','empty',tr('sUnavailable')))});
      var best=res.filter(Boolean)[0];if(best)box.append(credit(best,cfg))})}
    load();sportsTimer=setInterval(function(){if(!onRoute('ciyaaraha-toos')){clearInterval(sportsTimer);sportsTimer=null;return}load()},Math.max(30,+cfg.refreshSeconds||60)*1000)}
  function table(d){var w=el('div','stable');var rows=Array.isArray(d.table)?d.table:[];if(!rows.length){w.append(el('p','empty',tr('noData')));return w}
    if(d.competition&&d.competition.name)w.append(el('h3',null,d.competition.name+(d.season?' · '+d.season:'')));
    var t=el('table');var th=el('thead');var tr0=el('tr');['colPos','colTeam','colP','colW','colD','colL','colGD','colPts'].forEach(function(k){var c=el('th',null,tr(k));c.scope='col';tr0.append(c)});th.append(tr0);t.append(th);var tb=el('tbody');
    rows.forEach(function(r){var x=el('tr');x.append(el('td',null,String(r.position)));var tc=el('td','tteam');var a=el('a');a.href=C.hubHash('ciyaaraha-toos',{t:r.team&&r.team.id});a.append(crest(r.team&&r.team.crest),el('span',null,r.team&&r.team.name||''));tc.append(a);x.append(tc);
      [r.played,r.won,r.draw,r.lost,r.goalDifference,r.points].forEach(function(v,i){x.append(el('td',i===5?'pts':null,v==null?'':String(v)))});tb.append(x)});t.append(tb);var sc=el('div','tscroll');sc.append(t);w.append(sc);return w}
  var EV_IC={goal:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',yellow:'M7 3h10v18H7z',red:'M7 3h10v18H7z',sub:'M7 7h10l-3-3M17 17H7l3 3',var:'M3 5h18v12H3zM8 21h8',other:'M12 8v4M12 16h.01'};
  function matchPage(main,cfg,id){
    window.scrollTo(0,0);var box=el('div','mpage');box.setAttribute('aria-live','polite');main.append(box);box.append(el('p','empty',tr('loadingStory')));
    function draw(d){box.innerHTML='';var m=d.match;if(!m){box.append(el('p','empty',tr('noData')));return}
      C.setTitle((m.home&&m.home.name)+' – '+(m.away&&m.away.name));
      var hd=el('div','mhead'+(isLive(m)?' is-live':''));var comp=el('p','mcompn',(m.competition&&m.competition.name||'')+(roundTxt(m)?' · '+roundTxt(m):''));
      function team(t){var a=el('a','mt');a.href=C.hubHash('ciyaaraha-toos',{t:t&&t.id});var i=crest(t&&t.crest,'');i.width=i.height=56;a.append(i,el('b',null,t&&t.name||''));return a}
      var mid=el('div','mmid');mid.append(el('span','bigscore',score(m)));var st=el('span','mst');if(isLive(m))st.append(el('i','dot'));st.append(stLabel(m));mid.append(st);
      if(m.score&&m.score.halfTime&&m.score.halfTime.home!=null)mid.append(el('small',null,tr('sHalfTime')+' '+m.score.halfTime.home+' – '+m.score.halfTime.away));
      var row=el('div','mteams');row.append(team(m.home),mid,team(m.away));hd.append(comp,row);
      var d0=new Date(m.utcDate);var info=el('p','vmeta');if(!isNaN(d0))info.append(el('span',null,timeEAT(m.utcDate)));if(m.venue)info.append(el('span',null,m.venue));if(m.referee)info.append(el('span',null,tr('sReferee')+': '+m.referee));hd.append(info);box.append(hd);
      var str=authStream(cfg,m);
      if(str){var sb=el('section','authstream');sb.append(C.head(tr('sAuthStream')),playerBox(provider(str.url),{title:str.title}),el('p','vnote',trf('sRightsBy',{h:str.rightsHolder})));box.append(sb)}
      else{var nv=el('p','vnote',tr('sNoStream'));box.append(nv)}
      var ev=Array.isArray(m.events)?m.events:[];var tl=el('section','timeline');tl.append(C.head(tr('sEvents')));
      if(!ev.length)tl.append(el('p','empty',d.eventsAvailable===false?tr('sEventsNA'):tr('noData')));
      else{var ol=el('ol');ev.forEach(function(e){var li=el('li',e.team==='away'?'away':'home');var ic=el('span','evic '+(e.type||'other'));ic.innerHTML=C.svg(EV_IC[e.type]||EV_IC.other);
        li.append(el('b','evmin',(e.minute!=null?e.minute+(e.extra?'+'+e.extra:'')+"'":'')),ic,el('span','evtx',[e.player,evDetail(e.detail),e.score].filter(Boolean).join(' · ')));ol.append(li)});tl.append(ol)}
      if(ev.length&&d.eventTypes==='goals')tl.append(el('p','vnote',tr('sGoalsOnly')));
      box.append(tl);
      var stt=Array.isArray(m.statistics)?m.statistics:[];var sx=el('section','mstats');sx.append(C.head(tr('sStats')));
      if(!stt.length)sx.append(el('p','empty',d.statisticsAvailable===false?tr('sStatsNA'):tr('noData')));
      else stt.forEach(function(s){var r=el('div','srow');var hv=parseFloat(s.home)||0,av=parseFloat(s.away)||0,tot=hv+av||1;var bar=el('div','sbar');var hb=el('span','h');hb.style.width=(hv/tot*100)+'%';var ab=el('span','a');ab.style.width=(av/tot*100)+'%';bar.append(hb,ab);
        r.append(el('b',null,String(s.home==null?'–':s.home)),el('span',null,s.type),el('b',null,String(s.away==null?'–':s.away)),bar);sx.append(r)});
      box.append(sx,credit(d,cfg));var bk=el('a','back',tr('sBack'));bk.href='#ciyaaraha-toos';box.append(bk);return m}
    function load(){api(cfg,'/v1/match?id='+encodeURIComponent(id)).then(function(d){var m=draw(d);if(m&&!isLive(m)&&sportsTimer){clearInterval(sportsTimer);sportsTimer=null}}).catch(function(){box.innerHTML='';box.append(el('p','empty',tr('sUnavailable')))})}
    load();sportsTimer=setInterval(function(){if(!onRoute('ciyaaraha-toos')){clearInterval(sportsTimer);sportsTimer=null;return}load()},Math.max(30,+cfg.refreshSeconds||60)*1000);
  }
  function teamPage(main,cfg,id){var box=el('div','tpage');main.append(box);box.append(el('p','empty',tr('loadingStory')));
    api(cfg,'/v1/team?id='+encodeURIComponent(id)).then(function(d){box.innerHTML='';var t=d.team;if(!t){box.append(el('p','empty',tr('noData')));return}C.setTitle(t.name);
      var hd=el('div','thead');var i=crest(t.crest,'');i.width=i.height=72;hd.append(i);var tx=el('div');tx.append(el('h2',null,t.name));var m=el('p','vmeta');
      [[t.country,'country'],[t.founded,'sFounded'],[t.venue,'sVenue'],[t.coach,'sCoach']].forEach(function(x){if(x[0])m.append(el('span',null,tr(x[1])+': '+x[0]))});tx.append(m);
      var w=C.safeUrl(t.website);if(w){var a=el('a',null,tr('officialSite'));a.href=w;a.target='_blank';a.rel='noopener';tx.append(a)}hd.append(tx);box.append(hd);
      if(Array.isArray(d.matches)&&d.matches.length){box.append(C.head(tr('sTeamMatches')),mList(d.matches,cfg,tr('noData')))}
      if(Array.isArray(t.squad)&&t.squad.length){box.append(C.head(tr('sSquad')));var ul=el('ul','squad');t.squad.forEach(function(p){ul.append(el('li',null,p.name+(p.position?' · '+p.position:'')))});box.append(ul)}
      box.append(credit(d,cfg));var bk=el('a','back',tr('sBack'));bk.href='#ciyaaraha-toos';box.append(bk)}).catch(function(){box.innerHTML='';box.append(el('p','empty',tr('sUnavailable')))})}

  // ---------- LIVE NEWS: newsroom wire + official live channels (used by assets/app.js renderLiveNews) ----------
  // Headlines from the newsrooms' official feeds (BBC, BBC Somali, Al Jazeera, DW, France 24, UN News), newest first,
  // with the publisher's own time (Nairobi time). Only the headline and a link to the full article at the publisher.
  // Nothing is marked breaking unless the publisher marked it. Refreshed every minute while the page is open.
  var WIRE_REG=[['','wireAll'],['somalia','wireSomalia'],['eastafrica','wireEastAfrica'],['africa','wireAfrica'],['world','wireWorld']];
  function eatHM(d){try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}catch(e){return C.parts(d).t}}
  function wireItem(x,isNew){var li=el('li','lnitem wire'+(x.breaking?' brk':'')+(isNew?' new':''));var d=new Date(x.publishedAt);
    var t=el('time');t.dateTime=x.publishedAt;t.append(el('b',null,eatHM(d)),el('span',null,agoOrDate(d)));
    var tx=el('div','lntx');var tg=el('p','lntags');if(isNew)tg.append(el('span','lnnew',tr('lnNew')));if(x.breaking)tg.append(el('span','cat red',tr('breaking')));
    tg.append(el('span','lnsrc',x.source||''));var rg=WIRE_REG.filter(function(r){return r[0]===x.region})[0];if(rg&&x.region!=='world')tg.append(el('span','lnsec',tr(rg[1])));tx.append(tg);
    var h=el('h3');var a=el('a',null,x.title);var u=C.safeUrl(x.url);if(u){a.href=u;a.target='_blank';a.rel='noopener'}if(x.language&&x.language!==L())a.lang=x.language;h.append(a);tx.append(h);
    if(x.updatedAt){var ud=new Date(x.updatedAt);if(!isNaN(ud))tx.append(el('p','lnupd',trf('wireUpdated',{t:eatHM(ud)+' (EAT)'})))}
    var m=el('p','vmeta');var o=el('a',null,trf('wireRead',{s:x.source||''}));if(u){o.href=u;o.target='_blank';o.rel='noopener'}m.append(o);tx.append(m);li.append(t,tx);return li}
  function liveWire(main){
    var sec=el('section','wirebox');sec.setAttribute('aria-label',tr('wireTitle'));var tk=el('div','wiretick');tk.setAttribute('aria-label',tr('wireTicker'));
    var hd=C.head(tr('wireTitle'),'red');var sub=el('p','vnote',tr('wireSub'));
    var chips=el('div','wirechips');var ol=el('ol','lntl');var reg='',seen=null,timer=null,data=null;
    WIRE_REG.forEach(function(r){var b=el('button','chip',tr(r[1]));b.type='button';b.setAttribute('aria-pressed',String(r[0]===reg));b.addEventListener('click',function(){reg=r[0];[].forEach.call(chips.children,function(c){c.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');draw([])});chips.append(b)});
    // no public check time / stale warning (owner's decision, 8 Nov 2026): source health is in /admin/ and #ilaha-xaaladda
    sec.append(hd,tk,sub,chips,ol);main.append(sec);
    function ticker(items){tk.innerHTML='';var l=items.slice(0,12);if(!l.length){tk.hidden=true;return}tk.hidden=false;var lab=el('span','wtlab',tr('wireTicker'));var tr0=el('div','wttrack');var inner=el('div','wtinner');
      l.concat(l).forEach(function(x,i){var a=el('a',null,'');var u=C.safeUrl(x.url);if(u){a.href=u;a.target='_blank';a.rel='noopener'}if(i>=l.length){a.setAttribute('aria-hidden','true');a.tabIndex=-1}a.append(el('b',null,eatHM(new Date(x.publishedAt))+' · '+(x.source||'')),document.createTextNode(' '+x.title));inner.append(a)});tr0.append(inner);tk.append(lab,tr0)}
    function draw(added){ol.innerHTML='';var items=(data&&data.items||[]).filter(function(x){return x&&x.title&&C.safeUrl(x.url)&&!isNaN(new Date(x.publishedAt))});
      var fresh={};(added||[]).forEach(function(id){fresh[id]=1});var l=items.filter(function(x){return !reg||x.region===reg||(reg==='africa'&&(x.region==='eastafrica'||x.region==='somalia'))||(reg==='eastafrica'&&x.region==='somalia')});
      if(!l.length)ol.append(el('li','empty',data?tr('wireEmpty'):tr('loadingStory')));l.slice(0,60).forEach(function(x){ol.append(wireItem(x,!!fresh[x.id]))});
      ticker(items)}
    function load(){return liveFeed('live-wire.json',55000).then(function(d){var ids=(d&&d.items||[]).map(function(x){return x.id});var added=seen?ids.filter(function(id){return !seen[id]}):[];seen={};ids.forEach(function(id){seen[id]=1});data=d;draw(added)})
      .catch(function(){if(!data){ol.innerHTML='';ol.append(el('li','empty',tr('wireUnavailable')))}})}
    load();timer=setInterval(function(){if(!document.body.contains(sec)){clearInterval(timer);return}load()},60000);return sec}
  // official 24/7 news channels of the publishers, in YouTube's own live player (loaded only when the visitor presses play).
  // Whether a broadcast is on right now is shown by YouTube's player; Wartabiye TV adds no LIVE sign of its own here.
  function liveChannels(main){var box=el('section','lchans');box.setAttribute('aria-label',tr('lcTitle'));main.append(box);
    liveFeed('video-feed.json',5*60e3).then(function(d){var l=(d&&Array.isArray(d.liveChannels)?d.liveChannels:[]).filter(function(c){return c&&/^UC[A-Za-z0-9_-]{22}$/.test(c.channelId)});if(!l.length){box.remove();return}
      box.append(C.head(tr('lcTitle')),el('p','vnote',tr('lcSub')));var g=el('div','lcgrid');
      l.forEach(function(c){var card=el('div','lccard');var st=el('div','vframe lcposter');var b=el('button','lcplay');b.type='button';b.setAttribute('aria-label',trf('lcWatch',{s:c.name}));
        var ic=el('span','vicon');ic.innerHTML=C.svg('M8 5v14l11-7z');b.append(ic,el('span',null,trf('lcWatch',{s:c.name})));st.append(b);
        b.addEventListener('click',function(){var p=playerBox({p:'youtube-channel',id:c.channelId},{title:c.name,autoplay:true,eager:true});card.replaceChild(p,st)});
        var a=el('a','vyt',tr('vWatchOnYouTube'));var u=C.safeUrl(c.watchUrl);if(u){a.href=u;a.target='_blank';a.rel='noopener'}
        card.append(st,el('h3',null,c.name),a);g.append(card)});box.append(g)}).catch(function(){box.remove()})}
  // source health (admin): #ilaha-xaaladda — every feed's last check, last success, newest item and last error
  function sourceHealth(V){V.innerHTML='';C.setTitle(tr('healthTitle'));V.append(hub('videos',tr('healthTitle'),tr('healthSub')));var w=el('div','wrap page');V.append(w);w.append(el('p','empty',tr('loadingStory')));
    Promise.all([liveFeed('feeds-status.json',30000).catch(function(){return null}),json('data/live-status.json',30000).catch(function(){return null}),json('data/sports.json',60000).catch(function(){return null}),
      C.getJSON('data/sports-feed/index.json').catch(function(){return null}),C.getJSON('data/news.json').catch(function(){return null})]).then(function(r){w.innerHTML='';
      function row(tb,name,ok,a,b,c,e){var x=el('tr',ok===false?'bad':ok?'ok':'');x.append(el('td',null,name),el('td',null,ok===false?'✗':ok?'✓':'–'),el('td',null,a||''),el('td',null,b||''),el('td',null,c||''),el('td',null,e||''));tb.append(x)}
      function tm(s){var d=new Date(s);return isNaN(d)?'':C.dayMonth(d)+' '+eatHM(d)}
      function table(title,rows){w.append(C.head(title));var t=el('table','htable');var th=el('tr');[tr('healthSource'),'',tr('healthChecked'),tr('healthOk'),tr('healthNewest'),tr('healthError')].forEach(function(h){th.append(el('th',null,h))});var tb=el('tbody');t.append(el('thead'),tb);t.firstChild.append(th);rows(tb);var sc=el('div','tscroll');sc.append(t);w.append(sc)}
      var fs=r[0]&&r[0].sources||{};table(tr('healthFeeds'),function(tb){Object.keys(fs).forEach(function(k){var x=fs[k];row(tb,(x.kind==='video'?'▶ ':'')+(x.name||k),x.ok,tm(x.checkedAt),tm(x.lastOkAt),tm(x.newest)+(x.items!=null?' ('+x.items+')':''),x.error||'')});if(!Object.keys(fs).length)row(tb,tr('wireUnavailable'),false)});
      var nw=r[4]||{};var ls=r[1]||{};var sp=r[2]||{};var sf=r[3];
      table(tr('healthOther'),function(tb){row(tb,'Wartabiye TV news',!!nw.lastSuccessAt,tm(nw.lastRunAt),tm(nw.lastSuccessAt),'','');
        row(tb,'LIVE TV (YouTube check)',ls.checkedAt?true:null,tm(ls.checkedAt),ls.live?'LIVE':'',ls.source||'',ls.error||'');
        row(tb,'OpenLigaDB',(sp.openData||{}).enabled!==false&&((sp.openData||{}).leagues||[]).length?true:null,'','',((sp.openData||{}).leagues||[]).map(function(x){return x.name}).join(', '),'');
        row(tb,'football-data.org feed',sf?true:null,sf?tm(sf.updatedAt):'',sf?tm(sf.updatedAt):'',sf?(sf.competitions||[]).map(function(c){return c.name}).join(', '):tr('healthNoKey'),'');
        row(tb,'Sports proxy (apiBase)',/^https:/.test(sp.apiBase||'')?true:null,'','',sp.apiBase||tr('healthNoKey'),'')});
      if(r[0]&&r[0].checkedAt)w.append(el('p','vnote',trf('wireChecked',{t:tm(r[0].checkedAt)+' (EAT)'})))})}

  // desktop menu that scrolls sideways on narrower screens: fade the edge while more links are hidden
  function navFade(){var l=document.getElementById('links');if(!l)return;var max=l.scrollWidth-l.clientWidth;var x=Math.abs(l.scrollLeft);l.classList.toggle('fade',innerWidth>860&&max>2&&x<max-2)}
  window.WT_MEDIA={init:function(core){C=core;refreshBadge();setInterval(refreshBadge,120000);
      var l=document.getElementById('links');if(l)l.addEventListener('scroll',navFade,{passive:true});window.addEventListener('resize',navFade);setTimeout(navFade,300)},navFade:navFade,renderVideos:renderVideos,renderLive:renderLive,renderSports:renderSports,liveWire:liveWire,liveChannels:liveChannels,sourceHealth:sourceHealth,liveFeed:liveFeed,player:function(s){return playerBox(s.pv,{title:s.title||tr('liveTvNav'),autoplay:true,mute:true,eager:true})},homeStrip:homeStrip,refreshBadge:refreshBadge,liveState:liveState,
    _test:{provider:provider,embedSrc:embedSrc}};
})();
