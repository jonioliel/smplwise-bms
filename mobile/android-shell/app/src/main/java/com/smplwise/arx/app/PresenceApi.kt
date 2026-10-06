package com.smplwise.arx.app

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class PresenceFailure(val status: Int, val code: String, val details: JSONObject, val userMessage: String) : Exception(code)

/** One credential per request, bounded JSON, no redirects, no credential or value logging. */
object PresenceApi {
    fun call(server: Server, method: String, route: String, token: String? = null, cookie: String? = null, body: JSONObject? = null): JSONObject {
        require(token == null || cookie == null)
        require(route.split('/').none { it == ".." || it == "." } && !route.contains('?'))
        return request(server.url + "api/v1/" + route, method, token, cookie, body, 65536)
    }
    fun relay(method: String, body: JSONObject): JSONObject {
        val base = BuildConfig.PUSH_RELAY_URL.trimEnd('/')
        require(base.isNotEmpty()) { "relay_unconfigured" }
        require(base.startsWith("https://") || (BuildConfig.ALLOW_DEV_HTTP && base.startsWith("http://127.0.0.1:")))
        return request("$base/v1/register", method, null, null, body, 2048)
    }
    private fun request(url: String, method: String, token: String?, cookie: String?, body: JSONObject?, limit: Int): JSONObject {
        val bytes = body?.toString()?.toByteArray(Charsets.UTF_8)
        require(bytes == null || bytes.size <= limit)
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method; c.instanceFollowRedirects = false; c.connectTimeout = 6000; c.readTimeout = 6000
            c.setRequestProperty("Accept", "application/json")
            c.setRequestProperty("User-Agent", "SmplWiseArx/${BuildConfig.VERSION_NAME} (Android app)")
            if (token != null) c.setRequestProperty("Authorization", "Bearer $token")
            if (cookie != null) c.setRequestProperty("Cookie", cookie)
            if (bytes != null) {
                c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.setFixedLengthStreamingMode(bytes.size)
                c.outputStream.use { it.write(bytes) }
            }
            val status = c.responseCode
            if (status == 204) return JSONObject()
            val stream = if (status in 200..299) c.inputStream else c.errorStream
            val response = stream?.use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) { val count = input.read(buffer); if (count < 0) break; require(out.size() + count <= 131072); out.write(buffer, 0, count) }
                out.toByteArray()
            } ?: ByteArray(0)
            require(response.size <= 131072)
            val obj = try { JSONObject(String(response, Charsets.UTF_8)) } catch (_: Exception) { JSONObject() }
            if (status !in 200..299) throw PresenceFailure(status, obj.optString("code", "http_error"), obj.optJSONObject("details") ?: JSONObject(), obj.optString("user_message"))
            return obj
        } finally { c.disconnect() }
    }
}
