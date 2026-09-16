import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T056: (1) the Lovelace card, loaded in a harness with a fake `hass`, creates the Ingress session and
// embeds the VMS route for its view with embed=1 and no secret in its config; (2) the VMS itself, opened with
// embed=1 against the running developer backend, renders the screen without its chrome. SW_LIVE=1 only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T056-lovelace-live');
const CARD = path.resolve(HERE, '..', '..', 'smplwise_vms', 'integration', 'smplwise_bridge', 'www', 'smplwise-card.js');

test.describe('Lovelace card (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('card harness: ingress session, iframe route, no secret; VMS embed mode has no chrome', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto('/');  // the harness needs a real origin for document.cookie; the app's own is fine
    await page.setContent('<html><body style="background:#f4f6fb;padding:16px"><div id="host"></div></body></html>');
    await page.addScriptTag({ path: CARD });
    const result = await page.evaluate(async () => {
      const calls: { method: string; path: string }[] = [];
      const hass = {
        callApi: async (method: string, p: string) => {
          calls.push({ method, path: p });
          if (p.startsWith('hassio/addons/')) return { ingress_url: '/api/hassio_ingress/TESTTOKEN' };
          if (p === 'hassio/ingress/session') return { session: 'sess-123' };
          return {};
        },
      };
      const el = document.createElement('smplwise-card') as HTMLElement & { setConfig: (c: unknown) => void; hass: unknown; getCardSize: () => number };
      el.setConfig({ view: 'camera', camera: 'cam-1', height: 300, title: 'כניסה' });
      document.getElementById('host')!.appendChild(el);
      el.hass = hass;
      for (let i = 0; i < 50 && !el.shadowRoot?.querySelector('iframe'); i++) await new Promise((r) => setTimeout(r, 50));
      const iframe = el.shadowRoot?.querySelector('iframe') as HTMLIFrameElement | null;
      return { calls, src: iframe?.getAttribute('src'), cookie: document.cookie, size: el.getCardSize(), registered: (window as unknown as { customCards: { type: string }[] }).customCards.some((c) => c.type === 'smplwise-card') };
    });
    testInfo.annotations.push({ type: 'card', description: JSON.stringify(result) });
    expect(result.src).toBe('/api/hassio_ingress/TESTTOKEN/#/live/cameras/cam-1?embed=1');
    expect(result.calls.map((c) => c.path)).toEqual(['hassio/addons/0b8c26d5_smplwise_vms/info', 'hassio/ingress/session']);
    expect(result.registered).toBe(true);
    expect(result.size).toBe(6);
    // a bad view is refused at configuration time
    const bad = await page.evaluate(() => {
      const el = document.createElement('smplwise-card') as HTMLElement & { setConfig: (c: unknown) => void };
      try {
        el.setConfig({ view: 'admin' });
        return 'accepted';
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(bad).toContain('view must be one of');

    // the VMS in embed mode: the screen renders, the shell chrome does not
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras as { id: string }[];
    await page.goto('about:blank'); // leave the harness document: the next goto must be a real navigation, not a hash change
    await page.goto(`/#/live/cameras/${cams[0].id}?embed=1`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app')).toHaveAttribute('data-embed', '', { timeout: 30_000 });
    await expect(page.locator('sw-app nav')).toHaveCount(0);
    await expect(page.locator('live-camera')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `embed-camera-${testInfo.project.name}.png`) });
    // in-app navigation keeps the chrome hidden for the session
    await page.goto('/#/investigate/events');
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app')).toHaveAttribute('data-embed', '', { timeout: 30_000 });
    await expect(page.locator('sw-app nav')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `embed-events-${testInfo.project.name}.png`) });
  });
});
