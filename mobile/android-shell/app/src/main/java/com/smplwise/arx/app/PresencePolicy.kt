package com.smplwise.arx.app

import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

object PresencePolicy {
    val sensors = listOf("location", "activity", "steps", "altitude", "battery", "network", "beacon", "app_state")
    const val MAX_EVENTS = 200
    const val MAX_AGE_S = 86400L
    fun active(enabled: Boolean, ack: Int, version: Int, allowed: Set<String>, selected: Set<String>, permitted: Set<String>): Set<String> =
        if (!enabled || ack < version) emptySet() else allowed.intersect(selected).intersect(permitted).intersect(sensors.toSet())
    fun nameValid(name: String) = name.trim().codePointCount(0, name.trim().length) in 2..40
    fun hashSsid(salt: String, ssid: String): String = MessageDigest.getInstance("SHA-256").digest((salt + ssid).toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    fun validId(id: String) = Regex("^[A-Za-z0-9_-]{1,128}$").matches(id)
    fun fresh(at: String, now: Instant = Instant.now()): Boolean = try {
        val age = now.epochSecond - Instant.parse(at).epochSecond
        age in 0..MAX_AGE_S
    } catch (_: Exception) { false }
    fun eventId() = UUID.randomUUID().toString()
}
