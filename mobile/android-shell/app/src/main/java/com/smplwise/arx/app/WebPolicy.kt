package com.smplwise.arx.app

/**
 * The shell's security decisions as pure functions (unit-tested on the JVM): which navigations stay in the WebView,
 * which page may talk to the app, and which WebView permission requests are granted.
 */
object NavPolicy {
    enum class Decision {
        /** Let the WebView load it (the selected server's Arx pages, its `/auth/` flow, or a subframe). */
        IN_APP,
        /** Hand it to the system (browser, mail, dialer); the WebView stays where it is. */
        EXTERNAL,
        /** One of the app's own `arx://` links (`arx://servers`, `arx://open?url=`). */
        APP_LINK,
        /** Never loaded and never handed on: `javascript:`, `intent:`, `file:`, `content:`, `data:`, unknown schemes. */
        BLOCK,
    }

    private val SCHEME = Regex("^([A-Za-z][A-Za-z0-9+.-]*):")
    private val SYSTEM_SCHEMES = setOf("mailto", "tel", "sms", "geo")
    private val SUBFRAME_SCHEMES = setOf("https", "http", "about", "blob", "data")

    /**
     * [serverUrl] is the stored server (`https://host/arx/`); [url] the navigation target as the WebView reports it
     * (already canonicalised by the browser engine). Top-level navigation stays in the app only on the server's origin,
     * under its path or under `/auth/` (Home Assistant's sign-in endpoints, should the flow ever navigate); a path with
     * a dot segment, encoded or not, is never in scope. Subframes (the WisKey panel, same origin) are governed by the
     * page's own Content-Security-Policy; only schemes a frame may legitimately use are let through.
     */
    fun decide(serverUrl: String, url: String, isMainFrame: Boolean, allowDevHttp: Boolean = false): Decision {
        val scheme = SCHEME.find(url.trim())?.groupValues?.get(1)?.lowercase() ?: return Decision.BLOCK
        if (scheme == "arx") return if (isMainFrame) Decision.APP_LINK else Decision.BLOCK
        if (!isMainFrame) return if (scheme in SUBFRAME_SCHEMES) Decision.IN_APP else Decision.BLOCK
        return when (scheme) {
            "https", "http" -> if (inScope(serverUrl, url, allowDevHttp)) Decision.IN_APP else Decision.EXTERNAL
            in SYSTEM_SCHEMES -> Decision.EXTERNAL
            else -> Decision.BLOCK
        }
    }

    /** The server's Arx pages, or `/auth/…` on the same origin; never a path with a dot segment. */
    fun inScope(serverUrl: String, url: String, allowDevHttp: Boolean = false): Boolean {
        if (ServerUrls.resolveOnServer(serverUrl, url, allowDevHttp) != null) return true
        val origin = ServerUrls.originOf(serverUrl, allowDevHttp) ?: return false
        val p = ServerUrls.parse(url) ?: return false
        return p.origin == origin && p.rawPath.startsWith("/auth/") && !ServerUrls.hasDotSegments(p.rawPath)
    }
}

object BridgePolicy {
    /** The name of the injected message port (addWebMessageListener); the page sees `window.ArxApp` built on top of it. */
    const val NATIVE_OBJECT = "ArxAppNative"

    /** The kinds of message the page may send; anything else is ignored. */
    val MESSAGE_TYPES = setOf("switchServer", "blob", "blobError")

    /** `https://Host:443/` → `https://host`; null when it is not an http(s) origin. */
    fun canonicalOrigin(origin: String?): String? {
        val o = origin?.trim()?.removeSuffix("/") ?: return null
        val p = ServerUrls.parse("$o/") ?: return null
        return if (p.rawPath == "/" && p.rawQuery == null && p.rawFragment == null) p.origin else null
    }

    /**
     * A message is accepted only from the main frame of a page whose origin equals the selected server's origin. The
     * WebView already injects the object only into frames matching the allowed-origin rule; this is the second check.
     */
    fun accept(serverOrigin: String, sourceOrigin: String?, isMainFrame: Boolean): Boolean {
        if (!isMainFrame) return false
        val server = canonicalOrigin(serverOrigin) ?: return false
        return canonicalOrigin(sourceOrigin) == server
    }
}

object PermissionPolicy {
    /** android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE */
    const val AUDIO_CAPTURE = "android.webkit.resource.AUDIO_CAPTURE"

    /**
     * The resources of a WebView permission request that may be granted: only the microphone (two-way audio), only to
     * the selected server's own origin. Camera capture, MIDI, protected media and anything else are refused; video
     * playback (WebRTC receive-only) needs no permission at all.
     */
    fun grantable(serverOrigin: String, requestOrigin: String?, resources: Array<String>): List<String> {
        val server = BridgePolicy.canonicalOrigin(serverOrigin) ?: return emptyList()
        if (BridgePolicy.canonicalOrigin(requestOrigin) != server) return emptyList()
        return resources.filter { it == AUDIO_CAPTURE }.distinct()
    }
}
