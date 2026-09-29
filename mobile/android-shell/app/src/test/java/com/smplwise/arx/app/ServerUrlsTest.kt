package com.smplwise.arx.app

import com.smplwise.arx.app.ServerUrls.Problem
import com.smplwise.arx.app.ServerUrls.Result
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.IDN

/** The address normaliser and link matching (from the TWA branch's tests, plus that branch's review items M1, M2, L4). */
class ServerUrlsTest {
    private fun ok(raw: String, dev: Boolean = false): Result.Ok {
        val r = ServerUrls.normalize(raw, allowDevHttp = dev)
        assertTrue("expected Ok for '$raw', got $r", r is Result.Ok)
        return r as Result.Ok
    }

    private fun problem(raw: String, dev: Boolean = false): Problem {
        val r = ServerUrls.normalize(raw, allowDevHttp = dev)
        assertTrue("expected Invalid for '$raw', got $r", r is Result.Invalid)
        return (r as Result.Invalid).problem
    }

    @Test
    fun aBareHostGetsHttpsAndTheArxPath() {
        assertEquals("https://site.example.com/arx/", ok("site.example.com").url)
        assertEquals("https://site.example.com/arx/", ok("  SITE.Example.COM  ").url)
        assertEquals("https://site.example.com/arx/", ok("https://site.example.com").url)
        assertEquals("https://site.example.com/arx/", ok("https://site.example.com/").url)
        assertEquals("https://site.example.com/arx/", ok("HTTPS://site.example.com").url)
        assertEquals("https://site.example.com/arx/", ok("//site.example.com").url)
        assertEquals("https://site.example.com/arx/", ok("site.example.com.").url)
    }

    @Test
    fun aFullAddressKeepsItsPathAndLosesTheRest() {
        assertEquals("https://site.example.com/arx/", ok("https://site.example.com/arx").url)
        assertEquals("https://site.example.com/arx/", ok("https://site.example.com/arx/#/live/cameras").url)
        assertEquals("https://site.example.com/arx/", ok("https://site.example.com/arx/?design=a#/x").url)
        assertEquals("https://site.example.com/arx/", ok("https://site.example.com/arx/index.html").url)
        assertEquals("https://site.example.com/arx/", ok("https://site.example.com/arx/api/v1/auth/remote-config").url)
        assertEquals("https://site.example.com/remote/", ok("site.example.com/remote").url)
        assertEquals("https://site.example.com/a/b/", ok("https://site.example.com//a//b").url)
    }

    @Test
    fun originAndPort() {
        val r = ok("https://site.example.com:8443/arx/")
        assertEquals("https://site.example.com:8443/arx/", r.url)
        assertEquals("https://site.example.com:8443", r.origin)
        assertEquals("https://site.example.com:8443/arx/", ok("site.example.com:8443/arx").url)
        assertEquals("https://site.example.com", ok("https://site.example.com:443/arx/").origin)
        assertEquals("site.example.com", ok("site.example.com").host)
        assertEquals("https://203.0.113.7/arx/", ok("203.0.113.7").url) // TEST-NET-3 documentation address
    }

    @Test
    fun httpsOnlyAndNoCredentials() {
        assertEquals(Problem.NOT_HTTPS, problem("ws://site.example.com/arx/"))
        assertEquals(Problem.NOT_HTTPS, problem("ftp://site.example.com"))
        assertEquals(Problem.NOT_HTTPS, problem("javascript://site.example.com"))
        assertEquals(Problem.CREDENTIALS, problem("https://user:pass@site.example.com/arx/"))
        assertEquals(Problem.CREDENTIALS, problem("user@site.example.com"))
    }

    @Test
    fun hostileInputsFromTheReview() { // L4
        assertEquals(Problem.NOT_HTTPS, problem("javascript:alert(1)"))
        assertEquals(Problem.NOT_HTTPS, problem("JavaScript:alert(document.cookie)"))
        assertEquals(Problem.NOT_HTTPS, problem("intent://scan/#Intent;scheme=zxing;end"))
        assertEquals(Problem.NOT_HTTPS, problem("mailto:someone@example.com"))
        assertEquals(Problem.NOT_HTTPS, problem("data:text/html,hi"))
        assertEquals(Problem.BAD_URL, problem("https:site.example.com"))
        assertEquals(Problem.BAD_URL, problem("https://good.example.com\\@evil.example.com/"))
        assertEquals(Problem.BAD_URL, problem("https://good.example.com\\evil"))
        assertEquals(Problem.CREDENTIALS, problem("good.example.com:443@evil.example.com"))
        assertEquals(Problem.CREDENTIALS, problem("https://good.example.com:443@evil.example.com/arx/"))
        assertEquals(Problem.BAD_PORT, problem("https://site.example.com:65536/arx/"))
        assertEquals(Problem.BAD_PORT, problem("https://site.example.com:70000/arx/"))
        assertEquals(Problem.BAD_PORT, problem("https://site.example.com:99999999999/arx/"))
        assertEquals(Problem.BAD_URL, problem("https://site.example.com/%2e%2e/etc/"))
        assertEquals(Problem.BAD_URL, problem("https://site.example.com/arx/%2E%2e/"))
        assertEquals(Problem.BAD_URL, problem("https://site.example.com/%2e/"))
        assertEquals(Problem.BAD_URL, problem("https://site.example.com/arx/%zz/"))
        assertEquals(Problem.BAD_URL, problem("https://site.example.com/a\tb/"))
    }

