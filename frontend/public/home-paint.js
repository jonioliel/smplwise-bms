// HOME-V3-AUDITFIX-2437 (design audit round 30, item 7): the first frame of a device whose last screen was the home interface takes
// the home's own background (theme and scheme in force there, stored by sw-home as `arx-home-paint`) instead of the full interface's
// cool grey, until the home draws itself. A classic script file, not inline: the remote channel's CSP is `script-src 'self'`.
(function () {
  try {
    var p = JSON.parse(localStorage.getItem('arx-home-paint') || 'null');
    var h = location.hash;
    if (!p || typeof p.bg !== 'string' || !/^#[0-9a-f]{3,8}$|^rgb/i.test(p.bg)) return;
    if (h && h !== '#' && h !== '#/' && h.indexOf('#/home') !== 0) return;
    var s = document.documentElement.style;
    s.setProperty('--sw-bg', p.bg);
    s.background = p.bg;
    document.documentElement.setAttribute('data-home-paint', p.scheme === 'light' ? 'light' : 'dark');
  } catch (e) {
    /* storage off: the usual first frame */
  }
})();
