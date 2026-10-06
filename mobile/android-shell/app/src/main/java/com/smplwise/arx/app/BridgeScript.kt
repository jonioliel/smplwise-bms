package com.smplwise.arx.app

/**
 * The JavaScript the app gives the page (pure strings, no Android types).
 *
 * [source] runs at document start in **every frame** of the selected server's origin (WebViewCompat.
 * addDocumentStartJavaScript with the same allowed-origin rule as the message listener). It has two parts:
 *
 * 1. The media guard - in every frame of the origin, also the platform's own pages such as the WisKey intercom panel
 *    the Arx page frames at `/hikvision-intercom` (security re-review, item 2): it records every getUserMedia stream and
 *    AudioContext, and `window.__arxLock(on, token)` pauses every audio / video element (shadow roots included), stops
 *    the recorded microphone / camera tracks, suspends the audio contexts, and - while locked - refuses play() and
 *    getUserMedia and pauses anything that starts playing anyway. Only the app can lift it: unlocking needs the
 *    per-screen [token], which lives in a closure the page cannot read. Nothing is resumed on unlock; the page decides.
 * 2. The Arx interface - only under the server's Arx path, never on the platform's own pages:
 *
 *        window.ArxApp = { platform: 'android', shell: 'webview', version: '<versionName>', switchServer() }
 *
 *    and the helper for downloads the page builds (`blob:` URLs, e.g. the audit CSV): the WebView's download callback
 *    cannot fetch a blob and the site's CSP (`connect-src`) refuses a fetch of it, so the script keeps the most recent
 *    Blobs the page turned into URLs ([MAX_BLOBS], at most [BLOB_KEEP_MS] each) and hands one to the app only when the
 *    app asks for that URL right after the WebView reported the download.
 *
 * [lock] is what the app evaluates in the main frame on lock and unlock: it visits the main window and every nested
 * frame it can reach (same-origin frames), calling each frame's guard - or, where a frame has none (an outdated WebView
 * without document-start scripts), pausing its media directly.
 */
object BridgeScript {
    /** The largest file the page may hand over this way (the data travels base64-encoded through one message). */
    const val MAX_BLOB_BYTES = 10 * 1024 * 1024
    const val MAX_MESSAGE_CHARS = MAX_BLOB_BYTES / 3 * 4 + 64 * 1024
    const val MAX_BLOBS = 16
    const val BLOB_KEEP_MS = 120_000

