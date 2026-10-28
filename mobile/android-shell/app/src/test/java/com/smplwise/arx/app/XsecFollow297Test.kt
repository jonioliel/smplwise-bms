package com.smplwise.arx.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * XSECFOLLOW-297 (follow-up d of the XSECFIX-297 review, M4 shell half): an `arx://open` link that asks the site to act (`do=`) is
 * never opened by itself, and no link loads a site behind a due app lock. The pure rules end to end (parse -> route ->
 * asksForAction, LockPolicy on a cold start) plus a source guard on the two places that apply them (ServersActivity.openLink,
 * WebActivity's first load). JVM unit tests: `./gradlew :app:testDebugUnitTest` (working directory = the app module).
 */
class XsecFollow297Test {
    private val servers = listOf("https://office.example.com/arx/", "https://home.example.com:8443/remote/")

    /** The whole path an `arx://open` link takes before ServersActivity decides whether it may open at once. */
    private fun openRouteOf(link: String): DeepLinks.Route.Open {
        val parsed = DeepLinks.parse(link)
        assertTrue(link, parsed is DeepLinks.Link.Open)
        val route = DeepLinks.route((parsed as DeepLinks.Link.Open).target, servers)
        assertTrue(link, route is DeepLinks.Route.Open)
        return route as DeepLinks.Route.Open
    }

    @Test
    fun anEncodedArxOpenLinkWithDoRunOnAStoredServerNeedsConfirmation() {
        val route = openRouteOf("arx://open?url=https%3A%2F%2Foffice.example.com%2Farx%2F%23%2Fdevices%2Fautomations%2Fa1%3Fdo%3Drun")
        assertEquals("https://office.example.com/arx/", route.serverUrl)
        assertTrue(route.url, DeepLinks.asksForAction(route.url))
    }

    @Test
    fun anUnencodedArxOpenLinkWithDoRunKeepsItsRouteAndNeedsConfirmation() {
        // the `#/...?do=run` became the arx link's own fragment; parse gives it back to the target, so the check still sees it
        val route = openRouteOf("arx://open?url=https://office.example.com/arx/#/devices/automations/a1?do=run")
        assertTrue(route.url, route.url.contains("do=run"))
        assertTrue(route.url, DeepLinks.asksForAction(route.url))
    }

    @Test
    fun anArxOpenLinkWithoutAnActionOpensWithoutConfirmation() {
        val route = openRouteOf("arx://open?url=https%3A%2F%2Foffice.example.com%2Farx%2F%23%2Fdevices%2Fautomations%2Fa1%3Fview%3Dtrace")
        assertFalse(route.url, DeepLinks.asksForAction(route.url))
    }

    @Test
    fun doVariantsAreAllTreatedAsAskingForAnAction() {
        for (asking in listOf(
            "https://office.example.com/arx/#/devices/automations/a1?do", // no value: still asks (never opened by itself)
            "https://office.example.com/arx/#/devices/automations/a1?do=",
            "https://office.example.com/arx/#/devices/automations/a1?x=1&%20do=run", // a padded key
            "https://office.example.com/arx/#/devices/automations/a1?%44%4F=run", // an encoded upper-case key
            "https://office.example.com/arx/#/devices/scripts/s1?do=copy",
            "https://office.example.com/arx/#/devices/scenes/c1?do=delete",
            "https://office.example.com/arx/#/a b?do=run", // not parseable as a URI: treated as asking
        )) {
            assertTrue(asking, DeepLinks.asksForAction(asking))
        }
    }

    @Test
    fun keysThatOnlyLookLikeDoDoNotAsk() {
        for (plain in listOf(
            "https://office.example.com/arx/#/devices/automations/a1?%2564o=run", // double-encoded: the site decodes once -> `%64o`
            "https://office.example.com/arx/#/devices/automations/a1?todo=1&dont=2&do_not=3",
            "https://office.example.com/arx/#/devices/automations/a1?view=do",
            "https://office.example.com/arx/#/do/run",
        )) {
            assertFalse(plain, DeepLinks.asksForAction(plain))
        }
    }

    @Test
    fun onAColdStartWithTheLockOnALinkWaitsForTheUnlock() {
        // a cold start (never unlocked in this process): due, so ServersActivity queues the link (pendingOpen)
        assertTrue(LockPolicy.needsUnlock(enabled = true, unlockedAt = null, backgroundSince = null, now = 5_000L, minutes = 1))
        // the lock cover is up: still due, whatever else
        assertTrue(LockPolicy.needsUnlock(enabled = true, unlockedAt = 1_000L, backgroundSince = null, now = 5_000L, minutes = 15, lockShowing = true))
        // the lock is off: nothing to wait for (an action link is still confirmed - asksForAction above)
        assertFalse(LockPolicy.needsUnlock(enabled = false, unlockedAt = null, backgroundSince = null, now = 5_000L, minutes = 1))
    }

    private fun source(name: String): String {
        val f = listOf(File("src/main/java/com/smplwise/arx/app/$name"), File("app/src/main/java/com/smplwise/arx/app/$name")).firstOrNull { it.isFile }
        assertTrue("source of $name not found from ${File(".").absolutePath}", f != null)
        return f!!.readText()
    }

    @Test
    fun serversActivityQueuesALinkWhileTheLockIsDueOrWhenItAsksForAnAction() {
        val src = source("ServersActivity.kt")
        val start = src.indexOf("private fun openLink(")
        assertTrue(start > 0)
        val body = src.substring(start, src.indexOf("\n    }\n", start))
        assertTrue(body, body.contains("AppLock.isDue(store) || DeepLinks.asksForAction(route.url)"))
        assertTrue(body, body.contains("pendingOpen = route"))
        // the action link branch comes before the one that opens at once
        assertTrue(body, body.indexOf("pendingOpen = route") < body.indexOf("open(route.serverUrl, route.url)"))
    }

    @Test
    fun theSitesFirstLoadWaitsForTheUnlock() {
        val src = source("WebActivity.kt")
        assertTrue(src.contains("whenUnlocked { if (!rendererGone && !isFinishing) webView.loadUrl(ServerUrls.launchUrl(start)) }"))
    }
}