    @Test
    fun aFragmentWithAnAtSignDoesNotChangeTheHost() {
        val r = ok("good.example.com#@evil.example.com")
        assertEquals("good.example.com", r.host)
        assertEquals("https://good.example.com/arx/", r.url)
    }

    @Test
    fun internationalisedHostsAreStoredAsPunycode() {
        val unicode = "דוגמה.example.com"
        val ascii = IDN.toASCII(unicode)
        assertTrue(ascii.startsWith("xn--"))
        assertEquals("https://$ascii/arx/", ok(unicode).url)
        assertEquals("https://$ascii/arx/", ok("https://$unicode/arx/#/live").url)
        assertEquals("https://$ascii/arx/", ok(ascii).url) // punycode as typed stays as it is
        assertEquals("https://xn--4dbrk0ce.example.com/arx/", ok("https://XN--4dbrk0ce.example.com").url)
    }

    @Test
    fun badInput() {
        assertEquals(Problem.EMPTY, problem(""))
        assertEquals(Problem.EMPTY, problem("   "))
        assertEquals(Problem.BAD_URL, problem("site example.com"))
        assertEquals(Problem.BAD_HOST, problem("localhost"))
        assertEquals(Problem.BAD_HOST, problem("https://-bad-.example.com"))
        assertEquals(Problem.BAD_HOST, problem("https://site_1.example.com"))
        assertEquals(Problem.BAD_HOST, problem("1.2.3"))
        assertEquals(Problem.BAD_PORT, problem("https://site.example.com:0/arx/"))
        assertEquals(Problem.BAD_URL, problem("https://site.example.com/arx/../etc/"))
        assertEquals(Problem.BAD_URL, problem("https://site.example.com/a<b>/"))
    }

    @Test
    fun httpAsTypedIsUpgradedToHttps() { // owner 2026-09-29: he typed http://host/arx
        assertEquals("https://site.example.com/arx/", ok("http://site.example.com/arx").url)
        assertEquals("https://site.example.com/arx/", ok("HTTP://site.example.com").url)
        assertEquals("https://site.example.com/arx/", ok("http://site.example.com/").url)
        assertEquals("https://site.example.com/arx/", ok("http://site.example.com:80/arx/").url)
        assertEquals("https://site.example.com:8080/arx/", ok("http://site.example.com:8080/arx/").url)
        assertEquals("https://site.example.com", ok("http://site.example.com/arx/#/live").origin)
        assertEquals("https://site.example.com/arx/", ok("site.example.com/arx").url)
        assertEquals("https://site.example.com/arx/", ok("site.example.com/arx/").url)
        assertEquals(Problem.CREDENTIALS, problem("http://user:pw@site.example.com/arx/"))
        for (other in listOf("ftp://site.example.com", "ws://site.example.com", "file:///etc/hosts", "smb://site.example.com/arx")) {
            assertEquals(other, Problem.NOT_HTTPS, problem(other))
        }
    }

    @Test
    fun anAddressWithoutAPathIsTriedAtArxThenAtTheRoot() {
        val both = listOf("https://site.example.com/arx/", "https://site.example.com/")
        assertEquals(both, ServerUrls.candidates("site.example.com"))
        assertEquals(both, ServerUrls.candidates("http://site.example.com/"))
        assertEquals(both, ServerUrls.candidates("https://site.example.com#/live"))
        assertEquals(listOf("https://site.example.com/arx/"), ServerUrls.candidates("site.example.com/arx"))
        assertEquals(listOf("https://site.example.com/arx/"), ServerUrls.candidates("http://site.example.com/arx/#/live"))
        assertEquals(listOf("https://site.example.com/remote/"), ServerUrls.candidates("site.example.com/remote"))
        assertEquals(emptyList<String>(), ServerUrls.candidates("ftp://site.example.com"))
        assertEquals(emptyList<String>(), ServerUrls.candidates(""))
    }

