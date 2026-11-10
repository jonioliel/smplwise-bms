import { test, expect, type Page } from '@playwright/test';
import { settle } from './helpers/settle';

// WARMUP-POLISH-2421 (docs/changes/WARMUP-POLISH-2421.md), demo mode (no backend):
// - the attention card of the live overview never scrolls inside on a desktop width; what does not fit is paged;
// - after the first screen is ready the common screens' chunks arrive while idle (the live overview's element is defined without
//   ever opening it);
// - the camera player: a socket that never opens ends in plain words with a retry (no endless "מתחבר…"); a browser without
//   WebRTC goes on to the MSE path.

const deep = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const out: Element[] = [];
    const walk = (r: Document | ShadowRoot) => {
      r.querySelectorAll(s).forEach((e) => out.push(e));
      r.querySelectorAll('*').forEach((e) => e.shadowRoot && walk(e.shadowRoot));
    };
    walk(document);
    return out.length;
  }, sel);

async function attention(page: Page) {
  return page.evaluate(() => {
    let card: HTMLElement | null = null;
    const walk = (r: Document | ShadowRoot) => {
      if (card) return;
      card = r.querySelector('sw-card[data-overview-attention]');
      if (!card) r.querySelectorAll('*').forEach((e) => e.shadowRoot && walk(e.shadowRoot));
    };
    walk(document);
    const c = card as HTMLElement | null;
    const body = c?.shadowRoot?.querySelector<HTMLElement>('.body');
    return c && body
      ? { scroll: body.scrollHeight, client: body.clientHeight, items: c.querySelectorAll('[data-overview-spot]').length, range: c.querySelector('[data-overview-spot-range]')?.textContent ?? null }
      : null;
  });
}

test.describe('attention card', () => {
  for (const vp of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    test(`does not scroll inside at ${vp.width}x${vp.height}; the rest is paged`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/#/live');
      await page.locator('sw-app[data-shell-ready]').waitFor();
      await expect.poll(async () => (await attention(page))?.items ?? 0).toBeGreaterThan(0);
      await settle(page);
      const a = (await attention(page))!;
      expect(a.scroll).toBeLessThanOrEqual(a.client + 1);
      if (a.items < 3) {
        // the demo has three items: the pager says which are shown and moves on
        expect(a.range).toMatch(/מתוך 3/);
        const before = a.range;
        await page.locator('[data-spot-next]').click();
        await settle(page);
        const b = (await attention(page))!;
        expect(b.range).not.toBe(before);
        expect(b.scroll).toBeLessThanOrEqual(b.client + 1);
      }
    });
  }

  test('below the desktop width every item is shown (the page scrolls as before)', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/#/live');
    await page.locator('sw-app[data-shell-ready]').waitFor();
    await expect.poll(async () => (await attention(page))?.items ?? 0).toBe(3);
    expect((await attention(page))!.range).toBeNull();
  });
});

test('the common screens are fetched while idle after the first screen', async ({ page }) => {
  await page.goto('/#/devices/building');
  await page.locator('sw-app[data-shell-ready]').waitFor();
  await expect.poll(() => page.evaluate(() => ['live-overview', 'live-wall', 'devices-area'].every((t) => !!customElements.get(t))), { timeout: 30_000 }).toBe(true);
  expect(await deep(page, 'live-overview')).toBe(0); // fetched, never rendered
});

const NEVER_OPEN = () => {
  // a socket that stays CONNECTING (a proxy holding the upgrade, no media server)
  class Stuck extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    binaryType = 'blob';
    onopen: unknown = null;
    onclose: unknown = null;
    onerror: unknown = null;
    onmessage: unknown = null;
    constructor(public url: string) {
      super();
      (window as unknown as { __sockets: number }).__sockets = ((window as unknown as { __sockets?: number }).__sockets ?? 0) + 1;
    }
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  (window as unknown as { WebSocket: unknown }).WebSocket = Stuck;
};

async function mountPlayer(page: Page, props: Record<string, unknown>) {
  await page.goto('/#/live/wall');
  await page.locator('sw-app[data-shell-ready]').waitFor();
  await page.evaluate(() => customElements.whenDefined('sw-live-player'));
  await page.evaluate((p) => {
    const el = document.createElement('sw-live-player') as unknown as HTMLElement & Record<string, unknown>;
    el.id = 'probe';
    el.style.cssText = 'position:fixed;inset:20px auto auto 20px;width:480px;height:270px;z-index:99999';
    Object.assign(el, p);
    document.body.append(el);
  }, props);
}

test('camera player: a socket that never opens ends in plain words with a retry', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(NEVER_OPEN);
  await mountPlayer(page, { wsUrl: 'ws://127.0.0.1:9/never', retry: false });
  const err = page.locator('#probe [data-player-error]');
  await expect(page.locator('#probe')).toHaveJSProperty('status', 'connecting');
  await expect(err).toHaveText('שרת הווידאו אינו עונה', { timeout: 15_000 });
  await expect(page.locator('#probe')).not.toContainText('go2rtc');
  const sockets = await page.evaluate(() => (window as unknown as { __sockets: number }).__sockets);
  await page.locator('#probe [data-player-retry]').click();
  await settle(page);
  await expect(page.locator('#probe')).toHaveJSProperty('status', 'connecting');
  expect(await page.evaluate(() => (window as unknown as { __sockets: number }).__sockets)).toBe(sockets + 1);
});

test('camera player: no WebRTC in the browser goes on to MSE instead of a stuck spinner', async ({ page }) => {
  await page.addInitScript(() => {
    class Open extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = 0;
      binaryType = 'blob';
      onopen: ((e: Event) => void) | null = null;
      onclose: unknown = null;
      onerror: unknown = null;
      onmessage: unknown = null;
      constructor(public url: string) {
        super();
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
    (window as unknown as { WebSocket: unknown }).WebSocket = Open;
    (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = function () {
      throw new Error('no WebRTC');
    };
  });
  await mountPlayer(page, { cameraId: 'probe-cam', mode: 'auto', retry: false });
  await expect(page.locator('#probe')).toHaveJSProperty('transport', 'mse', { timeout: 5_000 });
  await expect(page.locator('#probe')).toHaveJSProperty('status', 'connecting');
});
