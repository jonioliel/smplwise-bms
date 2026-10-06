package com.smplwise.arx.app

import android.Manifest
import android.os.Build
import android.widget.LinearLayout
import org.json.JSONArray
import org.json.JSONObject
import com.google.android.material.switchmaterial.SwitchMaterial

object PushSettings {
    fun show(ui: PresenceUi, ignored: LinearLayout, s: Server, runtime: PresenceRuntime) {
        val host = ui.hostActivity()
        val b = ui.page("התראות", "התראות מהשרת מגיעות דרך ממסר SmplWise. הטקסט המלא נשלף מהשרת שלכם.")
        val r = runtime.record(s)
        if (!PushCoordinator.get(host).available()) ui.label(b, "התראות FCM לא זמינות בבנייה זו. חסרות הגדרות Firebase.")
        if (BuildConfig.PUSH_RELAY_URL.isEmpty()) ui.label(b, "כתובת ממסר ההתראות עדיין לא הוגדרה.")
        if (r.optString("relay_server_id").isEmpty()) ui.label(b, "שיוך השרת לממסר עדיין לא זמין.")
        if (Build.VERSION.SDK_INT >= 33 && !SensorPermissions.granted(host, Manifest.permission.POST_NOTIFICATIONS)) {
            ui.button(b, "אישור התראות בטלפון") { ui.requestNotifications { show(ui, b, s, runtime) } }
            ui.button(b, "פתח הגדרות") { ui.appSettings() }
        }
        val master = SwitchMaterial(host).apply { text = "התראות משרת זה"; isChecked = r.optBoolean("push_enabled"); filterTouchesWhenObscured = true }
        master.setOnCheckedChangeListener { _, on ->
            ui.job({ if (on) PushCoordinator.get(host).enable(s) else PushCoordinator.get(host).disable(s); JSONObject() }) { show(ui, b, s, runtime) }
        }
        b.addView(master)
        val cats = r.optJSONArray("categories") ?: JSONArray()
        for (i in 0 until cats.length()) {
            val cat = cats.getJSONObject(i); val key = cat.getString("id")
            val toggle = SwitchMaterial(host).apply { text = cat.getString("name"); isChecked = key !in r.stringSet("muted"); filterTouchesWhenObscured = true }
            toggle.setOnCheckedChangeListener { _, on ->
                val muted = runtime.record(s).stringSet("muted").let { if (on) it - key else it + key }
                runtime.store.update(s.id) { it.put("muted", JSONArray(muted.toList())) }
                ui.job({ runtime.tokenCall(s, "PATCH", "notifications/devices/${r.getString("device_id")}", JSONObject().put("muted", JSONArray(muted.toList()))); JSONObject() }) { show(ui, b, s, runtime) }
            }
            b.addView(toggle)
        }
        ui.button(b, "רענון") { ui.job({ PushCoordinator.get(host).sync(s); JSONObject() }) { show(ui, b, s, runtime) } }
        ui.button(b, "שלח התראת בדיקה") {
            ui.job({ runtime.tokenCall(s, "POST", "notifications/app/test", JSONObject()) }) { reply ->
                if (BuildConfig.DEBUG && s.url.startsWith("http://127.0.0.1:")) {
                    PushDelivery.receive(host, mapOf("notification_id" to reply.optString("message_id"), "server" to runtime.record(s).optString("relay_server_id"), "category" to "system"))
                    ui.label(b, "בדיקת mock מקומית — אינה בודקת מסירת FCM.")
                } else ui.label(b, if (reply.optBoolean("sent")) "בקשת הבדיקה נשלחה." else "השרת לא שלח את ההתראה.")
            }
        }
        ui.button(b, "חזרה") { ui.openSettings() }
    }
}
