import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';

// AUDIT30-B2-PAGE-ACTION (design audit round 30, finding 8; owner gate Q5 = option א): sw-page's `primary` slot in the browser, demo
// fixtures, classic skin. Desktop / tablet: the action sits in the header row, in the flow. Phone (<= 767 px): one floating 52 px
// action, 14 px from the end edge, 12 px above the bottom navigation; the page body keeps room for it; an empty slot draws nothing.
// Pixel baselines ("pixel-stable" in the title) are Linux ones generated on the runner with --update-snapshots; on an OS without a
// baseline the comparison is skipped, not failed.
//   run_smart.py preview pilot/AUDIT30-B2-PAGE-ACTION tests/evidence-audit30b2-page-action.spec.ts --workers=1

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto('/?design=a&fit=off&skin=classic&scheme=light#/investigate/health');
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-page') && !!customElements.get('sw-button'));
  await page.waitForTimeout(800);
}

/** two pages laid over the app: one with a primary action, one with none */
async function mount(page: Page, iconOnly = false) {
  await page.evaluate((icon) => {
    document.getElementById('b2')?.remove();
    const g = document.createElement('div');
    g.id = 'b2';
    g.setAttribute('dir', 'rtl');
    g.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--sw-bg);font-family:var(--sw-font)';
    const extra = icon ? ' iconOnly round' : '';
    g.innerHTML = `
      <sw-page data-p="with" heading="יומנים" subheading="3 יומנים">
        <sw-button slot="actions" icon="filter" label="סינון">סינון</sw-button>
        <sw-button slot="primary" variant="primary" icon="plus" label="חדש"${extra}>חדש</sw-button>
        <sw-card><div style="padding:14px">תוכן</div></sw-card>
      </sw-page>
      <sw-page data-p="without" heading="ללא פעולה ראשית"><sw-button slot="actions" label="רענון">רענון</sw-button></sw-page>`;
    document.body.appendChild(g);
  }, iconOnly);
  await page.waitForTimeout(300);
}

const geo = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector('#b2 sw-page[data-p="with"]') as HTMLElement;
    const none = document.querySelector('#b2 sw-page[data-p="without"]') as HTMLElement;
    const wrap = p.shadowRoot!.querySelector('[data-page-primary]') as HTMLElement;
    const head = p.shadowRoot!.querySelector('header')!.getBoundingClientRect();
    const r = wrap.getBoundingClientRect();
    const btn = (p.querySelector('[slot="primary"]') as HTMLElement).shadowRoot!.querySelector('button')!.getBoundingClientRect();
    const nav = parseFloat(getComputedStyle(p).getPropertyValue('--sw-bottomnav-h')) || 0;
    return {
      has: p.hasAttribute('has-primary'),
      noneHas: none.hasAttribute('has-primary'),
      noneDisplay: getComputedStyle(none.shadowRoot!.querySelector('[data-page-primary]')!).display,
      position: getComputedStyle(wrap).position,
      inHeader: r.top >= head.top - 1 && r.bottom <= head.bottom + 1,
      left: Math.round(r.left),
      bottomGap: Math.round(innerHeight - r.bottom),
      nav,
      h: Math.round(btn.height),
      w: Math.round(btn.width),
      bodyPad: getComputedStyle(p.shadowRoot!.querySelector('.body')!).paddingBlockEnd,
    };
  });

test('desktop / tablet: the primary action sits in the header row, in the flow; an empty slot draws nothing', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'the phone layout is the next test');
  await open(page);
  await mount(page);
  const g = await geo(page);
  expect(g.has).toBe(true);
  expect(g.noneHas).toBe(false);
  expect(g.noneDisplay).toBe('none');
  expect(g.position).toBe('static');
  expect(g.inHeader).toBe(true);
  expect(g.h).toBeLessThan(52); // the ordinary key height of the header
  expect(g.bodyPad).toBe('0px');
});

test('phone: one floating action, 52 px, 14 px from the end edge, 12 px above the bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await mount(page);
  const g = await geo(page);
  console.log(JSON.stringify(g));
  expect(g.position).toBe('fixed');
  expect(g.h).toBe(52);
  expect(g.left).toBe(14); // RTL: the end edge is the left side
  expect(g.bottomGap).toBe(g.nav + 12); // env(safe-area-inset-bottom) is 0 in the test browser
  expect(g.bodyPad).toBe('64px');
  expect(g.noneDisplay).toBe('none');
  // icon-only: a 52 px circle
  await mount(page, true);
  const c = await geo(page);
  expect([c.w, c.h]).toEqual([52, 52]);
});

test('phone: a hidden primary action is not floated', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.evaluate(() => {
    const g = document.createElement('div');
    g.id = 'b2h';
    g.innerHTML = '<sw-page heading="x"><sw-button slot="primary" hidden label="חדש">חדש</sw-button></sw-page>';
    document.body.appendChild(g);
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.querySelector('#b2h sw-page')!.hasAttribute('has-primary'))).toBe(false);
});

for (const view of ['desktop', 'phone'] as const) {
  test(`classic is pixel-stable: AUDIT30-B2 page primary action (${view})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project; the phone view is a 390 px viewport');
    if (view === 'phone') await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await mount(page);
    await settlePage(page);
    const file = `audit30b2-page-primary-${view}.png`;
    if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
    else await expect(page.locator('#b2')).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  });
}
