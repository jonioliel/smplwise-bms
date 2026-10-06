package com.smplwise.arx.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import org.json.JSONArray
import org.json.JSONObject

/** Native full-window cover. The WebView is invisible and disabled during checks, notice and the server gate. */
class PresenceUi(private val host: LockedActivity, private val root: FrameLayout, private val server: Server,
                 private val site: View?, private val signedOut: () -> Unit, private val reload: () -> Unit,
                 private val settingsOnly: Boolean = false, private val blockingChanged: (Boolean) -> Unit = {}) {
    private val runtime = PresenceRuntime.get(host)
    private val main = Handler(Looper.getMainLooper())
    private var cover: ScrollView? = null
    private val originalLightStatus = androidx.core.view.WindowCompat.getInsetsController(host.window, host.window.decorView).isAppearanceLightStatusBars
    val blocksSite: Boolean get() = cover != null
    private var busy = false
    private var alive = true
    private var user = ""
    private var settings = settingsOnly
    private var gate = JSONObject()
    private var reloadNeeded = false
    private var permissionDone: (() -> Unit)? = null
    private val permissions = host.registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        permissionDone?.invoke(); permissionDone = null
    }
    private val poll = object : Runnable {
        override fun run() { if (alive && user.isNotEmpty() && !host.locked) check(); main.postDelayed(this, 60000) }
    }
    init {
        host.onBackPressedDispatcher.addCallback(host) {
            if (cover == null) { isEnabled = false; host.onBackPressedDispatcher.onBackPressed(); isEnabled = true }
            else if (settings && !gate.optBoolean("blocked")) { settings = false; check() }
            else host.moveTaskToBack(true)
        }
        main.postDelayed(poll, 60000)
    }
    fun resume() {
        if (!alive) return
        val r = runtime.record(server)
        user = r.optString("user").takeIf { r.optBoolean("signed_in") }.orEmpty()
        if (user.isNotEmpty()) check() else if (settingsOnly) showNeedsSignIn()
    }
    fun signedIn() {
        // The page's user_id is not authoritative. Verify the signed-in session against /me.
        if (busy || host.locked) return
        showLoading()
        val cookie = CookieManager.getInstance().getCookie(server.url)
        job({
            val me = PresenceApi.call(server, "GET", "me", cookie = cookie)
            user = me.optString("user_id").ifEmpty { me.optJSONObject("user")?.optString("id").orEmpty() }.ifEmpty { me.optString("id") }
            require(user.isNotEmpty()) { "session_identity_missing" }
            val old = runtime.record(server)
            if (old.optString("user").isNotEmpty() && old.optString("user") != user) {
                runtime.signOut(server)
                // Explicit confirmation is shown before replacement; no silent ownership transfer.
                return@job JSONObject().put("different_user", true)
            }
            runtime.store.update(server.id) { it.put("user", user).put("signed_in", true) }
            JSONObject()
        }) { result ->
            if (result.optBoolean("different_user")) {
                val box = page("רישום למשתמש אחר", "המכשיר רשום למשתמש אחר. לרשום אותו מחדש למשתמש הנוכחי?")
                button(box, "רישום מחדש") { runtime.store.invalidate(server.id); runtime.store.update(server.id) { it.put("user", user).put("signed_in", true) }; registerScreen() }
                button(box, "התנתקות") { signOut() }
            } else check()
        }
    }
    fun pageSignedOut() { runtime.signOut(server); user = ""; close() }
    fun openSettings() { settings = true; if (user.isEmpty()) resume() else check() }
    private fun check() {
        if (busy || !alive || host.locked) return
        val r = runtime.record(server)
        if (r.optString("device_token").isEmpty()) { registerScreen(); return }
        showLoading()
        job({
            val sessionCookie = CookieManager.getInstance().getCookie(server.url)
            val me = PresenceApi.call(server, "GET", "me", cookie = sessionCookie)
            val actual = me.optString("user_id").ifEmpty { me.optJSONObject("user")?.optString("id").orEmpty() }.ifEmpty { me.optString("id") }
            require(actual.isNotEmpty()) { "session_identity_missing" }
            if (actual != runtime.record(server).optString("user")) {
                runtime.signOut(server); user = actual
                return@job JSONObject().put("different_user", true)
            }
            val c = runtime.refresh(server)
            runtime.sendStatus(server)
            val cookie = CookieManager.getInstance().getCookie(server.url)
            val g = PresenceApi.call(server, "GET", "presence/gate", cookie = cookie)
            PresenceApi.call(server, "GET", "me", cookie = cookie) // refresh the server session policy after status
            JSONObject().put("config", c).put("gate", g)
        }) { response ->
            if (response.optBoolean("different_user")) {
                val box = page("רישום למשתמש אחר", "המכשיר רשום למשתמש אחר. לרשום אותו מחדש למשתמש הנוכחי?")
                button(box, "רישום מחדש") { runtime.store.invalidate(server.id); runtime.store.update(server.id) { it.put("user", user).put("signed_in", true) }; registerScreen() }
                button(box, "התנתקות") { signOut() }
                return@job
            }
            val nextGate = response.getJSONObject("gate")
            if (gate.optBoolean("blocked") && !nextGate.optBoolean("blocked")) reloadNeeded = true
            gate = nextGate
            val c = response.getJSONObject("config")
            val r2 = runtime.record(server)
            SensorCoordinator.get(host).refresh()
            when {
                c.optBoolean("enabled") && r2.optInt("ack") < c.optInt("notice_version") -> notice(c)
                gate.optBoolean("blocked") -> gateScreen()
                settings -> sensorScreen()
                else -> close()
            }
        }
    }
    private fun registerScreen() {
        val box = page(host.getString(R.string.device_title), host.getString(R.string.device_intro))
        val name = EditText(host).apply { hint = host.getString(R.string.device_name_placeholder); maxLines = 1; filterTouchesWhenObscured = true }
        box.addView(name)
        button(box, host.getString(R.string.device_continue)) {
            if (!PresencePolicy.nameValid(name.text.toString())) { name.error = host.getString(R.string.device_name_error); return@button }
            val cookie = CookieManager.getInstance().getCookie(server.url).orEmpty()
            job({ runtime.register(server, cookie, user, name.text.toString()); JSONObject() }) { settings = true; check() }
        }
        button(box, "התנתקות") { signOut() }
    }
    private fun notice(c: JSONObject) {
        val text = c.optString("notice_text")
        val box = page(host.getString(R.string.notice_title), text)
        if (text.isNotBlank()) button(box, host.getString(R.string.notice_ack)) {
            job({ runtime.acknowledge(server); JSONObject() }) { check() }
        } else label(box, "השרת לא סיפק הודעה לעובדים. יש לפנות למנהל המערכת.")
        button(box, "התנתקות") { signOut() }
    }
    private fun gateScreen() {
        val missing = gate.stringSet("missing")
        val box = page(host.getString(R.string.required_title), missing.joinToString("\n") { host.getString(R.string.required_body, sensorName(it)) })
        missing.forEach { key ->
            label(box, if (!SensorPermissions.supported(host, key)) "${sensorName(key)}: לא זמין במכשיר. יש לפנות למנהל המערכת." else sensorName(key))
            button(box, host.getString(R.string.required_enable)) { enable(key) }
        }
        button(box, host.getString(R.string.required_open_settings)) { appSettings() }
        button(box, "נסה שוב") { check() }
        button(box, host.getString(R.string.required_signout)) { signOut() }
    }
    private fun sensorScreen() {
        val r = runtime.record(server); val c = runtime.config(server)
        val allowed = c.optJSONObject("sensors")?.stringSet("allowed") ?: emptySet()
        val box = page(host.getString(R.string.sensor_title), r.optString("name"))
        if (!c.optBoolean("enabled")) label(box, "שיתוף הנתונים כבוי בשרת.")
        PresencePolicy.sensors.forEach { key ->
            val supported = SensorPermissions.supported(host, key)
            val state = when {
                key !in allowed -> host.getString(R.string.sensor_not_allowed)
                !supported -> "לא זמין במכשיר"
                key in runtime.active(server) -> "פעיל"
                key in r.stringSet("selected") -> host.getString(R.string.sensor_needs_permission)
                else -> "כבוי"
            }
            val purpose = c.optJSONObject("sensors")?.optJSONArray("catalog")?.let { arr ->
                (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }.firstOrNull { it.optString("key") == key }?.optString("purpose_he")
            }.orEmpty()
            val toggle = SwitchMaterial(host).apply {
                text = "${sensorName(key)} · $state\n$purpose"
                isChecked = key in r.stringSet("selected"); isEnabled = key in allowed && supported
                filterTouchesWhenObscured = true
            }
            toggle.setOnCheckedChangeListener { _, on ->
                if (on) enable(key) else { runtime.select(server, runtime.record(server).stringSet("selected") - key); check() }
            }
            val card = com.google.android.material.card.MaterialCardView(host).apply {
                radius = dp(14).toFloat(); cardElevation = 0f; strokeWidth = dp(1); setStrokeColor(host.getColor(R.color.border))
                setCardBackgroundColor(android.graphics.Color.WHITE)
                addView(toggle, ViewGroup.LayoutParams(-1, -2)); toggle.setPadding(dp(16), dp(12), dp(16), dp(12))
            }
            box.addView(card, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) })
        }
        button(box, host.getString(R.string.sensor_select_all)) { enableMany(allowed.toList()) }
        button(box, host.getString(R.string.sensor_clear_all)) { runtime.select(server, emptySet()); check() }
        button(box, "פתח הגדרות") { appSettings() }
        if ("location" in r.stringSet("selected") && Build.VERSION.SDK_INT >= 29 && SensorPermissions.locationAuth(host) != "always")
            button(box, "מיקום גם כשהאפליקציה סגורה") {
                val explain = page("מיקום ברקע", "המיקום משותף גם כשהאפליקציה אינה פתוחה. ניתן לכבות שיתוף בכל עת. כדי לאפשר זאת, בחרו הרשאת מיקום תמיד בהגדרות הטלפון.")
                button(explain, "פתח הגדרות") { appSettings() }; button(explain, "לא עכשיו") { check() }
            }
        button(box, "התראות") { PushSettings.show(this, box, server, runtime) }
        button(box, "שינוי שם המכשיר") {
            val b = page("שינוי שם המכשיר", ""); val input = EditText(host).apply { setText(r.optString("name")) }; b.addView(input)
            button(b, "שמירה") { if (PresencePolicy.nameValid(input.text.toString())) job({
                val result = runtime.tokenCall(server, "PATCH", "presence/devices/${r.getString("device_id")}", JSONObject().put("name", input.text.toString().trim()))
                runtime.store.update(server.id) { it.put("name", result.getString("name")) }; JSONObject()
            }) { check() } else input.error = host.getString(R.string.device_name_error) }
        }
        button(box, "הסרת המכשיר מהמערכת") {
            val b = page("הסרת המכשיר מהמערכת", "המכשיר יוסר ושיתוף הנתונים ממנו ייפסק.")
            button(b, "הסרה") { job({ runtime.remove(server); JSONObject() }) { signOut() } }
            button(b, "ביטול") { check() }
        }
        button(box, "חזרה") { settings = false; if (settingsOnly) host.finish() else check() }
    }
    private fun enable(key: String, done: () -> Unit = { check() }) {
        val c = runtime.config(server)
        if (!c.optBoolean("enabled") || runtime.record(server).optInt("ack") < c.optInt("notice_version") || key !in (c.optJSONObject("sensors")?.stringSet("allowed") ?: emptySet()) || !SensorPermissions.supported(host, key)) return
        runtime.select(server, runtime.record(server).stringSet("selected") + key)
        val ask = SensorPermissions.requests(key).filter { !SensorPermissions.granted(host, it) }.toTypedArray()
        if (key == "location" && SensorPermissions.locationAuth(host) in setOf("always", "when_in_use")) { done(); return }
        if (ask.isEmpty()) { done(); return }
        val box = page(sensorName(key), "כדי לשתף את החיישן שבחרתם נדרשת הרשאה בטלפון. אפשר לכבות את השיתוף בכל עת.")
        button(box, "אישור הרשאה") { permissionDone = done; permissions.launch(ask) }
        button(box, "לא עכשיו") { runtime.select(server, runtime.record(server).stringSet("selected") - key); done() }
        button(box, "פתח הגדרות") { appSettings() }
    }
    private fun enableMany(keys: List<String>) {
        if (keys.isEmpty()) { check(); return }
        val key = keys.first()
        if (!SensorPermissions.supported(host, key)) enableMany(keys.drop(1)) else enable(key) { enableMany(keys.drop(1)) }
    }
    fun requestNotifications(done: () -> Unit) {
        if (Build.VERSION.SDK_INT < 33) { done(); return }
        permissionDone = done; permissions.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
    }
    fun signOut() { runtime.signOut(server); user = ""; signedOut(); close(); if (settingsOnly) host.finish() }
    fun appSettings() { host.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${host.packageName}"))) }
    private fun showNeedsSignIn() {
        val b = page(host.getString(R.string.sensor_title), "יש להיכנס למערכת כדי לרשום את המכשיר.")
        button(b, "פתיחת המערכת") { WebActivity.open(host, server.url, server.url); host.finish() }
    }
    private fun showLoading() { page("בודקים את הגדרות השיתוף", "רגע…") }
    fun job(work: () -> JSONObject, done: (JSONObject) -> Unit) {
        if (busy || !alive || host.locked) return
        busy = true
        runtime.io.execute {
            val result = runCatching(work)
            main.post {
                busy = false
                if (!alive || host.isDestroyed || host.locked) return@post
                result.fold(done) { e ->
                    if (e is PresenceFailure && e.status == 401) runtime.signOut(server)
                    SensorCoordinator.get(host).refresh()
                    val b = page("לא הצלחנו להשלים את הבדיקה", (e as? PresenceFailure)?.userMessage?.takeIf { it.isNotBlank() } ?: "בדקו את החיבור ונסו שוב.")
                    button(b, "נסה שוב") { if (user.isEmpty()) signedIn() else check() }
                    button(b, "התנתקות") { signOut() }
                }
            }
        }
    }
    fun page(title: String, text: String): LinearLayout {
        androidx.core.view.WindowCompat.getInsetsController(host.window, host.window.decorView).isAppearanceLightStatusBars = true
        cover?.let(root::removeView)
        blockingChanged(true)
        site?.apply { visibility = View.INVISIBLE; isEnabled = false; importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS }
        val box = LinearLayout(host).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(16), dp(16), dp(16)); layoutDirection = View.LAYOUT_DIRECTION_RTL }
        val heading = TextView(host).apply { this.text = title; textSize = 22f; setTextColor(android.graphics.Color.WHITE); setBackgroundColor(host.getColor(R.color.themeColor)); setPadding(dp(16), dp(16), dp(16), dp(16)) }
        box.addView(heading, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        if (text.isNotEmpty()) label(box, text)
        cover = ScrollView(host).apply { setBackgroundColor(host.getColor(R.color.backgroundColor)); isClickable = true; isFocusable = true; addView(box) }
        if (site == null) androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(cover!!) { v, insets ->
            val available = androidx.core.view.ViewCompat.getRootWindowInsets(root) ?: insets
            val bars = available.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars() or androidx.core.view.WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        root.addView(cover, FrameLayout.LayoutParams(-1, -1))
        androidx.core.view.ViewCompat.requestApplyInsets(root)
        return box
    }
    fun updateInsets(insets: androidx.core.view.WindowInsetsCompat) {
        val bars = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars() or androidx.core.view.WindowInsetsCompat.Type.ime())
        cover?.setPadding(bars.left, bars.top, bars.right, bars.bottom)
    }
    private fun dp(value: Int) = (value * host.resources.displayMetrics.density).toInt()
    fun label(box: LinearLayout, text: String, size: Float = 16f) { box.addView(TextView(host).apply { this.text = text; textSize = size; setTextColor(host.getColor(R.color.textPrimary)); setPadding(dp(8), dp(12), dp(8), dp(12)) }) }
    fun button(box: LinearLayout, text: String, action: () -> Unit) { box.addView(MaterialButton(host).apply { this.text = text; filterTouchesWhenObscured = true; setOnClickListener { if (!host.locked) action() } }) }
    fun sensorName(key: String) = host.getString(when (key) {
        "location" -> R.string.sensor_location; "activity" -> R.string.sensor_activity; "steps" -> R.string.sensor_steps
        "altitude" -> R.string.sensor_altitude; "battery" -> R.string.sensor_battery; "network" -> R.string.sensor_network
        "beacon" -> R.string.sensor_beacon; else -> R.string.sensor_app_state
    })
    private fun close() { androidx.core.view.WindowCompat.getInsetsController(host.window, host.window.decorView).isAppearanceLightStatusBars = originalLightStatus; cover?.let(root::removeView); cover = null; blockingChanged(false); site?.apply { visibility = View.VISIBLE; isEnabled = true; importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO }; if (reloadNeeded) { reloadNeeded = false; reload() } }
    fun destroy() { alive = false; main.removeCallbacksAndMessages(null) }
    fun hostActivity() = host
}
