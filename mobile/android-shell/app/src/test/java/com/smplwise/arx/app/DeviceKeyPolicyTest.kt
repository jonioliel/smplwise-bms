package com.smplwise.arx.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** MFA-DEVICEKEY-2490 (+ MFA-DEVICEKEY-ATTEST-2490 attestation challenge, FIX-PHONEKEY-2570 prompt from the signed payload): what the app agrees to sign with the phone key (DeviceKeyPolicy) and the bridge calls that reach it. */
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

    /** FIX-PHONEKEY-2570 (second deep review SA2-02): the prompt says what the SIGNED payload says - the page's text plays no part. */
    private fun promptFor(payload: String) = DeviceKeyPolicy.promptOf(DeviceKeyPolicy.acceptable(payload, origin, key) ?: DeviceKeyPolicy.acceptable(payload, origin, null)!!)

    @Test
    fun thePromptIsBuiltFromTheSignedPayloadOnly() {
        val k = DeviceKeyPolicy.PromptKind
        // a page that asks to sign a permission change while it shows "open the door" gets the permission change on the phone
        assertEquals(DeviceKeyPolicy.Prompt(k.PERMISSIONS), promptFor(p("step_up", action = "rbac.assign")))
        assertEquals(DeviceKeyPolicy.Prompt(k.DOOR), promptFor(p("step_up", action = "door.open")))
        assertEquals(DeviceKeyPolicy.Prompt(k.DISARM), promptFor(p("step_up", action = "alarm.disarm")))
        assertEquals(DeviceKeyPolicy.Prompt(k.BYPASS), promptFor(p("step_up", action = "alarm.bypass")))
        assertEquals(DeviceKeyPolicy.Prompt(k.USERS), promptFor(p("step_up", action = "identity.local.manage")))
        assertEquals(DeviceKeyPolicy.Prompt(k.FACTORS), promptFor(p("step_up", action = "auth.second_factor.reset")))
        assertEquals(DeviceKeyPolicy.Prompt(k.SETTINGS), promptFor(p("step_up", action = "system.configure")))
        assertEquals(DeviceKeyPolicy.Prompt(k.SETTINGS), promptFor(p("step_up", action = "nvr.configure")))
        assertEquals(DeviceKeyPolicy.Prompt(k.BACKUP), promptFor(p("step_up", action = "backup.restore")))
        assertEquals(DeviceKeyPolicy.Prompt(k.OTHER, "tickets.manage"), promptFor(p("step_up", action = "tickets.manage")))
        assertEquals(DeviceKeyPolicy.Prompt(k.IDENTITY), promptFor(p("step_up")))
        assertEquals(DeviceKeyPolicy.Prompt(k.REGISTER), promptFor(p("register", k = "-")))
        assertEquals(DeviceKeyPolicy.Prompt(k.SIGN_IN), promptFor(p("sign_in", user = "-")))
    }

    @Test
    fun anApprovalShowsTheSignedNumber() { // the number inside the signed action, not one the page claims
        assertEquals(DeviceKeyPolicy.Prompt(DeviceKeyPolicy.PromptKind.APPROVAL, "42"), promptFor(p("step_up", action = "auth.push_approval.n42")))
        assertEquals(DeviceKeyPolicy.PromptKind.FACTORS, promptFor(p("step_up", action = "auth.push_approval.n4")).kind) // not a 2-digit number
    }

    @Test
    fun theBridgeDoesNotPassThePagesTextToTheApp() {
        val js = BridgeScript.source("2.1.0", "/arx/", "0123abcd")
        assertTrue(js.contains("sign: function (payload) { return ask({ type: 'deviceKeySign', payload: String(payload) }); }"))
        assertFalse(js.contains("text: String(text"))
        assertTrue(js.contains("signedPrompt: true")) // the page offers the registration only to an app that does this
    }

    @Test
    fun theBridgeOffersTheDeviceKeyCalls() {
        val js = BridgeScript.source("2.0.0", "/arx/", "0123abcd")
        assertTrue(js.contains("deviceKey: deviceKey"))
        assertTrue(js.contains("m.type !== 'deviceKeyResult'"))
        assertTrue(BridgePolicy.MESSAGE_TYPES.containsAll(BridgePolicy.DEVICE_KEY_TYPES))
        assertEquals("AAEC", DeviceKeyPolicy.b64u(byteArrayOf(0, 1, 2)))
        assertTrue(js.contains("payload: String((o && o.payload) || '')")) // MFA-DEVICEKEY-ATTEST-2490: create() takes the register payload
    }

    @Test
    fun theAttestationChallengeIsTheHashOfThisServersRegisterPayload() { // MFA-DEVICEKEY-ATTEST-2490 (owner Q52)
        val reg = p("register", k = "-")
        val expected = java.security.MessageDigest.getInstance("SHA-256").digest(reg.toByteArray(Charsets.UTF_8))
        assertTrue(expected.contentEquals(DeviceKeyPolicy.attestationChallenge(reg, origin)))
        assertEquals(32, DeviceKeyPolicy.attestationChallenge(reg, origin)!!.size)
        assertNull(DeviceKeyPolicy.attestationChallenge(p("register", o = "https://evil.example.com", k = "-"), origin))
        assertNull(DeviceKeyPolicy.attestationChallenge(p("step_up", action = "system.configure"), origin)) // only a registration
        assertNull(DeviceKeyPolicy.attestationChallenge(null, origin))
        assertEquals(listOf("AAEC"), DeviceKeyPolicy.chainB64(listOf(byteArrayOf(0, 1, 2))))
    }
}
