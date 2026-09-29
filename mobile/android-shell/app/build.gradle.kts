import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---- optional build-time settings (gradle.properties, or -ParxHost=... on the command line) ------------------------
val hostRe = Regex("^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$")
val arxHost: String = (findProperty("arxHost") as String? ?: "").trim().lowercase()
val arxPath: String = (findProperty("arxPath") as String? ?: "/arx/").trim()
val arxServerName: String = (findProperty("arxServerName") as String? ?: "").trim()
val arxVersionCode: Int = (findProperty("arxVersionCode") as String? ?: "1").trim().toIntOrNull()
    ?: error("arxVersionCode must be a positive integer")
val arxVersionName: String = (findProperty("arxVersionName") as String? ?: "2.0.0").trim()
require(arxHost.isEmpty() || hostRe.matches(arxHost)) {
    "arxHost must be empty or a bare public hostname such as site.example.com (no scheme, port or path); got '$arxHost'"
}
require(Regex("^/[A-Za-z0-9._~-]+/$").matches(arxPath)) {
    "arxPath must be one path segment with a leading and a trailing slash, such as /arx/; got '$arxPath'"
}
require(arxVersionCode > 0) { "arxVersionCode must be a positive integer" }
require(Regex("^[0-9A-Za-z.+-]{1,40}$").matches(arxVersionName)) { "arxVersionName: letters, digits and . + - only" }
val defaultServerUrl = if (arxHost.isEmpty()) "" else "https://$arxHost$arxPath"

fun javaString(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

// ---- release signing: keystore.properties next to this project (gitignored) or ARX_KEYSTORE_* environment variables;
// without either, assembleRelease builds an unsigned APK ------------------------------------------------------------
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.isFile) f.inputStream().use { load(it) }
}
fun signingValue(prop: String, env: String): String? =
    (keystoreProps.getProperty(prop) ?: System.getenv(env))?.takeIf { it.isNotBlank() }
val releaseStoreFile = signingValue("storeFile", "ARX_KEYSTORE_FILE")
val releaseStorePassword = signingValue("storePassword", "ARX_KEYSTORE_PASSWORD")
val releaseKeyAlias = signingValue("keyAlias", "ARX_KEY_ALIAS")
val releaseKeyPassword = signingValue("keyPassword", "ARX_KEY_PASSWORD") ?: releaseStorePassword
val canSignRelease = releaseStoreFile != null && releaseStorePassword != null && releaseKeyAlias != null

android {
    namespace = "com.smplwise.arx.app"
    compileSdk = 36

    defaultConfig {
        // Different from the Trusted Web Activity (com.smplwise.arx), so both install side by side during the trial.
        applicationId = "com.smplwise.arx.app"
        minSdk = 26
        targetSdk = 35
        versionCode = arxVersionCode
        versionName = arxVersionName

        buildConfigField("String", "DEFAULT_SERVER_URL", javaString(defaultServerUrl))
        buildConfigField("String", "DEFAULT_SERVER_NAME", javaString(arxServerName))
    }

    signingConfigs {
        if (canSignRelease) {
            create("release") {
                storeFile = rootProject.file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("debug") {
            // Debug builds only: plain http to 127.0.0.1 (a local backend forwarded with adb reverse), for a smoke test
            // against a local development backend. Release builds are https-only (ServerUrls, network security config).
            buildConfigField("boolean", "ALLOW_DEV_HTTP", "true")
        }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("boolean", "ALLOW_DEV_HTTP", "false")
            if (canSignRelease) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    // No Google Play services and no Firebase (owner decision 2026-09-29): AndroidX and Material Components only.
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("com.google.android.material:material:1.12.0")
    testImplementation("junit:junit:4.13.2")
}

if (!canSignRelease) {
    logger.lifecycle("SmplWise Arx shell: no release signing configured (keystore.properties or ARX_KEYSTORE_*); assembleRelease builds an unsigned APK")
}
