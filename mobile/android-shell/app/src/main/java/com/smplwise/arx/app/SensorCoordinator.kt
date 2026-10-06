package com.smplwise.arx.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Acquire each source once. Per-server gates and intervals are applied before reporting. */
class SensorCoordinator private constructor(private val c: Context) : DefaultLifecycleObserver {
    private val runtime = PresenceRuntime.get(c)
    private val locationIntent = Intent(c, PresenceLocationService::class.java)
    private val main = Handler(Looper.getMainLooper())
    var foreground = false; private set
    private var activityRegistered = false
    private var activityPending = false
    private var batteryReceiver: android.content.BroadcastReceiver? = null
    private val lastSent = mutableMapOf<String, Long>()
    private val lastValue = mutableMapOf<String, String>()
    private val transitionIntent by lazy { PendingIntent.getBroadcast(c, 310, Intent(c, ActivityTransitionReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE) }
    private val geofences by lazy { PresenceGeofences(c) }
    private val extras by lazy { ExtraSensors(c, runtime, this) }
    private val heartbeat = object : Runnable {
        override fun run() {
            if (foreground) {
                runtime.io.execute { refreshConfigs() }
                refresh(); sampleBattery(); emitState()
                main.postDelayed(this, 60000)
            }
        }
    }
    fun start() {
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("presence-maintenance", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<PresenceMaintenanceWorker>(15, TimeUnit.MINUTES).build())
    }
    override fun onStart(owner: LifecycleOwner) { foreground = true; main.removeCallbacks(heartbeat); main.post(heartbeat); refresh() }
    override fun onStop(owner: LifecycleOwner) { foreground = false; emitState(); main.removeCallbacks(heartbeat); extras.stop(); refresh() }
    fun refreshConfigs() {
        runtime.servers().forEach { s ->
            if (runtime.record(s).optBoolean("signed_in") && runtime.record(s).optString("device_token").isNotEmpty()) {
                runCatching { runtime.refresh(s); runtime.sendStatus(s); runtime.flush(s); PushCoordinator.get(c).sync(s) }
            }
        }
        main.post { refresh() }
    }
    fun activeUnion() = runtime.servers().flatMap { runtime.active(it) }.toSet()
    fun refresh() {
        if (Looper.myLooper() != Looper.getMainLooper()) { main.post { refresh() }; return }
        val on = activeUnion()
        geofences.refresh()
        if ("location" in on && foreground) {
            runCatching { ContextCompat.startForegroundService(c, locationIntent) }
        } else if ("location" !in on) c.stopService(locationIntent)
        if ("activity" in on && !activityRegistered && !activityPending) {
            activityPending = true
            val list = listOf(DetectedActivity.STILL, DetectedActivity.WALKING, DetectedActivity.RUNNING, DetectedActivity.ON_BICYCLE, DetectedActivity.IN_VEHICLE)
                .flatMap { a -> listOf(ActivityTransition.ACTIVITY_TRANSITION_ENTER, ActivityTransition.ACTIVITY_TRANSITION_EXIT).map { t -> ActivityTransition.Builder().setActivityType(a).setActivityTransition(t).build() } }
            try {
                ActivityRecognition.getClient(c).requestActivityTransitionUpdates(ActivityTransitionRequest(list), transitionIntent)
                    .addOnSuccessListener { activityPending = false; activityRegistered = true; if ("activity" !in activeUnion()) refresh() }
                    .addOnFailureListener { activityPending = false }
            } catch (_: SecurityException) { activityPending = false }
        } else if ("activity" !in on && activityRegistered) {
            try { ActivityRecognition.getClient(c).removeActivityTransitionUpdates(transitionIntent) } catch (_: SecurityException) {}; activityRegistered = false
        }
        if ("battery" in on && batteryReceiver == null) {
            batteryReceiver = object : android.content.BroadcastReceiver() { override fun onReceive(context: Context, intent: Intent) { sampleBattery() } }
            c.registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        } else if ("battery" !in on && batteryReceiver != null) { c.unregisterReceiver(batteryReceiver); batteryReceiver = null }
        if (foreground) extras.refresh(on) else extras.stop()
    }
    fun emitThrottled(key: String, value: (Server) -> JSONObject, minSeconds: Long, changeOnly: Boolean = false) {
        runtime.io.execute {
            runtime.servers().forEach { s ->
                if (key !in runtime.active(s)) return@forEach
                val v = value(s); val id = "${s.id}:$key"
                val interval = (runtime.config(s).optJSONObject("sensors")?.optJSONObject("intervals_s")?.optLong(key) ?: 0).coerceAtLeast(minSeconds)
                val now = android.os.SystemClock.elapsedRealtime()
                if ((lastSent[id] ?: -interval * 1000) + interval * 1000 > now || (changeOnly && lastValue[id] == v.toString())) return@forEach
                lastSent[id] = now; lastValue[id] = v.toString()
                runtime.emitTo(s, key, v)
            }
        }
    }
    fun sampleBattery() {
        if ("battery" !in activeUnion()) return
        val i = c.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return
        val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100).coerceAtLeast(1)
        val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1); if (level < 0) return
        val charging = when (i.getIntExtra(BatteryManager.EXTRA_STATUS, -1)) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "charging"; BatteryManager.BATTERY_STATUS_FULL -> "full"
            BatteryManager.BATTERY_STATUS_DISCHARGING, BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "unplugged"; else -> "unknown"
        }
        val low = (c.getSystemService(Context.POWER_SERVICE) as PowerManager).isPowerSaveMode
        emitThrottled("battery", { JSONObject().put("level_percent", 100 * level / scale).put("charging_state", charging).put("low_power_mode", low) }, 900, true)
    }
    private fun emitState() { emitThrottled("app_state", { JSONObject().put("state", if (foreground) "foreground" else "background").put("last_seen", java.time.Instant.now().toString()) }, 300) }
    companion object {
        @Volatile private var instance: SensorCoordinator? = null
        fun get(c: Context): SensorCoordinator = instance ?: synchronized(this) { instance ?: SensorCoordinator(c.applicationContext).also { instance = it } }
    }
}
