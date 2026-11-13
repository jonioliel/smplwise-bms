import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { PIXEL_SKINS, pixelTitle, skinCheck } from './helpers/pixel-skins';

// AUDIT30-F-CALENDARS (round-30 operator/admin consistency audit, branch F; private/design-system-2026-10-27/round30/system-audit/FIXES.md §7).
// One regression check per fix, in demo mode (src/calendars/demo.ts: invented data, a fixed clock):
//   F1 (#4)  a selected floor chip is the Blue Wash pair (accent-soft / accent-text), never the black pill;
//   F2 (#6, #8) יומנים is framed by the shared sw-page (no local <h1>); "חדש" is the shared primary sw-button in the page's actions slot,
//            a floating button on the phone;
//   F3 (#11) the booking and maintenance drawers are the shared modal sw-drawer (top-layer dialog: scrim, focus trap, Escape closes);
//   F4 (#18) הגדרות › יומנים is sw-page + underline sw-tabs + one sw-card;
//   F5 (touch) on the phone every day cell of the month is a >= 44 px target.
// Plus: no page scroll at 1366x768 and 1440x900 (owner rule), and pixel baselines (titles with "pixel-stable", the gate's pixel step).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/audit30-f-calendars.spec.ts --project=desktop --project=mobile
// Baselines are Linux only (taken on the runner); an OS without a baseline skips the compare.

const FIXED = new Date('2026-10-29T08:40:00Z'); // Thursday 29.10.2026, 10:40 in the installation's zone (the demo's "now")
const P = 'sw-app calendars-page';
const S = 'sw-app system-calendars';
const proj = () => test.info().project.name;
const phone = () => proj() === 'mobile';

async function open(page: Page, hash: string, opts: { skin?: string; scheme?: 'light' | 'dark'; ready?: string } = {}) {
  await page.clock.setFixedTime(FIXED);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${opts.skin ?? 'classic'}&scheme=${opts.scheme ?? 'light'}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(opts.ready ?? `${P} [data-cal-body]`, { timeout: 30_000 });
}

/** The shell's main area and the document: neither scrolls (vertically or sideways). */
async function noScroll(page: Page) {
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const d = document.documentElement;
    return { sh: main?.scrollHeight ?? 0, ch: main?.clientHeight ?? 0, dh: d.scrollHeight - d.clientHeight, dw: d.scrollWidth - d.clientWidth };
  });
  expect(m.sh, 'the main area scrolls').toBeLessThanOrEqual(m.ch + 1);
  expect(m.dh, 'the document scrolls').toBeLessThanOrEqual(1);
  expect(m.dw, 'sideways overflow').toBeLessThanOrEqual(1);
}

/** The computed value of a custom property on an element (the token pair a rule must resolve to). */
const tokenOf = (page: Page, sel: string, prop: string, name: string) =>
  page.locator(sel).first().evaluate((el, [p, n]) => {
    const probe = document.createElement('span');
    probe.style.setProperty(p, `var(${n})`);
    (el.parentNode ?? el).appendChild(probe);
    const v = getComputedStyle(probe).getPropertyValue(p);
    probe.remove();
    return v;
  }, [prop, name] as const);

