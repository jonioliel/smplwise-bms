import { test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { AREA_PERMS, installBubbleMock } from './bubble-mocks';

// DEVICES-POLISH-2331 shoot harness, not a test: the layout editor (devices-layout.ts), the single-entity controls
// (devices-controls.ts, in the area screen's classic rows) and the automations screen (devices-automations.ts), at the
// five review sizes, light + dark. A mocked API boundary (bubble-mocks) or the demo mode; nothing here touches a device.
//   DP_OUT=<dir> DP_SCREENS=area,area-edit DP_SIZES=1440,390 SW_BASE_URL=http://127.0.0.1:4201/ npx playwright test tests/devpolish-2331-shoot.spec.ts --project=desktop
const OUT = process.env.DP_OUT ?? '';
const SIZES: Record<string, [number, number]> = { '1920': [1920, 1080], '1440': [1440, 900], '1180': [1180, 820], '1024': [1024, 768], '390': [390, 844] };
const SIZE_IDS = (process.env.DP_SIZES ?? Object.keys(SIZES).join(',')).split(',');
const SCHEMES = (process.env.DP_SCHEMES ?? 'light,dark').split(',') as ('light' | 'dark')[];
const ALL = 'area,area-edit,area-edit-card,area-edit-picker,tiles-covers,auto-rows,auto-cards,auto-empty,auto-offline,auto-loading';
const SCREENS = (process.env.DP_SCREENS ?? ALL).split(',');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function bootArea(page: Page, scheme: 'light' | 'dark', skin = 'classic') {
  await installBubbleMock(page, { perms: [...AREA_PERMS, 'system.configure'] });
  await page.route('**/api/v1/settings', (r) => json(r, { settings: { 'ui.design': 'a', 'ui.skin': skin, 'ui.scheme': scheme, 'devices.scheme': scheme, 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'home.info_style': 'cards' }, can_edit: true }));
  await page.route(/\/api\/v1\/devices\/layouts\/area\/[^/?]+(\?.*)?$/, (r) => json(r, { scope: 'area', id: 'living', desktop: null, phone: null, can_edit: true }));
  await page.route(/\/api\/v1\/devices\/pool(\?.*)?$/, (r) => json(r, { entities: [] }));
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#/devices/areas/living`);
  await page.locator('devices-area').waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function enterEdit(page: Page) {
  await page.locator('sw-app [data-profile-menu]:visible, sw-app [data-nav-me]:visible').first().click();
  await page.locator('sw-app sw-user-menu [data-menu-screen-edit="devices-layout"]').click();
  await page.locator('devices-area [data-layout-bar]').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
}

async function bootAuto(page: Page, scheme: 'light' | 'dark', auto: Record<string, unknown>, view = 'rows', hq = '') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
  await page.addInitScript((kv: Record<string, string>) => {
    try {
      localStorage.removeItem('sw.automations.view');
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    } catch {}
  }, { 'sw.automations.view': JSON.stringify(view), 'sw.demo.automations': JSON.stringify({ user: 'installer', scheme, ...auto }) });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${scheme}#/devices/automations${hq}`);
  await page.locator('devices-automations').waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1800);
}

const DEF: Record<string, (page: Page, scheme: 'light' | 'dark') => Promise<void>> = {
  area: (p, s) => bootArea(p, s),
  'area-edit': async (p, s) => {
    await bootArea(p, s);
    await enterEdit(p);
  },
  'area-edit-card': async (p, s) => {
    await bootArea(p, s);
    await enterEdit(p);
    await p.locator('devices-area .lay-item.lay-edit').nth(2).click({ position: { x: 30, y: 12 } });
    await p.waitForTimeout(500);
  },
  'area-edit-picker': async (p, s) => {
    await bootArea(p, s);
    await enterEdit(p);
    await p.locator('devices-area .lay-item.lay-edit[data-lay-key="card:lighting"]').click({ position: { x: 30, y: 12 } });
    await p.waitForTimeout(400);
    await p.locator('devices-area [data-layout-entities]').scrollIntoViewIfNeeded().catch(() => undefined);
    await p.waitForTimeout(300);
  },
  'tiles-covers': async (p, s) => {
    await bootArea(p, s);
    const c = p.locator('devices-area [data-control="cover"]').first();
    await c.scrollIntoViewIfNeeded().catch(() => undefined);
  },
  'auto-rows': (p, s) => bootAuto(p, s, {}),
  'auto-cards': (p, s) => bootAuto(p, s, {}, 'cards'),
  'auto-empty': (p, s) => bootAuto(p, s, { empty: true }),
  'auto-offline': (p, s) => bootAuto(p, s, { offline: true }),
  'auto-loading': (p, s) => bootAuto(p, s, {}, 'rows', '?state=loading'),
};

test.describe('DEVICES-POLISH-2331 shoot', () => {
  test.skip(!OUT, 'set DP_OUT to a directory to take the shots');
  for (const id of SCREENS) {
    for (const size of SIZE_IDS) {
      for (const scheme of SCHEMES) {
        test(`${id} ${size} ${scheme}`, async ({ page }, info) => {
          test.skip(info.project.name !== 'desktop', 'the sizes are set here; one project runs them');
          const [w, h] = SIZES[size];
          await page.setViewportSize({ width: w, height: h });
          await DEF[id](page, scheme);
          fs.mkdirSync(OUT, { recursive: true });
          await page.screenshot({ path: path.join(OUT, `${id}-${size}-${scheme}.png`) });
          const metrics = await page.evaluate(() => {
            const se = document.scrollingElement as HTMLElement;
            const deep = (root: Document | ShadowRoot, out: HTMLElement[] = []) => {
              for (const el of root.querySelectorAll<HTMLElement>('*')) {
                const cs = getComputedStyle(el);
                if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 200) out.push(el);
                if (el.shadowRoot) deep(el.shadowRoot, out);
              }
              return out;
            };
            return { page: se.scrollHeight - se.clientHeight, hscroll: se.scrollWidth - se.clientWidth, scrollers: deep(document).map((e) => `${e.tagName.toLowerCase()}.${e.className}`.slice(0, 60) + ` +${e.scrollHeight - e.clientHeight}`) };
          });
          fs.appendFileSync(path.join(OUT, 'metrics.txt'), `${id}-${size}-${scheme}: ${JSON.stringify(metrics)}\n`);
        });
      }
    }
  }
});
