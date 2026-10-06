package com.smplwise.arx.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest

class PresenceGeofences(private val c: Context) {
    private val runtime = PresenceRuntime.get(c)
    private val client = com.google.android.gms.location.LocationServices.getGeofencingClient(c)
    private val pending by lazy { PendingIntent.getBroadcast(c, 312, Intent(c, GeofenceReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE) }
    private var fingerprint = ""
    private var changing = false
    fun refresh() {
        if (changing) return
        val list = if (SensorPermissions.fine(c) && SensorPermissions.locationAuth(c) == "always") runtime.servers().filter { "location" in runtime.active(it) }.flatMap { s ->
            val sites = runtime.config(s).optJSONArray("sites")
            (0 until (sites?.length() ?: 0)).mapNotNull { i ->
                val site = sites?.optJSONObject(i) ?: return@mapNotNull null
                val id = site.optString("id"); val lat = site.optDouble("lat"); val lon = site.optDouble("lon"); val radius = site.optDouble("radius_m")
                if (!PresencePolicy.validId(id) || !lat.isFinite() || lat !in -90.0..90.0 || !lon.isFinite() || lon !in -180.0..180.0 || radius <= 0 || !radius.isFinite()) return@mapNotNull null
                Geofence.Builder().setRequestId("${s.id}:$id").setCircularRegion(lat, lon, radius.toFloat())
                    .setExpirationDuration(Geofence.NEVER_EXPIRE).setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT).build()
            }
        }.take(100) else emptyList()
        val next = list.toString()
        if (next == fingerprint) return
        changing = true
        client.removeGeofences(pending).addOnCompleteListener {
            if (list.isEmpty()) { fingerprint = next; changing = false }
            else try {
                client.addGeofences(GeofencingRequest.Builder().addGeofences(list).setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER).build(), pending)
                    .addOnSuccessListener { fingerprint = next; changing = false }
                    .addOnFailureListener { changing = false }
            } catch (_: SecurityException) { changing = false }
        }
    }
}
