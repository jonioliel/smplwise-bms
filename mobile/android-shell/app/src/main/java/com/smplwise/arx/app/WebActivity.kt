package com.smplwise.arx.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.os.SystemClock
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updateLayoutParams
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.google.android.material.snackbar.Snackbar
import org.json.JSONException
import org.json.JSONObject
import org.json.JSONTokener
import java.util.concurrent.Executors
import kotlin.math.max

/**
 * One server, full screen, in the app's own WebView (no browser, no address bar, no Digital Asset Links).
 *
 * Security (CR-008 §9, own-WebView shell):
 * - top-level navigation stays in the app only on the selected server's origin, under its path or `/auth/`
 *   (NavPolicy); anything else goes to the system browser, `javascript:` / `intent:` / `file:` / unknown schemes are
 *   dropped; `target=_blank` and `window.open` follow the same rule;
 * - no `addJavascriptInterface`: the page talks to the app only through `WebViewCompat.addWebMessageListener`, which
 *   the WebView injects only into frames of the server's origin, and every message is checked again (BridgePolicy:
 *   main frame, same origin, known type). The page sees `window.ArxApp` = {platform, shell, version, switchServer()};
 * - no file or content access, mixed content never allowed, Safe Browsing on, cleartext off (network security config),
 *   third-party cookies off, geolocation refused, only the microphone may be granted and only to the server's origin.
 */
class WebActivity : LockedActivity() {
    private lateinit var serverUrl: String
    private lateinit var serverOrigin: String
    private lateinit var webView: WebView
    private lateinit var root: FrameLayout
    private lateinit var webHolder: FrameLayout
    private lateinit var topScrim: View
    private lateinit var bottomScrim: View
    private lateinit var fullscreenHolder: FrameLayout
    private lateinit var progress: LinearProgressIndicator
    private lateinit var errorView: View

    private val dev = BuildConfig.ALLOW_DEV_HTTP
    private var bridge = false
    private var pageInsets = false
    private var firstPageShown = false
    private var failedUrl: String? = null

