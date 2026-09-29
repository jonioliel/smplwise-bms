package com.smplwise.arx.app

import java.net.IDN
import java.net.URI
import java.net.URISyntaxException

/**
 * Pure URL logic for the server list and for everything that decides "is this link on that server" (no Android types,
 * so it runs as a plain JVM unit test).
 *
 * A server is stored as `https://<host>[:port]/<path>/` - the address of the Arx page on that site, by default `/arx/`
 * (the add-on option remote_path). Users type whatever they have: `site.example.com`, `https://site.example.com`, or a full
 * `https://site.example.com/arx/#/live` copied from the browser.
 *
 * Based on the Trusted Web Activity branch's ServerUrls, with that branch's security review applied: a link is rebuilt
 * from its parsed parts (never compared or opened as the raw string), percent-encoded dot segments (`%2e%2e`) are
 * refused, a scheme without `//` (`javascript:alert(1)`) is a scheme and not a host, a backslash is never accepted,
 * and internationalised host names are stored in their ASCII (punycode) form. `http://` as typed is upgraded to
 * `https://` (the app never talks plain http to a server; debug builds keep http only for 127.0.0.1).
 */
object ServerUrls {
    const val DEFAULT_PATH = "/arx/"
    const val APP_PARAM = "app=android"

    /** Debug builds only (BuildConfig.ALLOW_DEV_HTTP): plain http to 127.0.0.1 (`adb reverse tcp:8099 tcp:8099`). */
    val DEV_HTTP_HOSTS = setOf("127.0.0.1")

    enum class Problem { EMPTY, NOT_HTTPS, CREDENTIALS, BAD_HOST, BAD_PORT, BAD_URL }

    sealed interface Result {
        data class Ok(val url: String, val origin: String, val host: String) : Result
        data class Invalid(val problem: Problem) : Result
    }

    private val HOST_LABEL = Regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
    private val IPV4 = Regex("^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$")
    private val PATH_SEGMENT = Regex("^[A-Za-z0-9._~%!$&'()*+,;=:@-]+$")
    private val SCHEME = Regex("^([A-Za-z][A-Za-z0-9+.-]*):(.*)$", RegexOption.DOT_MATCHES_ALL)
    /**
     * What follows `name:` when `name` is a host and the rest a port (`site.example.com:8443/arx`), not a scheme. An `@`
     * after the digits (`good.com:443@evil.com`) is still read as host:port so the authority check names it credentials.
     */
    private val PORT_REST = Regex("^\\d+([/?#@].*)?$", RegexOption.DOT_MATCHES_ALL)
    private val TRAILING_PORT = Regex(":\\d+$")

    private fun hasForbiddenChar(s: String) = s.any { it.isWhitespace() || it.isISOControl() || it == '\\' }

