package com.smplwise.arx.app

import com.smplwise.arx.app.DeepLinks.Link
import com.smplwise.arx.app.DeepLinks.Route
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** `arx://servers` and `arx://open?url=` (stored servers only; an unknown one is only offered, with its full address). */
class DeepLinksTest {
    private val servers = listOf("https://office.example.com/arx/", "https://home.example.com:8443/remote/")

    @Test
    fun parsesTheAppsTwoLinks() {
        assertEquals(Link.Servers, DeepLinks.parse("arx://servers"))
        assertEquals(Link.Servers, DeepLinks.parse("ARX://Servers"))
        assertEquals(
            Link.Open("https://office.example.com/arx/#/live"),
            DeepLinks.parse("arx://open?url=https%3A%2F%2Foffice.example.com%2Farx%2F%23%2Flive"),
        )
        assertEquals(Link.Unknown, DeepLinks.parse("arx://open"))
        assertEquals(Link.Unknown, DeepLinks.parse("arx://settings"))
        assertEquals(Link.Unknown, DeepLinks.parse("https://office.example.com/arx/"))
        assertEquals(Link.Unknown, DeepLinks.parse("arx://open?url=%zz"))
    }

    @Test
    fun anUnencodedRouteIsGivenBackToTheTarget() {
        assertEquals(
            Link.Open("https://office.example.com/arx/#/investigate/events/ev1"),
            DeepLinks.parse("arx://open?url=https://office.example.com/arx/#/investigate/events/ev1"),
        )
        // a target that already carries its own (encoded) route keeps it
        assertEquals(
            Link.Open("https://office.example.com/arx/#/a"),
            DeepLinks.parse("arx://open?url=https%3A%2F%2Foffice.example.com%2Farx%2F%23%2Fa#/b"),
        )
        // `+` is legal in a URL and is not turned into a space
        assertEquals(
            Link.Open("https://office.example.com/arx/?q=a+b"),
            DeepLinks.parse("arx://open?url=https://office.example.com/arx/?q=a+b"),
        )
        assertEquals("a+b", DeepLinks.queryParam("x=1&url=a+b", "url"))
        assertEquals("a b", DeepLinks.queryParam("url=a%20b", "url"))
    }

    @Test
    fun aLinkOnAStoredServerOpensRebuilt() {
        assertEquals(
            Route.Open("https://office.example.com/arx/", "https://office.example.com/arx/#/live"),
            DeepLinks.route("https://OFFICE.example.com:443/arx/#/live", servers),
        )
        assertEquals(
            Route.Open("https://home.example.com:8443/remote/", "https://home.example.com:8443/remote/?x=1"),
            DeepLinks.route("https://home.example.com:8443/remote/?x=1", servers),
        )
    }

    @Test
    fun aLinkToAnotherServerIsOnlyOfferedWithItsFullAddress() {
        assertEquals(
            Route.Offer("https://evil.example.com/arx/", "https://evil.example.com/arx/#/live"),
            DeepLinks.route("https://evil.example.com/arx/#/live", servers),
        )
        // the same host outside the stored path is another server, not this one (the add dialog then asks the site for
        // its real remote_path and corrects the guessed one)
        assertEquals(
            Route.Offer("https://office.example.com/other/x/", "https://office.example.com/other/x"),
            DeepLinks.route("https://office.example.com/other/x", servers),
        )
        // an escape attempt through an encoded dot segment is neither opened nor offered
        assertEquals(Route.Invalid, DeepLinks.route("https://office.example.com/arx/%2e%2e/lovelace", servers))
    }

    @Test
    fun onlyTheEntryPageWithItsRouteOpens() { // review L3
        assertEquals(
            Route.Open("https://office.example.com/arx/", "https://office.example.com/arx/?design=a#/investigate/events/ev1"),
            DeepLinks.route("https://office.example.com/arx/?design=a#/investigate/events/ev1", servers),
        )
        assertEquals(
            Route.Open("https://office.example.com/arx/", "https://office.example.com/arx/"),
            DeepLinks.route("https://office.example.com/arx", servers),
        )
        for (deeper in listOf(
            "https://office.example.com/arx/api/v1/exports/e1/download",
            "https://office.example.com/arx/index.html",
            "https://office.example.com/arx/assets/x.js",
            "https://office.example.com/arx/api/v1/auth/session",
        )) {
            assertEquals(deeper, Route.Invalid, DeepLinks.route(deeper, servers))
        }
    }

    @Test
    fun hostileTargetsAreInvalid() {
        for (bad in listOf(
            "javascript:alert(1)",
            "intent://x#Intent;end",
            "http://office.example.com/arx/",
            "https://office.example.com:443@evil.example.com/arx/",
            "https://office.example.com\\@evil.example.com/arx/",
            "file:///etc/hosts",
            "",
        )) {
            assertEquals(bad, Route.Invalid, DeepLinks.route(bad, servers))
        }
    }
    /** XSECFIX-297 M4: a link that asks the site to do something on arrival is never opened without the user's confirmation. */
    @Test
    fun linksAskingForAnActionAreDetected() {
        for (asking in listOf(
            "https://office.example.com/arx/#/devices/automations/a1?do=run",
            "https://office.example.com/arx/#/devices/scripts/s1?view=detail&do=run",
            "https://office.example.com/arx/#/devices/automations/a1?DO=run",
            "https://office.example.com/arx/#/devices/automations/a1?%64o=run",
            "https://office.example.com/arx/#/devices/automations/a1?d%6F=delete",
            "https://office.example.com/arx/?do=run#/devices/automations/a1",
            "https://office.example.com/arx/#/devices/automations/a1?x=1;do=run",
        )) {
            assertTrue(asking, DeepLinks.asksForAction(asking))
        }
        for (plain in listOf(
            "https://office.example.com/arx/",
            "https://office.example.com/arx/#/live",
            "https://office.example.com/arx/#/devices/automations/a1",
            "https://office.example.com/arx/#/devices/automations/a1?view=trace",
            "https://office.example.com/arx/#/investigate/events/ev1?done=1&undo=2",
        )) {
            assertFalse(plain, DeepLinks.asksForAction(plain))
        }
    }
}
