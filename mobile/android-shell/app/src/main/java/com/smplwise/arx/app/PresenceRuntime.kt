package com.smplwise.arx.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors

/** Serialized per-process fan-out; an opt-out drops queued values before reporting status. */
class PresenceRuntime private constructor(val context: Context) {
    val store = PresenceStore(context)
    val io = Executors.newSingleThreadExecutor()
    private val lastFixAt = mutableMapOf<String, Long>()
    fun servers() = ServerStore(context).servers()
    fun record(server: Server) = store.get(server.id)
    fun config(server: Server) = record(server).optJSONObject("config") ?: JSONObject()
    fun active(server: Server): Set<String> {
        val r = record(server); val c = r.optJSONObject("config") ?: return emptySet()
        if (!r.optBoolean("signed_in") || (!PresencePolicy.fresh(r.optString("config_at")) || Instant.now().epochSecond - runCatching { Instant.parse(r.optString("config_at")).epochSecond }.getOrDefault(0) > 300)) return emptySet()
        return PresencePolicy.active(c.optBoolean("enabled"), r.optInt("ack"), c.optInt("notice_version", 1),
            c.optJSONObject("sensors")?.stringSet("allowed") ?: emptySet(), r.stringSet("selected"), SensorPermissions.permitted(context))
    }
    fun tokenCall(server: Server, method: String, route: String, body: JSONObject? = null): JSONObject {
        val token = record(server).optString("device_token").takeIf { it.isNotEmpty() } ?: throw IllegalStateException("registration_required")
        try { return PresenceApi.call(server, method, route, token = token, body = body) }
        catch (e: PresenceFailure) {
            when (e.code) {
                "device_token_invalid" -> store.invalidate(server.id)
                "presence_disabled" -> store.update(server.id) { it.remove("config"); it.remove("queue") }
                "notice_ack_required", "notice_version_stale" -> store.update(server.id) { it.put("ack", 0); it.remove("queue") }
                "sensor_not_allowed" -> select(server, record(server).stringSet("selected") - e.details.optString("sensor"))
            }
            throw e
        }
    }
    fun refresh(server: Server): JSONObject {
        val c = tokenCall(server, "GET", "presence/config")
        store.update(server.id) { r ->
            r.put("config", c).put("config_at", Instant.now().toString())
            r.put("ack", c.optJSONObject("device")?.optInt("notice_ack_version") ?: 0)
            if (!c.optBoolean("enabled") || r.optInt("ack") < c.optInt("notice_version")) r.remove("queue")
        }
        return c
    }
    fun register(server: Server, cookie: String, user: String, name: String) {
        require(PresencePolicy.nameValid(name))
        val r = store.update(server.id) { if (!it.has("install_id")) it.put("install_id", UUID.randomUUID().toString()) }
        val response = PresenceApi.call(server, "POST", "presence/devices", cookie = cookie,
            body = JSONObject().put("name", name.trim()).put("platform", "android").put("install_id", r.getString("install_id"))
                .put("app_version", BuildConfig.VERSION_NAME).put("os_version", android.os.Build.VERSION.RELEASE).put("model", android.os.Build.MODEL))
        require(PresencePolicy.validId(response.getString("device_id")))
        require(Regex("^arxd_[A-Za-z0-9_-]{43}$").matches(response.getString("device_token")))
        store.update(server.id) { it.put("device_id", response.getString("device_id")).put("device_token", response.getString("device_token"))
            .put("name", response.getString("name")).put("user", user).put("signed_in", true).put("selected", JSONArray()).put("ack", 0).remove("queue") }
        refresh(server)
    }
    fun acknowledge(server: Server) {
        val version = config(server).getInt("notice_version")
        tokenCall(server, "POST", "presence/devices/${record(server).getString("device_id")}/ack", JSONObject().put("notice_version", version))
        store.update(server.id) { it.put("ack", version) }
    }
    fun select(server: Server, keys: Set<String>) = store.update(server.id) { r ->
        if (r.stringSet("selected") != keys) r.put("selection_revision", r.optInt("selection_revision") + 1)
        r.put("selected", JSONArray(keys.filter { it in PresencePolicy.sensors }))
        val queue = r.optJSONArray("queue") ?: JSONArray()
        r.put("queue", JSONArray((0 until queue.length()).mapNotNull { queue.optJSONObject(it) }.filter {
            val key = if (it.optString("type") == "sensor") it.optString("sensor") else "location"; key in keys
        }))
    }
    fun status(server: Server): JSONObject {
        val on = active(server)
        val sensors = JSONObject(); PresencePolicy.sensors.forEach { sensors.put(it, if (it in on) "on" else "off") }
        return JSONObject().put("location_auth", SensorPermissions.locationAuth(context)).put("precise", SensorPermissions.fine(context))
            .put("sharing", "location" in on).put("sensors", sensors)
    }
    fun sendStatus(server: Server) {
        tokenCall(server, "POST", "presence/devices/${record(server).getString("device_id")}/events", JSONObject().put("events", JSONArray()).put("status", status(server)))
    }
    fun emit(sensor: String, value: (Server) -> JSONObject) {
        io.execute {
            servers().forEach { s -> if (sensor in active(s)) {
                val event = JSONObject().put("client_event_id", PresencePolicy.eventId()).put("at", Instant.now().toString())
                    .put("type", "sensor").put("sensor", sensor).put("value", value(s))
                enqueue(s, event); flush(s)
            } }
        }
    }
    fun emitTo(s: Server, sensor: String, value: JSONObject) {
        if (sensor !in active(s)) return
        enqueue(s, JSONObject().put("client_event_id", PresencePolicy.eventId()).put("at", Instant.now().toString()).put("type", "sensor").put("sensor", sensor).put("value", value))
        flush(s)
    }
    fun emitLocationEvent(s: Server, event: JSONObject) {
        if ("location" !in active(s)) return
        enqueue(s, event); flush(s)
    }
    fun location(lat: Double, lon: Double, accuracy: Float) = io.execute {
        servers().forEach { s -> if ("location" in active(s)) {
            val key = "${s.id}:${record(s).optInt("selection_revision")}"; val now = android.os.SystemClock.elapsedRealtime()
            val interval = config(s).optLong("interval_s", 60).coerceAtLeast(15) * 1000
            if (now - (lastFixAt[key] ?: -interval) < interval) return@forEach
            lastFixAt[key] = now
            enqueue(s, JSONObject().put("client_event_id", PresencePolicy.eventId()).put("at", Instant.now().toString())
                .put("type", "fix").put("lat", lat).put("lon", lon).put("accuracy_m", accuracy.toDouble()).put("source", "continuous"))
            flush(s)
        } }
    }
    private fun enqueue(s: Server, e: JSONObject) {
        store.update(s.id) { r ->
        val q = r.optJSONArray("queue") ?: JSONArray()
        val list = (0 until q.length()).mapNotNull { q.optJSONObject(it) }.filter { PresencePolicy.fresh(it.optString("at")) }.toMutableList()
        list.add(e); r.put("queue", JSONArray(list.takeLast(PresencePolicy.MAX_EVENTS)))
        }
    }
    fun flush(s: Server) {
        try {
            val q = record(s).optJSONArray("queue") ?: return
            val on = active(s)
            val list = (0 until q.length()).mapNotNull { q.optJSONObject(it) }.filter { e ->
                PresencePolicy.fresh(e.optString("at")) && (if (e.optString("type") == "sensor") e.optString("sensor") else "location") in on
            }.take(50)
            if (list.isEmpty()) { store.update(s.id) { it.remove("queue") }; return }
            tokenCall(s, "POST", "presence/devices/${record(s).getString("device_id")}/events", JSONObject().put("events", JSONArray(list)).put("status", status(s)))
            val sent = list.map { it.getString("client_event_id") }.toSet()
            store.update(s.id) { r -> r.put("queue", JSONArray((0 until q.length()).mapNotNull { q.optJSONObject(it) }.filter { it.optString("client_event_id") !in sent }))
                r.put("last_event_at", Instant.now().toString()) }
        } catch (_: Exception) { /* bounded queue retried by the next refresh; no sensitive logs */ }
    }
    fun signOut(s: Server) { store.update(s.id) { it.put("signed_in", false).remove("queue") }; io.execute { runCatching { sendStatus(s) } } }
    fun remove(s: Server) {
        val id = record(s).optString("device_id")
        if (id.isNotEmpty()) { tokenCall(s, "DELETE", "notifications/devices/$id"); tokenCall(s, "DELETE", "presence/devices/$id") }
        store.forget(s.id)
    }
    companion object {
        @Volatile private var instance: PresenceRuntime? = null
        fun get(c: Context): PresenceRuntime = instance ?: synchronized(this) { instance ?: PresenceRuntime(c.applicationContext).also { instance = it } }
    }
}
