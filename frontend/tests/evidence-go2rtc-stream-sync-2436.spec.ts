import { test, expect, type Page } from '@playwright/test';

// GO2RTC-STREAM-SYNC-2436 (docs/changes/GO2RTC-STREAM-SYNC-2436.md), demo mode with a fake WebSocket: lab 12.11 (row 10) - a playback
// socket of a replaced generation reached the browser through HA ingress as a plain close 1000, not 4410, so the player could not
// tell "another seek owns the session" from "the recording ended". The relay now sends `{"type":"replaced"}` first. Here:
// - the frame then a close 1000 is "replaced" (4410: 'הסשן הוחלף', no retry), also while playing (before: shown as "ended");
// - without the frame a close 1000 while playing is still the end of the recording.
// What it does not prove: the real HA ingress (the lab check).

const FAKE_WS = () => {
  const w = window as unknown as { __sockets: Fake[]; __closeWith: (replaced: boolean) => void };
  w.__sockets = [];
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
      w.__sockets.push(this);
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }, 20);
    }
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  w.__closeWith = (replaced: boolean) => {
    const s = w.__sockets[w.__sockets.length - 1];
    if (replaced) s.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'replaced', value: 'superseded' }) }));
    else s.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' }) }));
    s.readyState = 3;
    s.onclose?.(new CloseEvent('close', { code: 1000 })); // what HA ingress delivers instead of 4410
  };
  (window as unknown as { WebSocket: unknown }).WebSocket = Fake;
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = function () {
    throw new Error('no WebRTC in this spec');
  };
};

async function mount(page: Page) {
  await page.goto('/#/live/wall');
  await page.locator('sw-app[data-shell-ready]').waitFor();
  await page.evaluate(() => customElements.whenDefined('sw-live-player'));
  await page.evaluate(() => {
    const w = window as unknown as { __status: { status: string; code?: number | string }[] };
    w.__status = [];
    const el = document.createElement('sw-live-player') as unknown as HTMLElement & Record<string, unknown>;
    el.id = 'pb';
    el.style.cssText = 'position:fixed;inset:20px auto auto 20px;width:480px;height:270px;z-index:99999';
    Object.assign(el, { wsUrl: 'ws://127.0.0.1:9/api/v1/playback/sessions/s1/ws?generation=0', retry: false, mode: 'mse' });
    el.addEventListener('player-status', (e) => w.__status.push((e as CustomEvent).detail));
    document.body.append(el);
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sockets: unknown[] }).__sockets.length)).toBe(1);
  await page.waitForTimeout(60); // the fake socket opened
}

const lastStatus = (page: Page) => page.evaluate(() => (window as unknown as { __status: { status: string; code?: number | string }[] }).__status.at(-1));
const setPlaying = (page: Page) => page.evaluate(() => ((document.getElementById('pb') as unknown as { status: string }).status = 'playing'));

test('a replaced frame then close 1000 is "replaced" (4410), not a lost connection', async ({ page }) => {
  await page.addInitScript(FAKE_WS);
  await mount(page);
  await page.evaluate(() => (window as unknown as { __closeWith: (r: boolean) => void }).__closeWith(true));
  await expect(page.locator('#pb [data-player-error]')).toHaveText('הסשן הוחלף');
  expect(await lastStatus(page)).toMatchObject({ status: 'error', code: 4410 });
  await page.screenshot({ path: test.info().outputPath('playback-replaced.png') });
});

test('while playing: the replaced frame makes it 4410 (before: "ended"); without it a close 1000 is still the end', async ({ page }) => {
  await page.addInitScript(FAKE_WS);
  await mount(page);
  await setPlaying(page);
  await page.evaluate(() => (window as unknown as { __closeWith: (r: boolean) => void }).__closeWith(true));
  expect(await lastStatus(page)).toMatchObject({ status: 'error', code: 4410 });
  await expect(page.locator('#pb')).toHaveJSProperty('status', 'error');

  // the control: a fresh socket that closes 1000 after playing, with no replaced frame - the end of the recording
  await page.evaluate(() => (document.getElementById('pb') as unknown as { reconnect: () => void }).reconnect());
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sockets: unknown[] }).__sockets.length)).toBe(2);
  await page.waitForTimeout(60);
  await setPlaying(page);
  await page.evaluate(() => (window as unknown as { __closeWith: (r: boolean) => void }).__closeWith(false));
  expect(await lastStatus(page)).toMatchObject({ status: 'ended', code: 1000 });
});