    fun normalize(raw: String, defaultPath: String = DEFAULT_PATH, allowDevHttp: Boolean = false): Result {
        var s = raw.trim()
        if (s.isEmpty()) return Result.Invalid(Problem.EMPTY)
        if (hasForbiddenChar(s)) return Result.Invalid(Problem.BAD_URL)

        var scheme = "https"
        val m = SCHEME.find(s)
        s = when {
            s.startsWith("//") -> "https:$s"
            m == null -> "https://$s"
            PORT_REST.matches(m.groupValues[2]) -> "https://$s" // host:port, not a scheme
            !m.groupValues[2].startsWith("//") -> {
                // `javascript:alert(1)`, `mailto:x@y`, `https:host` - a scheme without an authority
                return Result.Invalid(if (m.groupValues[1].equals("https", true)) Problem.BAD_URL else Problem.NOT_HTTPS)
            }
            else -> {
                scheme = m.groupValues[1].lowercase()
                // http is accepted as typed and upgraded to https below (owner 2026-09-29); any other scheme is refused
                if (scheme != "https" && scheme != "http") return Result.Invalid(Problem.NOT_HTTPS)
                "$scheme:" + m.groupValues[2]
            }
        }

        // The authority is checked before parsing: anything with `@` carries credentials (or hides the real host, as in
        // `good.com:443@evil.com`); a `#` or `?` ends it (`good.com#@evil.com` is the host good.com).
        val afterScheme = s.substring(scheme.length + 3)
        val authEnd = afterScheme.indexOfFirst { it == '/' || it == '?' || it == '#' }.let { if (it < 0) afterScheme.length else it }
        var authority = afterScheme.substring(0, authEnd)
        if (authority.contains('@')) return Result.Invalid(Problem.CREDENTIALS)
        if (authority.isEmpty()) return Result.Invalid(Problem.BAD_HOST)
        if (authority.any { it.code > 0x7f }) {
            val portPart = TRAILING_PORT.find(authority)?.value ?: ""
            val ascii = try {
                IDN.toASCII(authority.removeSuffix(portPart), IDN.USE_STD3_ASCII_RULES)
            } catch (e: IllegalArgumentException) {
                return Result.Invalid(Problem.BAD_HOST)
            }
            authority = ascii + portPart
            s = "$scheme://$authority" + afterScheme.substring(authEnd)
        }

        val uri = try {
            URI(s)
        } catch (e: URISyntaxException) {
            return Result.Invalid(if (TRAILING_PORT.containsMatchIn(authority)) Problem.BAD_PORT else Problem.BAD_URL)
        }
        if (uri.rawUserInfo != null) return Result.Invalid(Problem.CREDENTIALS)
        val host = uri.host?.lowercase()?.trimEnd('.')
            ?: return Result.Invalid(if (TRAILING_PORT.containsMatchIn(authority)) Problem.BAD_PORT else Problem.BAD_HOST)
        var portNumber = uri.port
        if (scheme == "http" && !(allowDevHttp && host in DEV_HTTP_HOSTS)) {
            // `http://host/arx` → `https://host/arx/`: the app never speaks plain http to a server; http's own default
            // port becomes https's default, any other explicit port is kept
            scheme = "https"
            if (portNumber == 80) portNumber = -1
        }
        if (!isHost(host)) return Result.Invalid(Problem.BAD_HOST)
        val port = portSuffix(scheme, portNumber) ?: return Result.Invalid(Problem.BAD_PORT)
        val path = normalizePath(uri.rawPath ?: "", defaultPath) ?: return Result.Invalid(Problem.BAD_URL)
        val origin = "$scheme://$host$port"
        return Result.Ok("$origin$path", origin, host)
    }

    /**
     * The addresses the add-server check tries, in order. An address typed with a path (`site.example.com/remote`) is
     * tried as it is; one without a path (`site.example.com`, `http://site.example.com/`) is tried at the default
     * `/arx/` first and then at the site's root. Empty when the input is not a valid address at all.
     */
    fun candidates(raw: String, allowDevHttp: Boolean = false): List<String> {
        val withDefault = normalize(raw, DEFAULT_PATH, allowDevHttp) as? Result.Ok ?: return emptyList()
        val atRoot = normalize(raw, "/", allowDevHttp) as? Result.Ok ?: return listOf(withDefault.url)
        return if (withDefault.url == atRoot.url) listOf(withDefault.url) else listOf(withDefault.url, atRoot.url)
    }

    /** `""` for the scheme's default port, `":<n>"` for another valid one, null for an invalid one. */
    private fun portSuffix(scheme: String, port: Int): String? = when {
        port == -1 -> ""
        scheme == "https" && port == 443 -> ""
        scheme == "http" && port == 80 -> ""
        port in 1..65535 -> ":$port"
        else -> null
    }

    private fun isHost(host: String): Boolean {
        if (host.length > 253) return false
        if (IPV4.matches(host)) return true
        val labels = host.split('.')
        return labels.size >= 2 && labels.all { HOST_LABEL.matches(it) } && !labels.last().all { it.isDigit() }
    }

    /**
     * Percent-decodes a path segment or a query value (`%2e%2e` → `..`; `+` stays `+`, it is legal in a URL). A malformed
     * escape decodes to null, which the callers treat as unsafe.
     */
    internal fun decodeSegment(segment: String): String? {
        if (!segment.contains('%')) return segment
        val out = java.io.ByteArrayOutputStream()
        var i = 0
        while (i < segment.length) {
            val c = segment[i]
            if (c == '%') {
                if (i + 2 >= segment.length) return null
                val b = segment.substring(i + 1, i + 3).toIntOrNull(16) ?: return null
                out.write(b)
                i += 3
            } else {
                out.write(c.toString().toByteArray(Charsets.UTF_8))
                i++
            }
        }
        return out.toString(Charsets.UTF_8.name())
    }

    /** True when a segment is, or percent-decodes to, `.` or `..` (a browser resolves both, escaping a path prefix). */
    internal fun isDotSegment(segment: String): Boolean {
        val d = decodeSegment(segment) ?: return true
        return d == "." || d == ".."
    }

