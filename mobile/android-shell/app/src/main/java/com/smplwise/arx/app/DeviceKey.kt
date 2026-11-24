package com.smplwise.arx.app

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * The rules of the phone key (MFA-DEVICEKEY-2490; server: services/device_keys.py), pure Kotlin so they are unit-tested on the JVM.
 *
 * The server hands the page a payload `arx-device-key|v1|<purpose>|<origin>|<user or ->|<key id or ->|<action or ->|<nonce>`; the page
 * asks the app to sign it. The app signs only a payload made for ITS OWN server's origin (a page cannot get a signature for another
 * site), with a known purpose, and - except a registration - naming the app's own key for that server.
 */
object DeviceKeyPolicy {
    const val PREFIX = "arx-device-key"
    const val VERSION = "v1"
    const val AUTH_BIOMETRIC = "biometric"
    const val AUTH_ANY = "biometric_or_screen_lock" // owner q23 b: a fingerprint / face OR the phone's screen code (the default)
    val PURPOSES = setOf("register", "step_up", "sign_in")
    const val MAX_PAYLOAD = 400
    const val MAX_PROMPT_TEXT = 120

    private val keyIdRe = Regex("^dk_[0-9a-f]{24}$")
    private val nonceRe = Regex("^dkn_[A-Za-z0-9_-]{40,60}$")
    private val actionRe = Regex("^[a-z][a-z0-9_.]{0,63}$")

    data class Payload(val purpose: String, val origin: String, val user: String, val keyId: String, val action: String, val nonce: String)

    fun isKeyId(value: String?): Boolean = value != null && keyIdRe.matches(value)

    fun parse(text: String?): Payload? {
        if (text == null || text.length > MAX_PAYLOAD) return null
        val f = text.split("|")
        if (f.size != 8 || f[0] != PREFIX || f[1] != VERSION || f.any { it.isEmpty() }) return null
        val p = Payload(f[2], f[3], f[4], f[5], f[6], f[7])
        if (p.purpose !in PURPOSES || !nonceRe.matches(p.nonce)) return null
        if (p.keyId != "-" && !isKeyId(p.keyId)) return null
        if (p.action != "-" && !actionRe.matches(p.action)) return null
        return p
    }

    /** The payload the app may sign for [serverOrigin] with its key [ownKeyId] (null: no key registered yet), or null. */
    fun acceptable(text: String?, serverOrigin: String, ownKeyId: String?): Payload? {
        val p = parse(text) ?: return null
        val server = BridgePolicy.canonicalOrigin(serverOrigin) ?: return null
        if (BridgePolicy.canonicalOrigin(p.origin) != server) return null
        return when (p.purpose) {
            "register" -> p.takeIf { it.keyId == "-" && it.user != "-" }
            "sign_in" -> p.takeIf { ownKeyId != null && it.keyId == ownKeyId && it.user == "-" }
            else -> p.takeIf { ownKeyId != null && it.keyId == ownKeyId && it.user != "-" }
        }
    }

    /**
     * What the key can really need: a per-use key that also accepts the screen lock exists only on Android 11 (API 30) and later;
     * below that a CryptoObject prompt is biometric only, whatever was asked. The app declares this kind to the server.
     */
    fun effectiveKind(requested: String?, sdk: Int): String = if (requested != AUTH_BIOMETRIC && sdk >= 30) AUTH_ANY else AUTH_BIOMETRIC

    /** One key per server (origin), so a key of one site never signs for another. */
    fun alias(serverOrigin: String): String {
        val canonical = BridgePolicy.canonicalOrigin(serverOrigin) ?: serverOrigin
        val digest = MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8))
        return "arx_device_key_v1_" + digest.take(12).joinToString("") { "%02x".format(it) }
    }

    /** The text under the prompt's title: the page's action text, trimmed, or the generic line. */
    fun promptText(text: String?, fallback: String): String =
        text?.replace(Regex("[\\p{Cntrl}]"), " ")?.trim()?.take(MAX_PROMPT_TEXT)?.takeIf { it.isNotEmpty() } ?: fallback

    fun b64u(bytes: ByteArray): String = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
}

/**
 * The phone key itself: an EC P-256 key in the Android Keystore that signs only right after the phone confirmed its user, through
 * BiometricPrompt with a CryptoObject (design 4.4):
 * - `setUserAuthenticationRequired(true)`; API 30+: `setUserAuthenticationParameters(0, BIOMETRIC_STRONG [| DEVICE_CREDENTIAL])` - every
 *   signature needs its own confirmation; below API 30 a per-use key is biometric only;
 * - `setInvalidatedByBiometricEnrollment(true)`: a new fingerprint voids the key (threat T1); the app then says so and the user
 *   registers again;
 * - StrongBox when the phone has it, else the TEE;
 * - [create] takes an attestation challenge (the registration nonce) for slice 9 DEVICEKEY-ATTEST (owner Q52); this slice passes none.
 *
 * Only public material leaves the Keystore. The server's id of the key and the declared kind are kept in plain preferences (they
 * are not secret).
 */
object DeviceKey {
    private const val STORE = "AndroidKeyStore"
    private const val PREFS = "arx_device_keys"

