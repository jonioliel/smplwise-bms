import { test, expect, type Page, type Route } from '@playwright/test';

// HEALTH-GO2RTC-2430 (docs/changes/HEALTH-GO2RTC-2430.md), demo mode with a mocked GET /api/v1/health/video and a fake WebSocket:
// lab 11.11 - the video service was stopped for two days; tiles retried every ~35 s, and HA ingress turned the relay's 4503 into a plain
// close 1000 so no tile knew why. Here:
// - the relay's error frame (`media_unavailable`) gives one plain message (+ the administrator's hint), no own retry of the tile, and an
//   automatic reconnect when the watch hears the service is back;
// - a socket that opens and closes 1000 before any frame (the ingress case) asks the server and shows the same message;
// - a tile mounted while the tab already knows the service is down opens no socket at all.
// What it does not prove: the real HA ingress, a real go2rtc outage (the lab check).

type Mode = 'frame' | 'bare' | 'ok';

const FAKE_WS = () => {
  const w = window as unknown as { __wsMode: string; __sockets: number };
  w.__wsMode = 'frame';
  w.__sockets = 0;
  class Fake extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    binaryType = 'blob';
    onopen: ((e: Event) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: unknown = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    constructor(public url: string) {
      super();
      w.__sockets += 1;
      const mode = w.__wsMode;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
        if (mode === 'ok') return; // stays open, says nothing: the tile is "connecting" again
        setTimeout(() => {
          if (mode === 'frame') this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'error', value: 'media_unavailable', message: 'שירות הווידאו לא זמין', media: 'unreachable' }) }));
          this.readyState = 3;
          this.onclose?.(new CloseEvent('close', { code: 1000 })); // what HA ingress delivers instead of 4503
        }, 30);
      }, 20);
    }
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  (window as unknown as { WebSocket: unknown }).WebSocket = Fake;
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = function () {
    throw new Error('no WebRTC in this spec');
  };
};

async function videoState(page: Page, state: { value: string; calls: number }) {
  await page.route('**/api/v1/health/video*', (route: Route) => {
    state.calls += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: state.value, configured: true, since: '2026-11-11T08:00:00Z', down_for_s: 60, last_ok_at: null, last_error_at: null, last_error: 'ConnectError', failures: 3, retry_in_s: 20 }) });
  });
}

async function mountPlayer(page: Page, id: string, props: Record<string, unknown>) {
  await page.evaluate(
    ({ id, p }) => {
      const el = document.createElement('sw-live-player') as unknown as HTMLElement & Record<string, unknown>;
      el.id = id;
      el.style.cssText = `position:fixed;inset:${id === 'probe' ? 20 : 310}px auto auto 20px;width:480px;height:270px;z-index:99999`;
      Object.assign(el, p);
      document.body.append(el);
    },
    { id, p: props },
  );
}

async function open(page: Page) {
  await page.goto('/#/live/wall');
  await page.locator('sw-app[data-shell-ready]').waitFor();
  await page.evaluate(() => customElements.whenDefined('sw-live-player'));
}

const sockets = (page: Page) => page.evaluate(() => (window as unknown as { __sockets: number }).__sockets);
const setMode = (page: Page, m: Mode) => page.evaluate((mode) => ((window as unknown as { __wsMode: string }).__wsMode = mode), m);

test('the relay says the service is down: one message, no retry storm, reconnects by itself on recovery', async ({ page }) => {
  test.setTimeout(60_000);
  const state = { value: 'unreachable', calls: 0 };
  await videoState(page, state);
  await page.addInitScript(FAKE_WS);
  await open(page);
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: true });
  const err = page.locator('#probe [data-player-error]');
  await expect(err).toHaveText('שירות הווידאו לא זמין', { timeout: 10_000 });
  await expect(page.locator('#probe [data-video-service-hint]')).toBeVisible();
  await expect(page.locator('#probe')).toHaveJSProperty('status', 'error');
  await expect(page.locator('#probe')).not.toContainText('מתחבר');
  await page.screenshot({ path: test.info().outputPath('video-service-down.png') });
  // no retry of its own: the shared watch re-checks the server (5 s, then 10 s ...) - the tile opens no socket meanwhile
  const n = await sockets(page);
  await page.waitForTimeout(3_000);
  expect(await sockets(page)).toBe(n);
  // recovery: the next check says reachable and the tile reconnects without a click
  state.value = 'reachable';
  await setMode(page, 'ok');
  await expect.poll(() => sockets(page), { timeout: 20_000 }).toBe(n + 1);
  await expect(page.locator('#probe')).toHaveJSProperty('status', 'connecting');
  await expect(page.locator('#probe [data-player-error]')).toHaveCount(0);
});

test('a close 1000 before any frame (HA ingress) is checked against the server, and a later tile opens no socket', async ({ page }) => {
  const state = { value: 'unreachable', calls: 0 };
  await videoState(page, state);
  await page.addInitScript(FAKE_WS);
  await open(page);
  await setMode(page, 'bare');
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: true });
  await expect(page.locator('#probe [data-player-error]')).toHaveText('שירות הווידאו לא זמין', { timeout: 10_000 });
  expect(state.calls, 'the player asked the server why the socket closed').toBeGreaterThanOrEqual(1);
  const n = await sockets(page);
  await mountPlayer(page, 'probe2', { cameraId: 'probe-cam-2', mode: 'mse', retry: true });
  await expect(page.locator('#probe2 [data-player-error]')).toHaveText('שירות הווידאו לא זמין');
  expect(await sockets(page), 'the tab already knew: the second tile never opened a socket').toBe(n);
});

test('a close 1000 before any frame while the service answers is the old path (not blamed on the service)', async ({ page }) => {
  const state = { value: 'reachable', calls: 0 };
  await videoState(page, state);
  await page.addInitScript(FAKE_WS);
  await open(page);
  await setMode(page, 'bare');
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: false });
  await expect(page.locator('#probe [data-player-error]')).toHaveText('החיבור נסגר', { timeout: 10_000 });
  await expect(page.locator('#probe [data-video-service-hint]')).toHaveCount(0);
});
