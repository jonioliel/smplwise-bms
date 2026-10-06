package com.smplwise.arx.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import org.json.JSONObject

class ActivityTransitionReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return
        val result = ActivityTransitionResult.extractResult(intent) ?: return
        val pending = goAsync()
        val runtime = PresenceRuntime.get(c)
        runtime.io.execute {
            try {
                result.transitionEvents.forEach { e ->
                    val state = if (e.transitionType == ActivityTransition.ACTIVITY_TRANSITION_EXIT) "unknown" else when (e.activityType) {
                        DetectedActivity.STILL -> "stationary"; DetectedActivity.WALKING -> "walking"; DetectedActivity.RUNNING -> "running"
                        DetectedActivity.ON_BICYCLE -> "cycling"; DetectedActivity.IN_VEHICLE -> "automotive"; else -> "unknown"
                    }
                    runtime.servers().forEach { s -> runtime.emitTo(s, "activity", JSONObject().put("state", state).put("confidence", "unknown")) }
                }
            } finally { pending.finish() }
        }
    }
}
