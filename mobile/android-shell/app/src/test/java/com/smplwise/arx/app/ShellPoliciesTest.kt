package com.smplwise.arx.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** App-lock timing, insets, bar colours, error mapping, file helpers and the injected script. */
class ShellPoliciesTest {
    private val min = 60_000L

    @Test
    fun theLockAsksOnEveryColdStartAndAfterTheChosenTimeAway() {
        assertFalse(LockPolicy.needsUnlock(false, null, null, 0, 1)) // off
        assertTrue(LockPolicy.needsUnlock(true, null, null, 10 * min, 5)) // this process never unlocked
        assertFalse(LockPolicy.needsUnlock(true, 1_000, null, 10 * min, 5)) // unlocked, never left
        assertFalse(LockPolicy.needsUnlock(true, 1_000, 2 * min, 6 * min, 5)) // 4 minutes away, limit 5
        assertTrue(LockPolicy.needsUnlock(true, 1_000, 2 * min, 7 * min, 5)) // exactly 5 minutes
        assertTrue(LockPolicy.needsUnlock(true, 1_000, 2 * min, 2 * min + 1, 0)) // "מיד"
        assertTrue(LockPolicy.needsUnlock(true, 1_000, 2 * min, 2 * min, 0))
        assertTrue(LockPolicy.needsUnlock(true, 1_000, 5 * min, 4 * min, 60)) // clock went backwards: lock
        assertEquals(listOf(0, 1, 5, 15, 60), LockPolicy.MINUTES_CHOICES)
        assertTrue(LockPolicy.DEFAULT_MINUTES in LockPolicy.MINUTES_CHOICES)
    }

    @Test
    fun leavingThroughTheAppsOwnHelperWaivesOnlyAShortGrace() { // review M5
        val away = 2 * min
        // "מיד": picking a file for 20 s does not lock, 31 s does, hours certainly do
        assertFalse(LockPolicy.needsUnlock(true, 1_000, away, away + 20_000, 0, viaExcursion = true))
        assertTrue(LockPolicy.needsUnlock(true, 1_000, away, away + 31_000, 0, viaExcursion = true))
        assertTrue(LockPolicy.needsUnlock(true, 1_000, away, away + 3 * 60 * min, 5, viaExcursion = true))
        // the grace never extends the chosen time: 15 minutes stays 15 minutes
        assertFalse(LockPolicy.needsUnlock(true, 1_000, away, away + 14 * min, 15, viaExcursion = true))
        assertTrue(LockPolicy.needsUnlock(true, 1_000, away, away + 15 * min, 15, viaExcursion = true))
        // without an excursion there is no grace
        assertTrue(LockPolicy.needsUnlock(true, 1_000, away, away + 20_000, 0, viaExcursion = false))
        assertEquals(30_000L, LockPolicy.EXCURSION_GRACE_MS)
    }

    @Test
    fun aShownLockStaysUntilTheUserIsConfirmed() { // emulator finding: cancelling the phone's prompt must not unlock
        val away = 2 * min
        // the credential screen took the app to the background for 5 s with the excursion flag set
        assertFalse(LockPolicy.needsUnlock(true, 1_000, away, away + 5_000, 0, viaExcursion = true, lockShowing = false))
        assertTrue(LockPolicy.needsUnlock(true, 1_000, away, away + 5_000, 0, viaExcursion = true, lockShowing = true))
        assertTrue(LockPolicy.needsUnlock(true, 1_000, null, away, 60, lockShowing = true))
        assertFalse(LockPolicy.needsUnlock(false, 1_000, null, away, 60, lockShowing = true)) // lock switched off
    }

    @Test
    fun theLockIsSwitchedOffOnlyWhenThePhoneHasNoScreenLock() { // review L4
        assertEquals(LockPolicy.AuthState.PROMPT, LockPolicy.onAuthState(canAuthenticate = true, noneEnrolled = false))
        assertEquals(LockPolicy.AuthState.SWITCH_OFF, LockPolicy.onAuthState(canAuthenticate = false, noneEnrolled = true))
        assertEquals(LockPolicy.AuthState.STAY_LOCKED, LockPolicy.onAuthState(canAuthenticate = false, noneEnrolled = false))
        // androidx.biometric's codes the app maps from
        assertEquals(0, androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS)
        assertEquals(11, androidx.biometric.BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED)
    }

    @Test
    fun theSafeAreaGoesToThePageFromWebView140() {
        assertEquals(140, InsetPolicy.webViewMajor("140.0.7339.51"))
        assertEquals(96, InsetPolicy.webViewMajor(" 96.0.4664.104 "))
        assertNull(InsetPolicy.webViewMajor(null))
        assertNull(InsetPolicy.webViewMajor(""))
        assertNull(InsetPolicy.webViewMajor("beta"))
        assertTrue(InsetPolicy.pageHandlesInsets(140))
        assertTrue(InsetPolicy.pageHandlesInsets(151))
        assertFalse(InsetPolicy.pageHandlesInsets(139))
        assertFalse(InsetPolicy.pageHandlesInsets(null))
        assertTrue(InsetPolicy.webViewOutdated(101)) // the API 33 emulator image's WebView
        assertFalse(InsetPolicy.webViewOutdated(111))
        assertFalse(InsetPolicy.webViewOutdated(140))
        assertFalse(InsetPolicy.webViewOutdated(null))
    }

