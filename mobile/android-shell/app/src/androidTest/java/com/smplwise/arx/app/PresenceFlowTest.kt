package com.smplwise.arx.app

import android.content.Context
import android.content.Intent
import android.webkit.CookieManager
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.scrollTo
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withText
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Only runs with adb reverse tcp:8099 tcp:8099 and the loopback synthetic fixture. */
@RunWith(AndroidJUnit4::class)
class PresenceFlowTest {
    private lateinit var c: Context
    private lateinit var runtime: PresenceRuntime
    private lateinit var server: Server
    private val fixtureUser = "fixture-" + java.util.UUID.randomUUID().toString()
    private var scenario: ActivityScenario<PresenceSettingsActivity>? = null
    private fun control(value: JSONObject, path: String = "config") {
        val conn = URL("http://127.0.0.1:8099/fixture/$path").openConnection() as HttpURLConnection
        try { conn.requestMethod = "POST"; conn.doOutput = true; conn.setRequestProperty("Content-Type", "application/json"); conn.outputStream.use { it.write(value.toString().toByteArray()) }; assertEquals(200, conn.responseCode); conn.inputStream.close() } finally { conn.disconnect() }
    }
    @Before fun setup() {
        c = ApplicationProvider.getApplicationContext(); runtime = PresenceRuntime.get(c)
        control(JSONObject().put("enabled", true).put("allowed", JSONArray(listOf("battery")))
            .put("required_sensors", JSONObject().put("enabled", true).put("sensors", JSONArray(listOf("battery"))))
            .put("notice_text", "Synthetic fixture notice. Not legal text."))
        server = ServerStore(c).add("בדיקת חוזה", "http://127.0.0.1:8099/arx/")
        val latch = CountDownLatch(1)
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            CookieManager.getInstance().setCookie(server.url, "fixture_user=$fixtureUser; Path=/arx/") { latch.countDown() }
        }
        assertTrue(latch.await(5, TimeUnit.SECONDS))
        runtime.register(server, "fixture_user=$fixtureUser", fixtureUser, "Fixture " + server.id.take(8))
        runtime.acknowledge(server)
    }
    @After fun cleanup() {
        scenario?.close(); runCatching { runtime.remove(server) }; ServerStore(c).delete(server.id)
    }
    private fun launch() { scenario = ActivityScenario.launch(Intent(c, PresenceSettingsActivity::class.java).putExtra("server_id", server.id)) }
    private fun waitFor(text: String) {
        var failure: Throwable? = null
        repeat(40) {
            try { onView(withText(text)).check(matches(isDisplayed())); return } catch (e: Throwable) { failure = e; Thread.sleep(250) }
        }
        throw AssertionError("Missing UI text: $text", failure)
    }
    @Test fun requiredBatteryBlocksThenEnablingAndClearingReturnsGate() {
        launch(); waitFor(c.getString(R.string.required_title))
        assertTrue(runtime.active(server).isEmpty())
        onView(withText(c.getString(R.string.required_enable))).perform(click())
        waitFor(c.getString(R.string.sensor_title))
        assertEquals(setOf("battery"), runtime.active(server))
        onView(withText(c.getString(R.string.sensor_clear_all))).perform(object : androidx.test.espresso.ViewAction {
            override fun getConstraints(): org.hamcrest.Matcher<android.view.View> = androidx.test.espresso.matcher.ViewMatchers.withEffectiveVisibility(androidx.test.espresso.matcher.ViewMatchers.Visibility.VISIBLE)
            override fun getDescription() = "Scroll the native sensor screen to Clear All"
            override fun perform(controller: androidx.test.espresso.UiController, view: android.view.View) {
                val box = view.parent as android.view.View
                val scroll = box.parent as android.widget.ScrollView
                scroll.scrollTo(0, view.top - 100)
                controller.loopMainThreadUntilIdle()
            }
        })
        onView(withText(c.getString(R.string.sensor_clear_all))).perform(click())
        waitFor(c.getString(R.string.required_title))
        assertTrue(runtime.active(server).isEmpty())
    }
    @Test fun changedNoticeStopsSelectedSensorsAndDisplaysOnlyServerNotice() {
        runtime.select(server, setOf("battery"))
        control(JSONObject().put("enabled", true).put("notice_text", "Updated synthetic notice"))
        launch(); waitFor(c.getString(R.string.notice_title))
        onView(withText("Updated synthetic notice")).check(matches(isDisplayed()))
        assertTrue(runtime.active(server).isEmpty())
        onView(withText(c.getString(R.string.notice_ack))).perform(click())
        waitFor(c.getString(R.string.sensor_title))
    }
    @Test fun disabledMasterSuppressesSelectedSensorsAndServerGate() {
        runtime.select(server, setOf("battery")); control(JSONObject().put("enabled", false))
        launch(); waitFor(c.getString(R.string.sensor_title))
        assertTrue(runtime.active(server).isEmpty())
        assertFalse(runtime.config(server).optJSONObject("required_sensors")!!.getBoolean("enabled"))
    }
    @Test fun tokensAreEncryptedAndInvalidTokenDropsRegistrationAndQueue() {
        val token = runtime.record(server).getString("device_token")
        val raw = c.getSharedPreferences("arx_presence_encrypted", Context.MODE_PRIVATE).getString(server.id, "")!!
        assertFalse(raw.contains(token)); assertFalse(raw.contains("arxd_"))
        runtime.store.update(server.id) { it.put("queue", JSONArray().put(JSONObject().put("type", "sensor"))) }
        control(JSONObject(), "revoke")
        try { runtime.refresh(server); fail("Expected invalid token") } catch (e: PresenceFailure) { assertEquals("device_token_invalid", e.code) }
        assertEquals("", runtime.record(server).optString("device_token")); assertFalse(runtime.record(server).has("queue"))
    }
}
