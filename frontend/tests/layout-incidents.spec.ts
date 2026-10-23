import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-LIVEEVENT100 F-04 / F-05: the live event page holds the owner's hard rule of 2026-10-24 - NO scrolling at all in a control screen.
// The static demo (no backend: fake data in the shape of the API) at 1366x768, 1920x1080, 1280x720, 1024x768, 768x1024 and the phone
// 390x844, light and dark; every phone part; the settings sheet; the list page. Per case: the shell's <main> is not scrolled and has
// nothing to scroll, no inner panel overflows, the document does not scroll sideways, and the plan is never mirrored by RTL.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-incidents.spec.ts --project=desktop
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/liveevent-100');
const DETAIL = '/investigate/incidents/demo-incident';
const SIZES = [
  { w: 1366, h: 768 }, { w: 1920, h: 1080 }, { w: 1280, h: 720 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 },
];

async function open(page: Page, hash: string, scheme: 'light' | 'dark') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}#${hash}`);
  await expect(page.locator('sw-app investigate-incidents')).toBeAttached();
}

/** No scroll anywhere: the shell's main, the document, and every panel of the page (an inner overflow would hide content). */
async function noScroll(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const app = document.querySelector('sw-app')!;
    const main = app.shadowRoot!.querySelector('main')!;
    const scr = app.shadowRoot!.querySelector('investigate-incidents')!.shadowRoot!;
    const panels = [...scr.querySelectorAll<HTMLElement>('.panel, .chain, .drs, .rows, .tiles')].filter((e) => e.offsetParent !== null)
      .map((e) => ({ k: `${e.className}:${e.dataset.pane ?? ''}`, over: e.scrollHeight - e.clientHeight, side: e.scrollWidth - e.clientWidth }));
    const de = document.documentElement;
    return { top: main.scrollTop, mh: main.scrollHeight - main.clientHeight, mw: main.scrollWidth - main.clientWidth, dh: de.scrollHeight - de.clientHeight, dw: de.scrollWidth - de.clientWidth, panels };
  });
  expect(m.top, `${label}: scrollTop`).toBe(0);
  expect(m.mh, `${label}: main scrollHeight <= clientHeight`).toBeLessThanOrEqual(1);
  expect(m.mw, `${label}: main scrollWidth <= clientWidth`).toBeLessThanOrEqual(1);
  expect(m.dh, `${label}: document height`).toBeLessThanOrEqual(1);
  expect(m.dw, `${label}: document width`).toBeLessThanOrEqual(1);
  for (const p of m.panels) {
    expect(p.over, `${label}: inner overflow ${p.k}`).toBeLessThanOrEqual(1);
    expect(p.side, `${label}: inner side overflow ${p.k}`).toBeLessThanOrEqual(1);
  }
}

test.describe('live event: no scrolling', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  for (const scheme of ['light', 'dark'] as const) {
    for (const s of SIZES) {
      test(`detail ${s.w}x${s.h} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: s.w, height: s.h });
        await open(page, DETAIL, scheme);
        const scr = page.locator('sw-app investigate-incidents');
        await expect(scr.locator('[data-incident-chain] [data-step]').first()).toBeAttached(); // below 1200 px the chain is its own part
        await expect(scr.locator('[data-incident-tile]').first()).toBeAttached();
        await page.waitForTimeout(500);
        if (s.w >= 1200) {
          await expect(scr.locator('[data-incident-parts]')).toBeHidden();
          for (const pane of ['map', 'cams', 'doors', 'chain']) await expect(scr.locator(`[data-pane="${pane}"]`).first()).toBeVisible();
          await noScroll(page, `${s.w}x${s.h}`);
          // the plan is never mirrored: the map box is left-to-right whatever the page direction
          expect(await scr.locator('[data-incident-map]').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
        } else {
          await expect(scr.locator('[data-incident-parts]')).toBeVisible();
          // cameras first (owner 2026-10-24), then every part on its own
          await expect(scr.locator('[data-part-btn="cams"]')).toHaveAttribute('aria-pressed', 'true');
          for (const part of ['cams', 'map', 'doors', 'chain']) {
            await scr.locator(`[data-part-btn="${part}"]`).click();
            await expect(scr.locator(`[data-pane="${part}"]`).first()).toBeVisible();
            await page.waitForTimeout(250);
            await noScroll(page, `${s.w}x${s.h} part ${part}`);
          }
          await scr.locator('[data-part-btn="cams"]').click();
        }
        // the live budget: desktop 4 live, phone / tablet 1 live + snapshots (demo: the illustrated tiles keep the same markers)
        const live = await scr.locator('[data-incident-tile][data-live="true"]').count();
        expect(live).toBe(s.w >= 1200 ? 4 : 1);
        await page.screenshot({ path: path.join(OUT, `detail-${s.w}x${s.h}-${scheme}.png`) });
      });
    }
  }

  test('phone: 44 px targets for the part switch', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, DETAIL, 'light');
    const h = await page.locator('sw-app investigate-incidents [data-part-btn="map"]').evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
  });

  test('tapping a snapshot swaps it in; the budget never grows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, DETAIL, 'light');
    const scr = page.locator('sw-app investigate-incidents');
    await expect(scr.locator('[data-incident-tile="c1"]')).toHaveAttribute('data-live', 'true');
    await scr.locator('[data-incident-tile="c3"]').click();
    await expect(scr.locator('[data-incident-tile="c3"]')).toHaveAttribute('data-live', 'true');
    await expect(scr.locator('[data-incident-tile="c1"]')).toHaveAttribute('data-live', 'false');
    expect(await scr.locator('[data-incident-tile][data-live="true"]').count()).toBe(1);
  });

  for (const s of [{ w: 1366, h: 768 }, { w: 390, h: 844 }]) {
    test(`settings sheet and list page ${s.w}x${s.h}`, async ({ page }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      await open(page, DETAIL, 'light');
      const scr = page.locator('sw-app investigate-incidents');
      await scr.locator('[data-incident-settings-open]').click();
      const form = scr.locator('incident-settings-form');
      await expect(form.locator('[data-setting="incident.enabled"]')).toBeVisible();
      await expect(form.locator('[data-setting="incident.max_live"]')).toHaveValue('4');
      await expect(form.locator('[data-setting="incident.merge_window_s"]')).toHaveValue('5'); // minutes on screen, seconds stored
      await page.waitForTimeout(300);
      await noScroll(page, `${s.w} sheet`);
      await page.screenshot({ path: path.join(OUT, `sheet-${s.w}x${s.h}.png`) });
      await form.locator('[data-settings-close]').click();
      await open(page, '/investigate/incidents', 'light');
      await expect(scr.locator('[data-incidents-list]')).toBeVisible();
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => { const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!; return main.scrollHeight - main.clientHeight; });
      expect(m, 'the list fits too').toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(OUT, `list-${s.w}x${s.h}.png`) });
    });
  }
});
