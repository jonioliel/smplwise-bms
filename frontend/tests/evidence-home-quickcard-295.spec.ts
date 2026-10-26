import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// QUICKHIDE-295 (FIX2231B): the home's quick-actions widget (the "תאורה" / "הכל" pills) can be hidden from הגדרות › מסך ראשי
// (`home.screen.quick_card`, default show). Hidden: the widget is absent and the cards left take the whole row (no hole), on a
// phone, a tablet and the desktop, with no scrolling added. Demo mode: `?hs_quick_card=hide` chooses it.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-home-quickcard-295.spec.ts --project=desktop
// Screenshots: docs/design/evidence/QUICKHIDE-295/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/QUICKHIDE-295');
const VP = { d: { width: 1366, height: 768 }, t: { width: 1024, height: 1366 }, m: { width: 390, height: 844 } } as const;
type Vp = keyof typeof VP;

async function open(page: Page, vp: Vp, q = '') {
  await page.setViewportSize(VP[vp]);
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.install({ time: new Date('2026-10-23T09:00:00Z') });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&hs_state=site${q}#/devices/building`);
  await page.waitForSelector('sw-app devices-building');
  await page.locator('sw-app devices-building sw-kpi').first().waitFor();
  await page.waitForTimeout(350);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

const B = (page: Page) => page.locator('sw-app devices-building');
const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Per row of cards (same top): how far its cards' union is from the widget area's two edges - 0 = no hole. */
const rowGaps = (page: Page) =>
  page.evaluate(() => {
    const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('devices-building')?.shadowRoot?.querySelector('home-widgets');
    const root = host?.shadowRoot;
    const wrap = root?.querySelector('.wrap') as HTMLElement | null;
    if (!wrap) return null;
    const w = wrap.getBoundingClientRect();
    const rows = new Map<number, { l: number; r: number }>();
    for (const el of Array.from(root!.querySelectorAll('[data-home-widget]'))) {
      const b = (el as HTMLElement).getBoundingClientRect();
      if (!b.width) continue;
      const k = Math.round(b.top / 6);
      const cur = rows.get(k) ?? { l: b.left, r: b.right };
      rows.set(k, { l: Math.min(cur.l, b.left), r: Math.max(cur.r, b.right) });
    }
    return { count: rows.size, gaps: [...rows.values()].map((r) => Math.max(r.l - w.left, w.right - r.r)) };
  });

for (const vp of ['d', 'm', 't'] as const) {
  test(`${vp}: the quick-actions widget is shown by default (unchanged)`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
    await open(page, vp);
    const q = B(page).locator('home-widgets [data-home-widget="quick"]');
    if (vp === 't') await expect(q).toHaveCount(vp === 't' && VP.t.width > VP.t.height ? 0 : 1);
    else await expect(q).toHaveCount(1);
    await shot(page, `quick-shown-${vp}`);
  });

  test(`${vp}: hidden - the widget is absent, the cards fill the row, nothing scrolls sideways`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
    await open(page, vp, '&hs_quick_card=hide');
    await expect(B(page).locator('home-widgets [data-home-widget="quick"]')).toHaveCount(0);
    await expect(B(page).locator('[data-quick-pill], [data-home-quick-pill]')).toHaveCount(0);
    const g = await rowGaps(page);
    expect(g).not.toBeNull();
    for (const gap of g!.gaps) expect(gap).toBeLessThanOrEqual(2);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await shot(page, `quick-hidden-${vp}`);
  });
}
