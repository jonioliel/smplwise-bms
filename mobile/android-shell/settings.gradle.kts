// SmplWise Arx for Android - the own-WebView shell (CR-008 §9): a native server list and a full-screen WebView per
// server. No browser, no Digital Asset Links, no Google Play services.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "smplwise-arx-android-shell"
include(":app")
