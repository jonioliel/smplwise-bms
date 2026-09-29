package com.smplwise.arx.app

/**
 * The JavaScript the app gives the page (pure strings, no Android types).
 *
 * [source] runs at document start, and the WebView injects it only into frames of the selected server's origin
 * (WebViewCompat.addDocumentStartJavaScript with the same allowed-origin rule as the message listener). The origin also
 * serves the platform's own pages, so the script does nothing unless the page is under the server's Arx path. It defines
 * the whole page-facing interface, frozen:
 *
 *     window.ArxApp = { platform: 'android', shell: 'webview', version: '<versionName>', switchServer() }
 *
 * and two helpers the app calls itself:
 * - downloads the page builds (`blob:` URLs, e.g. the audit CSV): the WebView's download callback cannot fetch a blob,
 *   and a `fetch()` of it would be refused by the site's CSP (`connect-src`), so the script remembers the most recent
 *   Blobs the page turned into URLs ([MAX_BLOBS], at most [BLOB_KEEP_MS] each) and hands one to the app only when the
 *   app asks for that URL right after the WebView reported the download;
 * - on app lock, stopping every microphone / camera track the page opened (the media elements are paused by [PAUSE]).
 */
object BridgeScript {
    /** The largest file the page may hand over this way (the data travels base64-encoded through one message). */
    const val MAX_BLOB_BYTES = 10 * 1024 * 1024
    const val MAX_MESSAGE_CHARS = MAX_BLOB_BYTES / 3 * 4 + 64 * 1024
    const val MAX_BLOBS = 16
    const val BLOB_KEEP_MS = 120_000

    fun source(version: String, serverPath: String): String {
        val native = BridgePolicy.NATIVE_OBJECT
        val versionJson = jsString(version)
        val pathJson = jsString(serverPath)
        return """
(function () {
  'use strict';
  var nat = window.$native;
  if (!nat || window.ArxApp) return;
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
  var captured = [];
  var md = navigator.mediaDevices;
  if (md && md.getUserMedia) {
    var gum = md.getUserMedia.bind(md);
    md.getUserMedia = function () {
      return gum.apply(null, arguments).then(function (s) { captured.push(s); return s; });
    };
  }
  function stopCapture() {
    captured.forEach(function (s) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} });
    captured = [];
  }
  Object.defineProperty(window, '__arxSaveBlob', { value: saveBlob });
  Object.defineProperty(window, '__arxStopCapture', { value: stopCapture });
  Object.defineProperty(window, 'ArxApp', {
    value: Object.freeze({
      platform: 'android',
      shell: 'webview',
      version: $versionJson,
      switchServer: function () { send({ type: 'switchServer' }); }
    })
  });
})();
""".trimStart()
    }

    /** Evaluated after each page load and route change: the colours the system bars should take (BarColors.pick). */
    const val READ_COLORS = "(function(){var m=document.querySelector('meta[name=\"theme-color\"]');" +
        "var b=document.body?getComputedStyle(document.body).backgroundColor:'';" +
        "var h=getComputedStyle(document.documentElement).backgroundColor;" +
        "return JSON.stringify({theme:m?m.getAttribute('content'):'',body:b,html:h});})()"

    /**
     * Evaluated when the app locks (security review L5): pauses every audio / video element, also inside shadow roots,
     * and stops the microphone / camera tracks the page opened (through the document-start script's record).
     */
    const val PAUSE = "(function(){function walk(r){r.querySelectorAll('*').forEach(function(e){" +
        "if(e instanceof HTMLMediaElement){try{e.pause();}catch(x){}}if(e.shadowRoot)walk(e.shadowRoot);});}" +
        "try{walk(document);}catch(x){}if(window.__arxStopCapture)window.__arxStopCapture();return 'paused';})()"

    /** A JavaScript string literal for [s]: ASCII letters, digits and `.+-_` pass, anything else becomes a `\u` escape. */
    fun jsString(s: String): String = buildString {
        append('\'')
        for (c in s) {
            if ((c.isLetterOrDigit() && c.code < 0x80) || c in ".+-_") append(c) else append("\\u%04x".format(c.code))
        }
        append('\'')
    }
}
