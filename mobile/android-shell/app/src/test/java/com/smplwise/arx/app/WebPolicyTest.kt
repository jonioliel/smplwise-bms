package com.smplwise.arx.app

import com.smplwise.arx.app.NavPolicy.Decision
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Navigation scope, the bridge's origin check and the permission policy of the WebView. */
class WebPolicyTest {
    private val server = "https://site.example.com/arx/"

    private fun main(url: String) = NavPolicy.decide(server, url, isMainFrame = true)
    private fun sub(url: String) = NavPolicy.decide(server, url, isMainFrame = false)

    @Test
    fun theServersArxPagesStayInTheApp() {
        assertEquals(Decision.IN_APP, main("https://site.example.com/arx/"))
        assertEquals(Decision.IN_APP, main("https://site.example.com/arx"))
        assertEquals(Decision.IN_APP, main("https://site.example.com/arx/?app=android#/live"))
        assertEquals(Decision.IN_APP, main("https://site.example.com/arx/#/kiosk/all"))
        assertEquals(Decision.IN_APP, main("https://site.example.com/arx/api/v1/exports/x/manifest"))
        assertEquals(Decision.IN_APP, main("https://SITE.example.com:443/arx/"))
    }

    @Test
    fun noAuthExceptionForTopLevelNavigation() { // review L2: the sign-in uses fetch, never navigates to /auth/
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/auth/authorize?client_id=x"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/auth/login_flow"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/auth"))
        assertFalse(NavPolicy.inScope(server, "https://site.example.com/auth/token"))
    }

    @Test
    fun onlyTheServersPagesMayBeShownAfterAnyNavigation() { // review M1: POST, back / forward, restored state
        assertTrue(NavPolicy.mayShow(server, "https://site.example.com/arx/#/live"))
        assertTrue(NavPolicy.mayShow(server, "https://site.example.com/arx/?app=android"))
        assertTrue(NavPolicy.mayShow(server, "about:blank"))
        assertTrue(NavPolicy.mayShow(server, null))
        assertTrue(NavPolicy.mayShow(server, ""))
        assertFalse(NavPolicy.mayShow(server, "https://site.example.com/")) // the platform's own UI, same origin
        assertFalse(NavPolicy.mayShow(server, "https://site.example.com/lovelace/0"))
        assertFalse(NavPolicy.mayShow(server, "https://evil.example.com/arx/"))
        assertFalse(NavPolicy.mayShow(server, "http://site.example.com/arx/"))
        assertFalse(NavPolicy.mayShow(server, "https://site.example.com/arx/%2e%2e/"))
        assertFalse(NavPolicy.mayShow(server, "data:text/html,<h1>x</h1>"))
        assertFalse(NavPolicy.mayShow(server, "javascript:alert(1)"))
        assertFalse(NavPolicy.mayShow(server, "about:srcdoc"))
        assertFalse(NavPolicy.mayShow(server, "file:///etc/hosts"))
    }

    @Test
    fun externalOpensWithoutAGestureAreThrottled() { // review L7
        val t = 1_000_000L
        assertTrue(NavPolicy.allowExternal(true, t, t - 1))
        assertTrue(NavPolicy.allowExternal(false, t, null))
        assertFalse(NavPolicy.allowExternal(false, t, t - 9_999))
        assertTrue(NavPolicy.allowExternal(false, t, t - 10_000))
        assertTrue(NavPolicy.allowExternal(false, t, t + 5)) // a clock from before a reboot never blocks forever
    }

    @Test
    fun switchingServersFromThePageNeedsARecentTouch() { // re-review, item 3
        val t = 9_000_000L
        assertFalse(NavPolicy.userActivated(t, null))
        assertTrue(NavPolicy.userActivated(t, t))
        assertTrue(NavPolicy.userActivated(t, t - 5_000))
        assertFalse(NavPolicy.userActivated(t, t - 5_001))
        assertFalse(NavPolicy.userActivated(t, t + 10)) // a touch "from the future" (state from before a reboot)
    }

    @Test
    fun rendererRestartsAreCapped() { // review L8
        val t = 5_000_000L
        assertTrue(NavPolicy.allowRendererRestart(t, null))
        assertFalse(NavPolicy.allowRendererRestart(t, t - 29_999))
        assertTrue(NavPolicy.allowRendererRestart(t, t - 30_000))
    }

