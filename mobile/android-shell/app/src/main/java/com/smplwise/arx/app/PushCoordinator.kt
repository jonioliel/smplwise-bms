package com.smplwise.arx.app

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONArray
import org.json.JSONObject

class PushCoordinator private constructor(private val c: Context) {
    private val runtime = PresenceRuntime.get(c)
    fun initialize() { /* FCM remains dormant until the user enables notifications. */ }
    fun available(): Boolean = runCatching { FirebaseApp.initializeApp(c) != null || FirebaseApp.getApps(c).isNotEmpty() }.getOrDefault(false)
    fun enable(s: Server) {
        runtime.store.update(s.id) { it.put("push_enabled", true) }
        if (!available()) {
            if (BuildConfig.DEBUG && s.url.startsWith("http://127.0.0.1:") && BuildConfig.PUSH_RELAY_URL.startsWith("http://127.0.0.1:"))
                updatedToken("fixture-fcm-" + java.util.UUID.randomUUID().toString())
            return
        }
        FirebaseMessaging.getInstance().isAutoInitEnabled = true
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> updatedToken(token) }
    }
    fun updatedToken(token: String) {
        runtime.io.execute {
            val old = runtime.store.get("push-global").optString("push_token")
            runtime.store.update("push-global") { it.put("push_token", token); if (old != token) it.remove("relay_token") }
            runtime.servers().forEach { runCatching { sync(it) } }
        }
    }
    fun sync(s: Server) {
        val r = runtime.record(s)
        if (!r.optBoolean("push_enabled") || r.optString("device_token").isEmpty() || !r.optBoolean("signed_in")) return
        val g = runtime.store.get("push-global")
        val pushToken = g.optString("push_token"); if (pushToken.isEmpty() || BuildConfig.PUSH_RELAY_URL.isEmpty()) return
        val relay = g.optString("relay_token").ifEmpty {
            val response = PresenceApi.relay("POST", JSONObject().put("platform", "android").put("push_token", pushToken)
                .put("app_version", BuildConfig.VERSION_NAME).put("bundle_id", BuildConfig.APPLICATION_ID))
            response.getString("relay_token").also { token -> runtime.store.update("push-global") { it.put("relay_token", token) } }
        }
        if (r.optString("relay_registered") != relay) {
            runtime.tokenCall(s, "POST", "notifications/devices", JSONObject().put("platform", "android").put("relay_token", relay).put("app_version", BuildConfig.VERSION_NAME))
            runtime.store.update(s.id) { it.put("relay_registered", relay) }
        }
        runtime.tokenCall(s, "PATCH", "notifications/devices/${r.getString("device_id")}", JSONObject().put("muted", JSONArray(r.stringSet("muted").toList())))
        val categories = runtime.tokenCall(s, "GET", "notifications/categories").getJSONArray("categories")
        runtime.store.update(s.id) { it.put("categories", categories) }
        // v1 contract lacks the binding from opaque relay server ID to a registered origin.
        // Only fixtures expose server_id; production pushes remain unroutable until a published contract supplies it.
        val id = if (BuildConfig.DEBUG && s.url.startsWith("http://127.0.0.1:")) runtime.config(s).optString("server_id") else ""
        if (id.isNotEmpty()) runtime.store.update(s.id) { it.put("relay_server_id", id) }
    }
    fun disable(s: Server) {
        runtime.store.update(s.id) { it.put("push_enabled", false).remove("relay_registered") }
        val id = runtime.record(s).optString("device_id")
        if (id.isNotEmpty()) runtime.tokenCall(s, "DELETE", "notifications/devices/$id")
        if (runtime.servers().none { runtime.record(it).optBoolean("push_enabled") }) {
            val relay = runtime.store.get("push-global").optString("relay_token")
            if (relay.isNotEmpty()) PresenceApi.relay("DELETE", JSONObject().put("relay_token", relay))
            runtime.store.forget("push-global")
            if (available()) { FirebaseMessaging.getInstance().isAutoInitEnabled = false; FirebaseMessaging.getInstance().deleteToken() }
        }
    }
    fun serverFor(id: String): Server? {
        if (id.isEmpty()) return null
        val matches = runtime.servers().filter { val r = runtime.record(it); r.optString("relay_server_id") == id && r.optBoolean("push_enabled") && r.optBoolean("signed_in") && r.optString("device_token").isNotEmpty() }
        return matches.singleOrNull() // Never guess, fetch across origins, or resolve a URL from the push payload.
    }
    companion object {
        @Volatile private var instance: PushCoordinator? = null
        fun get(c: Context): PushCoordinator = instance ?: synchronized(this) { instance ?: PushCoordinator(c.applicationContext).also { instance = it } }
    }
}
