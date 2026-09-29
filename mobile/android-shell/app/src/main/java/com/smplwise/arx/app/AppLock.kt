package com.smplwise.arx.app

import android.app.Activity
import android.app.Application
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.google.android.material.button.MaterialButton

/** Starts the app-lock bookkeeping for the whole process. */
class ArxApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppLock.register(this)
    }
}

/**
 * App lock ("נעילת האפליקציה"): when on, the app asks for the phone's fingerprint / face / screen lock on every cold
 * start and after the chosen number of minutes in the background (LockPolicy). The lock covers the whole window of
 * every activity (the server list and the site) until the phone confirms the user.
 */
object AppLock {
    const val AUTHENTICATORS = BIOMETRIC_WEAK or DEVICE_CREDENTIAL

    private var started = 0
    private var unlockedAt: Long? = null
    private var backgroundSince: Long? = null

    /**
     * Set just before the app itself opens something that covers it (the file picker, "save as", the microphone
     * permission dialog, the phone's own credential screen): leaving for those is not "the app went to the background".
     */
    var excursion = false

    fun register(app: Application) {
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStarted(activity: Activity) {
                started++
            }

            override fun onActivityStopped(activity: Activity) {
                started = (started - 1).coerceAtLeast(0)
                if (started == 0 && !activity.isChangingConfigurations && !excursion) {
                    backgroundSince = SystemClock.elapsedRealtime()
                }
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
            override fun onActivityResumed(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }

    /** Called from every activity's onResume: true when the lock must be shown now. */
    fun onForeground(store: ServerStore): Boolean {
        excursion = false
        val needed = LockPolicy.needsUnlock(
            store.lockEnabled, unlockedAt, backgroundSince, SystemClock.elapsedRealtime(), store.lockMinutes,
        )
        if (!needed) backgroundSince = null
        return needed
    }

    fun markUnlocked() {
        unlockedAt = SystemClock.elapsedRealtime()
        backgroundSince = null
    }

    fun canAuthenticate(activity: Activity): Boolean =
        BiometricManager.from(activity).canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS

    /** Shows the phone's own prompt (fingerprint, face, or the screen-lock PIN / pattern / password). */
    fun prompt(activity: AppCompatActivity, title: String, onSuccess: () -> Unit, onFailure: (String?) -> Unit) {
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                excursion = false
                markUnlocked()
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                excursion = false
                val cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON || errorCode == BiometricPrompt.ERROR_CANCELED
                onFailure(if (cancelled) null else errString.toString())
            }
        }
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setAllowedAuthenticators(AUTHENTICATORS)
            .setConfirmationRequired(false)
            .build()
        excursion = true // below Android 11 the screen-lock fallback is an activity of its own
        BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback).authenticate(info)
    }
}

/**
 * Base of the app's two screens: covers the window with the lock screen while the app is locked, and keeps the app out
 * of the recent-apps thumbnails while the lock is on (Android 13+).
 */
abstract class LockedActivity : AppCompatActivity() {
    protected lateinit var store: ServerStore
    private var cover: View? = null
    private var prompting = false
    private var lightIconsBefore: Boolean? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = ServerStore(this)
    }

    override fun onResume() {
        super.onResume()
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(!store.lockEnabled)
        if (prompting) return
        if (AppLock.onForeground(store)) showLock() else hideLock()
    }

    private fun showLock() {
        if (!AppLock.canAuthenticate(this)) {
            // No fingerprint, face or screen lock on the phone any more: the app lock cannot work; switch it off and say so.
            store.lockEnabled = false
            AppLock.markUnlocked()
            hideLock()
            com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
                .setTitle(R.string.lock_title)
                .setMessage(R.string.lock_unavailable_off)
                .setPositiveButton(R.string.ok, null)
                .show()
            return
        }
        val parent = findViewById<ViewGroup>(android.R.id.content)
        val view = cover ?: LayoutInflater.from(this).inflate(R.layout.lock_cover, parent, false).also {
            it.findViewById<MaterialButton>(R.id.unlock).setOnClickListener { ask() }
            parent.addView(it)
            cover = it
        }
        view.visibility = View.VISIBLE
        view.bringToFront()
        // the cover is light: dark status-bar icons while it shows (the screens underneath may use light ones)
        val bars = WindowCompat.getInsetsController(window, window.decorView)
        if (lightIconsBefore == null) lightIconsBefore = bars.isAppearanceLightStatusBars
        bars.isAppearanceLightStatusBars = true
        onLockChanged(true)
        ask()
    }

    private fun hideLock() {
        cover?.let {
            (it.parent as? ViewGroup)?.removeView(it)
            cover = null
            lightIconsBefore?.let { before -> WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = before }
            lightIconsBefore = null
            onLockChanged(false)
        }
    }

    private fun ask() {
        if (prompting) return
        prompting = true
        cover?.findViewById<TextView>(R.id.lockMessage)?.setText(R.string.lock_message)
        AppLock.prompt(this, getString(R.string.lock_prompt_title), onSuccess = {
            prompting = false
            hideLock()
        }, onFailure = { message ->
            prompting = false
            if (message != null) cover?.findViewById<TextView>(R.id.lockMessage)?.text = message
        })
    }

    /** The site pauses its media while locked. */
    protected open fun onLockChanged(locked: Boolean) = Unit
}
