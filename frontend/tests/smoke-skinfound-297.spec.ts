import { test, expect, type Page } from '@playwright/test';
import { FOUNDATION_SKINS } from '../src/design/skins';

// SKINFOUND-297 (owner 2026-10-27): the smoke of the two Arx skins at their foundation stage. Demo mode (no backend; "the installation" is
// this browser). For each new skin: pick it in הגדרות › כללי › מראה המערכת and save, then load home, a devices screen and settings - in
// light and dark - with no page error and no console error the classic skin does not also print on the same routes (the demo answers
// some calls with nothing; those lines are classic's too). The SmplWise mark in the rail, the SmplWise logo of the corner strip and the
// installation (company) logo slot render under the new skins at the same size as under classic. No pixel baselines (owner: not yet).
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/smoke-skinfound-297.spec.ts --project=desktop --project=mobile --workers=1

const ROUTES = [
  { id: 'home', hash: '/devices/building', ready: 'devices-building' },
  { id: 'devices', hash: '/devices/areas/ar3_offices', ready: 'devices-area' },
  { id: 'settings', hash: '/system/diagnostics', ready: 'system-design' },
] as const;

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="#1e2e47"/></svg>';

async function prepare(page: Page) {
  // the installation's company logo as last known (the shell reads this cache first; evidence-brand-logos.spec.ts does the same)
  await page.route('**/api/v1/brand/company-logo/**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO }) : r.fallback()));
  const cache = { company: { name: 'Smoke Co', kind: 'management', logo: {}, logo_file: { light: 'aaaaaaaaaaaaaaaa.svg', dark: null } }, size: 'm', dark_mode: 'plate', title: { prefix: 'Smplwise Arx', mode: 'both' }, project: { name: 'Smoke' } };
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.ui.brandlogo', JSON.stringify(c));
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  }, cache);
}

/** Console errors and page errors of everything that follows. */
function listen(page: Page) {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().replace(/\s+/g, ' ').slice(0, 300));
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  return { errors, pageErrors };
}

async function load(page: Page, hash: string, ready: string, scheme: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { state: 'attached', timeout: 20_000 });
  await page.waitForTimeout(600);
}

/** The logo boxes the shell draws: the rail mark (desktop), the corner strip's SmplWise logo and company logo (desktop), the phone home head. */
async function logoSizes(page: Page, phone: boolean): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const sel = phone
    ? { 'home head: company': 'sw-app [data-home-brand] sw-brand[kind="company"]', 'home head: SmplWise': 'sw-app [data-home-brand] sw-brand[kind="product"]' }
    : { 'rail mark': 'sw-app [data-brand-tile] sw-brand', 'strip: SmplWise': 'sw-app [data-brand-product]', 'strip: company': 'sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"]' };
  for (const [k, s] of Object.entries(sel)) {
    const loc = page.locator(s).first();
    await expect(loc, `${k} is drawn`).toBeVisible();
    const b = (await loc.boundingBox())!;
    out[k] = `${Math.round(b.width)}x${Math.round(b.height)}`;
  }
  return out;
}

test.describe('SKINFOUND-297: the Arx skins', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  test('the picker offers both Arx skins with their Hebrew labels; picking one and saving switches the whole shell', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    await prepare(page);
    await load(page, '/system/diagnostics', 'system-design', 'light');
    const card = page.locator('sw-app system-design');
    await expect(card.locator('[data-skin-option="infra"] .nm')).toContainText('Arx Infra');
    await expect(card.locator('[data-skin-option="soft"] .nm')).toContainText('Arx Soft');
    await expect(card.locator('[data-skin-option="bubble"]')).toHaveCount(0); // the frozen skin stays out
    for (const id of FOUNDATION_SKINS) {
      await card.locator(`[data-skin-option="${id}"]`).click();
      await card.locator('[data-design-save]').click();
      await expect(page.locator('html')).toHaveAttribute('data-skin', id);
      await expect(card.locator(`[data-skin-option="${id}"] [data-skin-current]`)).toBeVisible();
    }
    // the choice survives a reload (the installation's cache)
    await page.reload();
    await page.waitForSelector('sw-app');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'soft');
  });

  test('home, devices and settings load under each Arx skin, light and dark, with no new console error and every logo in place', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    test.setTimeout(180_000);
    const phone = info.project.name === 'mobile';
    await prepare(page);
    const { errors, pageErrors } = listen(page);
    const key = (s: string) => s.replace(/\d+/g, '#');

    // classic first: the reference for the console lines and the logo sizes
    const classicErrors = new Set<string>();
    const classicLogos: Record<string, Record<string, string>> = {};
    for (const scheme of ['light', 'dark']) {
      for (const r of ROUTES) {
        errors.length = 0;
        await load(page, r.hash, r.ready, scheme);
        await expect(page.locator('html')).toHaveAttribute('data-skin', 'classic');
        errors.forEach((e) => classicErrors.add(key(e)));
        if (r.id === 'home') classicLogos[scheme] = await logoSizes(page, phone);
      }
    }

    const report: string[] = [];
    for (const id of FOUNDATION_SKINS) {
      // the switch, as a person makes it: the picker in Settings, then save
      await load(page, '/system/diagnostics', 'system-design', 'light');
      await page.locator(`sw-app system-design [data-skin-option="${id}"]`).click();
      await page.locator('sw-app system-design [data-design-save]').click();
      await expect(page.locator('html')).toHaveAttribute('data-skin', id);
      for (const scheme of ['light', 'dark']) {
        for (const r of ROUTES) {
          errors.length = 0;
          await load(page, r.hash, r.ready, scheme);
          await expect(page.locator('html')).toHaveAttribute('data-skin', id);
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
          // the skin's tokens reached the page: the motion layer is the round-2 one (classic keeps the neutral 1)
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sw-press-scale').trim())).toBe('0.97');
          const fresh = errors.filter((e) => !classicErrors.has(key(e)));
          report.push(`${id}/${scheme}/${r.id}: ${errors.length} console error(s), ${fresh.length} not seen under classic`);
          expect(fresh, `${id}/${scheme}/${r.id}: console errors classic does not print`).toEqual([]);
          if (r.id === 'home') expect(await logoSizes(page, phone), `${id}/${scheme}: the logos as under classic`).toEqual(classicLogos[scheme]);
        }
      }
    }
    console.log(report.join('\n'));
    expect(pageErrors).toEqual([]);
  });

  test('reduced motion: the Arx motion names fall to zero and the press scale to 1', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const id of FOUNDATION_SKINS) {
      for (const scheme of ['light', 'dark']) {
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${id}&scheme=${scheme}#/devices/building`);
        await page.waitForSelector('sw-app');
        const v = await page.evaluate(() => {
          const cs = getComputedStyle(document.documentElement);
          return ['--sw-t-press', '--sw-t-med', '--sw-spring-toggle-ms', '--sw-enter-y', '--sw-press-scale', '--sw-hover-lift'].map((n) => cs.getPropertyValue(n).trim());
        });
        expect(v, `${id}/${scheme}`).toEqual(['0ms', '0ms', '0ms', '0px', '1', '0px']);
      }
    }
  });
});
