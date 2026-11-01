import { test, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// SCHED-POLISH-2331 shoot harness (design review only, not a gate spec): the schedules / automations settings pages, the slot panel,
// the table view and the create dialog at 1920 / 1440 / 1180 / 1024 / 390, demo mode. SHOT_PHASE=before|after picks the folder.
// Run: SW_BASE_URL=http://127.0.0.1:4210/ npx playwright test tests/shoot-sched-polish-2331.spec.ts --project=desktop --workers=1
const PHASE = process.env.SHOT_PHASE || 'after';
const OUT = fileURLToPath(new URL(`../../docs/evidence/SCHED-POLISH-2331/${PHASE}`, import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

const SIZES: [number, number][] = [[1920, 1080], [1440, 900], [1180, 820], [1024, 768], [390, 844]];

async function shot(page: Page, name: string, w: number, h: number, full = false) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${w}x${h}.png`), fullPage: full });
}

async function openApp(page: Page, hash: string, w: number, h: number, demo: Record<string, string> = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript((d) => {
    try {
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  }, demo);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

/** The page's own scroll height vs. the viewport, logged for the change doc. */
async function scrollFacts(page: Page, label: string) {
  const f = await page.evaluate(() => {
    const els = [document.scrollingElement, ...Array.from(document.querySelectorAll('*'))].filter((e): e is Element => !!e);
    const doc = document.scrollingElement!;
    return { doc: doc.scrollHeight - doc.clientHeight, vw: innerWidth, hx: doc.scrollWidth - doc.clientWidth, n: els.length };
  });
  fs.appendFileSync(path.join(OUT, 'scroll-facts.txt'), `${label} docOverflowY=${f.doc} docOverflowX=${f.hx}\n`);
}

async function mountEditor(page: Page, w: number, h: number, id: string, view: 'week' | 'table') {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript((v) => {
    try {
      localStorage.setItem('sw.demo.schedules', JSON.stringify({ persona: 'admin' }));
      localStorage.setItem('sw.schedules.editor_view', v);
    } catch {
      /* storage unavailable */
    }
  }, view);
  await page.goto('about:blank');
  await page.goto(`/?design=a#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('schedule-editor'));
  await page.evaluate((sid) => {
    document.querySelector('sw-app')?.remove();
    const el = document.createElement('schedule-editor') as HTMLElement & { scheduleId?: string };
    el.scheduleId = sid;
    document.body.append(el);
  }, id);
  await page.locator('schedule-editor [data-editor]').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
}

async function mountDialog(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.demo.schedules', JSON.stringify({ persona: 'admin' }));
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('schedule-create-dialog'));
  await page.evaluate(() => {
    document.querySelector('sw-app')?.remove();
    const el = document.createElement('schedule-create-dialog') as HTMLElement & { open?: boolean };
    el.open = true;
    document.body.append(el);
  });
  await page.locator('schedule-create-dialog [data-create-dialog]').waitFor();
  await page.waitForTimeout(600);
}

test.describe.configure({ mode: 'serial' });

for (const [w, h] of SIZES) {
  test(`settings › schedules ${w}x${h}`, async ({ page }) => {
    await openApp(page, '/system/schedules', w, h, { 'sw.demo.schedules': JSON.stringify({ persona: 'admin' }) });
    await page.locator('system-schedules [data-schedules-settings]').waitFor();
    await shot(page, 'sys-schedules', w, h);
    await scrollFacts(page, `sys-schedules ${w}x${h}`);
    if (w === 1440 || w === 390) await shot(page, 'sys-schedules-full', w, h, true);
    // a draft: the save bar
    await page.locator('system-schedules [data-snap="30"]').click();
    await shot(page, 'sys-schedules-dirty', w, h);
  });

  test(`settings › automations ${w}x${h}`, async ({ page }) => {
    await openApp(page, '/system/automations', w, h);
    await page.locator('system-automations [data-automations-settings]').waitFor();
    await shot(page, 'sys-automations', w, h);
    await scrollFacts(page, `sys-automations ${w}x${h}`);
    if (w === 1440 || w === 390) await shot(page, 'sys-automations-full', w, h, true);
  });

  test(`editor slot panel ${w}x${h}`, async ({ page }) => {
    await mountEditor(page, w, h, '4d6e0a', 'week');
    await page.locator('schedule-editor sw-schedule-grid .slot').first().click();
    await page.locator('schedule-editor schedule-slot-panel [data-slot-panel]').waitFor();
    await page.locator('schedule-editor schedule-slot-panel').scrollIntoViewIfNeeded();
    await shot(page, 'slot-panel', w, h);
  });

  test(`editor table view ${w}x${h}`, async ({ page }) => {
    await mountEditor(page, w, h, '4d6e0a', 'table');
    const btn = page.locator('schedule-editor [data-view-btn="table"]');
    if (await btn.count()) await btn.first().click();
    await page.locator('schedule-editor schedule-table-view').first().waitFor();
    await page.locator('schedule-editor schedule-table-view').scrollIntoViewIfNeeded();
    await shot(page, 'table-view', w, h);
  });

  test(`create dialog ${w}x${h}`, async ({ page }) => {
    await mountDialog(page, w, h);
    const dlg = page.locator('schedule-create-dialog');
    await dlg.locator('[data-template="ac"]').click();
    await shot(page, 'create-templates', w, h);
    await dlg.locator('[data-create-tab="quick"]').click();
    await dlg.locator('[data-quick-area="חצר"]').click();
    await dlg.locator('[data-quick-entity="light.yard"]').click();
    await dlg.locator('[data-quick-action="on"]').click();
    await dlg.locator('[data-quick-time="sunset"]').click();
    await dlg.locator('[data-quick-days="daily"]').click();
    await shot(page, 'create-quick', w, h);
  });
}

test('states 1440: forbidden + script slot', async ({ page }) => {
  await openApp(page, '/system/schedules', 1440, 900, { 'sw.demo.schedules': JSON.stringify({ persona: 'viewer' }) });
  await page.locator('system-schedules [data-schedules-settings-forbidden]').waitFor();
  await shot(page, 'sys-schedules-forbidden', 1440, 900);
  await page.close();
});

test('script slot 1440', async ({ page }) => {
  await mountEditor(page, 1440, 900, 'a0f4c9', 'week');
  await page.locator('schedule-editor sw-schedule-grid .slot').first().click();
  await page.locator('schedule-editor schedule-slot-panel').scrollIntoViewIfNeeded();
  await shot(page, 'slot-panel-script', 1440, 900);
});
