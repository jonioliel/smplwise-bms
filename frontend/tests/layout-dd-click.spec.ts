import { test, expect, type Page } from '@playwright/test';
import { installBubbleMock } from './bubble-mocks';

// Header dropdown placements 2-4 (ui.dd_place): the chip on the title row must open and EVERY option must be reachable by a real click
// and by the keyboard, on the home area ("מבט על" / "קברניט", #/devices/building <-> #/devices/schedules).
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test tests/layout-dd-click.spec.ts --project=desktop --workers=1

type Place = '1' | '2' | '3' | '4';
async function stage(page: Page, place: Place, hash: string) {
  await installBubbleMock(page);
  await page.addInitScript((p) => {
    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await orig(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method !== 'GET' || !res.ok) return res;
      if (new URL(url, location.href).pathname.endsWith('/api/v1/settings')) {
        const body = (await res.clone().json()) as { settings?: Record<string, unknown> };
        return new Response(JSON.stringify({ ...body, settings: { ...(body.settings ?? {}), 'ui.tabs_mode': 'dropdown', 'ui.dd_place': p } }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return res;
    };
    try {
      localStorage.removeItem('sw.dd.place');
      localStorage.removeItem('sw.tabs.mode');
    } catch {
      /* storage unavailable */
    }
  }, place);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  await page.waitForTimeout(2500);
}

/** What stands at the centre of the chip (deep hit test through the shadow roots) */
const hitAt = (page: Page, sel: string) =>
  page.locator('sw-app').evaluate((app, s) => {
    const host = app.shadowRoot!.querySelector(s) as HTMLElement | null;
    if (!host) return { found: false } as const;
    // the visible chip: the button inside the tab group's dropdown (placement 4 stretches the host wider than the chip)
    const el = ((host.shadowRoot?.querySelector('sw-dropdown') as HTMLElement | null)?.shadowRoot?.querySelector('button') as HTMLElement | null) ?? host;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    let top: Element | null = document.elementFromPoint(x, y);
    const path: string[] = [];
    while (top && top.shadowRoot) {
      path.push(top.localName);
      const inner = top.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === top) break;
      top = inner;
    }
    path.push(top?.localName ?? 'none');
    const mine = el === top || el.contains(top) || (top?.getRootNode() instanceof ShadowRoot && el.shadowRoot?.contains(top as Node)) || path.includes(el.localName);
    return { found: true, path, mine, place: app.getAttribute('data-dd-place'), fb: app.getAttribute('data-dd-fallback'), rect: [r.left, r.top, r.width, r.height] } as const;
  }, sel);

const sel = '.subnav[data-tabstyle="dropdown"] > sw-tabs, .tabpair:not(.single) > sw-tabs';
const LABEL: Record<string, string> = { 'devices/building': 'מבט על', 'devices/schedules': 'קברניט' };

for (const p of ['1', '2', '3', '4'] as const) {
  for (const [from, to] of [['devices/building', 'devices/schedules'], ['devices/schedules', 'devices/building']] as const) {
    test(`placement ${p}: the chip on #/${from} wins the hit test, opens, and switches to #/${to} by click`, async ({ page }) => {
      await stage(page, p, `/${from}`);
      const h = await hitAt(page, sel);
      expect(h.found).toBe(true);
      if (!h.found) return;
      expect(h.place, 'the placement is the asked one, not a fallback').toBe(p);
      // the topmost element at the chip's centre is the chip itself (not a page header drawn over it)
      expect(h.path[0], `hit path ${JSON.stringify(h.path)}`).toBe('sw-app');
      expect(h.path.includes('sw-tabs'), `hit path ${JSON.stringify(h.path)}`).toBe(true);
      expect(h.path.includes('devices-schedules'), `hit path ${JSON.stringify(h.path)}`).toBe(false);
      await page.locator('sw-app').locator(sel).first().locator('button').first().click({ timeout: 5000 });
      const opt = page.getByRole('option', { name: LABEL[to] });
      await expect(opt).toBeVisible();
      await opt.click({ timeout: 5000 });
      await expect.poll(() => page.evaluate(() => location.hash)).toMatch(to === 'devices/schedules' ? /#\/devices\/(schedules|automations)/ : /#\/devices\/building/);
    });
  }
}

test('placement 4: the other option is reachable by the keyboard', async ({ page }) => {
  await stage(page, '4', '/devices/schedules');
  await page.locator('sw-app').locator(sel).first().locator('button').first().click({ timeout: 5000 });
  await expect(page.getByRole('option', { name: 'מבט על' })).toBeVisible();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('#/devices/building');
});
