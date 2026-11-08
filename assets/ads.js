/* Wartabiye TV · Xayeysiimaha (advertising page).
   Loaded by assets/app.js only on #xayeysiimaha, together with assets/ads-i18n.js (copy in 9 languages) and assets/ads.css.
   Every advert drawn here is a TUSAALE / DEMO for "your company": no real or invented sponsor, price, offer or figure.
   Photos: Wikimedia Commons, open licences (credited at the bottom of the page). Videos: made by Wartabiye TV from
   those photos with ffmpeg (tools/make_ad_demos.sh), H.264 mp4 without sound, so they play inline on iPhone and Android.
   Motion stops when the visitor asks for reduced motion, when a pause button is pressed, or when it is off screen.
   Demo adverts are never counted, never sent anywhere and never shown outside this page. */
(function(){
  'use strict';
  var C=null,L='so',T={};
  var DIR='img/ads/demo/';
  var REEL_SEG=2.6;               // seconds per category in reel.mp4 (tools/make_ad_demos.sh: 3.2 s shots, 0.6 s cross-fades)
  var CAT_ORDER=['air','hotel','food','tech','estate','edu','fashion','market','telecom','car'];
  // gallery layout: format, size shown in the caption, grid width, photos and/or video
  var ADS=[
    {id:'air',fmt:'billboard',size:'970 × 250',w:'w12',imgs:['air-1','air-2','air-3']},
    {id:'hotel',fmt:'video',size:'16:9 · mp4',w:'w8',video:'hotel'},
    {id:'tech',fmt:'native',size:'640 × 360',w:'w4',imgs:['tech-1','tech-2','tech-3']},
    {id:'food',fmt:'halfpage',size:'300 × 600',w:'w4',imgs:['food-1','food-2','food-3']},
    {id:'estate',fmt:'carousel',size:'1200 × 628',w:'w8',imgs:['estate-1','estate-2','estate-3']},
    {id:'fashion',fmt:'story',size:'9:16 · mp4',w:'w4',video:'fashion'},
    {id:'telecom',fmt:'square',size:'1:1 · mp4',w:'w4',video:'telecom'},
    {id:'market',fmt:'mobile',size:'320 × 100',w:'w4',imgs:['market-1','market-2','market-3']},
    {id:'edu',fmt:'leader',size:'728 × 90',w:'w12',imgs:['edu-1','edu-2','edu-3']},
    {id:'car',fmt:'spotlight',size:'1200 × 628',w:'w12',imgs:['car-1','car-3']}
  ];
  var ICON={ // 24px stroke icons
    air:'M2.5 13.5l7-1.5 4-7.5h2l-1.5 7 5-.5 1.5-2h1.5l-1 4 1 4h-1.5l-1.5-2-5-.5 1.5 7h-2l-4-7.5-7-1.5z',
    hotel:'M3 19V6M3 14h18v5M21 19v-5a3 3 0 0 0-3-3h-7v3M7 11.5a1.8 1.8 0 1 0 0-.01',
    food:'M6 3v6a2 2 0 0 0 4 0V3M8 11v10M17 21V3c-2.5 1.5-3.5 5-3.5 8H17',
    tech:'M5 5h14v10H5zM2 19h20l-2-4H4z',
    estate:'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
    edu:'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
    fashion:'M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z',
    market:'M2 4h3l2.6 11h10.2L20 7H6.2M9.5 19.5a1.5 1.5 0 1 0 0-.01M17 19.5a1.5 1.5 0 1 0 0-.01',
    telecom:'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0M12 19.5v.01',
    car:'M3 15l2-6a2 2 0 0 1 2-1.4h10a2 2 0 0 1 2 1.4l2 6v4h-3v-2H6v2H3zM3 15h18M7 12.5h.01M17 12.5h.01',
    play:'M7 4.5v15l13-7.5z', pause:'M7 4h4v16H7zM13 4h4v16h-4z', ok:'M5 12.5l4.5 4.5L19 7.5', arr:'M5 12h14M13 6l6 6-6 6',
    prev:'M15 5l-7 7 7 7', next:'M9 5l7 7-7 7', mail:'M2.5 5.5h19v13h-19zM3.5 6.5l8.5 7 8.5-7', globe:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    phone:'M7 2.5h10v19H7zM11 18.5h2', desk:'M3 4h18v12H3zM8 20h8M12 16v4', eye:'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
    tag:'M3 12V3h9l9 9-9 9zM7.5 7.5h.01', shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', clock:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7v5l3 2'
  };
  function ic(k,cls){return '<svg class="'+(cls||'ai')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(ICON[k]||'')+'"/></svg>'}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function rm(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}}
  function t(k){return T[k]!=null?T[k]:((window.WT_ADS.so||{})[k])}
  function A(id){return (T.ads||{})[id]||window.WT_ADS.so.ads[id]}
  // one span per word for the rising headline; runs of Latin words stay together so their order is right inside Arabic
  function words(s){var out=[];String(s||'').split(/\s+/).forEach(function(w){var lat=/^[A-Za-z0-9’'.,!?:&-]+$/.test(w);if(lat&&out.length&&out[out.length-1].lat)out[out.length-1].t+=' '+w;else if(w)out.push({t:w,lat:lat})});
    return out.map(function(o,i){return '<span class="w" style="--i:'+i+'"'+(o.lat&&L==='ar'?' dir="ltr"':'')+'>'+esc(o.t)+'</span>'}).join(' ')}
  function img(name,alt,cls,eager){return '<img class="'+(cls||'')+'" src="'+DIR+name+'.webp" alt="'+esc(alt||'')+'"'+(eager?'':' loading="lazy"')+' decoding="async">'}
  function demoTag(){return '<span class="dtag" lang="so">'+esc(t('demo'))+'</span>'}
  function logo(){return '<span class="ylogo"><span class="ylg" dir="ltr">LOGO</span><span class="nm">'+esc(t('yourCo'))+'</span></span>'}
  function cta(id,cls){return '<a class="acta'+(cls?' '+cls:'')+'" href="#adForm" data-toform>'+esc(A(id).c)+ic('arr','arr')+'</a>'}
  function feats(id,cls){return '<ul class="'+(cls||'feats')+'">'+A(id).f.map(function(f){return '<li>'+ic('ok')+esc(f)+'</li>'}).join('')+'</ul>'}
  function slides(names,alt,cls){return '<div class="kb '+(cls||'')+'" data-slides>'+names.map(function(n,i){return img(n,i?'':alt,'s'+(i?'':' on'))}).join('')+'</div>'}
  function video(name,alt,cls){ // muted + playsinline: iOS and Android allow inline autoplay; preload=none until it is near the screen
    return '<div class="vbox '+(cls||'')+'"><video muted playsinline loop preload="none" poster="'+DIR+name+'-poster.webp" aria-label="'+esc(alt)+'" data-vid>'+
      '<source src="'+DIR+name+'.mp4" type="video/mp4"></video></div>'}
  function pbtn(){return '<button type="button" class="apb" data-pause aria-pressed="false" aria-label="'+esc(t('pause'))+'" title="'+esc(t('pause'))+'">'+ic('pause')+'</button>'}

  // ----- the ten creatives -----
  function creative(a){
    var x=A(a.id),cat=(T.cats||{})[a.id]||a.id,alt=cat+' · '+x.h;
    switch(a.fmt){
      case 'billboard': return '<div class="cr bb">'+slides(a.imgs,alt)+'<span class="shade"></span><span class="shine"></span>'+demoTag()+
        '<div class="in">'+logo()+'<span class="kick">'+esc(x.k)+'</span><strong class="hl">'+words(x.h)+'</strong><p>'+esc(x.t)+'</p>'+feats(a.id,'chips')+'</div>'+
        '<div class="side">'+cta(a.id)+'</div><svg class="trail" viewBox="0 0 400 120" aria-hidden="true"><path d="M-10 110C120 100 260 60 410 8"/></svg></div>';
      case 'video': return '<div class="cr vd">'+video(a.video,alt)+'<span class="shade"></span>'+demoTag()+
        '<div class="in">'+logo()+'<span class="kick">'+esc(x.k)+'</span><strong class="hl">'+words(x.h)+'</strong><p>'+esc(x.t)+'</p>'+cta(a.id)+'</div></div>';
      case 'halfpage': return '<div class="cr hp">'+demoTag()+'<div class="top">'+slides(a.imgs,alt)+'<span class="kick">'+esc(x.k)+'</span></div>'+
        '<div class="in">'+logo()+'<strong class="hl">'+words(x.h)+'</strong><p>'+esc(x.t)+'</p>'+feats(a.id)+cta(a.id,'wide')+'</div></div>';
      case 'carousel': return '<div class="cr cs">'+demoTag()+'<div class="stage">'+slides(a.imgs,alt,'manual')+
        '<button type="button" class="nav pv" data-step="-1" aria-label="'+esc(t('prev'))+'">'+ic('prev')+'</button><button type="button" class="nav nx" data-step="1" aria-label="'+esc(t('next'))+'">'+ic('next')+'</button>'+
        '<div class="dots">'+a.imgs.map(function(n,i){return '<button type="button" data-go="'+i+'" aria-label="'+esc(t('slide'))+' '+(i+1)+'"'+(i?'':' aria-current="true"')+'></button>'}).join('')+'</div></div>'+
        '<div class="in">'+logo()+'<span class="kick">'+esc(x.k)+'</span><strong class="hl">'+words(x.h)+'</strong><p>'+esc(x.t)+'</p>'+feats(a.id)+cta(a.id)+'</div></div>';
      case 'story': return '<div class="cr st">'+video(a.video,alt)+'<span class="shade"></span><div class="bars"><i></i><i></i><i></i></div>'+demoTag()+
        '<div class="hd">'+logo()+'</div><div class="in"><span class="kick">'+esc(x.k)+'</span><strong class="hl">'+words(x.h)+'</strong>'+cta(a.id,'wide')+'</div></div>';
      case 'native': return '<div class="cr nt"><div class="pic">'+slides(a.imgs,alt)+demoTag()+'</div><div class="in"><span class="spon">'+esc(C.tr('adLabel'))+' · '+esc(t('yourCo'))+'</span>'+
        '<strong class="hl">'+words(x.h)+'</strong><p>'+esc(x.t)+'</p>'+feats(a.id,'chips')+cta(a.id,'link')+'</div></div>';
      case 'square': return '<div class="cr sq">'+video(a.video,alt)+'<span class="shade"></span><svg class="waves" viewBox="0 0 100 60" aria-hidden="true"><path d="M20 40a42 42 0 0 1 60 0"/><path d="M30 48a28 28 0 0 1 40 0"/><path d="M40 56a14 14 0 0 1 20 0"/></svg>'+demoTag()+
        '<div class="in">'+logo()+'<strong class="hl">'+words(x.h)+'</strong>'+feats(a.id,'chips')+cta(a.id)+'</div></div>';
      case 'mobile': return '<div class="cr mb"><div class="phone"><div class="scr"><div class="bar"><img src="img/logo.png" alt="" width="16" height="16"><b dir="ltr">WARTABIYE<span>TV</span></b></div>'+
        '<div class="ln"><s></s><s class="sh"></s><u></u><s></s><s class="sh"></s><s></s></div>'+
        '<div class="mban">'+demoTag()+slides(a.imgs,alt,'thumb')+'<div class="mt"><span class="mk">'+esc(x.k)+'</span><b>'+esc(x.h)+'</b></div><a class="mc" href="#adForm" data-toform>'+esc(x.c)+'</a>'+
        '<div class="mq" aria-hidden="true"><span>'+x.f.concat(x.f).map(esc).join(' · ')+' · </span><span>'+x.f.concat(x.f).map(esc).join(' · ')+' · </span></div></div></div></div>'+
        '<div class="note"><strong class="hl">'+words(x.h)+'</strong><p>'+esc(x.t)+'</p></div></div>';
      case 'leader': return '<div class="cr ld">'+demoTag()+slides(a.imgs,alt,'round')+'<div class="rot"><span class="kick">'+esc(x.k)+'</span><strong class="hl">'+words(x.h)+'</strong></div>'+
        '<div class="mq" aria-hidden="true"><span>'+x.f.concat(x.f).map(function(f){return ic('ok')+esc(f)}).join('')+'</span><span>'+x.f.concat(x.f).map(function(f){return ic('ok')+esc(f)}).join('')+'</span></div>'+
        logo()+cta(a.id)+'</div>';
      case 'spotlight': return '<div class="cr sp">'+slides(a.imgs,alt)+'<span class="shade"></span>'+demoTag()+'<span class="rib">'+ic('eye')+esc(t('fmt').spotlight)+'</span>'+
        '<div class="glass">'+logo()+'<span class="kick">'+esc(x.k)+'</span><strong class="hl">'+words(x.h)+'</strong><p>'+esc(x.t)+'</p>'+feats(a.id)+cta(a.id)+'</div></div>';
    }
    return '';
  }
  function card(a){
    var cat=(T.cats||{})[a.id]||a.id,fm=(T.fmt||{})[a.fmt]||a.fmt;
    return '<figure class="demo '+a.w+' f-'+a.fmt+'" data-cat="'+a.id+'"><figcaption><span class="ci">'+ic(a.id)+'</span><span class="ct"><b>'+esc(cat)+'</b><small>'+esc(fm)+' · <span dir="ltr">'+a.size+'</span></small></span>'+pbtn()+'</figcaption>'+
      '<div class="frame">'+creative(a)+'</div></figure>'}

  // ----- hero: one reel of all ten business types, with the headline of each type over it -----
  function hero(){
    var chips=CAT_ORDER.map(function(id,i){return '<button type="button" data-ch="'+i+'"><span>'+ic(id)+'</span>'+esc((T.cats||{})[id]||id)+'</button>'}).join('');
    return '<section class="ahero"><div class="wrap">'+
      '<div class="htx"><span class="hk">'+ic('tag')+esc(t('kick'))+'</span><h1>'+esc(t('h1'))+'</h1><p>'+esc(t('sub'))+'</p>'+
      '<div class="ctas"><a class="btn primary" href="#adForm" data-toform>'+esc(t('order'))+ic('arr','arr')+'</a><a class="btn ghost" href="#xiriir">'+esc(t('contact'))+'</a><a class="btn link" href="#adDemos" data-todemos>'+esc(t('see'))+' ↓</a></div>'+
      '<ul class="facts">'+t('facts').map(function(f){return '<li><b dir="ltr">'+esc(f[0])+'</b><span>'+esc(f[1])+'</span></li>'}).join('')+'</ul></div>'+
      '<div class="reel" data-reel><div class="scr">'+video('reel',t('reel'),'rv')+'<span class="shade"></span>'+demoTag()+
      '<div class="rov"><span class="rk"></span><strong class="hl"></strong><span class="rc"></span></div><div class="rbrand"><img src="img/logo.png" alt="" width="22" height="22"><b dir="ltr">WARTABIYE<span>TV</span></b></div></div>'+
      '<div class="rbar"><i></i></div><div class="rctl"><button type="button" class="rpb" data-rplay>'+ic('pause')+'</button><div class="rch" role="group" aria-label="'+esc(t('galTitle'))+'">'+chips+'</div></div>'+
      '<p class="rnote">'+esc(t('reelNote'))+'</p><p class="rstill" hidden>'+esc(t('still'))+'</p></div></div></section>'}

  // ----- placements: a desktop page and a phone, each slot lights up when its row is chosen -----
  function placements(){
    var P=t('places'),keys=['home','sidebar','article','mobile','spotlight','video'];
    var slot=function(k,cls){return '<span class="slot s-'+k+' '+(cls||'')+'" data-slot="'+k+'"><em>'+esc(C.tr('adLabel'))+'</em><b>'+esc(P[k][0])+'</b><small dir="ltr">'+esc(P[k][2])+'</small></span>'};
    var desk='<div class="desk" aria-hidden="true"><div class="dbar"><i></i><i></i><i></i><span dir="ltr">wartabiyetv.com</span></div><div class="dpage"><div class="dhead"><img src="img/logo.png" alt="" width="18" height="18"><b dir="ltr">WARTABIYE<span>TV</span></b></div><div class="dnav"></div>'+
      '<div class="dmain"><div class="dmos"><s class="big"></s><s></s><s></s><s></s><s></s></div>'+slot('home')+'<div class="dcols"><div class="dlist"><s></s><s></s>'+slot('article','in')+'<s></s>'+slot('spotlight')+'</div><div class="dside">'+slot('sidebar')+slot('video')+'</div></div></div></div></div>';
    var phone='<div class="mphone" aria-hidden="true"><div class="mscr"><div class="mhead"><img src="img/logo.png" alt="" width="14" height="14"><b dir="ltr">WARTABIYE<span>TV</span></b></div><s class="big"></s><s></s>'+slot('mobile')+'<s></s><s></s></div></div>';
    var pr=(C.site()&&C.site().adPrices)||{},showP=pr.show===true&&Array.isArray(pr.items);
    function price(k){var p=showP&&pr.items.find(function(x){return x&&x.type===k&&x.price});return p?'<em class="pp">'+esc(C.tr('price'))+': '+esc(p.price)+(p.period?' / '+esc(p.period):'')+'</em>':''}
    var list='<ol class="plist">'+keys.map(function(k,i){return '<li><button type="button" data-p="'+k+'" aria-pressed="'+(i?'false':'true')+'"><span class="n">'+String(i+1).padStart(2,'0')+'</span><span class="pt"><b>'+esc(P[k][0])+'</b><span>'+esc(P[k][1])+'</span>'+price(k)+'</span><small dir="ltr">'+esc(P[k][2])+'</small></button></li>'}).join('')+'</ol>';
    return '<section class="secblock aplace" id="adPlaces"><div class="blockhead red"><h2>'+esc(t('placeTitle'))+'</h2></div><p class="lede">'+esc(t('placeSub'))+'</p>'+
      '<div class="pgrid" data-on="home"><div class="mock">'+desk+phone+'</div>'+list+'</div></section>'}

  function steps(){return '<section class="secblock ahow"><div class="blockhead"><h2>'+esc(t('howTitle'))+'</h2></div><ol class="steps">'+
    t('steps').map(function(s,i){return '<li><span class="n">'+(i+1)+'</span><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></li>'}).join('')+'</ol>'+
    '<div class="rules"><h3>'+ic('shield')+esc(t('rulesTitle'))+'</h3><ul>'+t('rules').map(function(r){return '<li>'+ic('ok')+esc(r)+'</li>'}).join('')+'</ul>'+
    '<a href="#siyaasadda-xayeysiiska">'+esc(t('policy'))+' →</a></div></section>'}

  function band(){return '<section class="aband"><div><span class="bk">'+esc(t('kick'))+'</span><h2>'+esc(t('h1'))+'</h2><p>'+esc(t('band'))+' '+esc(t('bandSub'))+'</p></div>'+
    '<div class="ctas"><a class="btn primary" href="#adForm" data-toform>'+esc(t('order'))+'</a><a class="btn ghost" href="#xiriir">'+esc(t('contact'))+'</a></div></section>'}

  // ----- request form: Web3Forms when the key is set in /admin/; otherwise an honest e-mail fallback -----
  function form(){
    var el=C.el,field=C.field;
    var sec=el('section','secblock aform');sec.id='adForm';
    var hd=el('div','blockhead red');hd.append(el('h2',null,t('formTitle')));sec.append(hd,el('p','lede',t('formSub')));
    var cats=CAT_ORDER.map(function(id){return [(T.cats||{})[id],(T.cats||{})[id]]}).concat([[t('other'),t('other')]]);
    var P=t('places');var places=['home','sidebar','article','mobile','spotlight','video'].map(function(k){return [P[k][0],P[k][0]]}).concat([[t('other'),t('other')]]);
    var periods=t('periods').map(function(p){return [p,p]});
    var g1=el('div','grid2'),g2=el('div','grid2'),g3=el('div','grid2'),g4=el('div','grid2');
    g1.append(field('text','business',t('fBiz'),true,{maxlength:'160',autocomplete:'organization'}),field('text','name',t('fPerson'),true,{maxlength:'120',autocomplete:'name'}));
    g2.append(field('email','email',C.tr('fEmail'),true,{maxlength:'160',autocomplete:'email'}),field('tel','phone',C.tr('fPhone'),true,{maxlength:'20',autocomplete:'tel'}));
    g3.append(field('select','category',t('fCat'),true,{options:cats}),field('select','placement',t('fPlace'),true,{options:places}));
    g4.append(field('select','period',t('fPeriod'),true,{options:periods}),field('date','start',t('fStart'),false,{}));
    var f=C.buildForm('advertising',[g1,g2,g3,g4,field('url','website',t('fSite'),false,{maxlength:'200',placeholder:'https://'}),field('textarea','message',t('fMsg'),true,{rows:'5',maxlength:'3000'})],
      function(d){return 'Wartabiye TV · Codsi xayeysiis · '+(d.business||'')},t('order'));
    var send=f.querySelector('.send'),row=el('div','sendrow');if(send){send.replaceWith(row);row.append(send)}
    if(!C.formCfg().key){ // no form service yet: say so plainly and offer the visitor's own e-mail app instead
      var off=f.querySelector('.status.bad[role=note]');if(off)off.remove();
      var mb=el('button','btn ghost-dark mailbtn');mb.type='button';mb.innerHTML=ic('mail');mb.append(t('mailBtn'));row.append(mb);
      var mn=el('p','mailnote',t('mailNote'));f.append(mn);
      mb.addEventListener('click',function(){
        var need=f.querySelector('[name=business]');if(need&&!need.value.trim()){need.focus();need.setAttribute('aria-invalid','true');return}
        var lines=[];f.querySelectorAll('input,select,textarea').forEach(function(i){if(!i.name||i.name==='botcheck'||i.name==='consent'||!i.value.trim())return;var lb=i.closest('label');lines.push((lb?lb.firstChild.textContent:i.name)+': '+i.value.trim())});
        var to=(C.site()&&C.site().forms&&C.site().forms.email)||'wartabiyetv@gmail.com';
        location.href='mailto:'+to+'?subject='+encodeURIComponent('Wartabiye TV · '+t('formTitle')+' · '+need.value.trim())+'&body='+encodeURIComponent(lines.join('\n'))})}
    sec.append(f);return sec}

  function credits(){
    var list=(window.WT_AD_CREDITS||[]);if(!list.length)return '';
    return '<details class="acred"><summary>'+esc(t('creditsTitle'))+'</summary><p>'+esc(t('creditsSub'))+'</p><ul>'+
      list.map(function(c){return '<li><b>'+esc(((T.cats||{})[c.cat]||c.cat)+' '+c.n)+'</b> · <a href="'+esc(c.page)+'" target="_blank" rel="noopener" dir="ltr">'+esc(c.title)+'</a> · <span dir="auto">'+esc(c.author||'')+'</span> · <a href="'+esc(c.licUrl||c.page)+'" target="_blank" rel="noopener" dir="ltr">'+esc(c.lic)+'</a></li>'}).join('')+'</ul></details>'}

  // ----- behaviour -----
  var IO=null,TICK=null;
  function setupMotion(root){
    var reduce=rm();
    // slideshows: every 4.5 s the next photo fades in with a slow zoom; only while visible and not paused
    if(TICK)clearInterval(TICK);
    TICK=setInterval(function(){if(document.hidden||!document.body.contains(root)){if(!document.body.contains(root))clearInterval(TICK);return}
      root.querySelectorAll('[data-slides]').forEach(function(k){if(k.classList.contains('manual')&&k.dataset.touched)return;var f=k.closest('[data-motion]');if(reduce||!f||f.dataset.vis!=='1'||f.classList.contains('paused'))return;step(k,1)})},4500);
    // videos and visibility
    if(IO)IO.disconnect();
    IO=('IntersectionObserver' in window)?new IntersectionObserver(function(es){es.forEach(function(e){var f=e.target;f.dataset.vis=e.isIntersecting?'1':'0';syncVideo(f)})},{threshold:.45}):null;
    root.querySelectorAll('[data-motion]').forEach(function(f){if(reduce)f.classList.add('paused');if(IO)IO.observe(f);else{f.dataset.vis='1';syncVideo(f)}
      var b=f.querySelector('[data-pause]');if(b){paintPause(b,f);b.addEventListener('click',function(){f.classList.toggle('paused');f.dataset.user='1';paintPause(b,f);syncVideo(f)})}});
    root.querySelectorAll('video[data-vid]').forEach(function(v){var last=0;v.addEventListener('timeupdate',function(){if(v.currentTime<last-0.5){var c=v.closest('.cr');if(c){c.classList.remove('again');void c.offsetWidth;c.classList.add('again')}}last=v.currentTime})});
    document.addEventListener('visibilitychange',function(){root.querySelectorAll('[data-motion]').forEach(syncVideo)});
  }
  function paintPause(b,f){var p=f.classList.contains('paused');b.setAttribute('aria-pressed',String(p));var lab=p?t('play'):t('pause');b.setAttribute('aria-label',lab);b.title=lab;b.innerHTML=ic(p?'play':'pause')}
  function syncVideo(f){var v=f.querySelector('video[data-vid]');if(!v)return;var go=f.dataset.vis==='1'&&!f.classList.contains('paused')&&!document.hidden;
    if(go){if(v.preload==='none')v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){f.classList.add('paused');var b=f.querySelector('[data-pause],[data-rplay]');if(b&&b.hasAttribute('data-pause'))paintPause(b,f)})}else if(!v.paused)v.pause()}
  function step(k,d,to){var s=k.querySelectorAll('.s');if(s.length<2)return;var i=[].indexOf.call(s,k.querySelector('.s.on'));var n=to!=null?to:(i+d+s.length)%s.length;
    s.forEach(function(x,j){x.classList.toggle('on',j===n)});var dots=k.parentNode.querySelectorAll('[data-go]');dots.forEach(function(b,j){if(j===n)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')})}

  function setupReel(root){
    var R=root.querySelector('[data-reel]');if(!R)return;var v=R.querySelector('video'),btn=R.querySelector('[data-rplay]'),bar=R.querySelector('.rbar i');
    var rk=R.querySelector('.rk'),hl=R.querySelector('.hl'),rc=R.querySelector('.rc'),chips=R.querySelectorAll('[data-ch]'),cur=-1;
    R.setAttribute('data-motion','');R.classList.add('demo-r');
    function show(i){if(i===cur)return;cur=i;var id=CAT_ORDER[i],x=A(id);rk.innerHTML=ic(id)+esc((T.cats||{})[id]||id);hl.innerHTML=words(x.h);rc.innerHTML='<a class="acta" href="#adForm" data-toform>'+esc(x.c)+ic('arr','arr')+'</a>';
      var s=R.querySelector('.scr');s.classList.remove('again');void s.offsetWidth;s.classList.add('again');chips.forEach(function(c,j){c.setAttribute('aria-pressed',String(j===i))})}
    function paint(){var p=R.classList.contains('paused');btn.innerHTML=ic(p?'play':'pause');var lab=p?t('play'):t('pause');btn.setAttribute('aria-label',lab);btn.title=lab}
    v.addEventListener('timeupdate',function(){var i=Math.max(0,Math.min(CAT_ORDER.length-1,Math.floor((v.currentTime+0.3)/REEL_SEG)));show(i);if(v.duration)bar.style.width=(v.currentTime/v.duration*100)+'%'});
    btn.addEventListener('click',function(){R.classList.toggle('paused');R.dataset.user='1';paint();syncVideo(R)});
    chips.forEach(function(c,i){c.addEventListener('click',function(){try{v.preload='auto';v.currentTime=i*REEL_SEG+0.05}catch(e){}show(i);if(R.classList.contains('paused')&&!rm()){R.classList.remove('paused');paint();syncVideo(R)}})});
    if(rm()){R.querySelector('.rstill').hidden=false}
    show(0);paint();
  }

  function setupUI(root){
    // filters
    var fb=root.querySelector('.afilter');if(fb)fb.addEventListener('click',function(e){var b=e.target.closest('[data-f]');if(!b)return;var k=b.dataset.f;
      fb.querySelectorAll('[data-f]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
      root.querySelectorAll('.demo').forEach(function(d){d.hidden=k!=='all'&&d.dataset.cat!==k});
      var g=root.querySelector('.agal');g.classList.toggle('one',k!=='all')});
    // carousel arrows and dots
    root.querySelectorAll('.cs .stage').forEach(function(s){var k=s.querySelector('[data-slides]');s.addEventListener('click',function(e){var b=e.target.closest('[data-step],[data-go]');if(!b)return;k.dataset.touched='1';
      if(b.dataset.step)step(k,+b.dataset.step);else step(k,0,+b.dataset.go)})});
    // placements
    var pg=root.querySelector('.pgrid');if(pg){var on=function(k){pg.dataset.on=k;pg.querySelectorAll('[data-p]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.p===k))})};
      pg.querySelectorAll('[data-p]').forEach(function(b){b.addEventListener('click',function(){on(b.dataset.p)});b.addEventListener('mouseenter',function(){on(b.dataset.p)});b.addEventListener('focus',function(){on(b.dataset.p)})})}
    // every demo call-to-action leads to the request form, never to an outside site
    root.addEventListener('click',function(e){var a=e.target.closest('[data-toform]');if(a){e.preventDefault();toForm()}var d=e.target.closest('[data-todemos]');if(d){e.preventDefault();var g=document.getElementById('adDemos');if(g)g.scrollIntoView({behavior:rm()?'auto':'smooth'})}});
  }
  function toForm(){var f=document.getElementById('adForm');if(!f)return;f.scrollIntoView({behavior:rm()?'auto':'smooth'});var i=f.querySelector('input:not([type=checkbox])');if(i)setTimeout(function(){i.focus({preventScroll:true})},rm()?0:600)}

  function render(core){
    C=core;L=C.lang();T=window.WT_ADS[L]||window.WT_ADS.so;
    var V=C.$('pageView');V.innerHTML='';C.setTitle(t('h1'));
    var root=C.el('div','adpage');root.lang=L;
    var gal='<section class="secblock agals" id="adDemos"><div class="blockhead red"><h2>'+esc(t('galTitle'))+'</h2></div>'+
      '<div class="gintro"><p class="lede">'+esc(t('galSub'))+'</p><p class="dnote">'+ic('shield')+'<span>'+esc(t('demoNote'))+'</span></p></div>'+
      '<div class="afilter" role="group" aria-label="'+esc(t('galTitle'))+'"><button type="button" data-f="all" aria-pressed="true">'+esc(t('all'))+'</button>'+
      CAT_ORDER.map(function(id){return '<button type="button" data-f="'+id+'" aria-pressed="false">'+ic(id)+esc((T.cats||{})[id])+'</button>'}).join('')+'</div>'+
      '<div class="agal">'+ADS.map(card).join('')+'</div></section>';
    root.innerHTML=hero()+'<div class="wrap page">'+gal+placements()+steps()+band()+'</div>';
    var w=root.querySelector('.wrap.page');w.append(form());var cr=C.el('div');cr.innerHTML=credits();if(cr.firstChild)w.append(cr.firstChild);
    root.querySelectorAll('.demo').forEach(function(d){d.setAttribute('data-motion','')});
    V.append(root);
    setupReel(root);setupMotion(root);setupUI(root);
  }
  window.WT_ADPAGE={render:render};
})();
