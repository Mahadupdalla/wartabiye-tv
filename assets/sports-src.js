/* Wartabiye TV: where the LIVE Sports page (assets/media.js) gets its data, all in one provider-neutral format
   (the same format as the sports proxy in workers/sports-api):
     match: {id, utcDate, status, minute, competition:{id,name,area,emblem}, round, home:{id,name,crest}, away:{...},
             score:{home,away,halfTime:{home,away}}, venue, referee, events:[{minute,extra,type,team,player,detail}], statistics:[]}

   Sources, set in /admin/ → LIVE TV & Ciyaaraha → Ciyaaraha Toos (data/sports.json):
   1. "apiBase"  – the Wartabiye sports proxy (Cloudflare Worker, provider key kept secret). When set it is used alone.
   2. "openData" – OpenLigaDB (api.openligadb.de): a free, open football database that anyone may use without a key.
                   Read directly by the visitor's browser, so scores update within a minute of the data changing.
   3. "feed"     – data/sports-feed/*.json written every 10 minutes by .github/workflows/sports-feed.yml from
                   football-data.org with the secret FOOTBALL_DATA_TOKEN (Premier League, LaLiga, Serie A ...).
                   The token stays in GitHub; only the finished JSON is public.

   Nothing here adds, guesses or fills in a score, minute, event or statistic. OpenLigaDB has no match clock, so
   a match counts as "in play" only from kick-off until the data says it finished (at most 150 minutes); after that,
   until the data confirms it, it is labelled "result not yet confirmed" (with the last score the data holds). A feed that is more than
   25 minutes old never shows a match as live. */
