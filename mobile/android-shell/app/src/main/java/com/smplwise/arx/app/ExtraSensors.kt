package com.smplwise.arx.app

import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.util.UUID

/** Foreground-only optional sensors. No raw SSID, MAC, BLE advertisements or sensor stream is persisted. */
class ExtraSensors(private val c: Context, private val runtime: PresenceRuntime, private val coordinator: SensorCoordinator) : SensorEventListener {
    private val sm = c.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val main = Handler(Looper.getMainLooper())
    private val registered = mutableSetOf<Int>()
    private var stepBaseline: Float? = null
    private var steps = 0
    private var lastPressureSampleAt = -60000L
    private val pressureBaselines = mutableMapOf<String, Float>()
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var scanning = false
    private val last = mutableMapOf<String, Long>()
    private val stopScan = Runnable { stopBeacon() }
    fun refresh(on: Set<String>) {
        val wanted = mutableSetOf<Int>()
        if ("steps" in on) wanted.add(Sensor.TYPE_STEP_COUNTER)
        if ("altitude" in on) wanted.add(Sensor.TYPE_PRESSURE)
        if (registered != wanted) {
            sm.unregisterListener(this); registered.clear(); stepBaseline = null; steps = 0; runtime.io.execute { pressureBaselines.clear(); stepCounters.clear() }
            wanted.forEach { t -> sm.getDefaultSensor(t)?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL); registered.add(t) } }
        }
        if ("network" in on) {
            if (networkCallback == null) {
                val callback = if (Build.VERSION.SDK_INT >= 31) object : ConnectivityManager.NetworkCallback(FLAG_INCLUDE_LOCATION_INFO) {
                    override fun onCapabilitiesChanged(n: android.net.Network, caps: NetworkCapabilities) { network(caps) }
                    override fun onLost(n: android.net.Network) { network(null) }
                } else object : ConnectivityManager.NetworkCallback() {
                    override fun onCapabilitiesChanged(n: android.net.Network, caps: NetworkCapabilities) { network(caps) }
                    override fun onLost(n: android.net.Network) { network(null) }
                }
                networkCallback = callback
                (c.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).registerDefaultNetworkCallback(callback)
            }
            val cm = c.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            network(cm.activeNetwork?.let(cm::getNetworkCapabilities))
        } else stopNetwork()
        if ("beacon" in on) startBeacon() else stopBeacon()
    }
    fun stop() {
        sm.unregisterListener(this); registered.clear(); stepBaseline = null; steps = 0; runtime.io.execute { pressureBaselines.clear(); stepCounters.clear() }
        stopNetwork(); stopBeacon()
    }
    private fun stopNetwork() { networkCallback?.let { runCatching { (c.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(it) } }; networkCallback = null }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    override fun onSensorChanged(e: SensorEvent) {
        if (!coordinator.foreground) return
        when (e.sensor.type) {
            Sensor.TYPE_STEP_COUNTER -> {
                val current = e.values[0]; val base = stepBaseline
                if (base == null || current < base) { stepBaseline = current; return }
                steps = (current - base).toInt().coerceAtLeast(0)
                if (steps == 0) return
                // Each opted-in server has its own baseline and interval; counts before opt-in are never included.
                val snapshot = current
                runtime.io.execute {
                    runtime.servers().forEach { s -> if ("steps" in runtime.active(s)) {
                        val id = "${s.id}:steps:${runtime.record(s).optInt("selection_revision")}"; val now = android.os.SystemClock.elapsedRealtime()
                        val prev = stepCounters[id]
                        if (prev == null || snapshot < prev) { stepCounters[id] = snapshot; last[id] = now }
                        else if (now - (last[id] ?: now) >= interval(s, "steps", 300) * 1000) {
                            runtime.emitTo(s, "steps", JSONObject().put("steps_delta", (snapshot - prev).toInt()).put("floors_available", false))
                            stepCounters[id] = snapshot; last[id] = now
                        }
                    } else stepCounters.keys.removeAll { it.startsWith("${s.id}:steps:") } }
                }
            }
            Sensor.TYPE_PRESSURE -> {
                val pressure = e.values[0]; if (!pressure.isFinite() || pressure <= 0) return
                val sampleAt = android.os.SystemClock.elapsedRealtime()
                if (sampleAt - lastPressureSampleAt < 60000) return
                lastPressureSampleAt = sampleAt
                runtime.io.execute {
                    runtime.servers().forEach { s -> if ("altitude" in runtime.active(s)) {
                        val id = "${s.id}:altitude:${runtime.record(s).optInt("selection_revision")}"; val now = android.os.SystemClock.elapsedRealtime()
                        val previous = pressureBaselines[id]
                        if (previous == null) { pressureBaselines[id] = pressure; last[id] = now }
                        else if (now - (last[id] ?: now) >= interval(s, "altitude", 300) * 1000) {
                            runtime.emitTo(s, "altitude", JSONObject().put("relative_change_m", SensorManager.getAltitude(previous, pressure).toDouble()))
                            pressureBaselines[id] = pressure; last[id] = now
                        }
                    } else pressureBaselines.keys.removeAll { it.startsWith("${s.id}:altitude:") } }
                }
            }
        }
    }
    private val stepCounters = mutableMapOf<String, Float>()
    private fun interval(s: Server, key: String, min: Long) = (runtime.config(s).optJSONObject("sensors")?.optJSONObject("intervals_s")?.optLong(key) ?: 0).coerceAtLeast(min)
    @Suppress("DEPRECATION")
    private fun network(caps: NetworkCapabilities?) {
        if (!coordinator.foreground || "network" !in coordinator.activeUnion()) return
        val kind = when {
            caps == null -> "none"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            else -> "other"
        }
        val info = if (Build.VERSION.SDK_INT >= 31) caps?.transportInfo as? WifiInfo else (c.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager).connectionInfo
        val ssid = if (kind == "wifi" && SensorPermissions.fine(c)) info?.ssid?.trim('"')?.takeIf { it != "<unknown ssid>" && it.isNotBlank() } else null
        runtime.io.execute {
            runtime.servers().forEach { s -> if ("network" in runtime.active(s)) {
                val id = "${s.id}:network"; val now = android.os.SystemClock.elapsedRealtime()
                if (now - (last[id] ?: -60000) < interval(s, "network", 60) * 1000) return@forEach
                last[id] = now
                val sites = runtime.config(s).optJSONArray("wifi_sites")
                runtime.emitTo(s, "network", JSONObject().put("network", kind).put("network_ssid", if (ssid == null) "unavailable" else "available"))
                if (ssid != null && sites != null) for (i in 0 until sites.length()) {
                    val site = sites.optJSONObject(i) ?: continue
                    val salt = site.optString("ssid_hash_salt"); if (salt.isEmpty()) continue
                    val hash = PresencePolicy.hashSsid(salt, ssid)
                    runtime.emitTo(s, "network", JSONObject().put("network", kind).put("site_id", site.optString("site_id"))
                        .put("ssid_hash", hash))
                }
            } }
        }
    }
    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            if (!coordinator.foreground || "beacon" !in coordinator.activeUnion()) return
            val data = result.scanRecord?.getManufacturerSpecificData(0x004c) ?: return
            val uuid = BeaconPolicy.uuid(data) ?: return
            val bucket = BeaconPolicy.proximity(result.rssi)
            runtime.io.execute {
                runtime.servers().forEach { s -> if ("beacon" in runtime.active(s)) {
                    val list = runtime.config(s).optJSONArray("beacons") ?: return@forEach
                    for (i in 0 until list.length()) {
                        val beacon = list.optJSONObject(i) ?: continue
                        if (!beacon.optString("uuid").equals(uuid, true)) continue
                        val site = beacon.optString("site_id"); val id = "${s.id}:beacon:$site"; val now = android.os.SystemClock.elapsedRealtime()
                        if (now - (last[id] ?: -60000) < interval(s, "beacon", 60) * 1000) continue
                        last[id] = now
                        runtime.emitTo(s, "beacon", JSONObject().put("site_id", site).put("proximity", bucket))
                    }
                } }
            }
        }
        override fun onScanFailed(errorCode: Int) { scanning = false }
    }
    private fun scanner() = (c.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter?.bluetoothLeScanner
    private fun startBeacon() {
        if (scanning || !SensorPermissions.requests("beacon").all { SensorPermissions.granted(c, it) }) return
        val filters = runtime.servers().filter { "beacon" in runtime.active(it) }.flatMap { s ->
            val list = runtime.config(s).optJSONArray("beacons")
            (0 until (list?.length() ?: 0)).mapNotNull { list?.optJSONObject(it)?.optString("uuid") }
        }.distinct().take(20).mapNotNull { id -> BeaconPolicy.filterData(id)?.let { ScanFilter.Builder().setManufacturerData(0x004c, it).build() } }
        if (filters.isEmpty()) return // Never do an unrestricted Bluetooth scan.
        try { scanner()?.startScan(filters, ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_POWER).build(), scanCallback); scanning = true; main.postDelayed(stopScan, 10000) }
        catch (_: SecurityException) { scanning = false }
    }
    private fun stopBeacon() { main.removeCallbacks(stopScan); if (scanning) try { scanner()?.stopScan(scanCallback) } catch (_: SecurityException) {}; scanning = false }
}
