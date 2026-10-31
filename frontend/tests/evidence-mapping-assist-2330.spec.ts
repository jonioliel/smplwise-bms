import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// MAPPING-ASSIST-2330 (owner approval 31.10, round 10 mapping v3): the mapping assistant and the multi-building switch, in demo mode on the
// mockup's synthetic 169 names (`?mb=1` = the multi-building view on, `?mb=off` = four mapped buildings with the view OFF, `?mbmap=applied`
// = mapped once already with three names new since).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-mapping-assist-2330.spec.ts --workers=1
// Every project (desktop 1440x900, tablet 1024x768, mobile 390x844): the assistant's sheet fits the viewport (its lists scroll inside their
// own panels, the page never scrolls), no horizontal overflow. Screenshots: docs/evidence/MAPPING-ASSIST-2330/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/MAPPING-ASSIST-2330');

async function boot(page: Page, q: string, hash: string, dark = false) {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.install({ time: new Date('2026-10-31T17:00:00Z') });
  await page.addInitScript(() => {
    try {
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
  await page.goto(`/?design=a${dark ? '&scheme=dark' : ''}${q}#${hash}`);
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
}

const settings = async (page: Page, q = '&mb=off', dark = false) => {
  await boot(page, q, '/system/diagnostics?tab=buildings', dark);
  await page.locator('system-mapping [data-mapping-switch]').waitFor();
  await page.waitForTimeout(300);
};

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.evaluate(() => document.querySelectorAll('[data-perf-probe]').forEach((n) => n.remove()));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const A = (page: Page) => page.locator('mapping-assistant');
/** The sheet sits inside the viewport and its own body does not scroll (only the lists inside panels do). */
async function fits(page: Page) {
  const vp = page.viewportSize()!;
  const box = (await A(page).locator('.sheet').boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  const mainOver = await A(page).locator('main').evaluate((m) => m.scrollHeight - m.clientHeight);
  expect(mainOver).toBeLessThanOrEqual(2);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
}

const openAssistant = async (page: Page) => {
  await page.locator('system-mapping [data-mapping-open]').first().click();
  await A(page).locator('[data-ma-detected]').waitFor();
  await page.waitForTimeout(300);
};

test('off by default: four mapped buildings, the view off - the home has no site UI; the settings say "כבוי"', async ({ page }, info) => {
  await boot(page, '&mb=off', '/devices/building');
  await page.locator('sw-app devices-building sw-kpi').first().waitFor();
  await page.waitForTimeout(400);
  await expect(page.locator('devices-building div[data-site-bar]')).toHaveCount(0);
  await expect(page.locator('devices-building home-site-view')).toHaveCount(0);
  await expect(page.locator('devices-building [data-kpi-tag]')).toHaveCount(0);
  await settings(page);
  await expect(page.locator('system-mapping [data-mapping-switch-state]')).toHaveAttribute('data-mapping-switch-state', 'off');
  await expect(page.locator('system-mapping [data-mapping-toggle]')).toHaveAttribute('aria-checked', 'false');
  await shot(page, 'settings-off', info.project.name);
});

test('on: the switch turns the site level on; off again returns the one-building home', async ({ page }, info) => {
  await boot(page, '&mb=1', '/devices/building');
  await page.locator('devices-building div[data-site-bar]').waitFor();
  await settings(page, '&mb=1');
  await expect(page.locator('system-mapping [data-mapping-toggle]')).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'settings-on', info.project.name);
  await page.locator('system-mapping [data-mapping-toggle]').click();
  await expect(page.locator('system-mapping [data-mapping-toggle]')).toHaveAttribute('aria-checked', 'false');
  await page.evaluate(() => (location.hash = '#/devices/building'));
  await page.locator('sw-app devices-building sw-kpi').first().waitFor();
  await page.waitForTimeout(400);
  await expect(page.locator('devices-building div[data-site-bar]')).toHaveCount(0);
});

test('the first question: start of the name is pre-selected (96%), another position recomputes live', async ({ page }, info) => {
  await settings(page);
  await openAssistant(page);
  await expect(A(page).locator('[data-ma-pos="start"]')).toHaveAttribute('aria-checked', 'true');
  await expect(A(page).locator('[data-ma-pct]')).toHaveText('96%');
  await expect(A(page).locator('[data-ma-detected]')).toContainText('163');
  await fits(page);
  await shot(page, 'step-mark', info.project.name);
  await A(page).locator('[data-ma-pos="label"]').click();
  await expect(A(page).locator('[data-ma-pct]')).not.toHaveText('96%');
  await A(page).locator('[data-ma-pos="start"]').click();
  // a separator chip: without "-" the "ג-גג" names lose their mark
  await A(page).locator('[data-ma-chip="sep--"]').click();
  await expect(A(page).locator('[data-ma-pct]')).toHaveText('93%');
  await A(page).locator('[data-ma-chip="sep--"]').click();
  await expect(A(page).locator('[data-ma-pct]')).toHaveText('96%');
});

test('the table: seven marks; "מ" merged into משותף, "ה" as a new building; side list follows', async ({ page }, info) => {
  await settings(page);
  await openAssistant(page);
  await A(page).locator('[data-ma-next]').click();
  await A(page).locator('[data-ma-table]').waitFor();
  await expect(A(page).locator('[data-ma-token]')).toHaveCount(7);
  await A(page).locator('select[data-ma-target="מ"]').selectOption('b:bS');
  await expect(A(page).locator('[data-ma-token="מ"] [data-ma-merged]')).toHaveCount(1);
  await A(page).locator('select[data-ma-target="ה"]').selectOption('n:בניין ה');
  await fits(page);
  await shot(page, 'step-table', info.project.name);
});

test('the exceptions: plain questions, "נשארו N החלטות" goes down, then the summary and apply (a version) and the explicit switch offer', async ({ page }, info) => {
  await settings(page);
  await openAssistant(page);
  await A(page).locator('[data-ma-next]').click();
  await A(page).locator('select[data-ma-target="מ"]').selectOption('b:bS');
  await A(page).locator('[data-ma-next]').click();
  await A(page).locator('[data-ma-questions]').waitFor();
  const left = async () => Number((await A(page).locator('[data-ma-left]').innerText()).match(/\d+/)?.[0] ?? 0);
  const n0 = await left();
  expect(n0).toBe(8);
  await fits(page);
  await shot(page, 'step-decide', info.project.name);
  await A(page).locator('[data-ma-question="t:ה"] [data-ma-answer^="n:"]').click();
  await expect.poll(left).toBe(n0 - 1);
  await A(page).locator('[data-ma-all-none]').click();
  await expect(A(page).locator('[data-ma-no-questions]')).toHaveCount(1);
  await A(page).locator('[data-ma-next]').click();
  await A(page).locator('[data-ma-summary]').waitFor();
  await expect(A(page).locator('[data-ma-sum-row="n:בניין ה"]')).toContainText('בניין חדש');
  await fits(page);
  await shot(page, 'step-summary', info.project.name);
  await A(page).locator('[data-ma-apply]').click();
  await A(page).locator('[data-ma-done]').waitFor();
  await expect(A(page).locator('[data-ma-done] h2')).toContainText('גרסה 1');
  await expect(A(page).locator('[data-ma-offer]')).toHaveCount(1);
  await shot(page, 'step-done', info.project.name);
  await A(page).locator('[data-ma-enable-multi]').click();
  await expect(A(page).locator('[data-ma-multi-on]')).toHaveCount(1);
  await A(page).locator('[data-ma-finish]').click();
  await expect(page.locator('system-mapping [data-mapping-toggle]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('system-mapping [data-mapping-version="1"]')).toHaveCount(1);
  await expect(page.locator('system-mapping [data-mapping-buildings]')).toContainText('בניין ה');
  await shot(page, 'settings-after-apply', info.project.name);
});

test('versions: a second apply, then "חזרה לגרסה זו" writes version 3', async ({ page }) => {
  await settings(page);
  for (let i = 0; i < 2; i++) {
    await openAssistant(page);
    await A(page).locator('[data-ma-next]').click();
    await A(page).locator('[data-ma-next]').click();
    if (await A(page).locator('[data-ma-questions]').count()) await A(page).locator('[data-ma-next]').click();
    await A(page).locator('[data-ma-apply]').click();
    await A(page).locator('[data-ma-done]').waitFor();
    await A(page).locator('[data-ma-finish]').click();
  }
  await page.locator('system-mapping [data-mapping-restore="1"]').click();
  await page.locator('[data-mapping-restore-confirm]').click();
  await expect(page.locator('system-mapping [data-mapping-version="3"]')).toContainText('חזרה לגרסה 1');
});

test('health after apply: three new names, "אשר" confirms the placed one as a new version; the home chip names them', async ({ page }, info) => {
  await settings(page, '&mb=1&mbmap=applied');
  await expect(page.locator('system-mapping [data-mapping-health="fresh"]')).toHaveCount(1);
  await expect(page.locator('system-mapping [data-mapping-health-count]')).toContainText('3');
  await shot(page, 'health-card', info.project.name);
  await page.locator('system-mapping [data-mapping-confirm]').click();
  await expect(page.locator('system-mapping [data-mapping-version="2"]')).toContainText('אישור שמות חדשים');
  await expect(page.locator('system-mapping [data-mapping-health-count]')).toContainText('2');
  // the home's site bar chip (a configurer, the view on)
  await page.evaluate(() => (location.hash = '#/devices/building'));
  await page.locator('devices-building div[data-site-bar]').waitFor();
  await expect(page.locator('devices-building [data-home-mapping-health]')).toContainText('2');
  await page.waitForTimeout(300);
  await shot(page, 'home-chip', info.project.name);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});

test('advanced: ordered rules with counters, a mixed rule changes the counts, drag order by keyboard', async ({ page }, info) => {
  await settings(page);
  await page.locator('system-mapping [data-mapping-advanced]').click();
  await A(page).locator('[data-ma-rules]').waitFor();
  await expect(A(page).locator('[data-ma-rule]')).toHaveCount(1);
  await A(page).locator('[data-ma-rule-add]').click();
  const r = A(page).locator('[data-ma-rule]').nth(1);
  await r.locator('select[data-ma-rule-kind]').selectOption('contains');
  await r.locator('input[data-ma-rule-value]').fill('חניון');
  await r.locator('select[data-ma-rule-to]').selectOption('b:bS');
  await expect(r.locator('[data-ma-rule-count]')).toHaveText('0 קומות, 0 אזורים'); // the table rule is first and decides every parking name
  await r.locator('[data-ma-rule-grip]').focus();
  await page.keyboard.press('ArrowUp');
  await expect(A(page).locator('[data-ma-rule]').first().locator('[data-ma-rule-count]')).toHaveText('2 קומות, 1 אזורים');
  await fits(page);
  await shot(page, 'advanced', info.project.name);
});

test('dark scheme: the first question and the table', async ({ page }, info) => {
  await settings(page, '&mb=off', true);
  await openAssistant(page);
  await shot(page, 'dark-mark', info.project.name);
  await A(page).locator('[data-ma-next]').click();
  await A(page).locator('[data-ma-table]').waitFor();
  await shot(page, 'dark-table', info.project.name);
});
