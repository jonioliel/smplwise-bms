package com.smplwise.arx.app

import kotlin.math.pow

/** App lock ("נעילת האפליקציה") timing, pure. Times are SystemClock.elapsedRealtime() milliseconds. */
object LockPolicy {
    /** The choices offered in the server list: 0 = every time the app leaves the screen. */
    val MINUTES_CHOICES = listOf(0, 1, 5, 15, 60)
    const val DEFAULT_MINUTES = 1

    /** Leaving through the app's own helper (file picker, "save as", the microphone prompt) waives this much, no more. */
    const val EXCURSION_GRACE_MS = 30_000L

    /**
     * Whether the app must ask for the fingerprint / face / screen lock before showing anything:
     * - never when the lock is off;
     * - always when this process has not been unlocked yet (a cold start, or Android killed the process);
     * - after [minutes] or more in the background. The time away is always recorded; when the app left through one of
     *   its own helpers ([viaExcursion]) the first [EXCURSION_GRACE_MS] do not count, so picking a file does not lock
     *   the app, but staying away longer does (security review M5).
     */
    fun needsUnlock(
        enabled: Boolean,
        unlockedAt: Long?,
        backgroundSince: Long?,
        now: Long,
        minutes: Int,
        viaExcursion: Boolean = false,
        lockShowing: Boolean = false,
    ): Boolean {
        if (!enabled) return false
        // once shown, the lock stays until the phone confirms the user: leaving for the phone's own credential screen
        // and cancelling it is not an excursion that could waive it (seen on the emulator)
        if (lockShowing) return true
        if (unlockedAt == null) return true
        if (backgroundSince == null) return false
        val elapsed = now - backgroundSince
        if (elapsed < 0) return true // the clock is monotonic; a negative span means state from before a reboot
        if (viaExcursion && elapsed < EXCURSION_GRACE_MS) return false
        return elapsed >= minutes.coerceAtLeast(0) * 60_000L
    }

    enum class AuthState { PROMPT, SWITCH_OFF, STAY_LOCKED }

    /**
     * What the lock does with the phone's answer to "can you authenticate?" (security review L4): prompt when it can;
     * switch the lock off only when the phone has no screen lock or biometrics at all any more; for anything else
     * (hardware busy or unavailable, a security update pending) stay locked and let the user try again.
     */
    fun onAuthState(canAuthenticate: Boolean, noneEnrolled: Boolean): AuthState = when {
        canAuthenticate -> AuthState.PROMPT
        noneEnrolled -> AuthState.SWITCH_OFF
        else -> AuthState.STAY_LOCKED
    }
}

/** Where the system-bar insets go (pure). */
object InsetPolicy {
    /**
     * Android System WebView reports `env(safe-area-inset-*)` correctly from version 140; earlier versions report 0 or
     * wrong values (Capacitor's edge-to-edge guide, capawesome.io, read 2026-09-29). From 140 the page receives the
     * bottom and side insets itself (it already pads its bottom navigation with `env(safe-area-inset-bottom)`); below
     * 140, or when the version is unknown, the app pads the WebView natively and the page sees 0.
     */
    const val FIRST_WEBVIEW_WITH_SAFE_AREA = 140

    fun webViewMajor(versionName: String?): Int? =
        versionName?.trim()?.substringBefore('.')?.toIntOrNull()?.takeIf { it > 0 }

    fun pageHandlesInsets(webViewMajor: Int?): Boolean =
        webViewMajor != null && webViewMajor >= FIRST_WEBVIEW_WITH_SAFE_AREA

    /**
     * The Arx web app uses CSS `color-mix()` (Chromium 111), `dvh` units (108) and `:has()` (105). On the emulator's
     * frozen WebView 101 the page rendered with wrong colours and a short layout. An older WebView gets a notice asking
     * to update "Android System WebView"; unknown versions get none.
     */
    const val MIN_WEBVIEW_FOR_SITE = 111

    fun webViewOutdated(webViewMajor: Int?): Boolean = webViewMajor != null && webViewMajor < MIN_WEBVIEW_FOR_SITE
}

