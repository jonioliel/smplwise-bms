package com.smplwise.arx.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import org.json.JSONObject

object PushDelivery {
    val categories = setOf("safety", "alerts", "doors", "device_faults", "automations", "system", "security")
    fun receive(c: Context, payload: Map<String, String>) {
        val s = PushCoordinator.get(c).serverFor(payload["server"].orEmpty()) ?: return
        val message = payload["notification_id"].orEmpty(); val category = payload["category"].orEmpty()
        if (!PresencePolicy.validId(message) || category !in categories || category in PresenceRuntime.get(c).record(s).stringSet("muted")) return
        show(c, s, message, category, null)
        val builder = OneTimeWorkRequestBuilder<NotificationFetchWorker>().setInputData(Data.Builder().putString("server_id", s.id).putString("message_id", message).putString("category", category).build())
        if (android.os.Build.VERSION.SDK_INT >= 31) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
        val req = builder.build()
        WorkManager.getInstance(c).enqueueUniqueWork("push:${s.id}:$message", ExistingWorkPolicy.KEEP, req)
    }
    fun show(c: Context, s: Server, message: String, category: String, content: JSONObject?) {
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return
        val runtime = PresenceRuntime.get(c); val r = runtime.record(s)
        if (!r.optBoolean("signed_in") || !r.optBoolean("push_enabled") || category in r.stringSet("muted")) return
        val channel = "arx:${s.id}:$category"
        val cats = r.optJSONArray("categories")
        val name = cats?.let { arr -> (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }.firstOrNull { it.optString("id") == category }?.optString("name") } ?: category
        c.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(channel, "${s.name} · $name", if (category in setOf("safety", "alerts")) NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT))
        val link = content?.optString("deep_link").orEmpty()
        val candidate = ServerUrls.resolveOnServer(s.url, link, BuildConfig.ALLOW_DEV_HTTP)
        val safe = candidate?.takeIf { DeepLinks.route(it, listOf(s.url), BuildConfig.ALLOW_DEV_HTTP) is DeepLinks.Route.Open } ?: s.url
        val intent = Intent(c, ServersActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse("arx://open?url=" + Uri.encode(safe)))
        val pending = PendingIntent.getActivity(c, (s.id + message).hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val public = NotificationCompat.Builder(c, channel).setSmallIcon(R.drawable.ic_notification).setContentTitle("SmplWise Arx").setContentText(name).build()
        val n = NotificationCompat.Builder(c, channel).setSmallIcon(R.drawable.ic_notification).setContentTitle(content?.optString("title") ?: "SmplWise Arx")
            .setContentText(content?.optString("body") ?: "התראה חדשה")
            .setStyle(NotificationCompat.BigTextStyle().bigText(content?.optString("body") ?: "התראה חדשה"))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPublicVersion(public).setGroup("arx:${s.id}")
            .setContentIntent(pending).setAutoCancel(true).setOnlyAlertOnce(true).setTimeoutAfter(86400000).build()
        try { NotificationManagerCompat.from(c).notify("${s.id}:$message", 1, n) } catch (_: SecurityException) {}
    }
    fun cancel(c: Context, s: Server, message: String) { NotificationManagerCompat.from(c).cancel("${s.id}:$message", 1) }
}