    @Test
    fun cssColours() {
        assertEquals(0xFF2F6BFF.toInt(), BarColors.parse("#2f6bff"))
        assertEquals(0xFF2F6BFF.toInt(), BarColors.parse(" #2F6BFF "))
        assertEquals(0xFFFFFFFF.toInt(), BarColors.parse("#fff"))
        assertEquals(0x80112233.toInt(), BarColors.parse("#11223380"))
        assertEquals(0xFFF5F7FB.toInt(), BarColors.parse("rgb(245, 247, 251)"))
        assertEquals(0x00000000, BarColors.parse("rgba(0, 0, 0, 0)"))
        assertEquals(0xFF0F172A.toInt(), BarColors.parse("rgb(15 23 42 / 1)"))
        assertEquals(0x7F0F172A, BarColors.parse("rgba(15, 23, 42, 50%)"))
        assertNull(BarColors.parse("blue"))
        assertNull(BarColors.parse(""))
        assertNull(BarColors.parse(null))
        assertNull(BarColors.parse("#12345"))
    }

    @Test
    fun barsFollowThePage() {
        // light Arx: blue status bar with light icons, light navigation bar with dark icons
        val (status, nav) = BarColors.pick("#2f6bff", "rgb(245, 247, 251)", "rgba(0, 0, 0, 0)")
        assertEquals(0xFF2F6BFF.toInt(), status)
        assertEquals(0xFFF5F7FB.toInt(), nav)
        assertFalse(BarColors.wantsDarkIcons(status))
        assertTrue(BarColors.wantsDarkIcons(nav))
        // a dark page: dark navigation bar with light icons
        val (_, darkNav) = BarColors.pick("#0b1220", "rgba(0, 0, 0, 0)", "rgb(11, 18, 32)")
        assertEquals(0xFF0B1220.toInt(), darkNav)
        assertFalse(BarColors.wantsDarkIcons(darkNav))
        // nothing readable: the manifest's colours
        assertEquals(BarColors.DEFAULT_THEME to BarColors.DEFAULT_BACKGROUND, BarColors.pick("", "transparent", null))
        assertTrue(BarColors.wantsDarkIcons(0xFFFFFFFF.toInt()))
        assertFalse(BarColors.wantsDarkIcons(0xFF000000.toInt()))
    }

    @Test
    fun errorScreens() {
        assertEquals(LoadErrors.Kind.OFFLINE, LoadErrors.ofNetworkError(-2, online = false))
        assertEquals(LoadErrors.Kind.NOT_FOUND, LoadErrors.ofNetworkError(-2, online = true))
        assertEquals(LoadErrors.Kind.TIMEOUT, LoadErrors.ofNetworkError(-8, online = true))
        assertEquals(LoadErrors.Kind.TIMEOUT, LoadErrors.ofNetworkError(-6, online = true))
        assertEquals(LoadErrors.Kind.TLS, LoadErrors.ofNetworkError(-11, online = true))
        assertEquals(LoadErrors.Kind.OTHER, LoadErrors.ofNetworkError(-1, online = true))
        assertEquals(LoadErrors.Kind.SERVER, LoadErrors.ofHttpStatus(502))
        assertEquals(LoadErrors.Kind.SERVER, LoadErrors.ofHttpStatus(530))
        assertEquals(LoadErrors.Kind.NOT_FOUND, LoadErrors.ofHttpStatus(404))
        assertNull(LoadErrors.ofHttpStatus(200))
        assertNull(LoadErrors.ofHttpStatus(401)) // the page handles its own sign-in
        // the WebView's constants, as inlined in LoadErrors
        assertEquals(-2, android.webkit.WebViewClient.ERROR_HOST_LOOKUP)
        assertEquals(-6, android.webkit.WebViewClient.ERROR_CONNECT)
        assertEquals(-8, android.webkit.WebViewClient.ERROR_TIMEOUT)
        assertEquals(-11, android.webkit.WebViewClient.ERROR_FAILED_SSL_HANDSHAKE)
    }

