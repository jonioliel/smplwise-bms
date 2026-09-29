package com.smplwise.arx.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.util.UUID

/** One Arx site: a display name and its normalised address (`https://<host>/<path>/`). No credentials, ever. */
data class Server(val id: String, val name: String, val url: String) {
    val origin: String get() = ServerUrls.originOf(url, BuildConfig.ALLOW_DEV_HTTP) ?: url
}

/**
 * The server list and the app's own settings, in SharedPreferences (a few entries; DataStore would add a dependency for
 * nothing). Only names and addresses are stored. Each site's sign-in lives in the WebView's own storage for that site
 * (cookies and localStorage per origin), exactly as it would in a browser - never in these preferences.
 * (From the Trusted Web Activity branch's ServerStore, plus the app-lock settings.)
 */
class ServerStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun servers(): List<Server> {
        val raw = prefs.getString(KEY_SERVERS, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val ok = ServerUrls.normalize(o.optString("url"), allowDevHttp = BuildConfig.ALLOW_DEV_HTTP) as? ServerUrls.Result.Ok
                    ?: return@mapNotNull null
                Server(o.optString("id").ifEmpty { UUID.randomUUID().toString() }, o.optString("name").ifEmpty { ok.host }, ok.url)
            }
        } catch (e: JSONException) {
            emptyList()
        }
    }

    private fun save(list: List<Server>) {
        val arr = JSONArray()
        list.forEach { arr.put(JSONObject().put("id", it.id).put("name", it.name).put("url", it.url)) }
        prefs.edit().putString(KEY_SERVERS, arr.toString()).apply()
    }

    fun add(name: String, url: String): Server {
        val server = Server(UUID.randomUUID().toString(), name, url)
        save(servers() + server)
        return server
    }

    fun update(server: Server) = save(servers().map { if (it.id == server.id) server else it })

    fun delete(id: String) = save(servers().filterNot { it.id == id })

    fun move(id: String, delta: Int) {
        val list = servers().toMutableList()
        val i = list.indexOfFirst { it.id == id }
        val j = i + delta
        if (i < 0 || j < 0 || j >= list.size) return
        list.add(j, list.removeAt(i))
        save(list)
    }

    fun findByUrl(url: String): Server? = servers().firstOrNull { it.url == url }

    var autoOpen: Boolean
        get() = prefs.getBoolean(KEY_AUTO_OPEN, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_OPEN, value).apply()

    /** "נעילת האפליקציה": ask for the fingerprint / face / screen lock on open and after [lockMinutes] away. */
    var lockEnabled: Boolean
        get() = prefs.getBoolean(KEY_LOCK, false)
        set(value) = prefs.edit().putBoolean(KEY_LOCK, value).apply()

    var lockMinutes: Int
        get() = prefs.getInt(KEY_LOCK_MINUTES, LockPolicy.DEFAULT_MINUTES).takeIf { it in LockPolicy.MINUTES_CHOICES }
            ?: LockPolicy.DEFAULT_MINUTES
        set(value) = prefs.edit().putInt(KEY_LOCK_MINUTES, value).apply()

    /** The server opened last (its URL), marked "שימוש אחרון" in the list. */
    var lastServerUrl: String?
        get() = prefs.getString(KEY_LAST_SERVER, null)
        set(value) = prefs.edit().putString(KEY_LAST_SERVER, value).apply()

    /** Whether the one-time "how to switch servers" hint was shown. */
    var switchHintShown: Boolean
        get() = prefs.getBoolean(KEY_SWITCH_HINT, false)
        set(value) = prefs.edit().putBoolean(KEY_SWITCH_HINT, value).apply()

    /** The build's optional pre-seeded server (gradle.properties arxHost), added once on the first start only. */
    fun seedOnce(defaultUrl: String, defaultName: String) {
        if (prefs.getBoolean(KEY_SEEDED, false)) return
        prefs.edit().putBoolean(KEY_SEEDED, true).apply()
        if (defaultUrl.isEmpty() || servers().isNotEmpty()) return
        val ok = ServerUrls.normalize(defaultUrl) as? ServerUrls.Result.Ok ?: return
        add(defaultName.ifEmpty { ok.host }, ok.url)
    }

    private companion object {
        const val PREFS = "arx_servers"
        const val KEY_SERVERS = "servers"
        const val KEY_AUTO_OPEN = "auto_open"
        const val KEY_SEEDED = "seeded"
        const val KEY_LOCK = "app_lock"
        const val KEY_LOCK_MINUTES = "app_lock_minutes"
        const val KEY_LAST_SERVER = "last_server"
        const val KEY_SWITCH_HINT = "switch_hint_shown"
    }
}
