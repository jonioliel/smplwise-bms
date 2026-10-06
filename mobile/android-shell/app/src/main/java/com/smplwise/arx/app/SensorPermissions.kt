package com.smplwise.arx.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat

object SensorPermissions {
    fun granted(c: Context, p: String) = ContextCompat.checkSelfPermission(c, p) == PackageManager.PERMISSION_GRANTED
    fun fine(c: Context) = granted(c, Manifest.permission.ACCESS_FINE_LOCATION)
    fun locationAuth(c: Context): String = when {
        !androidx.core.location.LocationManagerCompat.isLocationEnabled(c.getSystemService(Context.LOCATION_SERVICE) as LocationManager) -> "denied"
        !fine(c) && !granted(c, Manifest.permission.ACCESS_COARSE_LOCATION) -> "denied"
        Build.VERSION.SDK_INT < 29 || granted(c, Manifest.permission.ACCESS_BACKGROUND_LOCATION) -> "always"
        else -> "when_in_use"
    }
    fun requests(key: String): Array<String> = when (key) {
        "location", "network" -> arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        "activity", "steps" -> if (Build.VERSION.SDK_INT >= 29) arrayOf(Manifest.permission.ACTIVITY_RECOGNITION) else emptyArray()
        "beacon" -> if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                    else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        else -> emptyArray()
    }
    fun supported(c: Context, key: String): Boolean {
        val sm = c.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        return when (key) {
            "steps" -> sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
            "altitude" -> sm.getDefaultSensor(Sensor.TYPE_PRESSURE) != null
            "beacon" -> c.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)
            "activity", "location" -> com.google.android.gms.common.GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(c) == com.google.android.gms.common.ConnectionResult.SUCCESS
            else -> true
        }
    }
    fun permitted(c: Context): Set<String> = PresencePolicy.sensors.filter { key ->
        supported(c, key) && when (key) {
            "location" -> locationAuth(c) in setOf("always", "when_in_use")
            "network" -> true // interface works without SSID permission, availability is reported separately
            "beacon" -> requests(key).all { granted(c, it) } && fine(c)
            else -> requests(key).all { granted(c, it) }
        }
    }.toSet()
}
