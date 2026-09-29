package com.smplwise.arx.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AlertDialog
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton
import com.google.android.material.materialswitch.MaterialSwitch
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.util.concurrent.Executors

/**
 * The launcher: the list of Arx servers (sites) this phone can open, and the app's own settings (auto-open, app lock).
 * Ported from the Trusted Web Activity branch's ServersActivity; a server now opens in the app's own WebView
 * (WebActivity) instead of the browser.
 *
 * - First start without servers: the list opens with the "add server" dialog.
 * - Exactly one server and "פתח אוטומטית" on (the default): the launcher opens it directly; the list is reached by a
 *   long press on the app icon (static shortcut "שרתים") or from inside the site ("החלף שרת").
 * - `arx://servers` shows the list; `arx://open?url=https://…` opens a link on a stored server, and offers to add the
 *   server when the link belongs to none (showing the full address and a warning; never adds or opens by itself).
 */
class ServersActivity : LockedActivity() {
    private lateinit var list: LinearLayout
    private lateinit var empty: TextView
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    /** Set by `arx://open` with a link on no stored server. */
    private var offer: DeepLinks.Route.Offer? = null
    private val dev = BuildConfig.ALLOW_DEV_HTTP

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        store.seedOnce(BuildConfig.DEFAULT_SERVER_URL, BuildConfig.DEFAULT_SERVER_NAME)

        // The icon tapped while the app is already running: show what is running instead of reopening the site.
        if (savedInstanceState == null && !isTaskRoot && intent?.action == Intent.ACTION_MAIN &&
            intent?.hasCategory(Intent.CATEGORY_LAUNCHER) == true
        ) {
            finish()
            return
        }
        if (savedInstanceState == null && handleIntent(intent)) return