/** The system-bar colours taken from the page (pure). */
object BarColors {
    /** The PWA manifest's colours (frontend/public/arx-manifest.webmanifest), used until the page says otherwise. */
    const val DEFAULT_THEME = 0xFF2F6BFF.toInt()
    const val DEFAULT_BACKGROUND = 0xFFF5F7FB.toInt()

    private val HEX = Regex("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
    private val RGB = Regex("^rgba?\\(\\s*([\\d.]+)[\\s,]+([\\d.]+)[\\s,]+([\\d.]+)(?:\\s*[,/]\\s*([\\d.]+%?))?\\s*\\)$")

    /** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(r, g, b)`, `rgba(r, g, b, a)`, `rgb(r g b / a)` → ARGB; null otherwise. */
    fun parse(css: String?): Int? {
        val s = css?.trim()?.lowercase() ?: return null
        HEX.find(s)?.let {
            val h = it.groupValues[1]
            val full = if (h.length == 3) h.map { c -> "$c$c" }.joinToString("") else h
            val rgb = full.substring(0, 6).toLong(16).toInt()
            val a = if (full.length == 8) full.substring(6, 8).toInt(16) else 0xFF
            return (a shl 24) or rgb
        }
        val m = RGB.find(s) ?: return null
        val (r, g, b) = (1..3).map { i -> m.groupValues[i].toDoubleOrNull()?.coerceIn(0.0, 255.0)?.toInt() ?: return null }
        val aRaw = m.groupValues[4]
        val a = when {
            aRaw.isEmpty() -> 255
            aRaw.endsWith("%") -> ((aRaw.removeSuffix("%").toDoubleOrNull() ?: return null).coerceIn(0.0, 100.0) * 2.55).toInt()
            else -> ((aRaw.toDoubleOrNull() ?: return null).coerceIn(0.0, 1.0) * 255).toInt()
        }
        return (a shl 24) or (r shl 16) or (g shl 8) or b
    }

    private fun opaque(color: Int?): Int? = color?.takeIf { (it ushr 24) >= 0xF0 }

    /** WCAG relative luminance, 0 (black) to 1 (white). */
    fun luminance(color: Int): Double {
        fun ch(v: Int): Double {
            val c = v / 255.0
            return if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
        }
        return 0.2126 * ch((color shr 16) and 0xFF) + 0.7152 * ch((color shr 8) and 0xFF) + 0.0722 * ch(color and 0xFF)
    }

    /**
     * Dark icons on this background? White icons as long as they reach a 3:1 contrast (as Chrome decides for its
     * toolbar and a PWA's status bar), i.e. up to a relative luminance of 0.3 - the brand blue keeps white icons.
     */
    fun wantsDarkIcons(color: Int): Boolean = (1.05 / (luminance(color) + 0.05)) < 3.0

    /**
     * The status bar takes the page's `<meta name="theme-color">` (as a standalone PWA does); the navigation bar takes
     * the page's own background (body, else html). Transparent or unreadable values fall back to the defaults.
     */
    fun pick(themeColor: String?, bodyBackground: String?, htmlBackground: String?): Pair<Int, Int> {
        val status = opaque(parse(themeColor)) ?: DEFAULT_THEME
        val nav = opaque(parse(bodyBackground)) ?: opaque(parse(htmlBackground)) ?: DEFAULT_BACKGROUND
        return status to nav
    }
}

/** What the Hebrew error screen says (pure mapping; the texts are string resources). */
object LoadErrors {
    enum class Kind { OFFLINE, NOT_FOUND, TIMEOUT, TLS, SERVER, OUT_OF_SCOPE, OTHER }

    // android.webkit.WebViewClient.ERROR_* (inlined constants; not referenced so this stays a plain JVM class)
    private const val ERROR_HOST_LOOKUP = -2
    private const val ERROR_CONNECT = -6
    private const val ERROR_TIMEOUT = -8
    private const val ERROR_FAILED_SSL_HANDSHAKE = -11

