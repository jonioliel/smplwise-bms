import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// MULTIBUILDING-HOME-2330 (owner approval 31.10, round 10): the home screen's site level for an installation of several buildings, in demo
// mode (`?mb=1` = four buildings + "משותף", `?mb=alarm` adds an alarm in building ג; `?mblevel=<id>` opens a building directly).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-multibuilding-home-2330.spec.ts --workers=1
// Every project (desktop 1440x900, tablet 1024x768, mobile 390x844) checks: no page scroll on a control screen (desktop / tablet), no
// horizontal overflow anywhere, the one-building home draws no site bar. Screenshots: docs/evidence/MULTIBUILDING-HOME-2330/after/.

// SW_EVIDENCE_SUB=before: the one-building test run against a build of the train base, for the pixel-identity comparison
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../docs/evidence/MULTIBUILDING-HOME-2330/${process.env.SW_EVIDENCE_SUB || 'after'}`);

async function open(page: Page, q: string, dark = false) {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.install({ time: new Date('2026-10-23T09:00:00Z') });
  await page.addInitScript(() => {
    try {
      // a fixed performance verdict (design/performance.ts): no start-up probe layer, the same glass level in every run - the
      // before / after screenshots of the one-building home are compared pixel for pixel
      const nav = navigator as Navigator & { deviceMemory?: number };
      const sig = `${nav.hardwareConcurrency ?? '?'}/${nav.deviceMemory ?? '?'}/${Math.round(devicePixelRatio * 100) / 100}`;
      localStorage.setItem('sw.ui.performance', JSON.stringify({ tier: 'full', sig, at: Date.now() }));
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('about:blank');
  await page.goto(`/?design=a${dark ? '&scheme=dark' : ''}${q}#/devices/building`);
  await page.waitForSelector('sw-app devices-building');
  await page.locator('sw-app devices-building sw-kpi').first().waitFor();
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(400); // the fit steps and the site view's measured height settle
}

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  // the start-up performance probe (design/performance.ts: a moving, near-invisible layer in a corner) is not part of the screen
  await page.evaluate(() => document.querySelectorAll('[data-perf-probe]').forEach((n) => n.remove()));
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

const overflowY = (page: Page) =>
  page.evaluate(() => {
    let node: Node | null = document.querySelector('sw-app')?.shadowRoot?.querySelector('devices-building') ?? null;
    if (!node) return -1;
    while (node) {
      const parent: Node | null = (node as Element).assignedSlot ?? node.parentNode ?? (node as ShadowRoot).host ?? null;
      if (parent instanceof HTMLElement && ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent.scrollHeight - parent.clientHeight;
      node = parent;
    }
    return document.documentElement.scrollHeight - document.documentElement.clientHeight;
  });
const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const B = (page: Page) => page.locator('sw-app devices-building');
const phone = (page: Page) => (page.viewportSize()?.width ?? 1000) <= 600;

test('one building: no site bar, no site view - the home as before', async ({ page }, info) => {
  await open(page, '');
  await expect(B(page).locator('[data-site-bar]')).toHaveCount(0);
  await expect(B(page).locator('home-site-view')).toHaveCount(0);
  await expect(B(page).locator('[data-kpi-tag]')).toHaveCount(0);
  await expect(B(page).locator('.page-body')).not.toHaveAttribute('data-site-mode', /.+/);
  await shot(page, 'one-building', info.project.name);
});

test('the site level: building cards, the grouped tree, the shared building last, the tags', async ({ page }, info) => {
  await open(page, '&mb=1');
  const view = B(page).locator('home-site-view');
  await expect(view).toBeVisible();
  const cards = view.locator('[data-site-card]');
  await expect(cards).toHaveCount(5);
  await expect(cards.last()).toHaveAttribute('data-site-card', 'bS');
  await expect(B(page).locator('[data-site-switch-btn]')).toHaveCount(6);
  await expect(B(page).locator('sw-kpi').first()).toHaveAttribute('tag', 'אתר');
  if (!phone(page)) {
    await expect(view.locator('[data-site-tree-building]')).toHaveCount(5);
    await expect(view.locator('[data-site-unassigned]')).toHaveAttribute('data-site-unassigned', '1');
    expect(await overflowY(page), 'the site level fits the control screen').toBeLessThanOrEqual(1);
  }
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  await shot(page, 'site', info.project.name);
});

test('card -> building: today home scoped, breadcrumb, switch; the tree jumps straight to a floor', async ({ page }, info) => {
  await open(page, '&mb=1');
  const view = B(page).locator('home-site-view');
  await view.locator('[data-site-card-open="bA"]').click(); // the card's name (its "פתח בניין" button gives way on a short card)
  await expect(B(page).locator('[data-site-bar]')).toHaveAttribute('data-site-level', 'bA');
  await expect(B(page).locator('[data-site-switch-btn="bA"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(B(page).locator('.crumb.here')).toHaveText('בניין א');
  await expect(B(page).locator('sw-kpi').first()).toHaveAttribute('tag', 'בניין א');
  await expect(B(page).locator('home-site-view')).toHaveCount(0);
  if (!phone(page)) {
    // only building A's floors (8: four listed, the rest behind "עוד קומות" - today's rule), by OUR floor names
    const ids = await B(page).locator('[data-tree-select]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tree-select')));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id?.startsWith('ha_bA_'))).toBe(true);
    await expect(B(page).locator('[data-tree-select] .nm').first()).toHaveText('קרקע');
    await expect(B(page).locator('[data-tree-more]')).toHaveAttribute('data-tree-more', String(8 - ids.length));
    expect(await overflowY(page), 'a building fits like today home').toBeLessThanOrEqual(1);
  }
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  await shot(page, 'building-a', info.project.name);
  // back to the site through the breadcrumb, then one press in the tree opens building ד on its floor 2
  await B(page).locator('[data-site-crumb="site"]').click();
  await expect(B(page).locator('home-site-view')).toBeVisible();
  if (!phone(page)) {
    await view.locator('[data-site-tree-fold="bD"]').click();
    await view.locator('[data-site-tree-floor="bD_f2"]').click();
    await expect(B(page).locator('[data-site-bar]')).toHaveAttribute('data-site-level', 'bD');
    await expect(B(page).locator('[data-tree-select="ha_bD_2"]')).toHaveAttribute('aria-current', 'true');
  } else {
    await view.locator('[data-site-bar="bD_f2"]').click();
    await expect(B(page).locator('[data-site-bar]')).toHaveAttribute('data-site-level', 'bD');
  }
});

