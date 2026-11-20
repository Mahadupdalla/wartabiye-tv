// Wartabiye TV admin: Image sources. For every article: the photo, where it came from (clickable), photographer, licence,
// status, approval and usage history; approve or reject it, upload another, or search the photo providers for a new one.
// The status rules are the same as tools/image_system.py: VERIFIED is only given for a known free licence with a page to
// check it, never by hand. Saving is one commit on main (article + photo), like every other save in this dashboard.
(function () {
  'use strict';
  var C = function () { return window.WTV_C; };
  var W = function () { return window.WTV; };
  var h = function () { return W().h.apply(null, arguments); };
  var LABEL = { VERIFIED: 'Verified', ATTRIBUTION_REQUIRED: 'Attribution required', LICENSE_UNCLEAR: 'License unclear', EDITOR_UPLOAD: 'Editor upload',
    AI_ILLUSTRATION: 'AI illustration', CATEGORY_GRAPHIC: 'Category graphic', NO_IMAGE: 'No photo' };
  var TONE = { VERIFIED: 'ok', ATTRIBUTION_REQUIRED: 'info', LICENSE_UNCLEAR: 'bad', EDITOR_UPLOAD: 'warn', AI_ILLUSTRATION: 'warn', CATEGORY_GRAPHIC: 'info', NO_IMAGE: 'warn' };
  var HELP = { VERIFIED: 'Source and licence checked: free to publish (public domain, CC0 or your own photo).', ATTRIBUTION_REQUIRED: 'Free licence that needs the credit shown under the photo (CC BY / CC BY-SA).',
    LICENSE_UNCLEAR: 'Usage rights are not confirmed. Replace the photo or confirm the licence.', EDITOR_UPLOAD: 'Uploaded here. Confirm that you own it or have permission.',
    AI_ILLUSTRATION: 'AI-made illustration, never shown as a real photo.', CATEGORY_GRAPHIC: 'WARTABIYE TV category graphic: no accurate legal photo was available.' };

  // ---- licence and status (same rules as tools/image_system.py)
  function licence(name, url) {
    var s = String(name || '').trim().toLowerCase(), u = String(url || '').toLowerCase();
    if (!s && u) { var m = u.match(/creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/([\d.]+)/); if (m) s = (m[2] === 'zero' ? 'cc0' : m[2] === 'mark' ? 'pdm' : 'cc ' + m[2]) + ' ' + m[3]; }
    if (!s) return null;
    if (/(by-nc|by nc|noncommercial|non-commercial|\bnc\b)/.test(s)) return { free: false, attribution: true, commercial: false, modify: null, note: 'non-commercial only (Wartabiye TV carries adverts)' };
    if (/(by-nd|by nd|noderiv|\bnd\b)/.test(s)) return { free: false, attribution: true, commercial: true, modify: false, note: 'no changes allowed (no cropping)' };
    if (/^(cc0|cc-zero|publicdomain\/zero|pdm|public domain|pd\b|pd-|us gov)/.test(s)) return { free: true, attribution: false, commercial: true, modify: true };
    if (/^(cc[- ]?by|by\b|attribution)/.test(s)) return { free: true, attribution: true, commercial: true, modify: true, shareAlike: /sa/.test(s) };
    if (/^(unsplash|pexels|pixabay)/.test(s)) return { free: true, attribution: false, commercial: true, modify: true };
    if (/^(wartabiye|own photo)/.test(s)) return { free: true, attribution: false, commercial: true, modify: true, own: true };
    if (/permission/.test(s)) return { free: false, attribution: true, commercial: true, modify: null, note: 'permission must be on file' };
    return null;
  }
  var AGENCY = /\b(reuters|associated press|ap photo|afp|agence france|getty|epa|anadolu|shutterstock|alamy|bbc|al ?jazeera|xinhua|tass|dpa|ansa|efe)\b/i;
  var AGENCY_HOST = /(^|\.)(reuters\.com|apnews\.com|afp\.com|gettyimages\.[a-z.]+|epa\.eu|shutterstock\.com|alamy\.com|bbc\.co\.uk|bbc\.com|aljazeera\.(com|net))$/i;
  function agency(r) {
    try { if (r.pageUrl && AGENCY_HOST.test(new URL(r.pageUrl).hostname)) return true; } catch (e) {}
    return AGENCY.test([r.photographer, r.owner].join(' '));
  }
  function statusOf(r) {
    var t = r.sourceType, L = licence(r.license, r.licenseUrl);
    if (t === 'category') return 'CATEGORY_GRAPHIC';
    if (t === 'ai') return 'AI_ILLUSTRATION';
    if (t === 'editor') return r.rightsConfirmedBy && L && L.free && (L.own || /^https:/.test(r.pageUrl || '')) ? (L.attribution ? 'ATTRIBUTION_REQUIRED' : 'VERIFIED') : 'EDITOR_UPLOAD';
    if (agency(r) || !L || !L.free || !/^https:\/\//.test(r.pageUrl || '')) return 'LICENSE_UNCLEAR';
    if (L.attribution) return (r.photographer || r.owner) ? 'ATTRIBUTION_REQUIRED' : 'LICENSE_UNCLEAR';
    return 'VERIFIED';
  }
  function sourceName(page) {
    var host = ''; try { host = new URL(page).hostname.replace(/^www\./, ''); } catch (e) {}
    if (/wikimedia\.org$/.test(host)) return 'Wikimedia Commons';
    if (/flickr\.com$/.test(host)) return 'Flickr';
    if (/unsplash\.com$/.test(host)) return 'Unsplash';
    if (/pexels\.com$/.test(host)) return 'Pexels';
    if (/pixabay\.com$/.test(host)) return 'Pixabay';
    return host || null;
  }
  // the record of an article: its imageRights, or (older articles) read from the loose fields without guessing
  function record(a) {
    if (!a.image && !a.imageRights) return null;
    var r = Object.assign({}, a.imageRights || {});
    if (a.imageKind === 'category' || /^img\/category\//.test(a.image || '')) r.sourceType = 'category';
    if (a.imageKind === 'ai-illustration') r.sourceType = 'ai';
    if (!r.pageUrl && a.imageSourceUrl) r.pageUrl = a.imageSourceUrl;
    if (!('source' in r)) {
      var cr = String(a.imageCredit || ''), parts = cr.split(' / ');
      r.source = sourceName(r.pageUrl) || (parts.length > 1 ? parts[parts.length - 1] : cr) || null;
      if (parts.length > 1) r.photographer = parts.slice(0, -1).join(' / ');
      else if (cr && r.source && cr.toLowerCase() !== String(r.source).toLowerCase()) r.photographer = cr;
      if (a.by === 'admin' && !r.pageUrl && !r.sourceType) { r.sourceType = 'editor'; r.source = r.source || 'Wartabiye TV'; }
      if (!r.sourceType) r.sourceType = /wikimedia/.test(r.pageUrl || '') ? 'commons' : 'web';
      if (/^(unknown|unknown author|wikimedia commons)$/i.test(r.photographer || '')) delete r.photographer;
    }
    if (!r.license) r.license = a.imageLicense || null;
    var L = licence(r.license, r.licenseUrl);
    if (L) { r.attributionRequired = L.attribution; r.commercialUse = L.commercial; r.modification = L.modify; if (L.note) r.restrictions = L.note; }
    r.status = statusOf(r);
    if (!r.approval) r.approval = /^(VERIFIED|ATTRIBUTION_REQUIRED|CATEGORY_GRAPHIC)$/.test(r.status) ? 'approved' : 'pending';
    return r;
  }

  // ---- picture fingerprint (256-bit dHash, same as tools/image_system.py) to refuse a copy of another story's photo
  function dhashOf(url) {
    return new Promise(function (res) {
      var im = new Image(); im.onload = function () {
        var c = document.createElement('canvas'); c.width = 17; c.height = 16; var g = c.getContext('2d'); g.drawImage(im, 0, 0, 17, 16);
        var d = g.getImageData(0, 0, 17, 16).data, px = [];
        for (var i = 0; i < d.length; i += 4) px.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        var bits = ''; for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) bits += px[y * 17 + x] > px[y * 17 + x + 1] ? '1' : '0';
        var hex = ''; for (var k = 0; k < 256; k += 4) hex += parseInt(bits.slice(k, k + 4), 2).toString(16); res(hex);
      }; im.onerror = function () { res(null); }; im.src = url;
    });
  }
  function hamming(a, b) { if (!a || !b || a.length !== b.length) return 256; var n = 0; for (var i = 0; i < a.length; i++) { var x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { n += x & 1; x >>= 1; } } return n; }
  function sha256(bytes) { return crypto.subtle.digest('SHA-256', bytes).then(function (d) { return Array.from(new Uint8Array(d)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }

  var REPORT = null, REG = null, SETTINGS = null, SETTINGS_SHA = null;
  function loadExtra(force) {
    if (REPORT && !force) return Promise.resolve();
    var s = C().site(), cb = '?cb=' + Date.now();
    return Promise.all([
      fetch(s + 'data/image-report.json' + cb, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(s + 'data/image-registry.json' + cb, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      C().gh('GET', '/repos/' + C().repo() + '/contents/data/image-settings.json').then(function (f) { SETTINGS_SHA = f.sha; return JSON.parse(decodeURIComponent(escape(atob(f.content.replace(/\n/g, ''))))); }).catch(function () { return null; }),
    ]).then(function (r) { REPORT = r[0] || { articles: [], providers: {} }; REG = (r[1] && r[1].images) || {}; SETTINGS = r[2] || { noPhoto: 'category-graphic' }; });
  }
  function flagsOf(id) { var row = (REPORT.articles || []).find(function (x) { return x.id === id; }); return (row && row.flags) || []; }
  function usesOf(a) {
    var out = [], seen = {}, rec = record(a) || {};
    Object.keys(REG).forEach(function (k) {
      var e = REG[k], hit = (e.uses || []).some(function (u) { return u.article === a.id; }) || (e.files || []).indexOf(a.image) >= 0;
      if (!hit) return;
      (e.uses || []).forEach(function (u) { var key = u.article + (u.current ? '1' : '0'); if (!seen[key]) { seen[key] = 1; out.push(u); } });
    });
    ((rec.history) || []).forEach(function (x) { out.push({ article: a.id, title: 'Earlier photo of this article: ' + String(x.image || '').split('/').pop(), from: x.at, current: false, action: x.action }); });
    return out;
  }
  function conflicts(id, sha, dh, urls, continuing) {
    var out = [];
    Object.keys(REG).forEach(function (k) {
      var e = REG[k], why = null;
      if (sha && k === sha) why = 'same file';
      else if (dh && e.dhash && hamming(dh, e.dhash) <= 40) why = 'near-identical picture';
      else if ((urls || []).some(function (u) { return u && (e.sources || []).indexOf(String(u).split('?')[0].replace(/\/$/, '').toLowerCase()) >= 0; })) why = 'same source image';
      if (!why) return;
      (e.uses || []).forEach(function (u) { if (u.article !== id && (continuing || []).indexOf(u.article) < 0) out.push({ article: u.article, title: u.title, why: why, current: u.current }); });
    });
    // articles saved after the last publication are not in the registry yet
    C().store().articles.forEach(function (o) { if (o.id !== id && o.imageRights && sha && o.imageRights.sha256 === sha) out.push({ article: o.id, title: o.title, why: 'same file', current: true }); });
    return out;
  }

  // ------------------------------------------------------------------ the screen
  window.WTV_VIEWS.images = function (el) {
    el.innerHTML = ''; el.append(C().loadingBox('Loading the image records…'));
    Promise.all([C().load(), loadExtra()]).then(function () { draw(el); }).catch(function (e) { C().failBox(el, e, function () { window.WTV_VIEWS.images(el); }); });
  };
  var F = { f: 'review', q: '', limit: 60 };
  function draw(el) {
    el.innerHTML = '';
    var arts = C().store().articles, counts = {};
    var rows = arts.map(function (a) { var r = record(a); var st = r ? r.status : (a.by === 'auto-results' ? null : 'NO_IMAGE'); if (st) counts[st] = (counts[st] || 0) + 1; return { a: a, r: r, st: st, flags: flagsOf(a.id) }; }).filter(function (x) { return x.st; });
    var prov = REPORT.providers || {};
    var provLine = Object.keys(prov).map(function (p) { return p + ': ' + (prov[p] === 'ready' ? 'ready' : prov[p]); }).join(' · ') || 'commons: ready · openverse: ready';
    el.append(h('div', { class: 'hero' }, h('div', null, h('h2', { text: 'Image sources' }),
      h('p', { text: 'Every article photo with its source, photographer, licence and status. Status comes from the facts only: a photo is never marked Verified by hand. ' + (REPORT.updatedAt ? 'Report from ' + C().fmtDate(REPORT.updatedAt) + '. ' : '') + 'Photo sources: ' + provLine + '.' }))));
    // setting: no accurate photo
    var mode = C().sel(SETTINGS.noPhoto || 'category-graphic', [['category-graphic', 'Publish with the category graphic'], ['hold', 'Keep the story as a draft (Sugaya sawir)']]);
    var saveMode = h('button', { class: 'btn small', type: 'button', text: 'Save', onclick: function () {
      var s = Object.assign({}, SETTINGS, { noPhoto: mode.value });
      C().commitFiles([{ path: 'data/image-settings.json', text: JSON.stringify(s, null, 2) + '\n', expect: SETTINGS_SHA }], 'Maamul: sawirrada: ' + (mode.value === 'hold' ? 'sug sawir' : 'sawirka qaybta')).then(function () { C().toast('Saved. The news automation uses it from its next run.'); return loadExtra(true); }).then(function () { draw(el); }).catch(function (e) { C().toast(e.message, true); });
    } });
    el.append(h('div', { class: 'card' }, h('div', { class: 'two' }, C().field('When no accurate photo with usable rights is found', mode, 'The category graphic is labelled "Category graphic" on the website, never shown as a photo of the event.'), h('div', { style: 'align-self:end' }, saveMode))));
    var seg = h('div', { class: 'seg' });
    [['review', 'Needs review'], ['match', 'Check match'], ['all', 'All']].concat(['VERIFIED', 'ATTRIBUTION_REQUIRED', 'LICENSE_UNCLEAR', 'EDITOR_UPLOAD', 'CATEGORY_GRAPHIC', 'AI_ILLUSTRATION', 'NO_IMAGE'].map(function (k) { return [k, LABEL[k] + ' (' + (counts[k] || 0) + ')']; }))
      .forEach(function (t) { seg.append(h('button', { type: 'button', 'aria-pressed': String(F.f === t[0]), text: t[1], onclick: function () { F.f = t[0]; F.limit = 60; draw(el); } })); });
    var q = C().inp(F.q, { type: 'search', placeholder: 'Search by headline, photographer or source…' }); q.addEventListener('input', function () { F.q = q.value; drawRows(); });
    var list = h('div', { class: 'imgrows' });
    el.append(h('div', { class: 'card toolbar' }, seg, h('div', { class: 'tb-row' }, q)), list);
    function drawRows() {
      list.innerHTML = '';
      var ql = F.q.toLowerCase();
      var sel = rows.filter(function (x) {
        var ok = F.f === 'all' ? true : F.f === 'review' ? (x.st === 'LICENSE_UNCLEAR' || x.st === 'EDITOR_UPLOAD' || x.st === 'NO_IMAGE' && x.a.published !== false || (x.r && x.r.approval === 'pending') || x.flags.some(function (f) { return !/^check match/.test(f); }))
          : F.f === 'match' ? x.flags.some(function (f) { return /^check match/.test(f); }) : x.st === F.f;
        return ok && (!ql || [x.a.title, x.r && x.r.photographer, x.r && x.r.source, x.a.id].join(' ').toLowerCase().indexOf(ql) >= 0);
      });
      if (!sel.length) list.append(h('div', { class: 'empty', text: 'Nothing to show here.' }));
      sel.slice(0, F.limit).forEach(function (x) { list.append(row(x, el)); });
      if (sel.length > F.limit) list.append(h('button', { class: 'btn', type: 'button', style: 'margin:12px auto;display:flex', text: 'Show more (' + (sel.length - F.limit) + ')', onclick: function () { F.limit += 100; drawRows(); } }));
    }
    drawRows();
  }
  function chipFor(st) { return h('span', { class: 'chip ' + (TONE[st] || ''), title: HELP[st] || '', text: LABEL[st] || st }); }
  function link(t, u) { return /^https:\/\//.test(u || '') ? h('a', { href: u, target: '_blank', rel: 'noopener', text: t }) : h('span', { text: t }); }
  function row(x, el) {
    var a = x.a, r = x.r;
    var img = a.image ? h('img', { src: C().thumb(a.image), alt: '', loading: 'lazy', onerror: function () { this.onerror = null; this.src = C().full(a.image); } }) : h('div', { class: 'noimg', text: 'No photo' });
    var meta = h('div', { class: 'ir-m' }, h('b', { text: a.title || a.id }),
      h('div', { class: 'ir-c' }, chipFor(x.st), r && r.approval === 'pending' ? h('span', { class: 'chip warn', text: 'Approval pending' }) : null, a.published === false ? h('span', { class: 'chip st-draft', text: 'Not published' }) : null),
      r ? h('small', null, 'Source: ', link(r.source || '—', r.pageUrl), r.photographer ? ' · Photographer: ' + r.photographer : '', r.license ? ' · Licence: ' : '', r.license ? link(r.license, r.licenseUrl) : null) : null,
      x.flags.length ? h('small', { class: 'hint warnt', text: '⚠ ' + x.flags.join(' · ') }) : null);
    return h('div', { class: 'ir' }, h('button', { class: 'ir-img', type: 'button', 'aria-label': 'Open the image record', onclick: function () { detail(a, el); } }, img), meta,
      h('div', { class: 'ir-a' }, h('button', { class: 'btn small primary', type: 'button', text: 'Open', onclick: function () { detail(a, el); } })));
  }

  // ------------------------------------------------------------------ one article's image record
  function detail(a, el) {
    var r = record(a) || {};
    var body = h('div', { class: 'idet' });
    var pv = a.image ? h('a', { href: C().full(a.image), target: '_blank', rel: 'noopener' }, h('img', { src: C().full(a.image), alt: a.imageAlt || '' })) : h('div', { class: 'noimg big', text: 'No photo' });
    var tbl = h('table', { class: 'kv' });
    function kv(k, v) { tbl.append(h('tr', null, h('th', { text: k }), h('td', null, v == null || v === '' ? '—' : v))); }
    kv('Status', h('span', null, chipFor(r.status || 'NO_IMAGE'), ' ', HELP[r.status] || ''));
    kv('Approval', r.approval ? r.approval + (r.approvedAt ? ' (' + C().fmtDate(r.approvedAt) + ')' : '') : null);
    kv('Source', r.source ? link(r.source, r.pageUrl) : null);
    kv('Source page', r.pageUrl ? link(r.pageUrl, r.pageUrl) : null);
    kv('Original image', r.directUrl ? link('Open the original image', r.directUrl) : null);
    kv('Photographer', r.photographer); kv('Copyright owner', r.owner);
    kv('Licence', r.license ? link(r.license, r.licenseUrl) : null);
    kv('Attribution required', r.attributionRequired == null ? null : r.attributionRequired ? 'Yes: the credit is shown under the photo' : 'No');
    kv('Commercial use', r.commercialUse == null ? null : r.commercialUse ? 'Allowed' : 'Not allowed');
    kv('May be cropped or changed', r.modification == null ? null : r.modification ? 'Yes' : 'No');
    kv('Restrictions', r.restrictions);
    kv('Retrieved', r.retrievedAt ? C().fmtDate(r.retrievedAt) : 'not recorded (older article)');
    kv('Search used', r.searchQuery); kv('Match score', r.matchScore != null ? Math.round(r.matchScore * 100) + ' / 100' : null);
    kv('Credit shown to readers', [r.source && 'Photo: ' + r.source, r.photographer && 'Photographer: ' + r.photographer, r.license && 'License: ' + r.license].filter(Boolean).join(' | ') || null);
    var uses = usesOf(a), ul = h('ul', { class: 'uses' });
    if (!uses.length) ul.append(h('li', { text: 'No other use recorded.' }));
    uses.forEach(function (u) { ul.append(h('li', null, u.article === a.id ? h('b', { text: u.title || 'This article' }) : h('a', { href: '#articles?edit=' + encodeURIComponent(u.article), text: u.title || u.article }), ' · ' + (u.current ? 'current' : 'earlier use') + (u.from ? ' · from ' + C().fmtDate(u.from) : '') + (u.until ? ' to ' + C().fmtDate(u.until) : ''))); });
    var flags = flagsOf(a.id);
    body.append(h('div', { class: 'two' }, h('div', null, pv, flags.length ? h('p', { class: 'pt-err', text: '⚠ ' + flags.join(' · ') }) : null), h('div', null, tbl)), h('h3', { text: 'Usage history' }), ul);
    var acts = [
      h('a', { class: 'btn', href: '#articles?edit=' + encodeURIComponent(a.id), text: 'Edit article', onclick: function () { m.remove(); } }),
      h('button', { class: 'btn', type: 'button', text: 'Upload another', onclick: function () { C().pickFile(function (f) { C().cropDialog(f, a.id, function (res) { m.remove(); saveUpload(a, res, el); }); }); } }),
      h('button', { class: 'btn', type: 'button', text: 'Search for another', onclick: function () { m.remove(); searchModal(a, function (res) { savePick(a, res, el); }); } }),
      a.image && r.status !== 'CATEGORY_GRAPHIC' ? h('button', { class: 'btn danger', type: 'button', text: 'Reject', onclick: function () { if (confirm('Reject this photo? The article gets its category graphic until you choose another one.')) { m.remove(); reject(a, el); } } }) : null,
      a.image ? h('button', { class: 'btn primary', type: 'button', text: r.status === 'EDITOR_UPLOAD' ? 'I own it / have permission: approve' : 'Approve', onclick: function () { m.remove(); approve(a, r, el); } }) : null,
    ].filter(Boolean);
    var m = C().modal('Image record: ' + (a.title || a.id), body, acts);
  }

  function categoryGraphic(a) {
    var map = { Siyaasadda: 'siyaasadda', Amniga: 'amniga', Bulshada: 'bulshada', Dhaqaalaha: 'dhaqaalaha', Adduunka: 'adduunka', Ciyaaraha: 'ciyaaraha', Teknolojiyadda: 'teknolojiyadda', Caafimaadka: 'caafimaadka', Waxbarashada: 'waxbarashada' };
    var topic = { health: 'caafimaadka', education: 'waxbarashada', technology: 'teknolojiyadda', cybersecurity: 'teknolojiyadda', science: 'teknolojiyadda', economy: 'dhaqaalaha', politics: 'siyaasadda' };
    return 'img/category/' + (topic[a.topic] || map[a.category] || (a.section === 'sports' ? 'ciyaaraha' : a.section === 'world' ? 'adduunka' : 'soomaaliya')) + '.jpg';
  }
  function hist(a, action, extra) {
    var r = a.imageRights || {}, out = (r.history || []).slice();
    if (a.image) out.push(Object.assign({ at: C().nowMogadishu(), action: action, image: a.image, pageUrl: r.pageUrl || a.imageSourceUrl || null, status: (record(a) || {}).status, by: 'admin' }, extra || {}));
    return out.slice(-20);
  }
  function clean(o) { Object.keys(o).forEach(function (k) { if (o[k] == null || o[k] === '') delete o[k]; }); return o; }
  // the old photo file goes when no other article uses it
  function oldFileChanges(a, keep) {
    var old = a.image;
    if (!old || old === keep || !/^img\/news\//.test(old) || C().usedBy(old, a.id).length) return Promise.resolve([]);
    var st = C().store(), f = st.images.find(function (x) { return x.path === old; }), ch = f ? [{ path: old, delete: true, expect: f.sha }] : [];
    var m = old.match(/^img\/news\/(.+)\.(jpe?g|png|webp)$/i), tp = m ? 'img/news/w480/' + m[1] + '.webp' : null;
    if (!tp) return Promise.resolve(ch);
    return C().gh('GET', '/repos/' + C().repo() + '/contents/' + tp.split('/').map(encodeURIComponent).join('/')).then(function (x) { ch.push({ path: tp, delete: true, expect: x.sha }); return ch; }, function () { return ch; });
  }
  function commitArticle(a, n, extra, msg, label) {
    var changes = [{ path: a._file || 'data/news/' + a.id + '.json', text: C().json2(n), expect: a._sha }].concat(extra || []);
    return C().commitFiles(changes, msg).then(function (c) {
      C().track(label + ': ' + n.title, c, n.published !== false ? { id: n.id, expect: 'present', title: n.title, image: n.image } : { id: n.id, expect: 'absent' }, n.published !== false ? C().articleUrl(n.id) : null);
      C().toast('Saved. Publishing to the website now.');
      return C().load(true);
    });
  }
  function base(a) { var n = JSON.parse(JSON.stringify(a)); Object.keys(n).forEach(function (k) { if (k.charAt(0) === '_') delete n[k]; }); delete n.imageNote; return n; }
  function approve(a, r, el) {
    var n = base(a), rr = Object.assign({}, n.imageRights || {}, clean({ source: r.source, sourceType: r.sourceType, pageUrl: r.pageUrl, directUrl: r.directUrl, photographer: r.photographer, owner: r.owner, license: r.license, licenseUrl: r.licenseUrl }));
    if (r.status === 'EDITOR_UPLOAD') {
      var lic = prompt('Licence of this photo (for example "Wartabiye TV" for your own photo, "CC BY 4.0", "Used with permission"):', r.license || 'Wartabiye TV');
      if (!lic) return;
      rr.license = lic; rr.rightsConfirmedBy = (W().me() || {}).login || 'owner'; rr.rightsConfirmedAt = C().nowMogadishu();
      n.imageLicense = lic;
    }
    rr.approval = 'approved'; rr.approvedAt = C().nowMogadishu(); rr.approvedBy = (W().me() || {}).login || 'owner';
    rr.status = statusOf(rr);
    if (rr.status === 'LICENSE_UNCLEAR') C().toast('Approved, but the licence is still unclear: replace the photo or add its licence and source page in the article.', true);
    n.imageRights = clean(rr);
    commitArticle(a, n, [], 'Maamul: sawirka waa la oggolaaday "' + a.id + '"', 'Photo approved').then(function () { draw(el); }).catch(function (e) { C().toast(e.message, true); });
  }
  function reject(a, el) {
    var n = base(a), g = categoryGraphic(a);
    n.imageRights = clean({ source: 'Wartabiye TV', sourceType: 'category', license: 'Wartabiye TV', status: 'CATEGORY_GRAPHIC', approval: 'approved', retrievedAt: C().nowMogadishu(), history: hist(a, 'rejected', { reason: 'rejected in /admin/' }) });
    Object.assign(n, { image: g, imageKind: 'category', imageCredit: 'Wartabiye TV', imageLicense: 'Wartabiye TV', imageAlt: 'Sawirka qaybta ' + (a.category || 'wararka') + ' ee Wartabiye TV' });
    delete n.imageSourceUrl; delete n.imageFocus;
    oldFileChanges(a, g).then(function (ch) { return commitArticle(a, n, ch, 'Maamul: sawirka waa la diiday "' + a.id + '"', 'Photo rejected'); }).then(function () { draw(el); }).catch(function (e) { C().toast(e.message, true); });
  }
  function saveUpload(a, res, el) {
    sha256(res.bytes).then(function (sh) {
      return dhashOf(res.url).then(function (dh) {
        var cf = conflicts(a.id, sh, dh, []);
        if (cf.length && !confirm('This picture is already used by “' + (cf[0].title || cf[0].article) + '” (' + cf[0].why + '). Use it anyway ONLY if this is the same continuing story. Continue?')) return;
        var n = base(a), path = res.path.replace(/(\.[a-z]+)$/, '-' + sh.slice(0, 8) + '$1');
        n.imageRights = clean({ source: 'Wartabiye TV', sourceType: 'editor', status: 'EDITOR_UPLOAD', approval: 'pending', retrievedAt: C().nowMogadishu(), uploadedBy: (W().me() || {}).login || 'owner',
          sha256: sh, dhash: dh, continuing: cf.length ? cf.map(function (x) { return x.article; }) : null, history: hist(a, 'replaced') });
        Object.assign(n, { image: path, imageKind: 'actual', imageCredit: 'Wartabiye TV' }); delete n.imageSourceUrl; delete n.imageLicense;
        return oldFileChanges(a, path).then(function (ch) { return commitArticle(a, n, [{ path: path, bytes: res.bytes, expect: null }].concat(ch), 'Maamul: sawir cusub "' + a.id + '"', 'New photo'); }).then(function () { draw(el); });
      });
    }).catch(function (e) { C().toast(e.message, true); });
  }
  function savePick(a, res, el) {
    var n = base(a);
    n.imageRights = res.rights; n.imageRights.history = hist(a, 'replaced');
    Object.assign(n, res.fields);
    if (!n.imageSourceUrl) delete n.imageSourceUrl;
    return oldFileChanges(a, res.path).then(function (ch) { return commitArticle(a, n, [{ path: res.path, bytes: res.bytes, expect: null }].concat(ch), 'Maamul: sawir cusub "' + a.id + '" (' + res.rights.source + ')', 'New photo'); })
      .then(function () { if (el) draw(el); }).catch(function (e) { C().toast(e.message, true); });
  }

  // ------------------------------------------------------------------ search the photo providers
  function searchModal(a, done) {
    var q = C().inp(String((a.en && a.en.title) || a.title || '').replace(/[“”"']/g, '').split(/\s+/).slice(0, 6).join(' '), { type: 'search' });
    var prov = C().sel('commons', [['commons', 'Wikimedia Commons'], ['openverse', 'Openverse (Flickr and other CC collections)'], ['unsplash', 'Unsplash'], ['pexels', 'Pexels'], ['pixabay', 'Pixabay']]);
    var kind = C().sel('illustrative', [['illustrative', 'Earlier / illustrative photo (labelled on the site)'], ['actual', 'Photo taken at this event']]);
    var grid = h('div', { class: 'mgrid big' }), note = h('p', { class: 'sub', text: 'Reuters, AP, AFP, Getty, BBC and Al Jazeera photos are all rights reserved and are never offered here.' });
    function run() {
      grid.innerHTML = ''; grid.append(h('div', { class: 'skel', style: 'height:120px;grid-column:1/-1' }));
      fetch('/api/images/search?' + new URLSearchParams({ q: q.value, provider: prov.value }), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        grid.innerHTML = '';
        if (j.needsKey) return grid.append(h('div', { class: 'empty', text: 'This source needs its free API key: add the Worker secret ' + j.needsKey + ' (see workers/admin/README.md).' }));
        if (j.error) grid.append(h('div', { class: 'banner bad', text: 'The provider answered: ' + j.error }));
        if (!(j.results || []).length) return grid.append(h('div', { class: 'empty', text: 'No photos found. Try other words: the person’s full name, the place, the institution.' }));
        j.results.forEach(function (c) {
          c.sourceType = c.sourceType || 'web';
          var st = statusOf({ sourceType: c.sourceType, pageUrl: c.pageUrl, photographer: c.author, license: c.license, licenseUrl: c.licenseUrl });
          var cf = conflicts(a.id, null, null, [c.pageUrl, c.directUrl]);
          var usable = (st === 'VERIFIED' || st === 'ATTRIBUTION_REQUIRED') && !cf.length;
          grid.append(h('div', { class: 'mcard' + (usable ? '' : ' used') }, h('img', { src: c.thumb || c.directUrl, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
            h('div', { class: 'mc-b' }, h('small', { text: (c.title || '').slice(0, 90) }), chipFor(st),
              h('small', null, link(c.source || 'source', c.pageUrl), c.author ? ' · ' + c.author : '', c.license ? ' · ' + c.license : ' · licence unknown'),
              cf.length ? h('small', { class: 'hint warnt', text: 'Already used by: ' + (cf[0].title || cf[0].article) }) : null,
              h('button', { class: 'btn small' + (usable ? ' primary' : ''), type: 'button', disabled: usable ? null : '', text: usable ? 'Use this photo' : 'Cannot be used', onclick: function () { pick(c, st); } }))));
        });
      }).catch(function (e) { grid.innerHTML = ''; grid.append(W().errBox(e)); });
    }
    function pick(c, st) {
      var alt = prompt('Describe the photo in Somali (what it shows, who, where). For an earlier photo say so, e.g. "… sawir hore (2024)".', '');
      if (!alt) return;
      fetch('/api/images/fetch?url=' + encodeURIComponent(c.directUrl), { credentials: 'same-origin' }).then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || 'download failed'); }); return r.blob(); }).then(function (blob) {
        return blob.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf), url = URL.createObjectURL(blob);
          return sha256(bytes).then(function (sh) {
            return dhashOf(url).then(function (dh) {
              var cf = conflicts(a.id, sh, dh, [c.pageUrl, c.directUrl]);
              if (cf.length) throw new Error('This picture is already used by “' + (cf[0].title || cf[0].article) + '” (' + cf[0].why + '). Every story needs its own photo.');
              var ext = /png/.test(blob.type) ? 'png' : /webp/.test(blob.type) ? 'webp' : 'jpg';
              var path = 'img/news/' + a.id + '-' + sh.slice(0, 8) + '.' + ext;
              var L = licence(c.license, c.licenseUrl) || {};
              var rights = clean({ source: c.source, sourceType: c.sourceType, provider: c.provider, directUrl: c.directUrl, pageUrl: c.pageUrl, photographer: c.author, license: c.license, licenseUrl: c.licenseUrl,
                retrievedAt: C().nowMogadishu(), imageDate: c.date ? String(c.date).slice(0, 20) : null, searchQuery: q.value, selectedBy: 'admin', sha256: sh, dhash: dh, status: st,
                attributionRequired: L.attribution, commercialUse: L.commercial, modification: L.modify, approval: 'approved', approvedAt: C().nowMogadishu(), approvedBy: (W().me() || {}).login || 'owner' });
              var fields = { image: path, imageAlt: alt, imageCredit: c.author ? c.author + ' / ' + c.source : c.source, imageLicense: c.license, imageSourceUrl: c.pageUrl, imageKind: kind.value };
              m.remove();
              done({ bytes: bytes, path: path, url: url, rights: rights, fields: fields });
            });
          });
        });
      }).catch(function (e) { C().toast(e.message, true); });
    }
    var go = h('button', { class: 'btn primary', type: 'button', text: 'Search', onclick: run });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    var m = C().modal('Find a photo for: ' + (a.title || a.id), h('div', null, h('div', { class: 'three' }, C().field('Search words (English names work best)', q), C().field('Source', prov), C().field('What it shows', kind)), h('div', { class: 'row' }, go), note, grid));
    run();
  }
  // a library photo that belonged to another (earlier or deleted) story: refused in "Choose from library"
  function earlierUses(path, id) {
    var out = [];
    Object.keys(REG || {}).forEach(function (k) { var e = REG[k]; if ((e.files || []).indexOf(path) >= 0) (e.uses || []).forEach(function (u) { if (u.article !== id) out.push({ id: u.article, title: (u.title || u.article) + (u.current ? '' : ' (earlier story)') }); }); });
    return out;
  }
  window.WTV_IMG = { earlierUses: earlierUses, conflicts: conflicts, record: record, statusOf: statusOf, searchModal: searchModal, savePick: savePick, loadExtra: loadExtra, chipFor: chipFor, LABEL: LABEL };
})();
