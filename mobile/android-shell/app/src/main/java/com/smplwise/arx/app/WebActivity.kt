package com.smplwise.arx.app

import android.Manifest
import android.annotation.SuppressLint
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
import android.os.Message
import android.provider.DocumentsContract
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
import java.net.HttpURLConnection
import java.net.URL
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
    private lateinit var serverPath: String
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
    private var webViewOutdated = false
    private var firstPageShown = false
    private var failedUrl: String? = null
    private var rendererGone = false
    private var lastExternalAt: Long? = null
    private val probes = mutableListOf<WebView>()

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

    private var pendingDownload: ServerDownload? = null

    private val saveDownload = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val d = pendingDownload
        pendingDownload = null
        val uri = result.data?.data
        if (result.resultCode != RESULT_OK || uri == null || d == null) return@registerForActivityResult
        toast(R.string.download_started)
        downloads.execute { fetchTo(d, uri) }
    }

    /** Server downloads run on their own thread: a large export must not hold up the bridge or "save as". */
    private val downloads = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val ok = ServerUrls.normalize(intent.getStringExtra(EXTRA_SERVER).orEmpty(), allowDevHttp = dev) as? ServerUrls.Result.Ok
        // only a server the user stored (security review L11)
        if (ok == null || store.servers().none { it.url == ok.url }) {
            startActivity(Intent(this, ServersActivity::class.java).setData(Uri.parse("arx://servers")))
            finish()
            return
        }
        serverUrl = ok.url
        serverOrigin = ok.origin
        serverPath = ok.url.removePrefix(ok.origin)
        store.lastServerUrl = serverUrl
        instances += this
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

        val webViewMajor = InsetPolicy.webViewMajor(WebViewCompat.getCurrentWebViewPackage(this)?.versionName)
        pageInsets = InsetPolicy.pageHandlesInsets(webViewMajor)
        webViewOutdated = InsetPolicy.webViewOutdated(webViewMajor)
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
        WebViewCompat.addWebMessageListener(webView, BridgePolicy.NATIVE_OBJECT, rules) { view, message, sourceOrigin, isMainFrame, _ ->
            // origin, main frame, and the page shown must be one of the server's Arx pages (not the platform UI at /)
            if (!BridgePolicy.accept(serverUrl, serverOrigin, sourceOrigin.toString(), isMainFrame, view.url, dev)) return@addWebMessageListener
            val raw = message.data ?: return@addWebMessageListener
            if (raw.length > BridgeScript.MAX_MESSAGE_CHARS) return@addWebMessageListener
            // parsed off the main thread (a blob message can be megabytes; security review L6)
            io.execute {
                val msg = try {
                    JSONObject(raw)
                } catch (e: JSONException) {
                    return@execute
                }
                runOnUiThread { if (!isDestroyed) onBridgeMessage(msg) }
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, BridgeScript.source(BuildConfig.VERSION_NAME, serverPath), rules)
            bridge = true
        }
    }

    private fun onBridgeMessage(msg: JSONObject) {
        if (locked) return
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
                    else openExternal(request.url, request.hasGesture())
                    true
                }
                NavPolicy.Decision.APP_LINK -> {
                    handleAppLink(url)
                    true
                }
                NavPolicy.Decision.BLOCK -> true
            }
        }

        /**
         * shouldOverrideUrlLoading is never asked about POST navigations (a form with `target=_top`) - so a main-frame
         * request that is not one of the server's pages never reaches the network: it gets an empty answer, and the
         * start guard below takes the WebView back (security review M1).
         */
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (!request.isForMainFrame) return null
            val url = request.url.toString()
            if (NavPolicy.mayShow(serverUrl, url, dev)) return null
            return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), java.io.ByteArrayInputStream(ByteArray(0)))
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            if (guardShown(view, url)) return
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
            if (guardShown(view, url)) return // back / forward and restored history are checked here (M1)
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
            // The page's renderer crashed or was killed for memory: start this screen again instead of crashing the app,
            // but at most once per 30 s (security review L8) - a second crash shows the error screen.
            val url = view.url?.let { ServerUrls.resolveOnServer(serverUrl, it, dev) } ?: serverUrl
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            rendererGone = true
            val now = SystemClock.elapsedRealtime()
            if (NavPolicy.allowRendererRestart(now, lastRendererRestart)) {
                lastRendererRestart = now
                open(this@WebActivity, serverUrl, url)
                finish()
            } else {
                showError(LoadErrors.Kind.OTHER, url)
            }
            return true
        }
    }

    /**
     * The second half of M1: a main document that is not one of the server's pages (reached by a POST, back / forward,
     * a restored state) is stopped at once; the WebView goes back, or - with nothing to go back to - shows the "outside
     * the server" screen. True when it intervened.
     */
    private fun guardShown(view: WebView, url: String?): Boolean {
        if (NavPolicy.mayShow(serverUrl, url, dev)) return false
        view.stopLoading()
        if (view.canGoBack()) {
            view.goBack()
            toast(R.string.error_scope_title)
        } else {
            view.loadUrl("about:blank")
            showError(LoadErrors.Kind.OUT_OF_SCOPE, null)
        }
        return true
    }

    private inner class Chrome : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progress.setProgressCompat(newProgress, true)
            if (newProgress >= 100) progress.visibility = View.GONE
        }

        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            if (!isUserGesture) return false
            if (locked) return false
            // The new window never shows: a throwaway WebView learns the URL, then NavPolicy decides where it goes.
            // Every probe is tracked and destroyed after it answered, after 2 s at the latest, on window.close() and
            // with this screen (security review L1).
            val probe = WebView(this@WebActivity)
            probes += probe
            var handled = false
            fun route(url: String) {
                if (handled) return
                handled = true
                when (NavPolicy.decide(serverUrl, url, true, dev)) {
                    NavPolicy.Decision.IN_APP -> webView.loadUrl(url)
                    NavPolicy.Decision.EXTERNAL -> openExternal(Uri.parse(url), isUserGesture)
                    NavPolicy.Decision.APP_LINK -> handleAppLink(url)
                    NavPolicy.Decision.BLOCK -> Unit
                }
                // not probe.post: a view that was never attached never runs its posted actions (seen on the emulator)
                webView.post { destroyProbe(probe) }
            }
            probe.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                    route(request.url.toString())
                    return true
                }

                override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse =
                    // the probe never fetches anything itself (a POST popup would otherwise reach the network)
                    WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), java.io.ByteArrayInputStream(ByteArray(0)))

                override fun onPageStarted(v: WebView, url: String, favicon: Bitmap?) {
                    v.stopLoading()
                    if (url != "about:blank") route(url)
                }

                override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean {
                    destroyProbe(v)
                    return true
                }
            }
            probe.webChromeClient = object : WebChromeClient() {
                override fun onCloseWindow(window: WebView) = destroyProbe(window)
            }
            webView.postDelayed({ destroyProbe(probe) }, 2_000)
            (resultMsg.obj as WebView.WebViewTransport).webView = probe
            resultMsg.sendToTarget()
            return true
        }

        override fun onCloseWindow(window: WebView) {
            if (window in probes) destroyProbe(window)
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
                    locked || grant.isEmpty() -> request.deny() // never while the app is locked (security review L5)
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
            if (locked) {
                callback.onReceiveValue(null)
                return true
            }
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

    private fun destroyProbe(probe: WebView) {
        if (!probes.remove(probe)) return
        probe.stopLoading()
        probe.destroy()
    }

    /**
     * Hands a link to the system (browser, mail, dialer). Without a user gesture at most one every 10 s, and never while
     * locked (security review L7).
     */
    private fun openExternal(uri: Uri, hasGesture: Boolean) {
        val now = SystemClock.elapsedRealtime()
        if (locked || !NavPolicy.allowExternal(hasGesture, now, lastExternalAt)) return
        lastExternalAt = now
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
            NavPolicy.inScope(serverUrl, url, dev) -> askWhereToSave(url, userAgent, contentDisposition, mimetype)
            url.startsWith("https:") || url.startsWith("http:") -> openExternal(Uri.parse(url), false)
            else -> toast(R.string.download_unsupported)
        }
    }

    private class ServerDownload(val url: String, val name: String, val mime: String, val userAgent: String)

    /**
     * A file on the server (evidence export, backup) is fetched by the app itself, never by the system DownloadManager:
     * that would store the session cookie in the system's download database and send it again on every redirect hop
     * (security review M2). The user picks where to save it first ("save as"); then the file streams there.
     */
    private fun askWhereToSave(url: String, userAgent: String?, contentDisposition: String?, mimetype: String?) {
        if (locked) return
        val mime = mimetype?.substringBefore(';')?.trim()?.takeIf { it.isNotEmpty() } ?: "application/octet-stream"
        val name = FileTypes.safeName(URLUtil.guessFileName(url, contentDisposition, mimetype), "arx-download")
        if (DownloadPolicy.refused(name, mime)) {
            toast(R.string.download_refused)
            return
        }
        pendingDownload = ServerDownload(url, name, mime, userAgent ?: webView.settings.userAgentString)
        val create = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime).putExtra(Intent.EXTRA_TITLE, name)
        try {
            AppLock.excursion = true
            saveDownload.launch(create)
        } catch (e: ActivityNotFoundException) {
            AppLock.excursion = false
            pendingDownload = null
            toast(R.string.download_unsupported)
        }
    }

    /**
     * Streams [d] into [target]: the server's cookies for that URL only, redirects followed only to the server's own
     * pages (DownloadPolicy.nextHop, at most 5), anything else fails and removes the half-created file.
     */
    private fun fetchTo(d: ServerDownload, target: Uri) {
        val resolver = applicationContext.contentResolver
        var url = d.url
        var hops = 0
        val ok = try {
            var done = false
            while (true) {
                val conn = URL(url).openConnection() as HttpURLConnection
                try {
                    conn.instanceFollowRedirects = false
                    conn.connectTimeout = 15_000
                    conn.readTimeout = 60_000
                    conn.useCaches = false
                    CookieManager.getInstance().getCookie(url)?.let { conn.setRequestProperty("Cookie", it) }
                    conn.setRequestProperty("User-Agent", d.userAgent)
                    val code = conn.responseCode
                    if (code in 300..399) {
                        val next = DownloadPolicy.nextHop(serverUrl, url, conn.getHeaderField("Location"), dev)
                        if (next == null || ++hops > DownloadPolicy.MAX_REDIRECTS) break
                        url = next
                        continue
                    }
                    if (code != HttpURLConnection.HTTP_OK) break
                    conn.inputStream.use { input ->
                        resolver.openOutputStream(target)?.use { out -> input.copyTo(out, 64 * 1024) } ?: return@use
                        done = true
                    }
                    break
                } finally {
                    conn.disconnect()
                }
            }
            done
        } catch (e: Exception) {
            false
        }
        if (!ok) {
            try {
                DocumentsContract.deleteDocument(resolver, target)
            } catch (e: Exception) {
                // best effort: the provider may not support deleting
            }
        }
        runOnUiThread { if (!isDestroyed) toast(if (ok) R.string.download_saved else R.string.download_failed) }
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
        if (DownloadPolicy.refused(name, mime)) {
            toast(R.string.download_refused)
            return
        }
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
        if (rendererGone) {
            // the WebView is gone with its renderer: start this screen afresh
            open(this, serverUrl, failedUrl?.let { ServerUrls.resolveOnServer(serverUrl, it, dev) } ?: serverUrl)
            finish()
            return
        }
        errorView.visibility = View.GONE
        val target = failedUrl?.let { ServerUrls.resolveOnServer(serverUrl, it, dev) }
            ?: webView.url?.let { ServerUrls.resolveOnServer(serverUrl, it, dev) }
        failedUrl = null
        webView.loadUrl(target ?: ServerUrls.launchUrl(serverUrl))
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
        val sheet = track(BottomSheetDialog(this))
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

    /**
     * After the first page: an outdated WebView gets a notice on every start (the site needs a current one); otherwise,
     * once, where "החלף שרת" lives.
     */
    private fun maybeShowSwitchHint() {
        if (webViewOutdated) {
            Snackbar.make(webHolder, R.string.webview_outdated, Snackbar.LENGTH_INDEFINITE)
                .setAction(R.string.got_it) { }
                .show()
            return
        }
        if (store.switchHintShown) return
        store.switchHintShown = true
        Snackbar.make(webHolder, R.string.first_open_hint, 8_000)
            .setAction(R.string.got_it) { }
            .show()
    }

    /**
     * Locked: every video and audio element is paused and the microphone / camera tracks the page opened are stopped
     * (BridgeScript.PAUSE), then the WebView pauses; permission requests, file pickers, downloads and bridge messages
     * are refused until the unlock (security review L5).
     */
    override fun onLockChanged(locked: Boolean) {
        if (!::webView.isInitialized || rendererGone) return
        if (locked) {
            pendingPermission?.deny()
            pendingPermission = null
            if (customView != null) chrome.onHideCustomView()
            webView.evaluateJavascript(BridgeScript.PAUSE, null)
            webView.onPause()
        } else {
            webView.onResume()
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized && !rendererGone && !locked) webView.onResume()
    }

    override fun onPause() {
        if (::webView.isInitialized && !rendererGone) {
            CookieManager.getInstance().flush() // the session cookie and the page's storage survive a kill
            webView.onPause()
        }
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized && !rendererGone) webView.saveState(outState)
    }

    override fun onDestroy() {
        instances.remove(this)
        probes.toList().forEach { destroyProbe(it) }
        io.shutdown()
        downloads.shutdown() // a running download finishes
        pendingPermission?.deny()
        fileCallback?.onReceiveValue(null)
        if (::webView.isInitialized && !rendererGone) {
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun toast(res: Int) = Toast.makeText(this, res, Toast.LENGTH_SHORT).show()

    companion object {
        /** The site screens alive (main thread only). There is one at a time: opening a site finishes the others. */
        private val instances = mutableListOf<WebActivity>()

        /** A site screen exists (the server list asks before an `arx://open` replaces it). */
        val running: Boolean get() = instances.isNotEmpty()

        /** The last renderer-crash restart, for the once-per-30-s cap (process-wide: the screen itself restarts). */
        private var lastRendererRestart: Long? = null

        private const val EXTRA_SERVER = "com.smplwise.arx.app.SERVER"
        private const val EXTRA_URL = "com.smplwise.arx.app.URL"

        /**
         * Opens [url] (on [serverUrl]) and finishes every other site screen, so a running site of another server is
         * replaced, not stacked. Started in the caller's task: the app's activities have no task affinity (L10), so
         * task-affinity flags would scatter them over new tasks.
         */
        fun open(context: Context, serverUrl: String, url: String) {
            instances.toList().forEach { if (it !== context) it.finish() }
            val intent = Intent(context, WebActivity::class.java)
                .putExtra(EXTRA_SERVER, serverUrl)
                .putExtra(EXTRA_URL, url)
            if (context !is android.app.Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }
}
