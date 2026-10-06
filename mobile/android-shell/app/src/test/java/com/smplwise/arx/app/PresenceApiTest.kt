package com.smplwise.arx.app

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class PresenceApiTest {
    private lateinit var mock: MockWebServer
    private lateinit var server: Server
    @Before fun setup() { mock = MockWebServer(); mock.start(); server = Server("fixture", "Fixture", mock.url("/arx/").toString()) }
    @After fun done() { mock.shutdown() }
    @Test fun sessionAndDeviceCredentialsAreSeparateAndUaIdentifiesAndroid() {
        mock.enqueue(MockResponse().setBody("{}"))
        PresenceApi.call(server, "POST", "presence/devices", cookie = "fixture_user=fixture-a", body = JSONObject().put("name", "מכשיר"))
        val session = mock.takeRequest(); assertNull(session.getHeader("Authorization")); assertEquals("fixture_user=fixture-a", session.getHeader("Cookie"))
        assertTrue(session.getHeader("User-Agent")!!.endsWith("(Android app)"))
        mock.enqueue(MockResponse().setBody("{}"))
        PresenceApi.call(server, "GET", "presence/config", token = "fixture-token")
        val device = mock.takeRequest(); assertNull(device.getHeader("Cookie")); assertEquals("Bearer fixture-token", device.getHeader("Authorization"))
    }
    @Test fun redirectNeverForwardsDeviceToken() {
        mock.enqueue(MockResponse().setResponseCode(302).addHeader("Location", "/foreign"))
        try { PresenceApi.call(server, "GET", "presence/config", token = "fixture-token"); fail() } catch (e: PresenceFailure) { assertEquals(302, e.status) }
        assertEquals(1, mock.requestCount)
    }
    @Test fun finalAppNotificationRouteAndStructuredErrors() {
        mock.enqueue(MockResponse().setBody("{\"message_id\":\"msg_one\",\"title\":\"בדיקה\"}"))
        assertEquals("msg_one", PresenceApi.call(server, "GET", "notifications/app/msg_one", token = "fixture-token").getString("message_id"))
        assertEquals("/arx/api/v1/notifications/app/msg_one", mock.takeRequest().path)
        mock.enqueue(MockResponse().setResponseCode(400).setBody("{\"code\":\"sensor_not_allowed\",\"user_message\":\"לא מאושר\",\"details\":{\"sensor\":\"steps\"}}"))
        try { PresenceApi.call(server, "POST", "presence/devices/dev_one/events", token = "fixture-token", body = JSONObject()); fail() }
        catch (e: PresenceFailure) { assertEquals("steps", e.details.getString("sensor")); assertEquals("sensor_not_allowed", e.code) }
    }
    @Test fun oversizedBodyAndMixedCredentialsFailBeforeNetwork() {
        try { PresenceApi.call(server, "POST", "presence/devices", body = JSONObject().put("x", "x".repeat(65536))); fail() } catch (_: IllegalArgumentException) {}
        try { PresenceApi.call(server, "GET", "presence/config", token = "x", cookie = "y"); fail() } catch (_: IllegalArgumentException) {}
        assertEquals(0, mock.requestCount)
    }
}
