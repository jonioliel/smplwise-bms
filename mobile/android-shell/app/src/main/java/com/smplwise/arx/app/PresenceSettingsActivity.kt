package com.smplwise.arx.app

import android.os.Bundle
import android.widget.FrameLayout

class PresenceSettingsActivity : LockedActivity() {
    private var panel: PresenceUi? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val server = ServerStore(this).servers().firstOrNull { it.id == intent.getStringExtra("server_id") } ?: run { finish(); return }
        val root = FrameLayout(this); setContentView(root)
        panel = PresenceUi(this, root, server, null, {}, {}, true)
    }
    override fun onResume() { super.onResume(); panel?.resume() }
    override fun onLockChanged(locked: Boolean) { if (!locked) panel?.resume() }
    override fun onDestroy() { panel?.destroy(); super.onDestroy() }
}