    sealed class Outcome {
        data class Signed(val signature: String) : Outcome()
        data class Failed(val reason: String) : Outcome() // cancelled | invalidated | no_key | unavailable | error
    }

    private fun keyStore(): KeyStore = KeyStore.getInstance(STORE).apply { load(null) }

    fun exists(alias: String): Boolean = try {
        keyStore().containsAlias(alias)
    } catch (e: Exception) {
        false
    }

    fun canSign(activity: AppCompatActivity, kind: String): Boolean =
        BiometricManager.from(activity).canAuthenticate(authenticators(kind)) == BiometricManager.BIOMETRIC_SUCCESS

    private fun authenticators(kind: String): Int =
        if (kind == DeviceKeyPolicy.AUTH_ANY && Build.VERSION.SDK_INT >= 30) BIOMETRIC_STRONG or DEVICE_CREDENTIAL else BIOMETRIC_STRONG

    /** A new key for [alias] (any older one is deleted first). Returns the base64url SubjectPublicKeyInfo DER. */
    fun create(context: Context, alias: String, kind: String, attestationChallenge: ByteArray? = null): String {
        delete(context, alias)
        val strongBox = Build.VERSION.SDK_INT >= 28 && context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
        return try {
            generate(alias, kind, attestationChallenge, strongBox)
        } catch (e: Exception) {
            if (strongBox && (Build.VERSION.SDK_INT >= 28 && e is StrongBoxUnavailableException)) generate(alias, kind, attestationChallenge, false) else throw e
        }
    }

    private fun generate(alias: String, kind: String, attestationChallenge: ByteArray?, strongBox: Boolean): String {
        val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
            .apply {
                if (Build.VERSION.SDK_INT >= 30) {
                    val types = if (kind == DeviceKeyPolicy.AUTH_ANY) {
                        KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                    } else {
                        KeyProperties.AUTH_BIOMETRIC_STRONG
                    }
                    setUserAuthenticationParameters(0, types)
                } else {
                    @Suppress("DEPRECATION")
                    setUserAuthenticationValidityDurationSeconds(-1)
                }
                if (attestationChallenge != null) setAttestationChallenge(attestationChallenge) // slice 9 (DEVICEKEY-ATTEST)
                if (strongBox && Build.VERSION.SDK_INT >= 28) setIsStrongBoxBacked(true)
            }
            .build()
        val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, STORE)
        gen.initialize(spec)
        return DeviceKeyPolicy.b64u(gen.generateKeyPair().public.encoded)
    }

    fun delete(context: Context, alias: String) {
        try {
            keyStore().deleteEntry(alias)
        } catch (e: Exception) {
            // nothing to delete
        }
        prefs(context).edit().remove("$alias.id").remove("$alias.kind").apply()
    }

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun keyId(context: Context, alias: String): String? = prefs(context).getString("$alias.id", null)?.takeIf { DeviceKeyPolicy.isKeyId(it) }

    fun setKeyId(context: Context, alias: String, keyId: String) = prefs(context).edit().putString("$alias.id", keyId).apply()

    fun kind(context: Context, alias: String): String = prefs(context).getString("$alias.kind", null) ?: DeviceKeyPolicy.AUTH_BIOMETRIC

    fun setKind(context: Context, alias: String, kind: String) = prefs(context).edit().putString("$alias.kind", kind).apply()

    /**
     * Asks the phone to confirm its user (BiometricPrompt with the key's Signature as the CryptoObject) and signs [payload] with the
     * key the confirmation unlocked. A key voided by a new fingerprint answers `invalidated` (and is deleted).
     */
    fun sign(activity: AppCompatActivity, alias: String, payload: String, title: String, subtitle: String, negative: String, onDone: (Outcome) -> Unit) {
        val kind = kind(activity, alias)
        val signature = try {
            val key = keyStore().getKey(alias, null) as? PrivateKey ?: return onDone(Outcome.Failed("no_key"))
            Signature.getInstance("SHA256withECDSA").apply { initSign(key) }
        } catch (e: KeyPermanentlyInvalidatedException) {
            delete(activity, alias)
            return onDone(Outcome.Failed("invalidated"))
        } catch (e: Exception) {
            return onDone(Outcome.Failed("error"))
        }
        if (!canSign(activity, kind)) return onDone(Outcome.Failed("unavailable"))
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                AppLock.excursion = false
                val sig = result.cryptoObject?.signature ?: return onDone(Outcome.Failed("error"))
                val out = try {
                    sig.update(payload.toByteArray(Charsets.UTF_8))
                    Outcome.Signed(DeviceKeyPolicy.b64u(sig.sign()))
                } catch (e: Exception) {
                    Outcome.Failed("error")
                }
                onDone(out)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                AppLock.excursion = false
                val cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON || errorCode == BiometricPrompt.ERROR_CANCELED
                onDone(Outcome.Failed(if (cancelled) "cancelled" else "error"))
            }
        }
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(authenticators(kind))
            .setConfirmationRequired(true)
            .apply { if (authenticators(kind) and DEVICE_CREDENTIAL == 0) setNegativeButtonText(negative) }
            .build()
        AppLock.excursion = true // below Android 11 a credential screen is an activity of its own (kept for symmetry with AppLock)
        BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback).authenticate(info, BiometricPrompt.CryptoObject(signature))
    }
}
