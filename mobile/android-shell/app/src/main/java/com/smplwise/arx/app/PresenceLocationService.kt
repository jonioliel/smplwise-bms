package com.smplwise.arx.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/** Started only from a visible app after opt-in. No boot receiver, exact alarms or battery exemptions. */
class PresenceLocationService : Service() {
    private val main = Handler(Looper.getMainLooper())
    private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }
    private var running = false
    private var requestSpec = ""
    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val l = result.lastLocation ?: return
            if (SensorCoordinator.get(this@PresenceLocationService).foreground || SensorPermissions.locationAuth(this@PresenceLocationService) == "always")
                PresenceRuntime.get(this@PresenceLocationService).location(l.latitude, l.longitude, l.accuracy)
        }
    }
    private val check = object : Runnable {
        override fun run() {
            val r = PresenceRuntime.get(this@PresenceLocationService)
            r.io.execute { SensorCoordinator.get(this@PresenceLocationService).refreshConfigs() }
            if ("location" !in SensorCoordinator.get(this@PresenceLocationService).activeUnion() ||
                (!SensorCoordinator.get(this@PresenceLocationService).foreground && SensorPermissions.locationAuth(this@PresenceLocationService) != "always")) { stopSelf(); return }
            configure()
            main.postDelayed(this, 60000)
        }
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("presence", "שיתוף מיקום", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 301, Intent(this, ServersActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(this, "presence").setSmallIcon(R.drawable.ic_notification).setContentTitle("SmplWise Arx")
            .setContentText("שיתוף מיקום פעיל. ניתן לכבות במסך נתונים שהמכשיר משתף.").setOngoing(true).setContentIntent(open).build()
        startForeground(301, n)
        configure()
        return START_NOT_STICKY
    }
    private fun configure() {
        val runtime = PresenceRuntime.get(this)
        val servers = runtime.servers().filter { "location" in runtime.active(it) }
        if (servers.isEmpty()) { stopSelf(); return }
        val interval = servers.minOf { runtime.config(it).optLong("interval_s", 60).coerceAtLeast(15) }
        val distance = servers.minOf { runtime.config(it).optDouble("distance_filter_m", 50.0).coerceAtLeast(0.0) }.toFloat()
        val next = "$interval:$distance"
        if (running && next == requestSpec) return
        if (running) fused.removeLocationUpdates(callback)
        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, interval * 1000).setMinUpdateDistanceMeters(distance).build()
        try {
            fused.requestLocationUpdates(request, callback, Looper.getMainLooper()).addOnFailureListener { running = false; stopSelf() }
            requestSpec = next
            if (!running) { running = true; main.post(check) }
        } catch (_: SecurityException) { stopSelf() }
    }
    override fun onDestroy() { fused.removeLocationUpdates(callback); main.removeCallbacksAndMessages(null); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
}