    fun source(version: String, serverPath: String, token: String): String {
        val native = BridgePolicy.NATIVE_OBJECT
        val versionJson = jsString(version)
        val pathJson = jsString(serverPath)
        val tokenJson = jsString(token)
        return """
(function () {
  'use strict';
  // ---- 1. media guard: every frame of the server's origin ----
  if (!window.__arxLock) {
    var tok = $tokenJson;
    var locked = false;
    var streams = [];
    var contexts = [];
    function walk(root, fn) {
      try {
        root.querySelectorAll('*').forEach(function (e) { fn(e); if (e.shadowRoot) walk(e.shadowRoot, fn); });
      } catch (x) {}
    }
    function pauseAll() {
      walk(document, function (e) { if (e instanceof HTMLMediaElement) { try { e.pause(); } catch (x) {} } });
    }
    function stopCapture() {
      streams.forEach(function (s) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (x) {} });
      streams = [];
    }
    var md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      var gum = md.getUserMedia.bind(md);
      md.getUserMedia = function () {
        if (locked) return Promise.reject(new DOMException('The app is locked', 'NotAllowedError'));
        return gum.apply(null, arguments).then(function (s) {
          if (locked) { s.getTracks().forEach(function (t) { t.stop(); }); throw new DOMException('The app is locked', 'NotAllowedError'); }
          streams.push(s);
          return s;
        });
      };
    }
    ['AudioContext', 'webkitAudioContext'].forEach(function (n) {
      var C = window[n];
      if (!C) return;
      var W = function () {
        var c = new (Function.prototype.bind.apply(C, [null].concat([].slice.call(arguments))))();
        contexts.push(c);
        if (locked) { try { c.suspend(); } catch (x) {} }
        return c;
      };
      W.prototype = C.prototype;
      window[n] = W;
    });
    var play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (locked) return Promise.reject(new DOMException('The app is locked', 'NotAllowedError'));
      return play.apply(this, arguments);
    };
    document.addEventListener('play', function (e) {
      if (locked && e.target instanceof HTMLMediaElement) { try { e.target.pause(); } catch (x) {} }
    }, true);
    Object.defineProperty(window, '__arxLock', {
      value: function (on, t) {
        if (on) {
          locked = true;
          pauseAll();
          stopCapture();
          contexts.forEach(function (c) { try { c.suspend(); } catch (x) {} });
        } else if (t === tok) {
          locked = false; // nothing resumes by itself: the page decides
        }
        return locked;
      }
    });
  }

  // ---- 2. the Arx interface: only the main frame's Arx pages ----
  var nat = window.$native;
  if (!nat || window.ArxApp || window.top !== window) return;
  if (String(location.pathname).indexOf($pathJson) !== 0) return;
  function send(m) { try { nat.postMessage(JSON.stringify(m)); } catch (e) {} }
  var blobs = new Map();
  var names = new Map();
  function forget(u) { blobs.delete(u); names.delete(u); }
  var create = URL.createObjectURL;
  var revoke = URL.revokeObjectURL;
  URL.createObjectURL = function (o) {
    var u = create.apply(URL, arguments);
    if (o instanceof Blob) {
      blobs.set(u, o);
      while (blobs.size > $MAX_BLOBS) forget(blobs.keys().next().value);
      setTimeout(function () { forget(u); }, $BLOB_KEEP_MS);
    }
    return u;
  };
  URL.revokeObjectURL = function (u) {
    revoke.apply(URL, arguments);
    setTimeout(function () { forget(u); }, 10000);
  };
  function remember(a) {
    try {
      var href = String(a.href || '');
      if (a.download && href.indexOf('blob:') === 0 && blobs.has(href)) names.set(href, String(a.download));
    } catch (e) {}
  }
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { remember(this); return click.apply(this, arguments); };
  document.addEventListener('click', function (e) {
    var path = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      if (path[i] instanceof HTMLAnchorElement) { remember(path[i]); break; }
    }
  }, true);
  function saveBlob(url) {
    var b = blobs.get(url);
    if (!b) { send({ type: 'blobError', url: url, reason: 'missing' }); return; }
    if (b.size > $MAX_BLOB_BYTES) { send({ type: 'blobError', url: url, reason: 'too_large' }); return; }
    var r = new FileReader();
    r.onload = function () { send({ type: 'blob', url: url, name: names.get(url) || '', mime: b.type || '', data: String(r.result) }); };
    r.onerror = function () { send({ type: 'blobError', url: url, reason: 'read' }); };
    r.readAsDataURL(b);
  }
  Object.defineProperty(window, '__arxSaveBlob', { value: saveBlob });
  Object.defineProperty(window, 'ArxApp', {
    value: Object.freeze({
      platform: 'android',
      shell: 'webview',
      version: $versionJson,
      capabilities: Object.freeze(['device-registration', 'location', 'sensors', 'push']),
      signedIn: function (user) { send({ type: 'signedIn' }); },
      signedOut: function () { send({ type: 'signedOut' }); },
      deviceStatus: function () { return new Promise(function(resolve) {
        var id = String(Date.now()) + Math.random();
        var port = window.ArxAppNative;
        function receive(e) { try { var d = JSON.parse(e.data); if(d.request_id === id) { port.removeEventListener('message', receive); resolve(d.status); } } catch(e) {} }
        port.addEventListener('message', receive);
        send({ type: 'deviceStatus', request_id: id });
        setTimeout(function(){ port.removeEventListener('message', receive); resolve({registered:false}); },6000);
      }); },
      openLocationSettings: function () { send({ type: 'openLocationSettings' }); },
      openSensorSettings: function () { send({ type: 'openSensorSettings' }); },
      switchServer: function () { send({ type: 'switchServer' }); }
    })
  });
})();
""".trimStart()
    }

    /**
     * Evaluated in the main frame on lock ([on] true) and unlock: every reachable frame's guard is set; a frame without
     * one (no document-start support) gets its media paused directly. Unlocking passes the screen's [token].
     */
    fun lock(on: Boolean, token: String): String {
        val tokenJson = jsString(token)
        return "(function(on,t){var n=0;function pause(d){function w(r){try{r.querySelectorAll('*').forEach(function(e){" +
            "if(e instanceof HTMLMediaElement){try{e.pause();}catch(x){}}if(e.shadowRoot)w(e.shadowRoot);});}catch(x){}}w(d);}" +
            "function visit(win){try{if(win.__arxLock){win.__arxLock(on,t);n++;}else if(on){pause(win.document);n++;}}catch(x){}" +
            "try{for(var i=0;i<win.frames.length;i++)visit(win.frames[i]);}catch(x){}}visit(window);return n;})" +
            "(${if (on) "true" else "false"},$tokenJson)"
    }

    /** Evaluated after each page load and route change: the colours the system bars should take (BarColors.pick). */
    const val READ_COLORS = "(function(){var m=document.querySelector('meta[name=\"theme-color\"]');" +
        "var b=document.body?getComputedStyle(document.body).backgroundColor:'';" +
        "var h=getComputedStyle(document.documentElement).backgroundColor;" +
        "return JSON.stringify({theme:m?m.getAttribute('content'):'',body:b,html:h});})()"

    /** A JavaScript string literal for [s]: ASCII letters, digits and `.+-_` pass, anything else becomes a `\u` escape. */
    fun jsString(s: String): String = buildString {
        append('\'')
        for (c in s) {
            if ((c.isLetterOrDigit() && c.code < 0x80) || c in ".+-_") append(c) else append("\\u%04x".format(c.code))
        }
        append('\'')
    }
}
