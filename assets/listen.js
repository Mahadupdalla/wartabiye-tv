/*! © 2026 Wartabiye TV. All Rights Reserved. This code, design, text and branding are the property of Wartabiye TV; copying, reuse or redistribution without written permission is prohibited. */
/* "Dhageyso Warbixinta": the article audio player under every article's headline and byline (assets/app.js renderStory
   calls WTListen.player). It reads the article on screen, in the language on screen, with the newsroom's fixed voice for
   that language. The audio is made by our own service (workers/tts, the address is in this script tag's data-endpoint,
   filled in by .github/workflows/tts-deploy.yml): nothing is asked for until the visitor presses Play, nothing plays by
   itself, and the provider key never reaches the browser. No endpoint = no player (never a button that cannot work). */
(function(){
  'use strict';
  var me=document.currentScript;
  var EP=((me&&me.getAttribute('data-endpoint'))||'').trim().replace(/\/+$/,'');
  if(!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(EP)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(EP))EP='';
  var RATES=[0.75,1,1.25,1.5,2];
  var LS_RATE='wartabiye-listen-rate',LS_VOL='wartabiye-listen-vol';
  // a tenth of a second of silence: started inside the Play press so phones (iOS Safari) allow the real audio afterwards
  var SILENT='data:audio/mpeg;base64,//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
  // labels in the 9 languages of the website (the narration is always in the same language as the page)
  var T={
    so:{name:'Af-Soomaali',listen:'Dhageyso Warbixinta',pause:'Hakad',resume:'Sii wad',stop:'Jooji',replay:'Mar kale dhageyso',speed:'Xawaaraha',volume:'Heerka codka',mute:'Aamusi',unmute:'Cod soo celi',seek:'Meesha la dhageysanayo',loading:'Codka warbixinta waa la diyaarinayaa…',approx:'qiyaastii {n} daqiiqo',voiceOf:'Codka: {l}',
        err:'Codku hadda lama heli karo. Fadlan mar kale isku day.',noVoice:'Warbixintan hadda looma hayo cod af-Soomaali ah. Qoraalka ayaad akhrisan kartaa.',busy:'Adeegga codka hadda wuu mashquulsan yahay. Dhowr daqiiqo kadib isku day.',retry:'Isku day mar kale',tap:'Riix badhanka si aad u dhageysato.',of:'/'},
    en:{name:'English',listen:'Listen to Article',pause:'Pause',resume:'Resume',stop:'Stop',replay:'Listen again',speed:'Speed',volume:'Volume',mute:'Mute',unmute:'Unmute',seek:'Playback position',loading:'Preparing the audio…',approx:'about {n} min',voiceOf:'Narrated in {l}',
        err:'Audio is not available right now. Please try again.',noVoice:'Audio narration in English is not available for this article. You can read the full text below.',busy:'The audio service is busy. Please try again in a few minutes.',retry:'Try again',tap:'Press play to listen.',of:'of'},
    ar:{name:'العربية',listen:'استمع إلى المقال',pause:'إيقاف مؤقت',resume:'استئناف',stop:'إيقاف',replay:'استمع مرة أخرى',speed:'السرعة',volume:'مستوى الصوت',mute:'كتم الصوت',unmute:'إلغاء الكتم',seek:'موضع التشغيل',loading:'جارٍ تجهيز الصوت…',approx:'نحو {n} دقيقة',voiceOf:'القراءة باللغة {l}',
        err:'الصوت غير متاح حاليًا. يُرجى المحاولة مرة أخرى.',noVoice:'القراءة الصوتية باللغة العربية غير متاحة لهذا المقال. يمكنك قراءة النص كاملًا أدناه.',busy:'خدمة الصوت مشغولة حاليًا. يُرجى المحاولة بعد بضع دقائق.',retry:'حاول مرة أخرى',tap:'اضغط على زر التشغيل للاستماع.',of:'من'},
    fr:{name:'Français',listen:'Écouter l’article',pause:'Pause',resume:'Reprendre',stop:'Arrêter',replay:'Réécouter',speed:'Vitesse',volume:'Volume',mute:'Couper le son',unmute:'Rétablir le son',seek:'Position de lecture',loading:'Préparation de l’audio…',approx:'environ {n} min',voiceOf:'Lu en {l}',
        err:'L’audio n’est pas disponible pour le moment. Veuillez réessayer.',noVoice:'La lecture audio en français n’est pas disponible pour cet article. Le texte complet reste disponible ci-dessous.',busy:'Le service audio est occupé. Réessayez dans quelques minutes.',retry:'Réessayer',tap:'Appuyez sur lecture pour écouter.',of:'sur'},
    de:{name:'Deutsch',listen:'Artikel anhören',pause:'Pause',resume:'Fortsetzen',stop:'Stopp',replay:'Erneut anhören',speed:'Tempo',volume:'Lautstärke',mute:'Stummschalten',unmute:'Ton an',seek:'Wiedergabeposition',loading:'Audio wird vorbereitet …',approx:'ca. {n} Min.',voiceOf:'Gelesen auf {l}',
        err:'Audio ist gerade nicht verfügbar. Bitte versuchen Sie es erneut.',noVoice:'Für diesen Artikel ist keine Vorlesefunktion auf Deutsch verfügbar. Der vollständige Text steht unten.',busy:'Der Audiodienst ist ausgelastet. Bitte versuchen Sie es in einigen Minuten erneut.',retry:'Erneut versuchen',tap:'Zum Anhören auf Wiedergabe drücken.',of:'von'},
    it:{name:'Italiano',listen:'Ascolta l’articolo',pause:'Pausa',resume:'Riprendi',stop:'Stop',replay:'Ascolta di nuovo',speed:'Velocità',volume:'Volume',mute:'Disattiva audio',unmute:'Riattiva audio',seek:'Posizione di ascolto',loading:'Preparazione dell’audio…',approx:'circa {n} min',voiceOf:'Letto in {l}',
        err:'L’audio non è disponibile al momento. Riprova.',noVoice:'La lettura audio in italiano non è disponibile per questo articolo. Il testo completo è qui sotto.',busy:'Il servizio audio è occupato. Riprova tra qualche minuto.',retry:'Riprova',tap:'Premi play per ascoltare.',of:'di'},
    es:{name:'Español',listen:'Escuchar el artículo',pause:'Pausa',resume:'Reanudar',stop:'Detener',replay:'Escuchar de nuevo',speed:'Velocidad',volume:'Volumen',mute:'Silenciar',unmute:'Activar sonido',seek:'Posición de reproducción',loading:'Preparando el audio…',approx:'unos {n} min',voiceOf:'Narrado en {l}',
        err:'El audio no está disponible en este momento. Inténtalo de nuevo.',noVoice:'La narración en español no está disponible para este artículo. Puedes leer el texto completo a continuación.',busy:'El servicio de audio está ocupado. Inténtalo de nuevo en unos minutos.',retry:'Reintentar',tap:'Pulsa reproducir para escuchar.',of:'de'},
    nl:{name:'Nederlands',listen:'Luister naar het artikel',pause:'Pauze',resume:'Hervatten',stop:'Stoppen',replay:'Opnieuw luisteren',speed:'Snelheid',volume:'Volume',mute:'Dempen',unmute:'Geluid aan',seek:'Afspeelpositie',loading:'Audio wordt voorbereid…',approx:'ongeveer {n} min',voiceOf:'Voorgelezen in het {l}',
        err:'Audio is nu niet beschikbaar. Probeer het opnieuw.',noVoice:'Voorlezen in het Nederlands is niet beschikbaar voor dit artikel. De volledige tekst staat hieronder.',busy:'De audiodienst is druk. Probeer het over een paar minuten opnieuw.',retry:'Opnieuw proberen',tap:'Druk op afspelen om te luisteren.',of:'van'},
    tr:{name:'Türkçe',listen:'Haberi dinle',pause:'Duraklat',resume:'Devam et',stop:'Durdur',replay:'Yeniden dinle',speed:'Hız',volume:'Ses düzeyi',mute:'Sesi kapat',unmute:'Sesi aç',seek:'Oynatma konumu',loading:'Ses hazırlanıyor…',approx:'yaklaşık {n} dk',voiceOf:'{l} seslendirme',
        err:'Ses şu anda kullanılamıyor. Lütfen tekrar deneyin.',noVoice:'Bu haber için Türkçe sesli okuma kullanılamıyor. Haberin tam metni aşağıdadır.',busy:'Ses hizmeti şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',retry:'Tekrar dene',tap:'Dinlemek için oynat düğmesine basın.',of:'/'}
  };
  // the language name inside "Narrated in …" where the sentence needs another form than the language's own name
  var IN={ar:'العربية',nl:'Nederlands',de:'Deutsch',fr:'français',it:'italiano',es:'español',en:'English',tr:'Türkçe',so:'af-Soomaali'};
  var ICON={
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    stop:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/></svg>',
    replay:'<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ln" d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"/></svg>',
    vol:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="ln" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    mute:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="ln" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
    wave:'<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ln" d="M3 12h1.5M6.5 8v8M10 5v14M13.5 8.5v7M17 6.5v11M20.5 10.5v3"/></svg>'
  };
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
  function fmt(s){if(!isFinite(s)||s<0)s=0;s=Math.floor(s);var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')}
  function savedRate(){var r=parseFloat(lsGet(LS_RATE));return RATES.indexOf(r)>=0?r:1}
  function savedVol(){var v=parseFloat(lsGet(LS_VOL));return v>=0&&v<=1?v:1}
  var active=null;               // one narration at a time on the page
  var memo={};                   // id|lang → the service's answer (a second Play on the same article does not ask again)

  function player(o){
    if(!EP||!o||!o.id||!T[o.lang])return null;
    if(active)active.destroy();
    var S=T[o.lang],lang=o.lang,key=o.id+'|'+lang;
    var root=el('section','listen');root.setAttribute('aria-label',S.listen);root.lang=lang;root.dir=lang==='ar'?'rtl':'ltr';root.dataset.state='idle';
    var play=el('button','ls-play');play.type='button';
    var main=el('div','ls-main');
    var top=el('div','ls-top');var label=el('span','ls-label',S.listen);
    var sub=el('span','ls-sub');var langTag=el('span','ls-lang');langTag.innerHTML=ICON.wave;langTag.append(el('span',null,S.voiceOf.replace('{l}',IN[lang]||S.name)));
    var est=o.chars>0?Math.max(1,Math.round(o.chars/14/60)):0;      // about 14 spoken characters a second
    var estEl=est?el('span','ls-est',S.approx.replace('{n}',est)):null;
    sub.append(langTag);if(estEl)sub.append(estEl);
    top.append(label,sub);
    var bar=el('div','ls-bar');
    var seek=el('input','ls-seek');seek.type='range';seek.min='0';seek.max='0';seek.step='any';seek.value='0';seek.disabled=true;seek.setAttribute('aria-label',S.seek);
    var time=el('span','ls-time');time.dir='ltr';var cur=el('span','ls-cur','0:00'),tot=el('span','ls-tot','');time.append(cur,tot);
    bar.append(seek,time);
    main.append(top,bar);
    var ctl=el('div','ls-ctl');
    var spd=el('select','ls-speed');spd.setAttribute('aria-label',S.speed);spd.title=S.speed;
    RATES.forEach(function(r){var op=el('option',null,String(r).replace('.',lang==='so'||lang==='en'||lang==='ar'?'.':',')+'×');op.value=String(r);spd.append(op)});
    spd.value=String(savedRate());
    var stop=el('button','ls-stop');stop.type='button';stop.innerHTML=ICON.stop;stop.setAttribute('aria-label',S.stop);stop.title=S.stop;stop.disabled=true;
    var volW=el('div','ls-vol');var mute=el('button','ls-mute');mute.type='button';
    var vol=el('input','ls-volr');vol.type='range';vol.min='0';vol.max='1';vol.step='0.05';vol.value=String(savedVol());vol.setAttribute('aria-label',S.volume);
    volW.append(mute,vol);
    ctl.append(spd,stop,volW);
    var msg=el('p','ls-msg');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
    var retry=el('button','ls-retry',S.retry);retry.type='button';retry.hidden=true;
    var foot=el('div','ls-foot');foot.append(msg,retry);
    root.append(play,main,ctl,foot);
    function syncFoot(){foot.hidden=!msg.textContent&&retry.hidden}

    var audio=null,state='idle',req=null,info=memo[key]||null,dragging=false,dead=false;
    function setState(s){state=s;root.dataset.state=s;
      var playing=s==='playing',busy=s==='loading';
      play.innerHTML=playing?ICON.pause:s==='ended'?ICON.replay:ICON.play;
      var lab=playing?S.pause:s==='paused'?S.resume:s==='ended'?S.replay:S.listen;
      play.setAttribute('aria-label',lab);play.title=lab;play.setAttribute('aria-pressed',String(playing));
      play.disabled=busy;root.setAttribute('aria-busy',String(busy));
      stop.disabled=!(playing||s==='paused'||s==='ended');
      if(s!=='error'){retry.hidden=true;if(s!=='loading')msg.textContent=''}
      syncFoot();
    }
    function setMute(){var m=!audio?savedVol()===0:audio.muted||audio.volume===0;mute.innerHTML=m?ICON.mute:ICON.vol;mute.setAttribute('aria-label',m?S.unmute:S.mute);mute.title=mute.getAttribute('aria-label');mute.setAttribute('aria-pressed',String(m))}
    setMute();setState('idle');
    function fail(code){
      if(dead)return;setState('error');
      msg.textContent=code==='no_voice'||code==='no_text'||code==='too_long'?S.noVoice:code==='busy'||code==='limit'?S.busy:S.err;
      retry.hidden=code==='no_voice'||code==='no_text'||code==='too_long';syncFoot();
      if(audio){try{audio.pause()}catch(e){}}
    }
    function showTime(){if(!audio)return;var d=audio.duration;if(!isFinite(d)||!d)d=info&&info.duration||0;
      if(!dragging){seek.max=String(d||0);seek.value=String(Math.min(audio.currentTime,d||0))}
      var c=dragging?parseFloat(seek.value):audio.currentTime;cur.textContent=fmt(c);tot.textContent=d?' / '+fmt(d):'';
      seek.disabled=!d;seek.setAttribute('aria-valuetext',fmt(c)+(d?' '+S.of+' '+fmt(d):''));
      var pct=d?Math.min(100,c/d*100):0;seek.style.setProperty('--p',pct+'%')}
    function mediaSession(){if(!('mediaSession' in navigator))return;try{
      var art=[{src:new URL('img/logo.png',document.baseURI).href,sizes:'512x512',type:'image/png'}];
      if(o.image)art.unshift({src:new URL(o.image,document.baseURI).href});
      navigator.mediaSession.metadata=new MediaMetadata({title:o.title||document.title,artist:'Wartabiye TV',album:S.listen,artwork:art});
      navigator.mediaSession.setActionHandler('play',function(){resume()});
      navigator.mediaSession.setActionHandler('pause',function(){pause()});
      navigator.mediaSession.setActionHandler('stop',function(){stopAll()});
      navigator.mediaSession.setActionHandler('seekbackward',function(){if(audio)audio.currentTime=Math.max(0,audio.currentTime-15)});
      navigator.mediaSession.setActionHandler('seekforward',function(){if(audio)audio.currentTime=Math.min(audio.duration||0,audio.currentTime+15)});
    }catch(e){}}
    function makeAudio(){
      audio=new Audio();audio.preload='auto';
      audio.addEventListener('timeupdate',function(){if(!root.isConnected){destroy();return}showTime();if(root.offsetParent===null&&!audio.paused)pause()});
      audio.addEventListener('loadedmetadata',showTime);audio.addEventListener('durationchange',showTime);
      audio.addEventListener('playing',function(){if(audio.src!==SILENT)setState('playing')});
      audio.addEventListener('pause',function(){if(state==='playing')setState('paused')});
      audio.addEventListener('waiting',function(){if(state==='playing')root.dataset.buffering='1'});
      audio.addEventListener('canplay',function(){delete root.dataset.buffering});
      audio.addEventListener('ended',function(){if(audio.src===SILENT)return;setState('ended');showTime()});
      audio.addEventListener('error',function(){if(audio.src&&audio.src!==SILENT&&state!=='idle'){memo[key]=null;info=null;fail('provider')}});
      audio.addEventListener('volumechange',setMute);
      audio.volume=savedVol();
    }
    function startReal(){
      audio.src=info.url;audio.playbackRate=parseFloat(spd.value)||1;audio.defaultPlaybackRate=audio.playbackRate;
      if('preservesPitch' in audio)audio.preservesPitch=true;
      var p=audio.play();mediaSession();
      if(p&&p.catch)p.catch(function(e){if(dead)return;if(e&&e.name==='NotAllowedError'){setState('paused');msg.textContent=S.tap;syncFoot()}else if(e&&e.name!=='AbortError')fail('provider')});
    }
    function start(){
      if(!audio)makeAudio();
      if(info){setState('loading');startReal();return}
      // unlock the audio element inside the press, then ask our service (it reads the article itself)
      audio.src=SILENT;var u=audio.play();if(u&&u.catch)u.catch(function(){});
      setState('loading');msg.textContent=S.loading;syncFoot();
      var ac=window.AbortController?new AbortController():null;req=ac;
      var timer=setTimeout(function(){if(ac)ac.abort()},90000);
      fetch(EP+'/v1/listen?id='+encodeURIComponent(o.id)+'&lang='+encodeURIComponent(lang),{signal:ac?ac.signal:undefined,credentials:'omit'})
        .then(function(r){return r.json().catch(function(){return {ok:false,code:r.status===429?'busy':'provider'}})})
        .then(function(j){clearTimeout(timer);req=null;if(dead)return;
          if(!j||!j.ok||typeof j.url!=='string'||!/^https?:\/\//.test(j.url)){fail(j&&j.code);return}
          if(j.lang&&j.lang!==lang){fail('no_voice');return}          // never another language than the page
          info=memo[key]=j;startReal()})
        .catch(function(e){clearTimeout(timer);req=null;if(!dead&&!(e&&e.name==='AbortError'&&dead))fail('provider')});
    }
    function pause(){if(audio&&!audio.paused)audio.pause()}
    function resume(){if(!audio||!info){start();return}var p=audio.play();if(p&&p.catch)p.catch(function(){})}
    function stopAll(){if(req){try{req.abort()}catch(e){}req=null}
      if(audio){audio.pause();try{audio.currentTime=0}catch(e){}}setState('idle');showTime();cur.textContent='0:00';seek.value='0';seek.style.setProperty('--p','0%')}
    function destroy(){if(dead)return;dead=true;if(req){try{req.abort()}catch(e){}}
      if(audio){try{audio.pause();audio.removeAttribute('src');audio.load()}catch(e){}audio=null}
      if('mediaSession' in navigator){try{navigator.mediaSession.metadata=null}catch(e){}}
      if(active===api)active=null}
    play.addEventListener('click',function(){
      if(state==='playing')pause();
      else if(state==='paused'&&audio&&info)resume();
      else if(state==='ended'&&audio){audio.currentTime=0;resume()}
      else start()});
    stop.addEventListener('click',stopAll);
    retry.addEventListener('click',function(){memo[key]=null;info=null;if(audio){try{audio.removeAttribute('src');audio.load()}catch(e){}}start()});
    spd.addEventListener('change',function(){var r=parseFloat(spd.value)||1;lsSet(LS_RATE,String(r));if(audio){audio.playbackRate=r;audio.defaultPlaybackRate=r}});
    seek.addEventListener('input',function(){dragging=true;showTime()});
    seek.addEventListener('change',function(){dragging=false;if(audio&&isFinite(parseFloat(seek.value))){audio.currentTime=parseFloat(seek.value)}showTime()});
    seek.addEventListener('pointerup',function(){if(dragging){dragging=false;if(audio)audio.currentTime=parseFloat(seek.value)}});
    vol.addEventListener('input',function(){var v=parseFloat(vol.value);lsSet(LS_VOL,String(v));if(audio){audio.volume=v;audio.muted=v===0}setMute()});
    mute.addEventListener('click',function(){if(!audio)makeAudio();if(audio.muted||audio.volume===0){audio.muted=false;if(audio.volume===0){audio.volume=1;vol.value='1';lsSet(LS_VOL,'1')}}else audio.muted=true;setMute()});
    var api={el:root,destroy:destroy,stop:stopAll,state:function(){return state},audio:function(){return audio}};
    active=api;return root;
  }
  // another video or audio on the page starts: the narration pauses (never two voices at once)
  document.addEventListener('play',function(e){if(active&&active.audio()&&e.target!==active.audio())try{active.audio().pause()}catch(x){}},true);
  window.addEventListener('pagehide',function(){if(active)active.destroy()});
  window.WTListen={player:player,enabled:!!EP,stop:function(){if(active)active.stop()},current:function(){return active?active.audio():null}};
})();