    @Test
    fun downloadRedirectsStayOnTheServersPages() { // review M2
        val cur = "https://site.example.com/arx/api/v1/exports/e1/download"
        assertEquals(
            "https://site.example.com/arx/api/v1/exports/e1/file.zip",
            DownloadPolicy.nextHop(server, cur, "file.zip"),
        )
        assertEquals(
            "https://site.example.com/arx/api/v1/backups/b.zip",
            DownloadPolicy.nextHop(server, cur, "/arx/api/v1/backups/b.zip"),
        )
        assertNull(DownloadPolicy.nextHop(server, cur, "https://storage.example.com/x.zip")) // another host
        assertNull(DownloadPolicy.nextHop(server, cur, "/lovelace/x")) // same origin, outside Arx
        assertNull(DownloadPolicy.nextHop(server, cur, "http://site.example.com/arx/x.zip")) // downgrade
        assertNull(DownloadPolicy.nextHop(server, cur, "//evil.example.com/arx/x"))
        assertNull(DownloadPolicy.nextHop(server, cur, "../../../../../lovelace")) // resolves to /lovelace
        assertEquals("https://site.example.com/arx/x", DownloadPolicy.nextHop(server, cur, "../../../../x")) // still /arx/
        assertNull(DownloadPolicy.nextHop(server, cur, "/arx/%2e%2e/x"))
        assertNull(DownloadPolicy.nextHop(server, cur, null))
        assertNull(DownloadPolicy.nextHop(server, cur, ""))
        assertNull(DownloadPolicy.nextHop(server, cur, "/arx/a b"))
        assertNull(DownloadPolicy.nextHop(server, cur, "https://site.example.com\\@evil.example.com/arx/"))
        assertEquals(5, DownloadPolicy.MAX_REDIRECTS)
    }

    @Test
    fun androidPackagesAreNeverSaved() { // review L9
        assertTrue(DownloadPolicy.refused("update.apk", "application/octet-stream"))
        assertTrue(DownloadPolicy.refused("Update.APK", null))
        assertTrue(DownloadPolicy.refused("bundle.apks", null))
        assertTrue(DownloadPolicy.refused("x.bin", "application/vnd.android.package-archive"))
        assertTrue(DownloadPolicy.refused("x", "application/vnd.android.package-archive; charset=binary"))
        assertFalse(DownloadPolicy.refused("export-2026-09-29.zip", "application/zip"))
        assertFalse(DownloadPolicy.refused("audit.csv", "text/csv"))
        assertFalse(DownloadPolicy.refused(null, null))
    }