    @Test
    fun pickerTypesFromAnAcceptList() {
        val mime = mapOf("pdf" to "application/pdf", "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "zip" to "application/zip")
        val of = { ext: String -> mime[ext] }
        assertEquals(
            listOf("application/pdf", "image/png", "image/jpeg"),
            FileTypes.mimeTypes(arrayOf(".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,.dxf"), of),
        )
        assertEquals(listOf("application/zip"), FileTypes.mimeTypes(arrayOf(".zip", "application/zip"), of))
        assertEquals(listOf("image/*"), FileTypes.mimeTypes(arrayOf("image/*"), of))
        assertEquals(listOf("*/*"), FileTypes.mimeTypes(arrayOf(""), of))
        assertEquals(listOf("*/*"), FileTypes.mimeTypes(null, of))
        assertEquals(listOf("*/*"), FileTypes.mimeTypes(arrayOf(".dxf", "not a type"), of))
    }

    @Test
    fun downloadNamesAreSafe() {
        assertEquals("audit-2026-09-29.csv", FileTypes.safeName("audit-2026-09-29.csv", "x"))
        assertEquals("passwd", FileTypes.safeName("../../etc/passwd", "x"))
        assertEquals("evil.bat", FileTypes.safeName("..\\evil.bat", "x"))
        assertEquals("hidden", FileTypes.safeName(".hidden", "x"))
        assertEquals("ab.txt", FileTypes.safeName("a\u0000b.txt", "x"))
        assertEquals("fallback", FileTypes.safeName("", "fallback"))
        assertEquals("fallback", FileTypes.safeName(null, "fallback"))
        val long = FileTypes.safeName("a".repeat(300) + ".json", "x")
        assertEquals(120, long.length)
        assertTrue(long.endsWith(".json"))
        assertEquals("plan structure.json", FileTypes.safeName("plan structure.json", "x"))
    }

    @Test
    fun theInjectedScriptExposesOnlyTheWhitelistedInterface() {
        val js = BridgeScript.source("2.0.0", "/arx/", "0123abcd")
        // the Arx interface only in the main frame's Arx pages: the same origin also serves the platform's own pages
        val pathCheck = js.indexOf("String(location.pathname).indexOf('\\u002farx\\u002f') !== 0) return;")
        assertTrue(pathCheck > 0)
        assertTrue(js.contains("if (!nat || window.ArxApp || window.top !== window) return;"))
        // ... but the media guard runs before that check, so it reaches every frame of the origin, the WisKey intercom
        // panel at /hikvision-intercom included (re-review, item 2)
        val guard = js.indexOf("Object.defineProperty(window, '__arxLock'")
        assertTrue(guard in 1 until pathCheck)
        assertTrue(js.contains("md.getUserMedia = function ()"))
        assertTrue(js.contains("if (locked) return Promise.reject(new DOMException('The app is locked', 'NotAllowedError'));"))
        assertTrue(js.contains("HTMLMediaElement.prototype.play = function ()"))
        assertTrue(js.contains("document.addEventListener('play', function (e) {"))
        assertTrue(js.contains("c.suspend()"))
        // only the app can lift the guard: unlocking needs the screen's token; nothing is resumed
        assertTrue(js.contains("var tok = '0123abcd';"))
        assertTrue(js.contains("} else if (t === tok) {"))
        assertFalse(Regex("\\.play\\(\\)").containsMatchIn(js.substringAfter("value: function (on, t) {").substringBefore("return locked;")))
        // blobs: 10 MB (review L6), and only the latest few for a short time (review L12)
        assertEquals(10 * 1024 * 1024, BridgeScript.MAX_BLOB_BYTES)
        assertTrue(js.contains("while (blobs.size > ${BridgeScript.MAX_BLOBS})"))
        assertTrue(js.contains("forget(u); }, ${BridgeScript.BLOB_KEEP_MS});"))
        assertTrue(js.contains("window.ArxAppNative"))
        assertTrue(js.contains("platform: 'android'"))
        assertTrue(js.contains("version: '2.0.0'"))
        assertTrue(js.contains("switchServer: function () { send({ type: 'switchServer' }); }"))
        assertTrue(js.contains("Object.freeze"))
        assertTrue(js.contains("b.size > ${BridgeScript.MAX_BLOB_BYTES}"))
        assertFalse(js.contains("addJavascriptInterface"))
        // every message type the script can send is one the app accepts, and nothing else
        val sent = Regex("type: '([A-Za-z]+)'").findAll(js).map { it.groupValues[1] }.toSet()
        assertEquals(BridgePolicy.MESSAGE_TYPES, sent)
        assertEquals("'2.0.0'", BridgeScript.jsString("2.0.0"))
        assertEquals("'a\\u0027b\\u003c'", BridgeScript.jsString("a'b<"))
        assertTrue(BridgeScript.MAX_MESSAGE_CHARS > BridgeScript.MAX_BLOB_BYTES / 3 * 4)
    }

    @Test
    fun theLockScriptVisitsEveryReachableFrame() { // re-review, item 2
        val on = BridgeScript.lock(true, "0123abcd")
        val off = BridgeScript.lock(false, "0123abcd")
        assertTrue(on.contains("win.frames.length") && on.contains("visit(win.frames[i])"))
        assertTrue(on.contains("win.__arxLock(on,t)"))
        // a frame without the guard (no document-start support) still gets its media paused, shadow roots included
        assertTrue(on.contains("HTMLMediaElement") && on.contains("shadowRoot"))
        assertTrue(on.endsWith("(true,'0123abcd')"))
        assertTrue(off.endsWith("(false,'0123abcd')"))
        assertFalse(off.contains(".play("))
    }
}
