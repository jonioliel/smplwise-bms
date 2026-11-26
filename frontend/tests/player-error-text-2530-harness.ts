import { expect, type Page, type Route } from '@playwright/test';

// PLAYER-ERROR-TEXT-2530: a demo-mode page with a fake WebSocket whose relay answers every socket with one error frame
// (`{"type":"error","value":<code>}`, the value set per page through `window.__wsValue`) and then stays open, and a mocked
// GET /api/v1/health/video that says the video service is reachable. Shared by the evidence, pixel and before/after capture specs.

export const FAKE_WS = () => {
  const w = window as unknown as { __wsValue: string; __sockets: number; __urls: string[] };
  w.__wsValue = w.__wsValue ?? 'upstream_error';
  w.__sockets = 0;
  w.__urls = [];
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
      w.__urls.push(url);
      const value = w.__wsValue;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
        setTimeout(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'error', value }) })), 30);
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

export async function openPage(page: Page, opts: { scheme?: 'light' | 'dark'; lang?: 'he' | 'en' } = {}): Promise<void> {
  await page.route('**/api/v1/health/video*', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'reachable', configured: true, since: null, down_for_s: null, last_ok_at: null, last_error_at: null, last_error: null, failures: 0, retry_in_s: null }) }),
  );
  if (opts.lang === 'en') await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* no storage */ } });
  await page.addInitScript(FAKE_WS);
  await page.goto(`/${opts.scheme ? `?scheme=${opts.scheme}` : ''}#/live/wall`);
  await page.locator('sw-app[data-shell-ready]').waitFor();
  await page.evaluate(() => customElements.whenDefined('sw-live-player'));
}

export const setValue = (page: Page, v: string) => page.evaluate((value) => ((window as unknown as { __wsValue: string }).__wsValue = value), v);
export const sockets = (page: Page) => page.evaluate(() => (window as unknown as { __sockets: number }).__sockets);

/** Mounts one player in a fixed box above the page (`phone`: the 360 px tile of a 390 px screen). */
export async function mountPlayer(page: Page, id: string, props: Record<string, unknown>, phone = false): Promise<void> {
  await page.evaluate(
    ({ id, p, phone }) => {
      document.getElementById(id)?.remove();
      const el = document.createElement('sw-live-player') as unknown as HTMLElement & Record<string, unknown>;
      el.id = id;
      el.style.cssText = phone ? 'position:fixed;inset:80px auto auto 15px;width:360px;height:203px;z-index:99999' : 'position:fixed;inset:80px auto auto 40px;width:480px;height:270px;z-index:99999';
      Object.assign(el, p);
      document.body.append(el);
    },
    { id, p: props, phone },
  );
}

/** Waits for the player's error state (any text: the capture spec also runs against the build before this row). */
export async function playerError(page: Page, id: string): Promise<void> {
  await expect(page.locator(`#${id}`)).toHaveJSProperty('status', 'error', { timeout: 10_000 });
  await expect(page.locator(`#${id} [data-player-error]`)).toBeVisible();
}