test.describe('AUDIT30-F-CALENDARS', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop (1440, 1366 inside it) and the phone');
  });

  test('F1: a selected floor chip is the Blue Wash pair, not a black pill (#4)', async ({ page }) => {
    test.skip(phone(), 'the floor chips are a desktop row');
    await open(page, '/calendars/cal?view=month&date=2026-10-29');
    const on = page.locator(`${P} .floors .chipb[aria-pressed="true"]`);
    await expect(on).toHaveCount(1);
    for (const scheme of ['light', 'dark'] as const) {
      if (scheme === 'dark') await open(page, '/calendars/cal?view=month&date=2026-10-29', { scheme });
      const got = await on.evaluate((el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, fg: cs.color }; });
      const soft = await tokenOf(page, `${P} .floors .chipb[aria-pressed="true"]`, 'background-color', '--sw-accent-soft');
      const ink = await tokenOf(page, `${P} .floors .chipb[aria-pressed="true"]`, 'color', '--sw-accent-text');
      const heading = await tokenOf(page, `${P} .floors .chipb[aria-pressed="true"]`, 'background-color', '--sw-heading');
      expect(got.bg, `${scheme}: the fill is --sw-accent-soft`).toBe(soft);
      expect(got.fg, `${scheme}: the ink is --sw-accent-text`).toBe(ink);
      expect(got.bg, `${scheme}: never the heading colour (the black pill)`).not.toBe(heading);
    }
  });

  test('F2: the page is framed by sw-page and "חדש" is the shared primary button in its actions slot (#6, #8)', async ({ page }) => {
    await open(page, '/calendars/cal?view=month&date=2026-10-29');
    const frame = page.locator(`${P} sw-page[data-cal-page]`);
    await expect(frame).toHaveAttribute('heading', 'יומנים');
    // the only page title is sw-page's own
    const own = await page.locator(P).evaluate((el) => el.shadowRoot?.querySelectorAll('h1').length ?? -1);
    expect(own, 'calendars-page draws no <h1> of its own').toBe(0);
    const nb = page.locator(`${P} sw-button[data-cal-new]`);
    await expect(nb).toHaveAttribute('slot', 'actions');
    await expect(nb).toHaveAttribute('variant', 'primary');
    await expect(page.locator(`${P} button.btn.pri[data-cal-new]`)).toHaveCount(0);
    if (phone()) {
      // owner Q5 (option A): one floating button in the bottom corner, above the bottom navigation, a full 44 px target
      const pos = await nb.evaluate((el) => getComputedStyle(el).position);
      expect(pos).toBe('fixed');
      const box = await nb.boundingBox();
      const vp = page.viewportSize();
      expect(box && vp && box.y + box.height <= vp.height && box.y > vp.height / 2, `in the lower half: ${JSON.stringify(box)}`).toBe(true);
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
    }
    await nb.click();
    await expect(page.locator(`${P} cal-event-drawer sw-drawer[data-cal-drawer="new"]`)).toHaveCount(1);
  });

  test('F3: the booking drawer is the shared modal drawer - top layer, Escape closes it, focus comes back (#11)', async ({ page }) => {
    await open(page, '/calendars/cal?view=week&date=2026-10-29&role=site_admin');
    await page.locator(`${P} sw-button[data-cal-new]`).click();
    const d = page.locator(`${P} cal-event-drawer sw-drawer[data-cal-drawer="new"]`);
    await expect(d).toHaveAttribute('modal', '');
    await expect(d).toHaveAttribute('heading', 'הזמנה חדשה');
    const modal = await d.evaluate((el) => !!el.shadowRoot?.querySelector('dialog')?.matches(':modal'));
    expect(modal, 'a modal <dialog> in the top layer (scrim + inert page)').toBe(true);
    await expect(page.locator(`${P} cal-event-drawer aside`)).toHaveCount(0);
    // the action row: the primary save and the dismiss are shared buttons in the drawer's footer
    await expect(page.locator(`${P} cal-event-drawer sw-button[data-cal-submit]`)).toHaveAttribute('variant', 'primary');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${P} cal-event-drawer`)).toHaveCount(0);
  });

  test('F3: the maintenance drawer is the shared modal drawer too; Escape closes it (#11)', async ({ page }) => {
    await open(page, '/calendars/maint?role=site_admin');
    await page.locator(`${P} sw-button[data-cal-new]`).click();
    const d = page.locator(`${P} cal-maint-drawer sw-drawer[data-maint-drawer]`);
    await expect(d).toHaveAttribute('heading', 'חלון תחזוקה חדש');
    const modal = await d.evaluate((el) => !!el.shadowRoot?.querySelector('dialog')?.matches(':modal'));
    expect(modal).toBe(true);
    await expect(page.locator(`${P} cal-maint-drawer sw-button[data-maint-save]`)).toHaveAttribute('variant', 'primary');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${P} cal-maint-drawer`)).toHaveCount(0);
  });

  test('F4: הגדרות › יומנים is sw-page + underline tabs + one card (#18)', async ({ page }) => {
    await open(page, '/system/calendars?tab=behavior', { ready: `${S} [data-calset-rows]` });
    const frame = page.locator(`${S} sw-page[data-calset-page]`);
    await expect(frame).toHaveAttribute('heading', 'יומנים');
    // the crumb on the desktop; the phone drops it (the rows get the height), as before
    await expect(frame).toHaveAttribute('crumbs', phone() ? '' : 'הגדרות');
    await expect(page.locator(`${S} sw-toggle[data-calset="enabled"]`)).toBeAttached();
    const tabs = page.locator(`${S} sw-tabs[data-calset-tabs]`);
    await expect(tabs).toHaveAttribute('variant', 'underline');
    await expect(page.locator(`${S} sw-card[data-calset-tab="behavior"]`)).toHaveCount(1);
    const own = await page.locator(S).evaluate((el) => el.shadowRoot?.querySelectorAll('h1').length ?? -1);
    expect(own, 'no local <h1>').toBe(0);
    await tabs.getByRole('tab', { name: phone() ? 'אישור' : 'אישור לכל יומן' }).click();
    await expect(page.locator(`${S} sw-card[data-calset-tab="approval"]`)).toHaveCount(1);
  });

  test('F5: on the phone every day cell of the month is a 44 px target', async ({ page }) => {
    test.skip(!phone(), 'the touch rule of the phone');
    await open(page, '/calendars/cal?view=month&date=2026-10-29&role=site_admin');
    const cells = page.locator(`${P} cal-view-calendar .mcell`);
    await expect(cells).toHaveCount(42);
    const small = await cells.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.height < 43.5 || r.width < 43.5).length);
    expect(small, 'day cells under 44 px').toBe(0);
    // the cell is the target: a tap picks the day and lists it under the grid
    await page.locator(`${P} cal-view-calendar .mcell[data-cal-day="2026-10-27"]`).click();
    await expect(page.locator(`${P} cal-view-calendar .mcell[data-cal-day="2026-10-27"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${P} cal-view-calendar [data-cal-agenda]`)).toBeVisible();
  });

  for (const [w, h] of [[1366, 768], [1440, 900]] as const) {
    test(`no page scroll at ${w}x${h}: the calendar views and the settings tabs`, async ({ page }) => {
      test.skip(phone(), 'desktop sizes');
      await page.setViewportSize({ width: w, height: h });
      for (const hash of ['/calendars/cal?view=month&date=2026-10-29', '/calendars/cal?view=week&date=2026-10-29', '/calendars/rooms?date=2026-10-29', '/calendars/approvals', '/calendars/manage']) {
        await open(page, `${hash}${hash.includes('?') ? '&' : '?'}role=site_admin`);
        await noScroll(page);
      }
      await page.locator(`${P} sw-button[data-cal-new]`).click();
      await expect(page.locator(`${P} cal-event-drawer sw-drawer`)).toHaveCount(1);
      await noScroll(page);
      for (const tab of ['overlap', 'behavior', 'approval', 'perm', 'retention']) {
        await open(page, `/system/calendars?tab=${tab}`, { ready: `${S} [data-calset-tab="${tab}"]` });
        await noScroll(page);
      }
    });
  }

  // ---- pixel baselines (the gate's pixel step: --grep pixel-stable) ----
  const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
    !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
  async function compare(page: Page, info: Parameters<typeof noBaseline>[0], file: string) {
    if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
    else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  }
  const width = () => (phone() ? '390' : '1440');

  for (const skin of PIXEL_SKINS) {
    test(pixelTitle(skin, 'audit30 calendars month page'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, '/calendars/cal?view=month&date=2026-10-29&role=site_admin', { skin, ready: `${P} cal-view-calendar [data-cal-month]` });
      await settlePage(page);
      await check(() => compare(page, info, `a30f-month-${skin}-${width()}.png`), `${P} cal-view-calendar`);
    });

    test(pixelTitle(skin, 'audit30 calendars new booking drawer'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, '/calendars/rooms?date=2026-10-29&role=site_admin', { skin, ready: `${P} cal-view-rooms [data-cal-now].placed` });
      await page.locator(`${P} sw-button[data-cal-new]`).click();
      await page.waitForSelector(`${P} cal-event-drawer [data-cal-avail]`);
      await settlePage(page);
      await check(() => compare(page, info, `a30f-drawer-${skin}-${width()}.png`), `${P} cal-event-drawer`);
    });

    test(pixelTitle(skin, 'audit30 calendar settings, behaviour tab'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, '/system/calendars?tab=behavior', { skin, ready: `${S} [data-calset-rows] > *` });
      await settlePage(page);
      await check(() => compare(page, info, `a30f-settings-${skin}-${width()}.png`), S);
    });
  }
});
