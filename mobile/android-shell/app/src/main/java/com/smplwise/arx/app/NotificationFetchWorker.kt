package com.smplwise.arx.app

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class NotificationFetchWorker(c: Context, p: WorkerParameters) : Worker(c, p) {
    override fun doWork(): Result {
        val runtime = PresenceRuntime.get(applicationContext)
        val s = runtime.servers().firstOrNull { it.id == inputData.getString("server_id") } ?: return Result.success()
        val id = inputData.getString("message_id").orEmpty(); val category = inputData.getString("category").orEmpty()
        if (!PresencePolicy.validId(id)) return Result.failure()
        try {
            val body = runtime.tokenCall(s, "GET", "notifications/app/$id")
            if (!PresencePolicy.fresh(body.optString("at")) || body.optString("message_id") != id || body.optString("category") != category) {
                PushDelivery.cancel(applicationContext, s, id); return Result.success()
            }
            PushDelivery.show(applicationContext, s, id, category, body)
            return Result.success()
        } catch (e: PresenceFailure) {
            if (e.status in setOf(401, 403, 404)) { PushDelivery.cancel(applicationContext, s, id); return Result.success() }
            return if (runAttemptCount < 2 && e.status >= 500) Result.retry() else Result.failure()
        } catch (_: Exception) { return if (runAttemptCount < 2) Result.retry() else Result.failure() }
    }
}
