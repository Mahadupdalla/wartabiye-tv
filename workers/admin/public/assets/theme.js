// Light / dark mode (remembered on this device only) and loading states for sign-in buttons and forms.
(function () {
  var KEY = 'wtv-admin-theme', d = document.documentElement;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function system() { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function apply(t) { d.dataset.theme = t; var b = document.getElementById('themeBtn'); if (b) { b.setAttribute('aria-pressed', String(t === 'dark')); b.innerHTML = t === 'dark' ? SUN : MOON; } }
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12H4M20 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></svg>';
  d.dataset.theme = saved() || system();
  window.wtvTheme = { toggle: function () { var t = d.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, t); } catch (e) {} apply(t); }, apply: apply };
  document.addEventListener('DOMContentLoaded', function () {
    apply(d.dataset.theme);
    var b = document.getElementById('themeBtn'); if (b) b.addEventListener('click', window.wtvTheme.toggle);
    function busy(el, text) { el.classList.add('loading'); el.setAttribute('aria-busy', 'true'); var s = el.querySelector('span'); if (s && text) s.textContent = text; }
    document.querySelectorAll('a[data-loading]').forEach(function (a) { a.addEventListener('click', function () { busy(a, a.dataset.loading); }); });
    document.querySelectorAll('form').forEach(function (f) { f.addEventListener('submit', function () { var b = f.querySelector('button[type=submit]'); if (b) { busy(b, 'Checking…'); setTimeout(function () { b.disabled = true; }, 0); } }); });
    var c = document.getElementById('code');
    if (c) c.addEventListener('input', function () { var v = c.value.replace(/\s/g, ''); if (/^\d{6}$/.test(v) && c.form) { c.form.requestSubmit ? c.form.requestSubmit() : c.form.submit(); } });
  });
})();
