// Toolchain pinned to the one the Trusted Web Activity branch proved on this workstation (AGP 8.9.1 on Gradle 8.11.1,
// Kotlin 2.2.0, compileSdk 36), so both apps build from the same local SDK and Gradle cache.
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
}
