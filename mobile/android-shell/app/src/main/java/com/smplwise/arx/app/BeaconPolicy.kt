package com.smplwise.arx.app

import java.nio.ByteBuffer
import java.util.UUID

object BeaconPolicy {
    fun uuid(bytes: ByteArray): String? {
        if (bytes.size < 23 || bytes[0] != 0x02.toByte() || bytes[1] != 0x15.toByte()) return null
        val b = ByteBuffer.wrap(bytes, 2, 16)
        return UUID(b.long, b.long).toString()
    }
    fun filterData(uuid: String): ByteArray? = try {
        val id = UUID.fromString(uuid)
        ByteBuffer.allocate(18).put(0x02).put(0x15).putLong(id.mostSignificantBits).putLong(id.leastSignificantBits).array()
    } catch (_: Exception) { null }
    fun proximity(rssi: Int) = when { rssi >= -55 -> "immediate"; rssi >= -75 -> "near"; else -> "far" }
}