    private var customView: View? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermission: PermissionRequest? = null
    private var pendingBlobUrl: String? = null
    private var pendingBlobAt = 0L
    private var pendingSave: Pair<String, ByteArray>? = null
    private val io = Executors.newSingleThreadExecutor()
    private val chrome = Chrome()

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val cb = fileCallback ?: return@registerForActivityResult
        fileCallback = null
        val data = result.data
        val uris = if (result.resultCode != RESULT_OK || data == null) {
            null
        } else {
            val clip = data.clipData
            val list = if (clip != null) (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri } else listOfNotNull(data.data)
            list.takeIf { it.isNotEmpty() }?.toTypedArray()
        }
        cb.onReceiveValue(uris)
    }

    private val askMic = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val request = pendingPermission ?: return@registerForActivityResult
        pendingPermission = null
        val grant = PermissionPolicy.grantable(serverOrigin, request.origin?.toString(), request.resources)
        if (granted && grant.isNotEmpty()) request.grant(grant.toTypedArray()) else request.deny()
    }

    private val saveAs = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val pending = pendingSave
        pendingSave = null
        val uri = result.data?.data
        if (result.resultCode != RESULT_OK || uri == null || pending == null) return@registerForActivityResult
        io.execute {
            val ok = try {
                contentResolver.openOutputStream(uri)?.use { it.write(pending.second) } != null
            } catch (e: Exception) {
                false
            }
            runOnUiThread { toast(if (ok) R.string.download_saved else R.string.download_failed) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val ok = ServerUrls.normalize(intent.getStringExtra(EXTRA_SERVER).orEmpty(), allowDevHttp = dev) as? ServerUrls.Result.Ok
        if (ok == null) {
            startActivity(Intent(this, ServersActivity::class.java).setData(Uri.parse("arx://servers")))
            finish()
            return
        }
        serverUrl = ok.url
        serverOrigin = ok.origin
        store.lastServerUrl = serverUrl
        // M1: the start link is rebuilt from its parsed parts on this server (never trusted as a raw string)
        val start = ServerUrls.resolveOnServer(serverUrl, intent.getStringExtra(EXTRA_URL).orEmpty(), dev) ?: serverUrl

        setContentView(R.layout.activity_web)
        root = findViewById(R.id.root)
        webHolder = findViewById(R.id.webHolder)
        topScrim = findViewById(R.id.topScrim)
        bottomScrim = findViewById(R.id.bottomScrim)
        fullscreenHolder = findViewById(R.id.fullscreenHolder)
        progress = findViewById(R.id.progress)
        errorView = findViewById(R.id.errorView)
        errorView.findViewById<MaterialButton>(R.id.retry).setOnClickListener { retry() }
        errorView.findViewById<MaterialButton>(R.id.servers).setOnClickListener { openServers() }
        if (Build.VERSION.SDK_INT >= 29) window.isNavigationBarContrastEnforced = false
        applyBars(BarColors.DEFAULT_THEME, BarColors.DEFAULT_BACKGROUND)

        pageInsets = InsetPolicy.pageHandlesInsets(
            InsetPolicy.webViewMajor(WebViewCompat.getCurrentWebViewPackage(this)?.versionName),
        )
        webView = WebView(this).apply { layoutParams = FrameLayout.LayoutParams(-1, -1) }
        webHolder.addView(webView, 0)
        configureWebView()
        setupInsets()
        setupBack()

        val restored = savedInstanceState?.let { webView.restoreState(it) } != null
        if (!restored) webView.loadUrl(ServerUrls.launchUrl(start))
    }

    // ---- WebView set-up ----------------------------------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false // muted live tiles start by themselves, as in the browser
            setSupportMultipleWindows(true) // target=_blank / window.open reach onCreateWindow (NavPolicy decides)
            javaScriptCanOpenWindowsAutomatically = false
            setGeolocationEnabled(false)
            userAgentString = "$userAgentString SmplWiseArx/${BuildConfig.VERSION_NAME} (Android app)"
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(webView.settings, true)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false) // the site draws its own themes
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }
        installBridge()
        webView.webViewClient = Client()
        webView.webChromeClient = chrome
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            download(url, userAgent, contentDisposition, mimetype)
        }
    }

    /** The page-facing interface, injected only into frames of the server's origin (see the class comment). */
    private fun installBridge() {
        val rules = setOf(serverOrigin)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, BridgePolicy.NATIVE_OBJECT, rules) { _, message, sourceOrigin, isMainFrame, _ ->
            if (!BridgePolicy.accept(serverOrigin, sourceOrigin.toString(), isMainFrame)) return@addWebMessageListener
            onBridgeMessage(message.data ?: return@addWebMessageListener)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, BridgeScript.source(BuildConfig.VERSION_NAME), rules)
            bridge = true
        }
    }

    private fun onBridgeMessage(raw: String) {
        if (raw.length > BridgeScript.MAX_MESSAGE_CHARS) return
        val msg = try {
            JSONObject(raw)
        } catch (e: JSONException) {
            return
        }
        val type = msg.optString("type")
        if (type !in BridgePolicy.MESSAGE_TYPES) return
        when (type) {
            "switchServer" -> openServers()
            "blob" -> onBlob(msg)
            "blobError" -> if (msg.optString("url") == pendingBlobUrl) {
                pendingBlobUrl = null
                toast(if (msg.optString("reason") == "too_large") R.string.download_too_large else R.string.download_failed)
            }
        }
    }

    // ---- navigation --------------------------------------------------------------------------------------------------

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()
            return when (NavPolicy.decide(serverUrl, url, request.isForMainFrame, dev)) {
                NavPolicy.Decision.IN_APP -> false
                NavPolicy.Decision.EXTERNAL -> {
                    if (!firstPageShown && request.isRedirect) showError(LoadErrors.Kind.OUT_OF_SCOPE, url)
                    else openExternal(request.url)
                    true
                }
                NavPolicy.Decision.APP_LINK -> {
                    handleAppLink(url)
                    true
                }
                NavPolicy.Decision.BLOCK -> true
            }
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            progress.visibility = View.VISIBLE
        }

        override fun onPageCommitVisible(view: WebView, url: String) {
            if (failedUrl == null && !firstPageShown) {
                firstPageShown = true
                maybeShowSwitchHint()
            }
        }

        override fun onPageFinished(view: WebView, url: String) {
            progress.visibility = View.GONE
            CookieManager.getInstance().flush()
            readPageColors()
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
            view.postDelayed({ readPageColors() }, 400) // hash routes: the new screen renders after the history update
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                showError(LoadErrors.ofNetworkError(error.errorCode, isOnline()), request.url.toString())
            }
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (!request.isForMainFrame) return
            LoadErrors.ofHttpStatus(response.statusCode)?.let { showError(it, request.url.toString()) }
        }

        @SuppressLint("WebViewClientOnReceivedSslError")
        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handler.cancel() // never proceed past a certificate error
            if (!firstPageShown || ServerUrls.parse(error.url)?.origin == serverOrigin) showError(LoadErrors.Kind.TLS, error.url)
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // The page's renderer crashed or was killed for memory: start this screen again instead of crashing the app.
            val url = view.url?.let { ServerUrls.resolveOnServer(serverUrl, it, dev) } ?: serverUrl
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            open(this@WebActivity, serverUrl, url)
            finish()
            return true
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progress.setProgressCompat(newProgress, true)
            if (newProgress >= 100) progress.visibility = View.GONE
        }

        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            if (!isUserGesture) return false
            // The new window never shows: a throwaway WebView learns the URL, then NavPolicy decides where it goes.
            val probe = WebView(this@WebActivity)
            var handled = false
            fun route(url: String) {
                if (handled) return
                handled = true
                when (NavPolicy.decide(serverUrl, url, true, dev)) {
                    NavPolicy.Decision.IN_APP -> webView.loadUrl(url)
                    NavPolicy.Decision.EXTERNAL -> openExternal(Uri.parse(url))
                    NavPolicy.Decision.APP_LINK -> handleAppLink(url)
                    NavPolicy.Decision.BLOCK -> Unit
                }
                probe.post { probe.destroy() }
            }
            probe.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                    route(request.url.toString())
                    return true
                }

                override fun onPageStarted(v: WebView, url: String, favicon: Bitmap?) {
                    v.stopLoading()
                    if (url != "about:blank") route(url)
                }
            }
            (resultMsg.obj as WebView.WebViewTransport).webView = probe
            resultMsg.sendToTarget()
            return true
        }

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (customView != null) {
                callback.onCustomViewHidden()
                return
            }
            customView = view
            customCallback = callback
            fullscreenHolder.addView(view, FrameLayout.LayoutParams(-1, -1))
            fullscreenHolder.visibility = View.VISIBLE
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            WindowCompat.getInsetsController(window, window.decorView).apply {
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                hide(WindowInsetsCompat.Type.systemBars())
            }
        }

        override fun onHideCustomView() {
            val view = customView ?: return
            fullscreenHolder.removeView(view)
            fullscreenHolder.visibility = View.GONE
            customView = null
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            WindowCompat.getInsetsController(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
            customCallback?.onCustomViewHidden()
            customCallback = null
        }

        override fun onPermissionRequest(request: PermissionRequest) {
            runOnUiThread {
                val grant = PermissionPolicy.grantable(serverOrigin, request.origin?.toString(), request.resources)
                when {
                    grant.isEmpty() -> request.deny()
                    ContextCompat.checkSelfPermission(this@WebActivity, Manifest.permission.RECORD_AUDIO) ==
                        PackageManager.PERMISSION_GRANTED -> request.grant(grant.toTypedArray())
                    else -> {
                        pendingPermission?.deny()
                        pendingPermission = request
                        AppLock.excursion = true
                        askMic.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }
        }

        override fun onPermissionRequestCanceled(request: PermissionRequest) {
            if (pendingPermission == request) pendingPermission = null
        }

        override fun onGeolocationPermissionsShowPrompt(origin: String, callback: android.webkit.GeolocationPermissions.Callback) {
            callback.invoke(origin, false, false)
        }

        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            val mimes = FileTypes.mimeTypes(params.acceptTypes) { MimeTypeMap.getSingleton().getMimeTypeFromExtension(it) }
            val pick = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType(if (mimes.size == 1) mimes[0] else "*/*")
            if (mimes.size > 1) pick.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray())
            if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            return try {
                AppLock.excursion = true
                pickFiles.launch(Intent.createChooser(pick, params.title ?: getString(R.string.choose_file)))
                true
            } catch (e: ActivityNotFoundException) {
                AppLock.excursion = false
                fileCallback = null
                callback.onReceiveValue(null)
                true
            }
        }

        /** No grey "play" poster behind videos that have not started yet. */
        override fun getDefaultVideoPoster(): Bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            toast(R.string.no_app_for_link)
        }
    }

    /** `arx://servers` and `arx://open?url=` from inside the page go to the server list, which decides. */
    private fun handleAppLink(url: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).setClass(this, ServersActivity::class.java))
    }

    private fun openServers() {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("arx://servers")).setClass(this, ServersActivity::class.java))
    }

    // ---- downloads ---------------------------------------------------------------------------------------------------

    private fun download(url: String, userAgent: String?, contentDisposition: String?, mimetype: String?) {
        when {
            url.startsWith("blob:") -> {
                if (!bridge) {
                    toast(R.string.download_unsupported)
                    return
                }
                pendingBlobUrl = url
                pendingBlobAt = SystemClock.elapsedRealtime()
                webView.evaluateJavascript("window.__arxSaveBlob && window.__arxSaveBlob(${JSONObject.quote(url)})", null)
            }
            ServerUrls.parse(url)?.origin == serverOrigin -> enqueue(url, userAgent, contentDisposition, mimetype)
            url.startsWith("https:") || url.startsWith("http:") -> openExternal(Uri.parse(url))
            else -> toast(R.string.download_unsupported)
        }
    }

    /**
     * A file on the server (evidence export, backup): the system DownloadManager fetches it with this server's cookies
     * (the `__Secure-arx_session` cookie, Path=/arx/) - they are attached only for the server's own origin.
     */
    private fun enqueue(url: String, userAgent: String?, contentDisposition: String?, mimetype: String?) {
        val name = FileTypes.safeName(URLUtil.guessFileName(url, contentDisposition, mimetype), "arx-download")
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(name)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        mimetype?.takeIf { it.isNotBlank() }?.let { request.setMimeType(it) }
        CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
        request.addRequestHeader("User-Agent", userAgent ?: webView.settings.userAgentString)
        if (Build.VERSION.SDK_INT >= 29) {
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
        } else {
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name) // no storage permission
        }
        try {
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            toast(R.string.download_started)
        } catch (e: Exception) {
            toast(R.string.download_failed)
        }
    }

    /** A file the page built itself (audit CSV, plan JSON, 3D export): "save as" through the system's file picker. */
    private fun onBlob(msg: JSONObject) {
        val url = msg.optString("url")
        if (url.isEmpty() || url != pendingBlobUrl || SystemClock.elapsedRealtime() - pendingBlobAt > 30_000) return
        pendingBlobUrl = null
        val dataUrl = msg.optString("data")
        val comma = dataUrl.indexOf(',')
        if (!dataUrl.startsWith("data:") || comma < 0 || !dataUrl.substring(0, comma).endsWith(";base64")) {
            toast(R.string.download_failed)
            return
        }
        val mime = msg.optString("mime").substringBefore(';').trim().ifEmpty { "application/octet-stream" }
        val name = FileTypes.safeName(msg.optString("name"), "arx-file")
        io.execute {
            val bytes = try {
                Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
            } catch (e: IllegalArgumentException) {
                null
            }
            runOnUiThread {
                if (bytes == null) {
                    toast(R.string.download_failed)
                    return@runOnUiThread
                }
                pendingSave = name to bytes
                val create = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mime).putExtra(Intent.EXTRA_TITLE, name)
                try {
                    AppLock.excursion = true
                    saveAs.launch(create)
                } catch (e: ActivityNotFoundException) {
                    AppLock.excursion = false
                    pendingSave = null
                    toast(R.string.download_unsupported)
                }
            }
        }
    }

    // ---- look: system bars, insets, errors ---------------------------------------------------------------------------

    private fun readPageColors() {
        if (!::webView.isInitialized || !NavPolicy.inScope(serverUrl, webView.url.orEmpty(), dev)) return
        webView.evaluateJavascript(BridgeScript.READ_COLORS) { result ->
            val json = try {
                (JSONTokener(result ?: return@evaluateJavascript).nextValue() as? String)?.let { JSONObject(it) }
            } catch (e: JSONException) {
                null
            } ?: return@evaluateJavascript
            val (status, nav) = BarColors.pick(json.optString("theme"), json.optString("body"), json.optString("html"))
            applyBars(status, nav)
        }
    }

    private fun applyBars(status: Int, nav: Int) {
        topScrim.setBackgroundColor(status)
        bottomScrim.setBackgroundColor(nav)
        root.setBackgroundColor(nav)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = BarColors.wantsDarkIcons(status)
            isAppearanceLightNavigationBars = BarColors.wantsDarkIcons(nav)
        }
    }

    /**
     * Edge-to-edge: the status-bar strip is painted in the page's theme colour and the page starts below it (the Arx
     * top bar does not pad itself for the status bar). The bottom and side insets reach the page as the standard
     * `env(safe-area-inset-*)` on WebView 140 and later; on older WebViews the app pads the WebView itself (InsetPolicy).
     * The keyboard always shrinks the WebView.
     */
    private fun setupInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            webHolder.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                topMargin = bars.top
                bottomMargin = if (pageInsets) ime.bottom else max(bars.bottom, ime.bottom)
                leftMargin = if (pageInsets) 0 else bars.left
                rightMargin = if (pageInsets) 0 else bars.right
            }
            topScrim.updateLayoutParams { height = bars.top }
            bottomScrim.updateLayoutParams { height = if (pageInsets) 0 else bars.bottom }
            if (pageInsets) insets else WindowInsetsCompat.CONSUMED
        }
    }

    private fun showError(kind: LoadErrors.Kind, url: String?) {
        failedUrl = url
        progress.visibility = View.GONE
        val (title, message) = when (kind) {
            LoadErrors.Kind.OFFLINE -> R.string.error_offline_title to R.string.error_offline
            LoadErrors.Kind.NOT_FOUND -> R.string.error_not_found_title to R.string.error_not_found
            LoadErrors.Kind.TIMEOUT -> R.string.error_timeout_title to R.string.error_timeout
            LoadErrors.Kind.TLS -> R.string.error_tls_title to R.string.error_tls
            LoadErrors.Kind.SERVER -> R.string.error_server_title to R.string.error_server
            LoadErrors.Kind.OUT_OF_SCOPE -> R.string.error_scope_title to R.string.error_scope
            LoadErrors.Kind.OTHER -> R.string.error_other_title to R.string.error_other
        }
        errorView.findViewById<TextView>(R.id.errorTitle).setText(title)
        errorView.findViewById<TextView>(R.id.errorMessage).setText(message)
        errorView.findViewById<TextView>(R.id.errorServer).text = serverUrl
        errorView.visibility = View.VISIBLE
        errorView.bringToFront()
    }

    private fun retry() {
        errorView.visibility = View.GONE
        val target = failedUrl?.let { ServerUrls.resolveOnServer(serverUrl, it, dev) }
        failedUrl = null
        if (target != null) webView.loadUrl(target) else if (firstPageShown) webView.reload() else webView.loadUrl(ServerUrls.launchUrl(serverUrl))
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // ---- back, lifecycle ---------------------------------------------------------------------------------------------

    /**
     * Back: leave full-screen video, else the page's own history (hash routes included), else - at the site's first
     * screen - a small sheet "יציאה / שרתים", so switching servers is one tap away (owner, 2026-09-29).
     */
    private fun setupBack() {
        onBackPressedDispatcher.addCallback(this) {
            when {
                customView != null -> chrome.onHideCustomView()
                errorView.visibility == View.VISIBLE && firstPageShown -> errorView.visibility = View.GONE
                webView.canGoBack() -> webView.goBack()
                else -> showExitSheet()
            }
        }
    }

    private fun showExitSheet() {
        val sheet = BottomSheetDialog(this)
        val view = layoutInflater.inflate(R.layout.sheet_exit, null)
        view.findViewById<MaterialButton>(R.id.sheetServers).setOnClickListener {
            sheet.dismiss()
            openServers()
        }
        view.findViewById<MaterialButton>(R.id.sheetExit).setOnClickListener {
            sheet.dismiss()
            finish()
        }
        sheet.setContentView(view)
        sheet.show()
    }

    /** Once, after the first server has opened: where "החלף שרת" lives. */
    private fun maybeShowSwitchHint() {
        if (store.switchHintShown) return
        store.switchHintShown = true
        Snackbar.make(webHolder, R.string.first_open_hint, 8_000)
            .setAction(R.string.got_it) { }
            .show()
    }

    override fun onLockChanged(locked: Boolean) {
        if (!::webView.isInitialized) return
        if (locked) webView.onPause() else webView.onResume()
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            CookieManager.getInstance().flush() // the session cookie and the page's storage survive a kill
            webView.onPause()
        }
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.saveState(outState)
    }

    override fun onDestroy() {
        io.shutdown()
        pendingPermission?.deny()
        fileCallback?.onReceiveValue(null)
        if (::webView.isInitialized) {
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun toast(res: Int) = Toast.makeText(this, res, Toast.LENGTH_SHORT).show()

    companion object {
        private const val EXTRA_SERVER = "com.smplwise.arx.app.SERVER"
        private const val EXTRA_URL = "com.smplwise.arx.app.URL"

        /** Opens [url] (on [serverUrl]) in a fresh task, so a running site of another server is replaced, not stacked. */
        fun open(context: Context, serverUrl: String, url: String) {
            context.startActivity(
                Intent(context, WebActivity::class.java)
                    .putExtra(EXTRA_SERVER, serverUrl)
                    .putExtra(EXTRA_URL, url)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
            )
        }
    }
}
