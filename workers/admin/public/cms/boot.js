// Starts the publishing tool already signed in. The "token" below is NOT a credential: GitHub calls go to this
// Worker's /api/github proxy, which ignores it and uses the owner's server-side session instead.
(function () {
  try {
    var u = JSON.parse(localStorage.getItem('sveltia-cms.user') || 'null');
    if (!u || u.backendName !== 'github' || u.token !== 'server-session') {
      localStorage.setItem('sveltia-cms.user', JSON.stringify({ backendName: 'github', token: 'server-session' }));
    }
  } catch (e) {}
  // when the session ends, go back to the sign-in page instead of showing the tool's own token form
  var f = window.fetch;
  window.fetch = function (input, init) {
    return f.apply(this, arguments).then(function (r) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (r.status === 401 && url.indexOf('/api/') >= 0) {
        try { (window.top || window).location.href = '/login?e=expired'; } catch (e) { location.href = '/login?e=expired'; }
      }
      return r;
    });
  };
  // if GitHub could not be reached, the tool stays on its own sign-in screen: cover it with a clear retry message.
  // The tool shows that screen for a moment on every start before it signs in by itself, so only react when it is
  // still there after 12 seconds, and take the message away again as soon as the tool has loaded.
  var since = 0;
  function signInScreen() {
    return [].some.call(document.querySelectorAll('button'), function (b) { return /Sign In Using Access Token|Work with Local Repository/.test(b.textContent); });
  }
  function guard() {
    var o = document.getElementById('wtvRetry');
    if (!signInScreen()) { since = 0; if (o) o.remove(); return; }
    if (!since) since = Date.now();
    if (o || Date.now() - since < 12000) return;
    o = document.createElement('div'); o.id = 'wtvRetry';
    o.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#f1f5fa;font:16px system-ui,sans-serif;color:#0b1c33;padding:20px;text-align:center');
    var box = document.createElement('div');
    var h = document.createElement('h2'); h.textContent = 'Could not connect to GitHub';
    var p = document.createElement('p'); p.textContent = 'The publishing tool could not load the website files just now (GitHub may be busy). Your session is still safe.';
    var b = document.createElement('button'); b.textContent = 'Try again';
    b.setAttribute('style', 'background:#037BDC;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer');
    b.addEventListener('click', function () { try { localStorage.setItem('sveltia-cms.user', JSON.stringify({ backendName: 'github', token: 'server-session' })); } catch (e) {} location.reload(); });
    box.append(h, p, b); o.append(box); document.body.append(o);
  }
  setInterval(guard, 1000);
  // keep the session alive while the owner is working in the editor
  var last = 0;
  ['keydown', 'pointerdown'].forEach(function (ev) {
    addEventListener(ev, function () {
      var t = Date.now();
      if (t - last > 120000) { last = t; try { window.parent.postMessage({ wtv: 'activity' }, location.origin); } catch (e) {} }
    }, { passive: true });
  });
})();
