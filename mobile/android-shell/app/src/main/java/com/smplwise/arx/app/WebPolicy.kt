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
     * (already canonicalised by the browser engine). Top-level navigation stays in the app only on the server's origin
     * and under its path; a path with a dot segment, encoded or not, is never in scope. (No `/auth/` exception: the Arx
     * sign-in talks to those endpoints with fetch, it never navigates there - security review L2.) Subframes (the
     * WisKey panel, same origin) are governed by the page's own Content-Security-Policy; only schemes a frame may
     * legitimately use are let through.
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

    /** The server's Arx pages: its origin, at or below its path; never a path with a dot segment. */
    fun inScope(serverUrl: String, url: String, allowDevHttp: Boolean = false): Boolean =
        ServerUrls.resolveOnServer(serverUrl, url, allowDevHttp) != null

    /**
     * What the WebView may show as its main document once a navigation has started or a history entry became current.
     * `shouldOverrideUrlLoading` never sees POST navigations (a form with `target=_top`), back / forward or a restored
     * state, so this second check runs on every main-frame start and history update (security review M1):
     * the server's pages are fine, `about:blank` is harmless, anything else must be stopped.
     */
    fun mayShow(serverUrl: String, url: String?, allowDevHttp: Boolean = false): Boolean {
        val u = url?.trim().orEmpty()
        if (u.isEmpty() || u == "about:blank") return true
        return inScope(serverUrl, u, allowDevHttp)
    }

    /**
     * A navigation without a user gesture (script, meta refresh) may hand one link to the system browser at most every
     * [EXTERNAL_THROTTLE_MS]; a tap always may (security review L7: a page must not be able to spray intents).
     */
    const val EXTERNAL_THROTTLE_MS = 10_000L

    fun allowExternal(hasGesture: Boolean, now: Long, lastExternalAt: Long?): Boolean =
        hasGesture || lastExternalAt == null || now - lastExternalAt >= EXTERNAL_THROTTLE_MS || now < lastExternalAt

    /**
     * "החלף שרת" from the page (the bridge's switchServer, or an `arx://servers` navigation reported without a gesture)
     * is honoured only within [USER_ACTIVATION_MS] of a touch on the WebView, so a page cannot stack server lists by
     * itself (security re-review, item 3).
     */
    const val USER_ACTIVATION_MS = 5_000L

    fun userActivated(now: Long, lastTouchAt: Long?): Boolean =
        lastTouchAt != null && now >= lastTouchAt && now - lastTouchAt <= USER_ACTIVATION_MS

    /**
     * The renderer crashed or was killed: restart the screen at most once per [RESTART_WINDOW_MS] (security review L8);
     * a second crash inside the window shows the error screen instead of looping.
     */
    const val RESTART_WINDOW_MS = 30_000L

    fun allowRendererRestart(now: Long, lastRestartAt: Long?): Boolean =
        lastRestartAt == null || now - lastRestartAt >= RESTART_WINDOW_MS || now < lastRestartAt
}

object DownloadPolicy {
    const val MAX_REDIRECTS = 5

    /**
     * The next hop of an in-app download after an HTTP redirect (security review M2): the `Location` resolved against
     * the current URL, followed only when it is still one of the server's pages (so the session cookie never leaves
     * them); null otherwise.
     */
    fun nextHop(serverUrl: String, currentUrl: String, location: String?, allowDevHttp: Boolean = false): String? {
        val loc = location?.trim()?.takeIf { it.isNotEmpty() && it.none { c -> c.isWhitespace() || c == '\\' } } ?: return null
        val resolved = try {
            java.net.URI(currentUrl).resolve(loc).toString()
        } catch (e: Exception) {
            return null
        }
        return ServerUrls.resolveOnServer(serverUrl, resolved, allowDevHttp)
    }

    private val PACKAGE_MIMES = setOf("application/vnd.android.package-archive", "application/x-apk")

    /** Never offer to save an Android package from the site (security review L9). */
    fun refused(name: String?, mime: String?): Boolean {
        val n = name.orEmpty().trim().lowercase()
        val m = mime.orEmpty().substringBefore(';').trim().lowercase()
        return n.endsWith(".apk") || n.endsWith(".apks") || n.endsWith(".xapk") || m in PACKAGE_MIMES
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

    /**
     * The origin rule cannot tell paths apart, and the server's origin also hosts the platform's own UI at `/`. So the
     * page currently shown must also be one of the server's Arx pages (security review M1) - checked against the
     * WebView's current URL whenever a message arrives.
     */
    fun accept(serverUrl: String, serverOrigin: String, sourceOrigin: String?, isMainFrame: Boolean, currentUrl: String?, allowDevHttp: Boolean = false): Boolean =
        accept(serverOrigin, sourceOrigin, isMainFrame) && currentUrl != null && NavPolicy.inScope(serverUrl, currentUrl, allowDevHttp)
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