test('the shared building opens with its own switch and the mini cross-section opens a floor', async ({ page }, info) => {
  await open(page, '&mb=alarm');
  const view = B(page).locator('home-site-view');
  await expect(view.locator('[data-site-card="bC"] [data-site-alert]')).toHaveCount(1);
  await shot(page, 'site-alarm', info.project.name);
  // the mini cross-section (desktop / phone); a tablet keeps the buildings tall and opens the floor from the card's bar
  const cell = view.locator('[data-site-cell="bC_f3"]');
  if (await cell.count()) await cell.click();
  else {
    await view.locator('[data-site-tree-fold="bC"]').click();
    await view.locator('[data-site-tree-floor="bC_f3"]').click();
  }
  await expect(B(page).locator('[data-site-bar]')).toHaveAttribute('data-site-level', 'bC');
  await B(page).locator('[data-site-switch-btn="bS"]').click();
  await expect(B(page).locator('.crumb.here')).toHaveText('משותף');
  if (!phone(page)) expect(await overflowY(page)).toBeLessThanOrEqual(1);
  await shot(page, 'building-shared', info.project.name);
});

test('"כבה הכל באתר": the buildings with checks, "משותף" unchecked, a strong confirmation (demo sends nothing)', async ({ page }, info) => {
  await open(page, '&mb=1');
  await B(page).locator('[data-site-off-site]').click();
  const dlg = B(page).locator('home-site-off');
  await expect(dlg.locator('[data-site-off-building]')).toHaveCount(5);
  await expect(dlg.locator('[data-site-off-building="bS"]')).not.toBeChecked();
  await expect(dlg.locator('[data-site-off-building="bA"]')).toBeChecked();
  await expect(dlg.locator('[data-site-off-shared-note]')).toBeVisible();
  await shot(page, 'site-off-pick', info.project.name);
  await dlg.locator('[data-site-off-next]').click();
  await expect(dlg.locator('[data-site-off-question]')).toBeVisible();
  await expect(dlg.locator('[data-site-off-ack]')).toBeVisible();
  await expect(dlg.locator('[data-site-off-confirm]')).toHaveAttribute('disabled', '');
  await shot(page, 'site-off-confirm', info.project.name);
});

test('inside a building "כבה הכל" names the building', async ({ page }, info) => {
  await open(page, '&mb=1&mblevel=bB');
  await expect(B(page).locator('[data-site-bar]')).toHaveAttribute('data-site-level', 'bB');
  const quick = B(page).locator('[data-site-off-kind="all_off"]');
  if (await quick.count()) {
    await expect(quick).toContainText('בניין ב');
    await quick.click();
  } else {
    // the quick-actions widget carries the action on this screen size - or, on a landscape tablet, the installation drops the building-off
    // card (building_off_tablet = hide, today's rule) and the action stays in the floor menu
    const pill = B(page).locator('home-widgets').locator('[data-home-quick="all_off"]');
    if (!(await pill.count())) return; // (the floor menu needs a server: not drawn in the demo)
    await pill.first().click();
  }
  const dlg = B(page).locator('home-site-off');
  await expect(dlg.locator('sw-dialog')).toHaveAttribute('heading', /בניין ב/);
  await expect(dlg.locator('[data-site-off-building]')).toHaveCount(0);
  await shot(page, 'building-off', info.project.name);
});

test('dark scheme of the site level', async ({ page }, info) => {
  await open(page, '&mb=1', true);
  await expect(B(page).locator('home-site-view')).toBeVisible();
  await shot(page, 'site-dark', info.project.name);
});
