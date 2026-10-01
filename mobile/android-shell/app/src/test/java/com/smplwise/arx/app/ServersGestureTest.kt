package com.smplwise.arx.app

import com.smplwise.arx.app.ServersGesture.Mode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ServersGestureTest {
    // a 2000 px tall view at density 2: 120 dp = 240 px
    private fun trigger(
        mode: Mode, startY: Float = 1500f, endY: Float = 1000f, startX: Float = 500f, endX: Float = 520f,
        startSpread: Float = 300f, endSpread: Float = 310f, ms: Long = 300,
    ) = ServersGesture.isTrigger(mode, startY, endY, startX, endX, startSpread, endSpread, 2000f, ms, 2f)

    @Test fun `a quick vertical two-finger swipe up opens the list anywhere`() {
        assertTrue(trigger(Mode.ANYWHERE))
        assertTrue(trigger(Mode.ANYWHERE, startY = 600f, endY = 200f))
    }

    @Test fun `off never triggers`() = assertFalse(trigger(Mode.OFF))

    @Test fun `edge mode needs the swipe to start in the bottom quarter`() {
        assertTrue(trigger(Mode.EDGE, startY = 1700f, endY = 1100f))
        assertFalse(trigger(Mode.EDGE, startY = 1200f, endY = 700f))
    }

    @Test fun `too short, too slow, downward or sideways does not trigger`() {
        assertFalse(trigger(Mode.ANYWHERE, endY = 1400f)) // 100 px < 240 px
        assertFalse(trigger(Mode.ANYWHERE, ms = 1500))
        assertFalse(trigger(Mode.ANYWHERE, startY = 1000f, endY = 1500f))
        assertFalse(trigger(Mode.ANYWHERE, endX = 1100f))
    }

    @Test fun `a pinch is not a swipe`() = assertFalse(trigger(Mode.ANYWHERE, endSpread = 600f))

    @Test fun `stored value falls back to anywhere`() {
        assertEquals(Mode.ANYWHERE, Mode.of(null))
        assertEquals(Mode.ANYWHERE, Mode.of("garbage"))
        assertEquals(Mode.EDGE, Mode.of("edge"))
        assertEquals(Mode.OFF, Mode.of("off"))
    }
}
