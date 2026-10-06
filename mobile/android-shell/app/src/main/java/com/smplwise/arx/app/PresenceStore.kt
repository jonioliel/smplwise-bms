package com.smplwise.arx.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Tokens and the bounded offline queue are encrypted with a non-exportable Android Keystore key. */
class PresenceStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("arx_presence_encrypted", Context.MODE_PRIVATE)
    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey("arx_presence_v1", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("arx_presence_v1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun get(id: String): JSONObject = synchronized(lock) {
        val raw = prefs.getString(id, null) ?: return@synchronized JSONObject()
        try {
            val parts = raw.split(":")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
            JSONObject(String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8))
        } catch (_: Exception) { JSONObject() } // Key invalidated: require registration, never recover plaintext.
    }
    fun update(id: String, block: (JSONObject) -> Unit): JSONObject = synchronized(lock) {
        val value = get(id); block(value)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val raw = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.toString().toByteArray()), Base64.NO_WRAP)
        check(prefs.edit().putString(id, raw).commit())
        value
    }
    fun forget(id: String) = synchronized(lock) { prefs.edit().remove(id).commit() }
    fun invalidate(id: String) = update(id) { o ->
        listOf("device_token", "device_id", "config", "ack", "queue", "relay_registered", "relay_server_id").forEach(o::remove)
        o.put("signed_in", false)
    }
    companion object { private val lock = Any() }
}
fun JSONArray.strings(): Set<String> = (0 until length()).mapNotNull { optString(it).takeIf(String::isNotBlank) }.toSet()
fun JSONObject.stringSet(key: String): Set<String> = optJSONArray(key)?.strings() ?: emptySet()
