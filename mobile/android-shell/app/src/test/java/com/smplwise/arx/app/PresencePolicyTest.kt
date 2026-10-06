package com.smplwise.arx.app

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PresencePolicyTest {
    private val all = PresencePolicy.sensors.toSet()
    @Test fun masterAndNoticeAlwaysOverrideUserAndPermission() {
        assertTrue(PresencePolicy.active(false, 2, 2, all, all, all).isEmpty())
        assertTrue(PresencePolicy.active(true, 1, 2, all, all, all).isEmpty())
        assertEquals(setOf("battery"), PresencePolicy.active(true, 2, 2, all, setOf("battery", "location"), setOf("battery")))
    }
    @Test fun defaultsAndRemovedAllowedSensorsNeverReport() {
        assertTrue(PresencePolicy.active(true, 1, 1, all, emptySet(), all).isEmpty())
        assertEquals(setOf("steps"), PresencePolicy.active(true, 1, 1, setOf("steps"), all, all))
    }
    @Test fun wifiHashUsesUtf8AndDifferentServerSalts() {
        assertEquals("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb", PresencePolicy.hashSsid("", "a"))
        assertNotEquals(PresencePolicy.hashSsid("one", "משרד"), PresencePolicy.hashSsid("two", "משרד"))
    }
    @Test fun queueAndPushRejectExpiredOrFutureDates() {
        val now = Instant.parse("2026-10-05T12:00:00Z")
        assertTrue(PresencePolicy.fresh("2026-10-05T11:59:59Z", now))
        assertFalse(PresencePolicy.fresh("2026-10-04T11:59:59Z", now))
        assertFalse(PresencePolicy.fresh("2026-10-05T12:01:00Z", now))
        assertFalse(PresencePolicy.fresh("bad", now))
    }
    @Test fun namesAndIdsAreBoundedAndPathSafe() {
        assertTrue(PresencePolicy.nameValid("  הנייד שלי  "))
        assertFalse(PresencePolicy.nameValid("א")); assertFalse(PresencePolicy.nameValid("א".repeat(41)))
        assertTrue(PresencePolicy.validId("msg_123-abc")); assertFalse(PresencePolicy.validId("../other")); assertFalse(PresencePolicy.validId("%2F"))
    }
    @Test fun beaconParserAcceptsOnlyIBeaconAndDerivesNoDeviceIdentifier() {
        val id = "00112233-4455-6677-8899-aabbccddeeff"
        val bytes = BeaconPolicy.filterData(id)!! + byteArrayOf(0,1,0,2,-59)
        assertEquals(id, BeaconPolicy.uuid(bytes))
        assertNull(BeaconPolicy.uuid(byteArrayOf(2, 21)))
        assertNull(BeaconPolicy.filterData("bad"))
        assertEquals("near", BeaconPolicy.proximity(-65))
    }
}