(function(){
  'use strict';
  var OL='https://api.openligadb.de';
  var LIVE={LIVE:1,IN_PLAY:1,PAUSED:1,HT:1,ET:1,BT:1,P:1};
  var FEED_FRESH=25*60e3, LIVE_WINDOW=150*60e3;
  var cache={};
  function now(){return (window.WT_NOW?window.WT_NOW():Date.now())}
  function getJSON(url,ttl){var c=cache[url],t=Date.now();if(c&&t-c.t<ttl)return c.p;
    var p=fetch(url,{headers:{Accept:'application/json'},cache:'no-cache'}).then(function(r){if(!r.ok){var e=new Error('HTTP '+r.status);e.status=r.status;throw e}return r.json()});
    cache[url]={t:t,p:p};p.catch(function(){if(cache[url]&&cache[url].p===p)delete cache[url]});return p}
  function q(path){var i=path.indexOf('?'),o={route:i<0?path:path.slice(0,i)};if(i>=0)path.slice(i+1).split('&').forEach(function(kv){var j=kv.indexOf('=');if(j>0)o[decodeURIComponent(kv.slice(0,j))]=decodeURIComponent(kv.slice(j+1))});return o}
  function ymdEAT(d){return new Date(+d+3*3600e3).toISOString().slice(0,10)}
  function rank(m){return LIVE[m.status]?0:m.status==='AWAIT'?1:m.status==='SCHEDULED'?2:3}
  function sortM(l){return l.sort(function(a,b){return rank(a)-rank(b)||String(a.utcDate).localeCompare(String(b.utcDate))})}
  function byDate(a,b){return String(a.utcDate).localeCompare(String(b.utcDate))}

  // ---------------- OpenLigaDB ----------------
  function olLeagues(cfg){var o=cfg&&cfg.openData;if(!o||o.enabled===false)return [];
    return (Array.isArray(o.leagues)?o.leagues:[]).filter(function(l){return l&&l.enabled!==false&&/^[A-Za-z0-9_-]{1,20}$/.test(String(l.id||''))&&/^\d{4}$/.test(String(l.season||''))})}
  // feed competitions that an open-data league already covers live (for example BL1 = bl1) are left out, so no match is listed twice
  function sameSet(cfg){var o={};olLeagues(cfg).forEach(function(l){String(l.same||'').split(',').forEach(function(x){x=x.trim();if(x)o[x]=1})});return o}
  function olTeam(t){return t?{id:'ol'+t.teamId,name:t.shortName||t.teamName,crest:t.teamIconUrl||null}:null}
  function olStatus(m,t){if(m.matchIsFinished)return 'FT';var k=Date.parse(m.matchDateTimeUTC);if(isNaN(k))return 'SCHEDULED';if(t<k)return 'SCHEDULED';return t-k<=LIVE_WINDOW?'LIVE':'AWAIT'}
  function olNorm(m,lg){var t=now(),st=olStatus(m,t),res=(m.matchResults||[]).slice().sort(function(a,b){return a.resultOrderID-b.resultOrderID});
    var fin=res.filter(function(r){return r.resultTypeID===2})[0]||res[res.length-1],ht=res.filter(function(r){return r.resultTypeID===1})[0];
    var goals=(m.goals||[]).slice().sort(function(a,b){return (a.matchMinute||0)-(b.matchMinute||0)||a.goalID-b.goalID}),lastG=goals[goals.length-1];
    var sh=null,sa=null;
    if(st==='FT'&&fin){sh=fin.pointsTeam1;sa=fin.pointsTeam2}
    else if(st==='LIVE'||st==='AWAIT'){ // the latest score the data holds; nothing when it holds none
      if(lastG&&(!fin||lastG.scoreTeam1+lastG.scoreTeam2>=fin.pointsTeam1+fin.pointsTeam2)){sh=lastG.scoreTeam1;sa=lastG.scoreTeam2}else if(fin){sh=fin.pointsTeam1;sa=fin.pointsTeam2}}
    var h=m.team1||{},loc=m.location||{};
    return {id:'ol'+m.matchID,utcDate:m.matchDateTimeUTC,status:st,minute:null,
      competition:{id:lg.id,name:lg.name||m.leagueName,area:lg.area||null,emblem:null},
      round:m.group?(/spieltag/i.test(m.group.groupName||'')&&m.group.groupOrderID?{matchday:m.group.groupOrderID}:m.group.groupName||null):null,
      home:olTeam(m.team1),away:olTeam(m.team2),
      score:{home:sh,away:sa,halfTime:{home:ht&&st!=='SCHEDULED'?ht.pointsTeam1:null,away:ht&&st!=='SCHEDULED'?ht.pointsTeam2:null}},
      venue:loc.locationStadium?String(loc.locationStadium).trim()+(loc.locationCity?', '+loc.locationCity:''):null,referee:null,
      events:goals.map(function(g){return {minute:g.matchMinute,extra:null,type:'goal',team:g.scoringTeamId===h.teamId?'home':'away',player:g.goalGetterName||null,
        detail:g.isOwnGoal?'own':g.isPenalty?'pen':null,score:g.scoreTeam1+' – '+g.scoreTeam2}}),
      statistics:[]}}
  function olGroup(lg){return getJSON(OL+'/getcurrentgroup/'+encodeURIComponent(lg.id),10*60e3).then(function(g){return +g.groupOrderID||1})}
  function olRound(lg,g,ttl){if(g<1)return Promise.resolve([]);return getJSON(OL+'/getmatchdata/'+encodeURIComponent(lg.id)+'/'+lg.season+'/'+g,ttl).then(function(l){return (Array.isArray(l)?l:[]).map(function(m){return olNorm(m,lg)})}).catch(function(){return []})}
  function olRounds(lg,offs,ttlCur){return olGroup(lg).then(function(g){return Promise.all(offs.map(function(o){return olRound(lg,g+o,o===0?ttlCur:5*60e3)}))}).then(function(a){var seen={},out=[];a.forEach(function(l){l.forEach(function(m){if(!seen[m.id]){seen[m.id]=1;out.push(m)}})});return out})}
  function olAll(cfg,offs,ttl){var ls=olLeagues(cfg);return Promise.all(ls.map(function(lg){return olRounds(lg,offs,ttl).catch(function(){return null})})).then(function(a){
      if(ls.length&&a.every(function(x){return x===null}))throw new Error('openligadb unavailable');var out=[];a.forEach(function(l){if(l)out=out.concat(l)});return out})}
  var OPEN={name:'OpenLigaDB',
    has:function(cfg,comp){return olLeagues(cfg).some(function(l){return String(l.id)===String(comp)})},
    lg:function(cfg,comp){return olLeagues(cfg).filter(function(l){return String(l.id)===String(comp)})[0]},
    live:function(cfg){return olAll(cfg,[-1,0],30e3).then(function(l){return l.filter(function(m){return LIVE[m.status]})})},
    day:function(cfg,date){return olAll(cfg,[-1,0,1],30e3).then(function(l){return l.filter(function(m){return ymdEAT(new Date(m.utcDate))===date})})},
    fixtures:function(cfg,comp){var lg=OPEN.lg(cfg,comp);return olRounds(lg,[0,1,2,3],60e3).then(function(l){return l.filter(function(m){return m.status==='SCHEDULED'||LIVE[m.status]}).sort(byDate)})},
    results:function(cfg,comp){var lg=OPEN.lg(cfg,comp);return olRounds(lg,[-2,-1,0],60e3).then(function(l){return l.filter(function(m){return m.status==='FT'}).sort(byDate).reverse()})},
    standings:function(cfg,comp){var lg=OPEN.lg(cfg,comp);return getJSON(OL+'/getbltable/'+encodeURIComponent(lg.id)+'/'+lg.season,10*60e3).then(function(rows){
      rows=Array.isArray(rows)?rows:[];return {competition:{id:lg.id,name:lg.name},season:lg.season+'/'+String(+lg.season+1).slice(2),
        table:rows.map(function(r,i){return {position:i+1,team:{id:'ol'+r.teamInfoId,name:r.shortName||r.teamName,crest:r.teamIconUrl||null},played:r.matches,won:r.won,draw:r.draw,lost:r.lost,goalDifference:r.goalDiff,points:r.points}})}})},
    match:function(cfg,id){var n=String(id).replace(/^ol/,'');if(!/^\d{1,10}$/.test(n))return Promise.resolve({match:null});
      return getJSON(OL+'/getmatchdata/'+n,30e3).then(function(m){if(!m||!m.matchID)return {match:null};var lg=olLeagues(cfg).filter(function(l){return l.id===m.leagueShortcut})[0]||{id:m.leagueShortcut,name:m.leagueName,season:m.leagueSeason};
        return {match:olNorm(m,lg),eventsAvailable:true,statisticsAvailable:false,eventTypes:'goals'}})},
    team:function(cfg,id){var n=String(id).replace(/^ol/,'');if(!/^\d{1,10}$/.test(n))return Promise.resolve({team:null,matches:[]});
      return getJSON(OL+'/getmatchesbyteamid/'+n+'/3/3',5*60e3).then(function(l){l=Array.isArray(l)?l:[];var t=null,ls=olLeagues(cfg);
        var ms=l.map(function(m){var lg=ls.filter(function(x){return x.id===m.leagueShortcut})[0]||{id:m.leagueShortcut,name:m.leagueName,season:m.leagueSeason};var x=olNorm(m,lg);
          if(!t)t=String(m.team1&&m.team1.teamId)===n?x.home:String(m.team2&&m.team2.teamId)===n?x.away:null;return x}).sort(byDate);
        return {team:t?{id:t.id,name:t.name,crest:t.crest}:null,matches:ms}})}};

  // ---------------- data/sports-feed (football-data.org through GitHub Actions) ----------------
  function feedIndex(){return getJSON('data/sports-feed/index.json?v='+Math.floor(Date.now()/60e3),60e3).then(function(d){return d&&d.updatedAt&&Array.isArray(d.competitions)?d:null}).catch(function(){return null})}
  function feedFile(name){return getJSON('data/sports-feed/'+name+'.json?v='+Math.floor(Date.now()/60e3),60e3)}
  function fresh(d){var t=Date.parse(d&&d.updatedAt);return !isNaN(t)&&now()-t<=FEED_FRESH}
  // an old feed must not claim a match is in play: such matches are shown as "result not confirmed"
  function guard(d,list){return fresh(d)?list:list.map(function(m){if(!LIVE[m.status])return m;var x=JSON.parse(JSON.stringify(m));x.status='AWAIT';x.minute=null;return x})}
  var FEED={name:'football-data.org',
    index:feedIndex,
    window:function(){return feedIndex().then(function(ix){if(!ix)return null;return feedFile('window').then(function(d){return {ix:ix,d:d,list:guard(d,Array.isArray(d.matches)?d.matches:[])}})})},
    live:function(){return FEED.window().then(function(w){return w?{w:w,list:w.list.filter(function(m){return LIVE[m.status]})}:null})},
    day:function(date){return FEED.window().then(function(w){return w?{w:w,list:w.list.filter(function(m){return ymdEAT(new Date(m.utcDate))===date})}:null})},
    comp:function(kind,comp){return feedFile(kind+'-'+String(comp).replace(/[^A-Za-z0-9_-]/g,''))}};

  // ---------------- dispatcher ----------------
  function worker(cfg,path){var b=String(cfg.apiBase||'').replace(/\/+$/,'');
    return fetch(b+path,{headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
  function useWorker(cfg){return /^https:\/\//.test(String(cfg&&cfg.apiBase||''))}
  function stamp(o,names,times){o.provider=names.filter(function(x,i){return x&&names.indexOf(x)===i}).join(' · ');var ts=times.filter(Boolean).sort();o.updatedAt=ts[0]||new Date(now()).toISOString();return o}
  // competitions the page offers, each with its source
  function competitions(cfg){
    if(useWorker(cfg))return Promise.resolve((Array.isArray(cfg.competitions)?cfg.competitions:[]).filter(function(c){return c&&c.id}).map(function(c){return {id:String(c.id),name:c.name||c.id,src:'worker'}}));
    var out=olLeagues(cfg).map(function(l){return {id:String(l.id),name:l.name||l.id,src:'open'}});
    var same=sameSet(cfg);return feedIndex().then(function(ix){if(ix)ix.competitions.forEach(function(c){if(c&&c.id&&!same[String(c.id)]&&!out.some(function(o){return o.id===String(c.id)}))out.push({id:String(c.id),name:c.name||c.id,src:'feed'})});
      // order: as listed in /admin/ (competitions first, then open-data leagues), then the rest
      var order=(Array.isArray(cfg.competitions)?cfg.competitions:[]).map(function(c){return c&&String(c.id)});
      return out.sort(function(a,b){var x=order.indexOf(a.id),y=order.indexOf(b.id);x=x<0?99:x;y=y<0?99:y;return x-y})})}
  function connected(cfg){if(useWorker(cfg))return Promise.resolve(true);if(olLeagues(cfg).length)return Promise.resolve(true);return feedIndex().then(function(ix){return !!ix})}
  function call(cfg,path){
    if(useWorker(cfg))return worker(cfg,path);
    var p=q(path),r=p.route,iso=new Date(now()).toISOString();
    function both(openP,feedP){return Promise.all([openP.then(function(l){return {ok:true,l:l}},function(){return {ok:false}}),feedP.then(function(x){return {ok:true,x:x}},function(){return {ok:false}})]).then(function(a){
        var o=a[0],f=a[1],fx=f.ok&&f.x;if(!o.ok&&!fx)throw new Error('unavailable');var list=[],names=[],times=[];
        if(o.ok&&olLeagues(cfg).length){list=list.concat(o.l);names.push(OPEN.name);times.push(iso)}
        var same=sameSet(cfg);if(fx){list=list.concat(fx.list.filter(function(m){return !(m.competition&&same[String(m.competition.id)])}));names.push(fx.w.d.provider||FEED.name);times.push(fx.w.d.updatedAt)}
        return stamp({matches:sortM(list),partial:!o.ok&&olLeagues(cfg).length>0},names,times)})}
    if(r==='/v1/live')return both(OPEN.live(cfg),FEED.live());
    if(r==='/v1/matches'){var date=p.date||ymdEAT(new Date(now()));return both(OPEN.day(cfg,date),FEED.day(date)).then(function(d){d.date=date;return d})}
    if(r==='/v1/fixtures'||r==='/v1/results'||r==='/v1/standings'){var c=p.competition,kind=r.slice(4);
      if(OPEN.has(cfg,c))return OPEN[kind](cfg,c).then(function(x){return stamp(kind==='standings'?x:{matches:x},[OPEN.name],[iso])});
      return FEED.comp(kind,c).then(function(d){if(kind!=='standings')d.matches=guard(d,Array.isArray(d.matches)?d.matches:[]);return d})}
    if(r==='/v1/match'){var id=String(p.id||'');
      if(/^ol\d+$/.test(id))return OPEN.match(cfg,id).then(function(d){return stamp(d,[OPEN.name],[iso])});
      // feed: the match as listed in the feed (score and status only, no events on this plan)
      return FEED.window().then(function(w){var ms=w?w.list:[];var m=ms.filter(function(x){return String(x.id)===id})[0];if(m)return {match:m,eventsAvailable:false,statisticsAvailable:false,provider:w.d.provider,updatedAt:w.d.updatedAt};
        return feedIndex().then(function(ix){var cs=ix?ix.competitions:[];return Promise.all(cs.map(function(c){return Promise.all(['fixtures','results'].map(function(k){return FEED.comp(k,c.id).catch(function(){return null})}))})).then(function(a){var hit=null,src=null;
          a.forEach(function(pair){pair.forEach(function(d){if(d&&!hit){var x=(d.matches||[]).filter(function(y){return String(y.id)===id})[0];if(x){hit=guard(d,[x])[0];src=d}}})});
          return {match:hit,eventsAvailable:false,statisticsAvailable:false,provider:src&&src.provider,updatedAt:src&&src.updatedAt}})})})}
    if(r==='/v1/team'){var tid=String(p.id||'');
      if(/^ol\d+$/.test(tid))return OPEN.team(cfg,tid).then(function(d){return stamp(d,[OPEN.name],[iso])});
      return feedIndex().then(function(ix){var cs=ix?ix.competitions:[];return Promise.all(cs.map(function(c){return Promise.all(['results','fixtures'].map(function(k){return FEED.comp(k,c.id).catch(function(){return null})}))})).then(function(a){var t=null,ms=[],src=null;
        a.forEach(function(pair){pair.forEach(function(d){if(!d)return;guard(d,d.matches||[]).forEach(function(m){var side=m.home&&String(m.home.id)===tid?m.home:m.away&&String(m.away.id)===tid?m.away:null;if(side){t=t||side;ms.push(m);src=src||d}})})});
        return {team:t,matches:ms.sort(byDate),provider:src&&src.provider,updatedAt:src&&src.updatedAt}})})}
    return Promise.reject(new Error('not found'))}
  window.WT_SPORTS={call:call,competitions:competitions,connected:connected,useWorker:useWorker,_t:{olNorm:olNorm,olStatus:olStatus,guard:guard,ymdEAT:ymdEAT,FEED_FRESH:FEED_FRESH,LIVE_WINDOW:LIVE_WINDOW}};
})();
