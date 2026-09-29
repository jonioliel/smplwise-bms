package com.smplwise.arx.app

/**
 * The JavaScript the app gives the page (pure strings, no Android types).
 *
 * [source] runs at document start, and the WebView injects it only into frames of the selected server's origin
 * (WebViewCompat.addDocumentStartJavaScript with the same allowed-origin rule as the message listener). It defines the
 * whole page-facing interface, frozen:
 *
 *     window.ArxApp = { platform: 'android', shell: 'webview', version: '<versionName>', switchServer() }
 *
 * and a helper for downloads the page builds itself (`blob:` URLs, e.g. the audit CSV): the WebView's download
 * callback cannot fetch a blob, and a `fetch()` of it would be refused by the site's own CSP (`connect-src`), so the
 * script remembers each Blob when the page creates its URL and hands it to the app only when the app asks for that URL
 * right after the WebView reported the download.
 */
object BridgeScript {
    /** The largest file the page may hand over this way (the data travels base64-encoded through one message). */
    const val MAX_BLOB_BYTES = 25 * 1024 * 1024
    const val MAX_MESSAGE_CHARS = MAX_BLOB_BYTES / 3 * 4 + 64 * 1024

    fun source(version: String): String {
        val native = BridgePolicy.NATIVE_OBJECT
        val versionJson = jsString(version)
        return """
(function () {
  'use strict';
  var nat = window.$native;
  if (!nat || window.ArxApp) return;
  function send(m) { try { nat.postMessage(JSON.stringify(m)); } catch (e) {} }
  var blobs = new Map();
  var names = new Map();
  var create = URL.createObjectURL;
  var revoke = URL.revokeObjectURL;
  URL.createObjectURL = function (o) {
    var u = create.apply(URL, arguments);
    if (o instanceof Blob) blobs.set(u, o);
    return u;
  };
  URL.revokeObjectURL = function (u) {
    revoke.apply(URL, arguments);
    setTimeout(function () { blobs.delete(u); names.delete(u); }, 60000);
  };
  function remember(a) {
    try {
      var href = String(a.href || '');
      if (a.download && href.indexOf('blob:') === 0) names.set(href, String(a.download));
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

    /** A JavaScript string literal for [s]: ASCII letters, digits and `.+-_` pass, anything else becomes a `\u` escape. */
    fun jsString(s: String): String = buildString {
        append('\'')
        for (c in s) {
            if ((c.isLetterOrDigit() && c.code < 0x80) || c in ".+-_") append(c) else append("\\u%04x".format(c.code))
        }
        append('\'')
    }
}