        setContentView(R.layout.activity_servers)
        // Edge-to-edge: the blue toolbar reaches under the status bar (light icons on it); the list pads itself.
        val toolbar = findViewById<View>(R.id.toolbar)
        val barHeight = toolbar.minimumHeight // ?attr/actionBarSize
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.updatePadding(left = bars.left, right = bars.right, bottom = bars.bottom)
            // the padding is inside the minimum height: grow it, so the title stays centred in its own bar
            toolbar.updatePadding(top = bars.top)
            toolbar.minimumHeight = barHeight + bars.top
            insets
        }
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = true
        }
        list = findViewById(R.id.list)
        empty = findViewById(R.id.empty)
        findViewById<ExtendedFloatingActionButton>(R.id.add).setOnClickListener { showServerDialog(null, null) }
        findViewById<MaterialSwitch>(R.id.autoOpen).apply {
            isChecked = store.autoOpen
            setOnCheckedChangeListener { _, checked -> store.autoOpen = checked }
        }
        findViewById<TextView>(R.id.version).text = getString(R.string.version_line, BuildConfig.VERSION_NAME)
        setupLockSettings()
        render()
        if (savedInstanceState == null) {
            if (offer != null) showOffer()
            else if (store.servers().isEmpty()) showServerDialog(null, null)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (handleIntent(intent)) return
        render()
        if (offer != null) showOffer()
    }

    override fun onDestroy() {
        super.onDestroy()
        io.shutdownNow()
    }

    /** True when the intent was handled by leaving this screen (a site was opened). */
    private fun handleIntent(intent: Intent?): Boolean {
        val data = intent?.dataString
        if (data != null && data.startsWith("arx:", ignoreCase = true)) {
            return when (val link = DeepLinks.parse(data)) {
                is DeepLinks.Link.Open -> openLink(link.target)
                else -> false // "servers" (and anything unknown): show the list
            }
        }
        val servers = store.servers()
        if (intent?.action == Intent.ACTION_MAIN && servers.size == 1 && store.autoOpen) {
            open(servers[0].url, servers[0].url)
            return true
        }
        return false
    }

    private fun openLink(target: String): Boolean {
        return when (val route = DeepLinks.route(target, store.servers().map { it.url }, dev)) {
            is DeepLinks.Route.Open -> {
                open(route.serverUrl, route.url)
                true
            }
            is DeepLinks.Route.Offer -> {
                offer = route
                false
            }
            DeepLinks.Route.Invalid -> false
        }
    }

    /** A link to a server that is not in the list: show the full address and a warning; add only on request. */
    private fun showOffer() {
        val route = offer ?: return
        offer = null
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_offer, null)
        view.findViewById<TextView>(R.id.offerUrl).text = route.fullUrl
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.open_unknown_title)
            .setView(view)
            .setPositiveButton(R.string.add_server) { _, _ -> showServerDialog(null, route.serverUrl) }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun open(serverUrl: String, url: String) {
        WebActivity.open(this, serverUrl, url)
        finish()
    }

    private fun render() {
        val servers = store.servers()
        list.removeAllViews()
        empty.visibility = if (servers.isEmpty()) View.VISIBLE else View.GONE
        val inflater = LayoutInflater.from(this)
        val last = store.lastServerUrl
        servers.forEachIndexed { index, server ->
            val card = inflater.inflate(R.layout.item_server, list, false)
            card.findViewById<TextView>(R.id.name).text = server.name
            card.findViewById<TextView>(R.id.url).text = server.url
            if (servers.size > 1 && server.url == last) card.findViewById<View>(R.id.lastUsed).visibility = View.VISIBLE
            card.setOnClickListener { open(server.url, server.url) }
            card.setOnLongClickListener { showActions(it, server, index, servers.size); true }
            card.findViewById<MaterialButton>(R.id.more).setOnClickListener { showActions(it, server, index, servers.size) }
            list.addView(card)
        }
    }

    private fun showActions(anchor: View, server: Server, index: Int, count: Int) {
        PopupMenu(this, anchor).apply {
            menu.add(0, 1, 0, R.string.action_open)
            menu.add(0, 2, 1, R.string.action_edit)
            if (index > 0) menu.add(0, 3, 2, R.string.action_move_up)
            if (index < count - 1) menu.add(0, 4, 3, R.string.action_move_down)
            menu.add(0, 5, 4, R.string.action_delete)
            setOnMenuItemClickListener {
                when (it.itemId) {
                    1 -> open(server.url, server.url)
                    2 -> showServerDialog(server, null)
                    3 -> { store.move(server.id, -1); render() }
                    4 -> { store.move(server.id, +1); render() }
                    5 -> confirmDelete(server)
                }
                true
            }
        }.show()
    }

    private fun confirmDelete(server: Server) {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.delete_title)
            .setMessage(getString(R.string.delete_message, server.name))
            .setPositiveButton(R.string.action_delete) { _, _ ->
                store.delete(server.id)
                render()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    // ---- app lock ------------------------------------------------------------------------------------------------------

    private fun setupLockSettings() {
        val toggle = findViewById<MaterialSwitch>(R.id.lockSwitch)
        val minutes = findViewById<Button>(R.id.lockMinutes)
        fun refresh() {
            toggle.setOnCheckedChangeListener(null)
            toggle.isChecked = store.lockEnabled
            minutes.isEnabled = store.lockEnabled
            minutes.text = minutesLabel(store.lockMinutes)
            toggle.setOnCheckedChangeListener { _, checked -> onLockToggled(checked) { refresh() } }
        }
        minutes.setOnClickListener {
            val choices = LockPolicy.MINUTES_CHOICES
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.lock_after_title)
                .setSingleChoiceItems(choices.map { minutesLabel(it) }.toTypedArray(), choices.indexOf(store.lockMinutes)) { d, which ->
                    store.lockMinutes = choices[which]
                    d.dismiss()
                    refresh()
                }
                .setNegativeButton(R.string.cancel, null)
                .show()
        }
        refresh()
    }

    /** Switching the lock on or off both need the phone to confirm the user first. */
    private fun onLockToggled(on: Boolean, done: () -> Unit) {
        if (!AppLock.canAuthenticate(this)) {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.lock_title)
                .setMessage(R.string.lock_unavailable)
                .setPositiveButton(R.string.ok, null)
                .show()
            if (!on) store.lockEnabled = false
            done()
            return
        }
        AppLock.prompt(this, getString(if (on) R.string.lock_enable_prompt else R.string.lock_disable_prompt), onSuccess = {
            store.lockEnabled = on
            done()
        }, onFailure = { done() })
    }

    private fun minutesLabel(m: Int): String = when (m) {
        0 -> getString(R.string.lock_immediately)
        1 -> getString(R.string.lock_one_minute)
        60 -> getString(R.string.lock_one_hour)
        else -> getString(R.string.lock_minutes, m)
    }

    // ---- add / edit --------------------------------------------------------------------------------------------------

    /**
     * Add ([existing] null) or edit a server. The address is normalised and checked against the site (at most 6 s); a
     * failed check warns but never blocks - "add anyway" saves it.
     */
    private fun showServerDialog(existing: Server?, prefillUrl: String?) {
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_server, null)
        val nameLayout = view.findViewById<TextInputLayout>(R.id.nameLayout)
        val nameInput = view.findViewById<TextInputEditText>(R.id.nameInput)
        val urlLayout = view.findViewById<TextInputLayout>(R.id.urlLayout)
        val urlInput = view.findViewById<TextInputEditText>(R.id.urlInput)
        val status = view.findViewById<TextView>(R.id.status)
        nameInput.setText(existing?.name.orEmpty())
        urlInput.setText(existing?.url ?: prefillUrl.orEmpty())

        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(if (existing == null) R.string.add_server else R.string.edit_server)
            .setView(view)
            .setPositiveButton(R.string.save, null) // replaced below so a warning keeps the dialog open
            .setNegativeButton(R.string.cancel, null)
            .create()
        var warnedFor: String? = null

        fun save(url: String) {
            val host = (ServerUrls.normalize(url, allowDevHttp = dev) as? ServerUrls.Result.Ok)?.host ?: url
            val name = nameInput.text?.toString()?.trim().orEmpty().ifEmpty { host }
            if (existing == null) store.add(name, url) else store.update(existing.copy(name = name, url = url))
            render()
            dialog.dismiss()
        }

        dialog.setOnShowListener {
            val positive = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            positive.setOnClickListener {
                urlLayout.error = null
                nameLayout.error = null
                val result = ServerUrls.normalize(urlInput.text?.toString().orEmpty(), allowDevHttp = dev)
                if (result is ServerUrls.Result.Invalid) {
                    urlLayout.error = getString(problemText(result.problem))
                    return@setOnClickListener
                }
                val ok = result as ServerUrls.Result.Ok
                if (store.servers().any { it.url == ok.url && it.id != existing?.id }) {
                    urlLayout.error = getString(R.string.error_duplicate)
                    return@setOnClickListener
                }
                if (warnedFor == ok.url) { // second press after a warning: "add anyway"
                    save(ok.url)
                    return@setOnClickListener
                }
                positive.isEnabled = false
                status.visibility = View.VISIBLE
                status.setTextColor(getColor(R.color.textSecondary))
                status.setText(R.string.checking)
                // an address without a path is tried at /arx/ first, then at the site's root (ServerUrls.candidates)
                val tries = ServerUrls.candidates(urlInput.text?.toString().orEmpty(), dev).ifEmpty { listOf(ok.url) }
                io.execute {
                    var outcome: ServerCheck.Outcome = ServerCheck.Outcome.Unreachable("none")
                    var foundAt: String? = null
                    for ((i, candidate) in tries.withIndex()) {
                        val o = ServerCheck.check(candidate)
                        if (i == 0 || o is ServerCheck.Outcome.Arx) outcome = o
                        if (o is ServerCheck.Outcome.Arx) {
                            foundAt = candidate
                            break
                        }
                        if (o is ServerCheck.Outcome.Unreachable) break // the host itself does not answer
                    }
                    main.post {
                        if (!dialog.isShowing) return@post
                        positive.isEnabled = true
                        when (val result = outcome) {
                            is ServerCheck.Outcome.Arx -> {
                                // the site knows its own remote_path: correct a guessed default (`host` → /arx/)
                                val at = foundAt ?: ok.url
                                val fixed = result.path?.let {
                                    ServerUrls.normalize(ok.origin + it, allowDevHttp = dev) as? ServerUrls.Result.Ok
                                }?.url ?: at
                                if (store.servers().any { it.url == fixed && it.id != existing?.id }) {
                                    status.visibility = View.GONE
                                    urlLayout.error = getString(R.string.error_duplicate)
                                } else {
                                    save(fixed)
                                }
                            }
                            is ServerCheck.Outcome.NotArx -> {
                                warnedFor = ok.url
                                warn(status, positive, if (result.status > 0) getString(R.string.warn_not_arx, result.status) else getString(R.string.warn_not_arx_body), existing == null)
                            }
                            is ServerCheck.Outcome.Unreachable -> {
                                warnedFor = ok.url
                                warn(status, positive, getString(R.string.warn_unreachable), existing == null)
                            }
                        }
                    }
                }
            }
        }
        dialog.show()
    }

    private fun warn(status: TextView, positive: Button, message: String, adding: Boolean) {
        status.visibility = View.VISIBLE
        status.setTextColor(getColor(R.color.warning))
        status.text = message
        positive.setText(if (adding) R.string.add_anyway else R.string.save_anyway)
    }

    private fun problemText(problem: ServerUrls.Problem): Int = when (problem) {
        ServerUrls.Problem.EMPTY -> R.string.error_empty
        ServerUrls.Problem.NOT_HTTPS -> R.string.error_not_https
        ServerUrls.Problem.CREDENTIALS -> R.string.error_credentials
        ServerUrls.Problem.BAD_HOST -> R.string.error_host
        ServerUrls.Problem.BAD_PORT -> R.string.error_port
        ServerUrls.Problem.BAD_URL -> R.string.error_url
    }
}