    @Test
    fun plainHttpOnlyInDebugAndOnlyToLoopback() {
        assertEquals("https://127.0.0.1:8099/arx/", ok("http://127.0.0.1:8099/arx/").url) // release: upgraded
        val dev = ok("http://127.0.0.1:8099/arx/", dev = true)
        assertEquals("http://127.0.0.1:8099/arx/", dev.url)
        assertEquals("http://127.0.0.1:8099", dev.origin)
        assertEquals("http://127.0.0.1/arx/", ok("http://127.0.0.1:80/arx/", dev = true).url)
        assertEquals("https://site.example.com/arx/", ok("http://site.example.com/arx/", dev = true).url)
        assertEquals("https://192.0.2.10/arx/", ok("http://192.0.2.10/arx/", dev = true).url)
        assertEquals("https://site.example.com/arx/", ok("site.example.com", dev = true).url) // https stays the default
    }

    @Test
    fun belongsToOnlyTheSameOriginUnderTheServerPath() {
        val server = "https://site.example.com/arx/"
        assertTrue(ServerUrls.belongsTo(server, "https://site.example.com/arx/"))
        assertTrue(ServerUrls.belongsTo(server, "https://site.example.com/arx"))
        assertTrue(ServerUrls.belongsTo(server, "https://site.example.com/arx/#/investigate/events/ev1"))
        assertTrue(ServerUrls.belongsTo(server, "https://SITE.example.com:443/arx/?x=1"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/arxx/"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/lovelace/0"))
        assertFalse(ServerUrls.belongsTo(server, "http://site.example.com/arx/"))
        assertFalse(ServerUrls.belongsTo(server, "https://evil.example.com/arx/"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com.evil.example/arx/"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com:8443/arx/"))
        assertFalse(ServerUrls.belongsTo(server, "https://user@site.example.com/arx/"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com:443@evil.example.com/arx/"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com\\@evil.example.com/arx/"))
        assertFalse(ServerUrls.belongsTo(server, "javascript:alert(1)"))
        assertFalse(ServerUrls.belongsTo(server, "intent://site.example.com/arx/#Intent;end"))
        assertFalse(ServerUrls.belongsTo(server, "not a url"))
    }

    @Test
    fun encodedDotSegmentsNeverEscapeTheServerPath() { // M2
        val server = "https://site.example.com/arx/"
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/arx/%2e%2e/lovelace/0"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/arx/%2E%2E/"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/arx/.%2e/config"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/arx/%2e/x"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/arx/../hassio"))
        assertFalse(ServerUrls.belongsTo(server, "https://site.example.com/arx/%zz"))
        assertTrue(ServerUrls.belongsTo(server, "https://site.example.com/arx/files/a%2eb.pdf")) // a dot inside a name is fine
    }

    @Test
    fun aMatchingLinkIsRebuiltFromItsPartsOnTheServerOrigin() { // M1
        val server = "https://site.example.com/arx/"
        assertEquals(
            "https://site.example.com/arx/?x=1",
            ServerUrls.resolveOnServer(server, "https://SITE.example.com:443/arx/?x=1"),
        )
        assertEquals(
            "https://site.example.com/arx/?design=a#/investigate/events/ev1",
            ServerUrls.resolveOnServer(server, "https://site.example.com./arx/?design=a#/investigate/events/ev1"),
        )
        assertEquals("https://site.example.com/arx/", ServerUrls.resolveOnServer(server, "https://site.example.com/arx"))
        assertEquals(
            "https://site.example.com/arx/#/live?x=%20y",
            ServerUrls.resolveOnServer(server, "https://site.example.com/arx/#/live?x=%20y"),
        )
        assertNull(ServerUrls.resolveOnServer(server, "https://site.example.com/other/"))
        // the round trip: what resolveOnServer returns belongs to the server again, unchanged
        val once = ServerUrls.resolveOnServer(server, "https://SITE.Example.com:443/arx/sub/?q=1#/a")!!
        assertEquals(once, ServerUrls.resolveOnServer(server, once))
    }

    @Test
    fun launchUrlAddsTheAppParameterBeforeTheRoute() {
        assertEquals("https://site.example.com/arx/?app=android", ServerUrls.launchUrl("https://site.example.com/arx/"))
        assertEquals("https://site.example.com/arx/?app=android#/live", ServerUrls.launchUrl("https://site.example.com/arx/#/live"))
        assertEquals("https://site.example.com/arx/?design=a&app=android#/x", ServerUrls.launchUrl("https://site.example.com/arx/?design=a#/x"))
        assertEquals("https://site.example.com/arx/?app=android", ServerUrls.launchUrl("https://site.example.com/arx/?app=android"))
        assertEquals("https://site.example.com/arx/?app=android", ServerUrls.launchUrl("https://site.example.com/arx/?"))
    }

    @Test
    fun originOf() {
        assertEquals("https://site.example.com", ServerUrls.originOf("https://site.example.com/arx/"))
        assertEquals("https://site.example.com", ServerUrls.originOf("http://site.example.com/arx/"))
        assertEquals(null, ServerUrls.originOf("ftp://site.example.com/arx/"))
    }
}
