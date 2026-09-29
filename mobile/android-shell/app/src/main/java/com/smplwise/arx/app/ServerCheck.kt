package com.smplwise.arx.app

import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.HttpsURLConnection

/**
 * Is there an Arx site at this address? `GET <url>api/v1/auth/remote-config` (public on the remote channel, no identity,
 * CR-008). Advisory only: adding a server is never blocked by the answer (the phone may be offline right now), the
 * screen just warns. (From the Trusted Web Activity branch, with its review's L1 applied: the connect and read timeouts
 * do not cover DNS and apply per address, so the whole call runs under one overall deadline and is abandoned after it.)
 */
object ServerCheck {
    sealed interface Outcome {
        /** Arx answered; [path] is its remote_path (`/arx/`) when it said so. */
        data class Arx(val path: String?) : Outcome
        /** Something answered, but not Arx's remote channel (HTTP status, 0 = not JSON). */
        data class NotArx(val status: Int) : Outcome
        /** No answer: offline, DNS, TLS, timeout. */
        data class Unreachable(val reason: String) : Outcome
    }

    private const val TIMEOUT_MS = 5_000
    private const val OVERALL_MS = 6_000L

    private val pool = Executors.newCachedThreadPool { r -> Thread(r, "arx-server-check").apply { isDaemon = true } }

    /** Blocking, at most ~6 s; call off the main thread. */
    fun check(serverUrl: String): Outcome {
        val conn = AtomicReference<HttpURLConnection?>(null)
        val future = pool.submit<Outcome> {
            val c = try {
                URL(serverUrl + "api/v1/auth/remote-config").openConnection() as? HttpURLConnection
                    ?: return@submit Outcome.Unreachable("not http")
            } catch (e: IOException) {
                return@submit Outcome.Unreachable(e.javaClass.simpleName)
            }
            if (c !is HttpsURLConnection && !BuildConfig.ALLOW_DEV_HTTP) return@submit Outcome.Unreachable("not https")
            conn.set(c)
            request(c)
        }
        return try {
            future.get(OVERALL_MS, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            future.cancel(true)
            conn.get()?.disconnect()
            Outcome.Unreachable("timeout")
        } catch (e: ExecutionException) {
            Outcome.Unreachable(e.cause?.javaClass?.simpleName ?: "error")
        } catch (e: InterruptedException) {
            future.cancel(true)
            Thread.currentThread().interrupt()
            Outcome.Unreachable("interrupted")
        }
    }

    private fun request(conn: HttpURLConnection): Outcome = try {
        conn.connectTimeout = TIMEOUT_MS
        conn.readTimeout = TIMEOUT_MS
        conn.instanceFollowRedirects = false
        conn.useCaches = false
        conn.setRequestProperty("Accept", "application/json")
        val status = conn.responseCode
        if (status != HttpURLConnection.HTTP_OK) {
            Outcome.NotArx(status)
        } else {
            val buf = ByteArray(8192) // remote-config is tiny; never read more than this from an unknown server
            var n = 0
            conn.inputStream.use { s ->
                while (n < buf.size) {
                    val r = s.read(buf, n, buf.size - n)
                    if (r < 0) break
                    n += r
                }
            }
            val json = try {
                JSONObject(String(buf, 0, n, Charsets.UTF_8))
            } catch (e: JSONException) {
                null
            }
            when {
                json == null || !json.has("session") -> Outcome.NotArx(0)
                else -> Outcome.Arx(json.optString("path").takeIf { it.startsWith("/") && it.endsWith("/") })
            }
        }
    } catch (e: IOException) {
        Outcome.Unreachable(e.javaClass.simpleName)
    } finally {
        conn.disconnect()
    }
}
