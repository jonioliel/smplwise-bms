package com.smplwise.arx.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import org.json.JSONObject
import java.time.Instant

class GeofenceReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError() || event.geofenceTransition !in setOf(Geofence.GEOFENCE_TRANSITION_ENTER, Geofence.GEOFENCE_TRANSITION_EXIT)) return
        val pending = goAsync(); val runtime = PresenceRuntime.get(c)
        runtime.io.execute {
            try {
                event.triggeringGeofences?.forEach { fence ->
                    val parts = fence.requestId.split(':', limit = 2); if (parts.size != 2) return@forEach
                    val server = runtime.servers().firstOrNull { it.id == parts[0] } ?: return@forEach
                    if (SensorPermissions.locationAuth(c) != "always" || "location" !in runtime.active(server)) return@forEach
                    runtime.emitLocationEvent(server, JSONObject().put("client_event_id", PresencePolicy.eventId()).put("at", Instant.now().toString())
                        .put("type", if (event.geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) "enter" else "exit").put("site_id", parts[1]).put("source", "region"))
                }
            } finally { pending.finish() }
        }
    }
}