    @Test
    fun everythingElseOnTheWebGoesToTheBrowser() {
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/lovelace/0"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/hikvision-intercom?embed=1"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/arxx/"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com:8443/arx/"))
        assertEquals(Decision.EXTERNAL, main("https://other.example.com/arx/"))
        assertEquals(Decision.EXTERNAL, main("http://site.example.com/arx/"))
        assertEquals(Decision.EXTERNAL, main("https://team.cloudflareaccess.com/cdn-cgi/access/login"))
        assertEquals(Decision.EXTERNAL, main("mailto:support@example.com"))
        assertEquals(Decision.EXTERNAL, main("tel:+972000000000"))
    }

    @Test
    fun encodedDotSegmentsAreNeverInScope() { // M2 applied to shouldOverrideUrlLoading
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/arx/%2e%2e/"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/arx/%2E%2E/lovelace/0"))
        assertEquals(Decision.EXTERNAL, main("https://site.example.com/arx/.%2e/hassio"))
        assertFalse(NavPolicy.inScope(server, "https://site.example.com/arx/%2e%2e/config"))
    }

    @Test
    fun dangerousSchemesAreDropped() {
        assertEquals(Decision.BLOCK, main("javascript:alert(1)"))
        assertEquals(Decision.BLOCK, main("intent://scan/#Intent;scheme=zxing;package=x;end"))
        assertEquals(Decision.BLOCK, main("file:///sdcard/Download/x.html"))
        assertEquals(Decision.BLOCK, main("content://com.example.provider/x"))
        assertEquals(Decision.BLOCK, main("data:text/html,<script>alert(1)</script>"))
        assertEquals(Decision.BLOCK, main("about:blank"))
        assertEquals(Decision.BLOCK, main("market://details?id=x"))
        assertEquals(Decision.BLOCK, main(""))
        assertEquals(Decision.BLOCK, main("//site.example.com/arx/"))
    }

    @Test
    fun appLinksOnlyFromTheMainFrame() {
        assertEquals(Decision.APP_LINK, main("arx://servers"))
        assertEquals(Decision.APP_LINK, main("ARX://open?url=https%3A%2F%2Fsite.example.com%2Farx%2F"))
        assertEquals(Decision.BLOCK, sub("arx://servers"))
    }

    @Test
    fun subframesFollowThePagesOwnPolicy() {
        assertEquals(Decision.IN_APP, sub("https://site.example.com/hikvision-intercom?embed=1"))
        assertEquals(Decision.IN_APP, sub("about:srcdoc"))
        assertEquals(Decision.IN_APP, sub("blob:https://site.example.com/1234"))
        assertEquals(Decision.BLOCK, sub("intent://x#Intent;end"))
        assertEquals(Decision.BLOCK, sub("javascript:alert(1)"))
        assertEquals(Decision.BLOCK, sub("file:///etc/hosts"))
    }

    @Test
    fun aDebugBuildMayUseLoopbackOverHttp() {
        val dev = "http://127.0.0.1:8099/arx/"
        assertEquals(Decision.IN_APP, NavPolicy.decide(dev, "http://127.0.0.1:8099/arx/#/live", true, allowDevHttp = true))
        assertEquals(Decision.EXTERNAL, NavPolicy.decide(dev, "http://127.0.0.1:8099/", true, allowDevHttp = true))
        // without the debug switch the stored http server is not a server at all: nothing is in scope
        assertEquals(Decision.EXTERNAL, NavPolicy.decide(dev, "http://127.0.0.1:8099/arx/", true, allowDevHttp = false))
    }

    @Test
    fun theBridgeAnswersOnlyTheServersMainFrame() {
        val origin = "https://site.example.com"
        assertTrue(BridgePolicy.accept(origin, "https://site.example.com", true))
        assertTrue(BridgePolicy.accept(origin, "https://SITE.example.com:443/", true))
        assertFalse(BridgePolicy.accept(origin, "https://site.example.com", false)) // the WisKey frame, same origin
        assertFalse(BridgePolicy.accept(origin, "https://evil.example.com", true))
        assertFalse(BridgePolicy.accept(origin, "https://site.example.com.evil.example", true))
        assertFalse(BridgePolicy.accept(origin, "https://site.example.com:8443", true))
        assertFalse(BridgePolicy.accept(origin, "http://site.example.com", true))
        assertFalse(BridgePolicy.accept(origin, "null", true))
        assertFalse(BridgePolicy.accept(origin, "", true))
        assertFalse(BridgePolicy.accept(origin, null, true))
        assertFalse(BridgePolicy.accept(origin, "https://site.example.com/arx/", true)) // an origin has no path
        assertFalse(BridgePolicy.accept("not an origin", "not an origin", true))
    }

    @Test
    fun theBridgeAlsoNeedsTheShownPageToBeAnArxPage() { // review M1: the origin also serves the platform's UI at /
        val origin = "https://site.example.com"
        assertTrue(BridgePolicy.accept(server, origin, origin, true, "https://site.example.com/arx/#/live"))
        assertFalse(BridgePolicy.accept(server, origin, origin, true, "https://site.example.com/"))
        assertFalse(BridgePolicy.accept(server, origin, origin, true, "https://site.example.com/hikvision-intercom"))
        assertFalse(BridgePolicy.accept(server, origin, origin, true, null))
        assertFalse(BridgePolicy.accept(server, origin, origin, false, "https://site.example.com/arx/"))
        assertFalse(BridgePolicy.accept(server, origin, "https://evil.example.com", true, "https://site.example.com/arx/"))
    }

    @Test
    fun canonicalOrigins() {
        assertEquals("https://site.example.com", BridgePolicy.canonicalOrigin("https://SITE.example.com:443/"))
        assertEquals("https://site.example.com:8443", BridgePolicy.canonicalOrigin("https://site.example.com:8443"))
        assertNull(BridgePolicy.canonicalOrigin("file://"))
        assertNull(BridgePolicy.canonicalOrigin("https://user@site.example.com"))
    }

    @Test
    fun onlyTheMicrophoneAndOnlyForTheServer() {
        val origin = "https://site.example.com"
        val audio = PermissionPolicy.AUDIO_CAPTURE
        val video = "android.webkit.resource.VIDEO_CAPTURE"
        val midi = "android.webkit.resource.MIDI_SYSEX"
        val drm = "android.webkit.resource.PROTECTED_MEDIA_ID"
        assertEquals(listOf(audio), PermissionPolicy.grantable(origin, "https://site.example.com/", arrayOf(audio)))
        assertEquals(listOf(audio), PermissionPolicy.grantable(origin, "https://site.example.com/", arrayOf(audio, video)))
        assertEquals(emptyList<String>(), PermissionPolicy.grantable(origin, "https://site.example.com/", arrayOf(video)))
        assertEquals(emptyList<String>(), PermissionPolicy.grantable(origin, "https://site.example.com/", arrayOf(midi, drm)))
        assertEquals(emptyList<String>(), PermissionPolicy.grantable(origin, "https://evil.example.com/", arrayOf(audio)))
        assertEquals(emptyList<String>(), PermissionPolicy.grantable(origin, null, arrayOf(audio)))
        assertEquals("android.webkit.resource.AUDIO_CAPTURE", android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE)
    }
}
