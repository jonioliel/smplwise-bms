package com.smplwise.arx.app

import android.app.Activity
import android.app.Application
import android.app.Dialog
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
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
    private var backgroundViaExcursion = false

    /** The lock cover is up somewhere in the app; only a successful authentication (markUnlocked) clears it. */
    var showing = false

    /**
     * Set just before the app itself opens something that covers it (the file picker, "save as", the microphone
     * permission dialog, the phone's own credential screen). The time away is recorded all the same; the excursion only
     * waives LockPolicy.EXCURSION_GRACE_MS of it, and the flag is cleared when the app is back in front.
     */
    var excursion = false

    fun register(app: Application) {
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStarted(activity: Activity) {
                started++
            }

            override fun onActivityStopped(activity: Activity) {
                started = (started - 1).coerceAtLeast(0)
                if (started == 0 && !activity.isChangingConfigurations) {
                    backgroundSince = SystemClock.elapsedRealtime()
                    backgroundViaExcursion = excursion
                }
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
            override fun onActivityResumed(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }

    /** Would the lock show if the app came to the front now? No side effects (used before onResume has run). */
    fun isDue(store: ServerStore): Boolean = LockPolicy.needsUnlock(
        store.lockEnabled, unlockedAt, backgroundSince, SystemClock.elapsedRealtime(), store.lockMinutes, backgroundViaExcursion, showing,
    )

    /** Called from every activity's onResume: true when the lock must be shown now. */
    fun onForeground(store: ServerStore): Boolean {
        val needed = isDue(store)
        excursion = false
        if (!needed) {
            backgroundSince = null
            backgroundViaExcursion = false
        }
        return needed
    }

    fun markUnlocked() {
        showing = false
        unlockedAt = SystemClock.elapsedRealtime()
        backgroundSince = null
        backgroundViaExcursion = false
    }

    fun authState(activity: Activity): LockPolicy.AuthState {
        val status = BiometricManager.from(activity).canAuthenticate(AUTHENTICATORS)
        return LockPolicy.onAuthState(
            status == BiometricManager.BIOMETRIC_SUCCESS,
            status == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED,
        )
    }

    fun canAuthenticate(activity: Activity): Boolean = authState(activity) == LockPolicy.AuthState.PROMPT

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
 * Base of the app's two screens: covers the window with the lock screen while the app is locked, keeps the app's
 * content out of the recent-apps thumbnails while the lock is on (Android 13+: no thumbnail; older: FLAG_SECURE), and
 * keeps every other interaction away while locked: dialogs are dismissed and new ones wait for the unlock, Back only
 * moves the app to the background (security review M3, M4).
 */
abstract class LockedActivity : AppCompatActivity() {
    protected lateinit var store: ServerStore
    private var cover: View? = null
    private var prompting = false
    private var lightIconsBefore: Boolean? = null
    private val dialogs = mutableListOf<Dialog>()
    private val afterUnlock = mutableListOf<() -> Unit>()
    private var lockedBack: OnBackPressedCallback? = null

    /** True while the lock cover is up. */
    protected val locked: Boolean get() = cover != null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = ServerStore(this)
    }

    override fun onResume() {
        super.onResume()
        if (Build.VERSION.SDK_INT >= 33) {
            setRecentsScreenshotEnabled(!store.lockEnabled)
        } else if (store.lockEnabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        if (prompting) return
        if (AppLock.onForeground(store)) showLock() else hideLock()
    }

    /** A dialog that must not stay above the lock cover: dismissed when the lock shows. */
    protected fun <T : Dialog> track(dialog: T): T {
        dialogs += dialog
        dialog.setOnDismissListener { dialogs.remove(dialog) }
        return dialog
    }

    /** Runs [action] now, or - when the app is locked or about to lock - right after the unlock. */
    protected fun whenUnlocked(action: () -> Unit) {
        if (locked || AppLock.isDue(store)) afterUnlock += action else action()
    }

    private fun showLock() {
        when (AppLock.authState(this)) {
            LockPolicy.AuthState.SWITCH_OFF -> {
                // No fingerprint, face or screen lock on the phone any more: the lock cannot work; switch it off, say so.
                store.lockEnabled = false
                AppLock.markUnlocked()
                hideLock()
                track(
                    com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
                        .setTitle(R.string.lock_title)
                        .setMessage(R.string.lock_unavailable_off)
                        .setPositiveButton(R.string.ok, null)
                        .show(),
                )
                return
            }
            else -> Unit // PROMPT, or STAY_LOCKED: the cover stays and "פתיחה" tries again
        }
        AppLock.showing = true
        dialogs.toList().forEach { it.dismiss() }
        dialogs.clear()
        val parent = findViewById<ViewGroup>(android.R.id.content)
        val view = cover ?: LayoutInflater.from(this).inflate(R.layout.lock_cover, parent, false).also {
            it.findViewById<MaterialButton>(R.id.unlock).setOnClickListener { ask() }
            parent.addView(it)
            cover = it
        }
        view.visibility = View.VISIBLE
        view.bringToFront()
        if (lockedBack == null) {
            // added last, so it wins over the screen's own Back handling while locked
            lockedBack = object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    moveTaskToBack(true)
                }
            }.also { onBackPressedDispatcher.addCallback(this, it) }
        }
        // the cover is light: dark status-bar icons while it shows (the screens underneath may use light ones)
        val bars = WindowCompat.getInsetsController(window, window.decorView)
        if (lightIconsBefore == null) lightIconsBefore = bars.isAppearanceLightStatusBars
        bars.isAppearanceLightStatusBars = true
        onLockChanged(true)
        if (AppLock.authState(this) == LockPolicy.AuthState.PROMPT) {
            ask()
        } else {
            view.findViewById<TextView>(R.id.lockMessage)?.setText(R.string.lock_try_again)
        }
    }

    private fun hideLock() {
        cover?.let {
            (it.parent as? ViewGroup)?.removeView(it)
            cover = null
            lockedBack?.remove()
            lockedBack = null
            lightIconsBefore?.let { before -> WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = before }
            lightIconsBefore = null
            onLockChanged(false)
        }
        if (afterUnlock.isNotEmpty()) {
            val actions = afterUnlock.toList()
            afterUnlock.clear()
            window.decorView.post { actions.forEach { it() } }
        }
    }

    private fun ask() {
        if (prompting) return
        if (AppLock.authState(this) != LockPolicy.AuthState.PROMPT) {
            cover?.findViewById<TextView>(R.id.lockMessage)?.setText(R.string.lock_try_again)
            return
        }
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

    /** The site pauses its media and microphone while locked. */
    protected open fun onLockChanged(locked: Boolean) = Unit
}
