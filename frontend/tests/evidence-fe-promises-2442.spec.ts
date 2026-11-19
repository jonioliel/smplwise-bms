import { test, expect, type Page } from '@playwright/test';

// CR-FE-PROMISES-2442 (docs/changes/CR-FE-PROMISES-2442.md), demo mode with a fake WebSocket and a fake RTCPeerConnection:
// the camera player's WebRTC start throws OUTSIDE the failures it expects (here: the browser refuses a transceiver). Before, that
// rejection vanished and the tile stayed on "מתחבר…" until the 60 s connecting cap. Now the attempt ends the usual way at once:
// - `webrtc` only: the player's error;
// - `auto`: a fresh socket for MSE.
// No screenshot is written. What it does not prove: a real browser that refuses a transceiver.

const FAKES = () => {
  const w = window as unknown as { __sockets: number };
  w.__sockets = 0;
  class Fake extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    binaryType = 'blob';
    onopen: ((e: Event) => void) | null = null;
    onclose: unknown = null;
    onerror: unknown = null;
    onmessage: unknown = null;
    constructor(public url: string) {
      super();
      w.__sockets += 1;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open')); // opens and says nothing more
      }, 20);
    }
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  (window as unknown as { WebSocket: unknown }).WebSocket = Fake;
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = function () {
    return {
      connectionState: 'new',
      addTransceiver() {
        throw new Error('this browser refuses a transceiver');
      },
      close() {},
    };
  };
};

async function open(page: Page) {
  await page.addInitScript(FAKES);
  await page.route('**/api/v1/health/video*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'reachable', configured: true }) }));
  await page.goto('/#/live/wall');
  await page.locator('sw-app[data-shell-ready]').waitFor();
  await page.evaluate(() => customElements.whenDefined('sw-live-player'));
}

async function mountPlayer(page: Page, props: Record<string, unknown>) {
  await page.evaluate((p) => {
    (window as unknown as { __sockets: number }).__sockets = 0; // only this player's sockets are counted
    const el = document.createElement('sw-live-player') as unknown as HTMLElement & Record<string, unknown>;
    el.id = 'probe';
    el.style.cssText = 'position:fixed;inset:20px auto auto 20px;width:480px;height:270px;z-index:99999';
    Object.assign(el, p);
    document.body.append(el);
  }, props);
}

const sockets = (page: Page) => page.evaluate(() => (window as unknown as { __sockets: number }).__sockets);

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one size is enough: no layout is involved');
});

test('WebRTC only: a start that throws is the player\'s error at once, not "connecting" until the cap', async ({ page }) => {
  await open(page);
  await mountPlayer(page, { cameraId: 'probe-cam', mode: 'webrtc', retry: false });
  await expect(page.locator('#probe [data-player-error]')).toHaveText('WebRTC לא נתמך בדפדפן', { timeout: 5_000 });
  await expect(page.locator('#probe')).toHaveJSProperty('status', 'error');
  await expect(page.locator('#probe')).not.toContainText('מתחבר');
  expect(await sockets(page)).toBe(1);
});

test('auto: a start that throws moves on to MSE on a fresh socket', async ({ page }) => {
  await open(page);
  await mountPlayer(page, { cameraId: 'probe-cam', mode: 'auto', retry: false });
  await expect.poll(() => sockets(page), { timeout: 5_000 }).toBe(2);
  await expect(page.locator('#probe')).toHaveJSProperty('transport', 'mse');
  await expect(page.locator('#probe [data-player-error]')).toHaveCount(0);
});
