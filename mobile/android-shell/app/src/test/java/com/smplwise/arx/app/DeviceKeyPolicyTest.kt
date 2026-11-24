package com.smplwise.arx.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** MFA-DEVICEKEY-2490: what the app agrees to sign with the phone key (DeviceKeyPolicy) and the bridge calls that reach it. */
class DeviceKeyPolicyTest {
    private val origin = "https://site.example.com"
    private val key = "dk_0123456789abcdef01234567"
    private val nonce = "dkn_" + "A".repeat(43)

    private fun p(purpose: String, o: String = origin, user: String = "u1", k: String = key, action: String = "-") =
        "arx-device-key|v1|$purpose|$o|$user|$k|$action|$nonce"

    @Test
    fun onlyThisServersPayloadsAreSigned() {
        assertNotNull(DeviceKeyPolicy.acceptable(p("step_up", action = "system.configure"), origin, key))
        assertNotNull(DeviceKeyPolicy.acceptable(p("step_up"), "https://SITE.example.com:443/", key))
        assertNull(DeviceKeyPolicy.acceptable(p("step_up", o = "https://evil.example.com"), origin, key))
        assertNull(DeviceKeyPolicy.acceptable(p("step_up", o = "http://site.example.com"), origin, key))
    }

    @Test
    fun aPayloadMustNameThisAppsKeyExceptARegistration() {
        assertNull(DeviceKeyPolicy.acceptable(p("step_up", k = "dk_ffffffffffffffffffffffff"), origin, key))
        assertNull(DeviceKeyPolicy.acceptable(p("step_up"), origin, null))
        assertNotNull(DeviceKeyPolicy.acceptable(p("register", k = "-"), origin, null))
        assertNull(DeviceKeyPolicy.acceptable(p("register"), origin, null)) // a registration names no key yet
        assertNotNull(DeviceKeyPolicy.acceptable(p("sign_in", user = "-"), origin, key))
        assertNull(DeviceKeyPolicy.acceptable(p("sign_in"), origin, key)) // a sign-in payload carries no user
    }

    @Test
    fun malformedPayloadsAreRefused() {
        assertNull(DeviceKeyPolicy.parse("arx-device-key|v2|step_up|$origin|u1|$key|-|$nonce"))
        assertNull(DeviceKeyPolicy.parse(p("disarm")))
        assertNull(DeviceKeyPolicy.parse(p("step_up", action = "Bad Action")))
        assertNull(DeviceKeyPolicy.parse(p("step_up") + "|extra"))
        assertNull(DeviceKeyPolicy.parse("arx-device-key|v1|step_up|$origin|u1|$key|-|short"))
        assertNull(DeviceKeyPolicy.parse("x".repeat(DeviceKeyPolicy.MAX_PAYLOAD + 1)))
        assertNull(DeviceKeyPolicy.parse(null))
    }

    @Test
    fun theScreenLockIsOfferedOnlyWhereAPerUseKeyCanTakeIt() { // owner q23 b; per-use + screen lock needs Android 11 (API 30)
        assertEquals(DeviceKeyPolicy.AUTH_ANY, DeviceKeyPolicy.effectiveKind(null, 30))
        assertEquals(DeviceKeyPolicy.AUTH_ANY, DeviceKeyPolicy.effectiveKind("biometric_or_screen_lock", 34))
        assertEquals(DeviceKeyPolicy.AUTH_BIOMETRIC, DeviceKeyPolicy.effectiveKind("biometric", 34))
        assertEquals(DeviceKeyPolicy.AUTH_BIOMETRIC, DeviceKeyPolicy.effectiveKind(null, 29))
    }

    @Test
    fun oneKeyPerServer() {
        val a = DeviceKeyPolicy.alias("https://site.example.com")
        assertEquals(a, DeviceKeyPolicy.alias("https://SITE.example.com:443"))
        assertNotEquals(a, DeviceKeyPolicy.alias("https://other.example.com"))
        assertTrue(a.startsWith("arx_device_key_v1_") && a.length == "arx_device_key_v1_".length + 24)
    }

    @Test
    fun thePromptTextIsShortAndPlain() {
        assertEquals("fallback", DeviceKeyPolicy.promptText("  ", "fallback"))
        assertEquals("a b", DeviceKeyPolicy.promptText("a\nb", "fallback"))
        assertEquals(DeviceKeyPolicy.MAX_PROMPT_TEXT, DeviceKeyPolicy.promptText("x".repeat(500), "f").length)
    }

    @Test
    fun theBridgeOffersTheDeviceKeyCalls() {
        val js = BridgeScript.source("2.0.0", "/arx/", "0123abcd")
        assertTrue(js.contains("deviceKey: deviceKey"))
        assertTrue(js.contains("m.type !== 'deviceKeyResult'"))
        assertTrue(BridgePolicy.MESSAGE_TYPES.containsAll(BridgePolicy.DEVICE_KEY_TYPES))
        assertEquals("AAEC", DeviceKeyPolicy.b64u(byteArrayOf(0, 1, 2)))
    }
}
