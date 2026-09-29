# SmplWise Arx shell. No JavascriptInterface classes exist (the page talks to the app only through
# WebViewCompat.addWebMessageListener, which needs no reflection), so nothing has to be kept for the WebView.
# Keep line numbers readable in crash reports from sideloaded builds.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