    fun ofNetworkError(code: Int, online: Boolean): Kind = when {
        !online -> Kind.OFFLINE
        code == ERROR_HOST_LOOKUP -> Kind.NOT_FOUND
        code == ERROR_TIMEOUT -> Kind.TIMEOUT
        code == ERROR_CONNECT -> Kind.TIMEOUT
        code == ERROR_FAILED_SSL_HANDSHAKE -> Kind.TLS
        else -> Kind.OTHER
    }

    /**
     * A main-document HTTP status that gets the app's own screen instead of the page: the tunnel or proxy in front of
     * the server answering for a server that is down (502, 503, 504, Cloudflare's 52x and 530), or the path not being
     * served at all (404: remote access switched off in the add-on).
     */
    fun ofHttpStatus(status: Int): Kind? = when (status) {
        404 -> Kind.NOT_FOUND
        in 500..599 -> Kind.SERVER
        else -> null
    }
}

/** Upload and download file helpers (pure). */
object FileTypes {
    /**
     * MIME types for the system file picker from an `<input accept>` list: `.pdf` → application/pdf (through [mimeOf],
     * Android's MimeTypeMap in the app), a type or a wildcard type (image/star) kept as it is; unknown or empty → any
     * type (star/star). (Written out: a slash-star inside a Kotlin comment would open a nested comment.)
     */
    fun mimeTypes(accept: Array<String>?, mimeOf: (String) -> String?): List<String> {
        val out = linkedSetOf<String>()
        for (token in accept.orEmpty().flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }) {
            when {
                token.startsWith(".") -> mimeOf(token.removePrefix("."))?.let { out += it }
                Regex("^[a-z0-9.+-]+/([a-z0-9.+-]+|\\*)$").matches(token) -> out += token
            }
        }
        return if (out.isEmpty()) listOf("*/*") else out.toList()
    }

    /** A file name safe to hand to the system: no path, no control characters, at most 120 characters. */
    fun safeName(name: String?, fallback: String): String {
        val base = name.orEmpty().substringAfterLast('/').substringAfterLast('\\')
            .filterNot { it.isISOControl() || it in "<>:\"|?*" }
            .trim().trimStart('.')
        val cleaned = base.ifEmpty { fallback }
        return if (cleaned.length <= 120) cleaned else {
            val ext = cleaned.substringAfterLast('.', "").takeIf { it.length in 1..10 }
            if (ext != null) cleaned.take(119 - ext.length) + "." + ext else cleaned.take(120)
        }
    }
}

/** Two-finger swipe up opens the server list. Pure, so the thresholds are unit-tested. */
object ServersGesture {
    enum class Mode(val key: String) {
        OFF("off"), ANYWHERE("anywhere"), EDGE("edge");

        companion object {
            fun of(key: String?): Mode = values().firstOrNull { it.key == key } ?: ANYWHERE
        }
    }

    const val MIN_RISE_DP = 120f
    const val MAX_MS = 700L
    const val EDGE_FRACTION = 0.25f
    private const val MAX_SPREAD_CHANGE = 0.25f

    /** The two fingers moved apart or together by more than a quarter of their starting distance: a pinch (zoom), never this gesture.
     *  Checked on every move as well as at the end, so a pinch that ends back at its starting distance is still ruled out. */
    fun isPinch(startSpread: Float, spread: Float): Boolean =
        startSpread > 0f && kotlin.math.abs(spread - startSpread) / startSpread > MAX_SPREAD_CHANGE

    /** Average of both fingers at the start and the end of one two-finger touch that never had a third finger. */
    fun isTrigger(
        mode: Mode, startY: Float, endY: Float, startX: Float, endX: Float,
        startSpread: Float, endSpread: Float, viewHeight: Float, durationMs: Long, density: Float,
    ): Boolean {
        if (mode == Mode.OFF || viewHeight <= 0f || durationMs > MAX_MS) return false
        val rise = startY - endY
        if (rise < MIN_RISE_DP * density) return false
        if (kotlin.math.abs(endX - startX) > rise / 2) return false // mostly vertical
        if (isPinch(startSpread, endSpread)) return false
        return mode != Mode.EDGE || startY >= viewHeight * (1f - EDGE_FRACTION)
    }
}