    /** True when any segment of [rawPath] is a (possibly encoded) dot segment or cannot be decoded. */
    fun hasDotSegments(rawPath: String): Boolean = rawPath.split('/').any { it.isNotEmpty() && isDotSegment(it) }

    /** `/arx/#…`, `/arx/index.html`, `/arx/api/v1/…` → `/arx/`; empty or `/` → the default; always `/…/`. */
    private fun normalizePath(rawPath: String, defaultPath: String): String? {
        var p = rawPath
        val api = p.indexOf("/api/")
        if (api >= 0) p = p.substring(0, api + 1)
        if (p.endsWith("/index.html")) p = p.removeSuffix("index.html")
        val segments = p.split('/').filter { it.isNotEmpty() }
        if (segments.isEmpty()) return defaultPath
        if (segments.any { isDotSegment(it) || !PATH_SEGMENT.matches(it) }) return null
        return "/" + segments.joinToString("/") + "/"
    }

    /** The origin (`https://host[:port]`) of a stored server URL, or null when it is not a valid server URL. */
    fun originOf(serverUrl: String, allowDevHttp: Boolean = false): String? =
        (normalize(serverUrl, allowDevHttp = allowDevHttp) as? Result.Ok)?.origin

    /** A parsed absolute link: its origin as the server list writes origins, and its raw path, query and fragment. */
    data class Parsed(val origin: String, val rawPath: String, val rawQuery: String?, val rawFragment: String?)

    /**
     * Parses an absolute http(s) link for comparison with a server. Null for anything else: another scheme, credentials,
     * a backslash or whitespace, a host that is not ASCII after the browser's own canonicalisation, an invalid port.
     */
    fun parse(target: String): Parsed? {
        val t = target.trim()
        if (t.isEmpty() || hasForbiddenChar(t)) return null
        val uri = try {
            URI(t)
        } catch (e: URISyntaxException) {
            return null
        }
        val scheme = uri.scheme?.lowercase() ?: return null
        if (scheme != "https" && scheme != "http") return null
        if (uri.rawUserInfo != null || (uri.rawAuthority ?: "").contains('@')) return null
        val host = uri.host?.lowercase()?.trimEnd('.') ?: return null
        if (host.isEmpty() || host.any { it.code > 0x7f }) return null
        val port = portSuffix(scheme, uri.port) ?: return null
        return Parsed("$scheme://$host$port", uri.rawPath.orEmpty().ifEmpty { "/" }, uri.rawQuery, uri.rawFragment)
    }

    /**
     * The link [target] rebuilt on the server stored as [serverUrl] - `server origin + path + ?query + #fragment` from the
     * parsed parts - when it lies on that server: the same origin and a path at or below the server's path, with no
     * dot segment (encoded or not). Null otherwise. `arx://open` opens only what this returns.
     */
    fun resolveOnServer(serverUrl: String, target: String, allowDevHttp: Boolean = false): String? {
        val server = normalize(serverUrl, allowDevHttp = allowDevHttp) as? Result.Ok ?: return null
        val p = parse(target) ?: return null
        if (p.origin != server.origin) return null
        if (hasDotSegments(p.rawPath)) return null
        val serverPath = server.url.removePrefix(server.origin)
        val path = when {
            p.rawPath == serverPath.removeSuffix("/") -> serverPath
            p.rawPath.startsWith(serverPath) -> p.rawPath
            else -> return null
        }
        return server.origin + path + (p.rawQuery?.let { "?$it" } ?: "") + (p.rawFragment?.let { "#$it" } ?: "")
    }

    /** Whether [target] lies on the server stored as [serverUrl] (see [resolveOnServer]). */
    fun belongsTo(serverUrl: String, target: String, allowDevHttp: Boolean = false): Boolean =
        resolveOnServer(serverUrl, target, allowDevHttp) != null

    /** The URL the app opens: [target] (default: the server itself) with `app=android` added before the `#` route. */
    fun launchUrl(target: String): String {
        val hash = target.indexOf('#')
        val beforeHash = if (hash >= 0) target.substring(0, hash) else target
        val fragment = if (hash >= 0) target.substring(hash) else ""
        val query = beforeHash.substringAfter('?', "")
        if (query.split('&').any { it == APP_PARAM }) return target
        val sep = when {
            !beforeHash.contains('?') -> "?"
            beforeHash.endsWith("?") || beforeHash.endsWith("&") -> ""
            else -> "&"
        }
        return "$beforeHash$sep$APP_PARAM$fragment"
    }
}
