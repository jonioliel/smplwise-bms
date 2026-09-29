package com.smplwise.arx.app

import java.net.URI
import java.net.URISyntaxException

/**
 * The app's own links (pure, unit-tested):
 * - `arx://servers` - the server list ("החלף שרת" inside the site, the icon's long-press shortcut);
 * - `arx://open?url=https://<server>/arx/#/...` - open a link, but only on a server that is already in the list. A link
 *   to any other site is never opened by itself: the list offers to add that server and shows the full address.
 *
 * Plain https links (for example in a messaging app) open in the browser: the app declares no verified https links,
 * because the servers are known only at run time.
 */
object DeepLinks {
    sealed interface Link {
        data object Servers : Link
        data class Open(val target: String) : Link
        data object Unknown : Link
    }

    sealed interface Route {
        /** Open [url] (rebuilt from its parts) on [serverUrl]. */
        data class Open(val serverUrl: String, val url: String) : Route
        /** Not on any stored server: offer to add [serverUrl], showing the [fullUrl] of the link. */
        data class Offer(val serverUrl: String, val fullUrl: String) : Route
        data object Invalid : Route
    }

    fun parse(link: String): Link {
        val uri = try {
            URI(link.trim())
        } catch (e: URISyntaxException) {
            return Link.Unknown
        }
        if (!"arx".equals(uri.scheme, ignoreCase = true)) return Link.Unknown
        return when (uri.host?.lowercase()) {
            "servers" -> Link.Servers
            "open" -> {
                var target = queryParam(uri.rawQuery, "url") ?: return Link.Unknown
                // `arx://open?url=https://h/arx/#/live` written without encoding: the `#/live` became the arx link's own
                // fragment. Give it back to the target (only when the target has none).
                if (uri.rawFragment != null && !target.contains('#')) target += "#" + uri.rawFragment
                Link.Open(target)
            }
            else -> Link.Unknown
        }
    }

    /** Where an `arx://open` target goes, given the stored servers' URLs (in list order). */
    fun route(target: String, serverUrls: List<String>, allowDevHttp: Boolean = false): Route {
        // a link handed over by another app must be an absolute https address (plain http only to a debug build's host)
        val scheme = ServerUrls.parse(target)?.origin?.substringBefore("://") ?: return Route.Invalid
        if (scheme != "https" && !allowDevHttp) return Route.Invalid
        for (server in serverUrls) {
            val url = ServerUrls.resolveOnServer(server, target, allowDevHttp)
            if (url != null) return Route.Open(server, url)
        }
        val ok = ServerUrls.normalize(target, allowDevHttp = allowDevHttp) as? ServerUrls.Result.Ok ?: return Route.Invalid
        // the full address as it will be shown: rebuilt from its parts when it parses, otherwise the server address
        val parsed = ServerUrls.parse(target)
        val full = if (parsed != null && parsed.origin == ok.origin) {
            parsed.origin + parsed.rawPath + (parsed.rawQuery?.let { "?$it" } ?: "") + (parsed.rawFragment?.let { "#$it" } ?: "")
        } else {
            ok.url
        }
        return Route.Offer(ok.url, full)
    }

    /** The first value of [name] in a raw query, percent-decoded (`+` is kept: it is legal in a URL). */
    internal fun queryParam(rawQuery: String?, name: String): String? {
        if (rawQuery.isNullOrEmpty()) return null
        for (pair in rawQuery.split('&')) {
            val eq = pair.indexOf('=')
            val key = if (eq < 0) pair else pair.substring(0, eq)
            if (key != name) continue
            val value = if (eq < 0) "" else pair.substring(eq + 1)
            return ServerUrls.decodeSegment(value)
        }
        return null
    }
}
