import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetAutomationsMock, type AutomationsMockStore, type MockUserId } from '../src/api/automations-mock';
import { ApiError } from '../src/api/client';

// CR-017 S3: the automations screen ("אוטומציות", the third tab of the home area), its drawer (detail, "למה זה רץ", versions, dry-run, trash), the scenes panel
// with the capture editor, the script runner and הגדרות › אוטומציות, in demo mode (no backend: api/automations-mock.ts answers; the persona, the state and the
// scheme through localStorage `sw.demo.automations`, see api/automations-demo.ts) at 1440 / 820 / 390, light and dark, RTL; three users (installer, household
// editor, script runner - no view-only access, owner decision 1b) and every state. The last describe block runs with a session (a mocked backend answering the real routes from the same mock store): the
// permission-gated navigation and what the client sends. S4's editors open as the real sheets over the list (the wiring of S3 and S4).
//   SW_BASE_URL=http://127.0.0.1:4711/ npx playwright test tests/evidence-automations-list.spec.ts --project=desktop --workers=1
// Screenshots: docs/design/evidence/CR-017/s3/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-017/s3');
const SIZES = { '1440': { width: 1440, height: 900 }, '820': { width: 820, height: 1100 }, '390': { width: 390, height: 844 } } as const;
type Size = keyof typeof SIZES;
const BRANDS = /Home Assistant|\bHA\b|YAML|yaml|Ingress|blueprint|Supervisor|Companion/;

interface Control {
  user?: MockUserId;
  delegation?: boolean;
  available?: string;
  scheduler?: boolean;
  empty?: boolean;
  error?: boolean;
  noPermission?: boolean;
  offline?: boolean;
  invalid?: string[];
  scheme?: 'light' | 'dark';
  phoneFilter?: 'fold' | 'rows';
  sensitiveChip?: 'amber' | 'red';
}

async function open(page: Page, hash: string, size: Size = '1440', control: Control = {}) {
  await page.setViewportSize(SIZES[size]);
  // demo mode whatever runs on the preview's proxy target: no backend answers this page
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.demo.automations', JSON.stringify(c));
    } catch {
      /* storage unavailable */
    }
  }, control);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

const scr = (page: Page) => page.locator('sw-app devices-automations');
const cards = (page: Page) => scr(page).locator('automation-card');
const card = (page: Page, name: string) => scr(page).locator('automation-card', { hasText: name });
const drawer = (page: Page) => scr(page).locator('automation-drawer');
const hashOf = (page: Page) => page.evaluate(() => location.hash);

async function shot(page: Page, name: string, size: Size, scheme: 'light' | 'dark' = 'light') {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${size}${scheme === 'dark' ? '-dark' : ''}.png`) });
}

async function ready(page: Page) {
  await expect(scr(page).locator('[data-auto-grid], [data-scenes-panel], [data-scripts-panel], [data-auto-state]')).toBeVisible();
}

test.describe('the list (installer)', () => {
  test('automations: the tab row, the header, one card per automation, chips, the sentence', async ({ page }) => {
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/devices/automations', size);
      await ready(page);
      await expect(cards(page)).toHaveCount(12);
      await shot(page, '01-list', size);
    }
    await open(page, '/devices/automations');
    await ready(page);
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['מבט על', 'תזמונים', 'אוטומציות']);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('אוטומציות');
    await expect(scr(page).locator('[data-auto-title]')).toHaveText('אוטומציות');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // the segments with their counts
    await expect(scr(page).locator('button[data-segment]')).toHaveCount(3);
    await expect(scr(page).locator('button[data-segment="automations"]')).toContainText('12');
    await expect(scr(page).locator('button[data-segment="scenes"]')).toContainText('5');
    await expect(scr(page).locator('button[data-segment="scripts"]')).toContainText('3');
    // the card: name, floor and areas, the one-line sentence, the run line, "למה זה רץ"
    const hall = card(page, 'תנועה בפרוזדור');
    await expect(hall.locator('[data-card-sentence]')).toContainText('תנועה');
    await expect(hall.locator('.where b')).toHaveText('קומה 1');
    await expect(hall.locator('[data-card-run]')).toHaveText('רצה לפני 4 דק׳ · 38 ריצות');
    await expect(hall.locator('[data-card-why]')).toBeVisible();
    await expect(hall.locator('[data-card-toggle]')).toHaveAttribute('aria-checked', 'true');
    // chips: sensitive, locked parts with their count, a missing device, a failed run
    await expect(card(page, 'כולם יצאו').locator('[data-chip="sensitive"]')).toHaveText('רגישה');
    await expect(card(page, 'כפתורי מפסק סלון').locator('[data-chip="locked"]')).toHaveText('2 חלקים נעולים');
    await expect(card(page, 'דוד שמש בבוקר').locator('[data-chip="missing"]')).toHaveText('מכשיר חסר');
    await expect(card(page, 'דוד שמש בבוקר').locator('.dot.bad')).toHaveCount(1);
    await expect(card(page, 'נטרול אזעקה בבוקר').locator('[data-chip="changed_outside"]')).toHaveText('שונתה מחוץ למערכת');
    await expect(card(page, 'השקיה בשבת').locator('[data-chip="read_only"]')).toHaveText('צפייה בלבד');
    // a switched-off automation: the toggle is off, nothing else says "off"
    await expect(card(page, 'הקפאת תזמונים בחופשה').locator('[data-card-toggle]')).toHaveAttribute('aria-checked', 'false');
    // the operator screen names no product and carries no hint paragraph
    expect(await scr(page).innerText()).not.toMatch(BRANDS);
    // RTL: the name sits at the start (right) edge, the toggle at the end (left)
    const t = await hall.locator('h3').boundingBox();
    const g = await hall.locator('[data-card-toggle]').boundingBox();
    expect(t!.x).toBeGreaterThan(g!.x);
  });

  test('dark scheme (devices.scheme): the same screen, dark glass', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations', size, { scheme: 'dark' });
      await ready(page);
      await expect(scr(page)).toHaveAttribute('data-devices-scheme', 'dark');
      await shot(page, '02-list', size, 'dark');
    }
  });
});

test.describe('toggle, filters, the segments', () => {
  test('the toggle switches an automation; the counts follow; filters and search; the address carries them', async ({ page }) => {
    await open(page, '/devices/automations');
    await ready(page);
    const hall = card(page, 'תנועה בפרוזדור');
    await hall.locator('[data-card-toggle]').click();
    await expect(hall.locator('[data-card-toggle]')).toHaveAttribute('aria-checked', 'false');
    await expect(scr(page).locator('[data-state-filter="off"] small')).toHaveText('3');
    await hall.locator('[data-card-toggle]').click();
    await expect(hall.locator('[data-card-toggle]')).toHaveAttribute('aria-checked', 'true');
    // the sensitive filter
    await scr(page).locator('[data-state-filter="sensitive"]').click();
    await expect.poll(() => hashOf(page)).toContain('state=sensitive');
    await expect(cards(page)).toHaveCount(3);
    await expect(card(page, 'כולם יצאו')).toBeVisible();
    await scr(page).locator('[data-state-filter="all"]').click();
    // a floor chip and the search
    await scr(page).locator('[data-floor="g"]').click();
    await expect.poll(() => hashOf(page)).toContain('floor=g');
    const ground = await cards(page).count();
    expect(ground).toBeGreaterThan(0);
    expect(ground).toBeLessThan(12);
    await scr(page).locator('[data-floor=""]').click();
    await scr(page).locator('[data-search]').fill('מזגן');
    await expect(cards(page)).toHaveCount(2);
    await expect(card(page, 'מזגן חדר שינה לפי שעה')).toBeVisible();
    await expect.poll(() => hashOf(page)).toContain('q=');
    await scr(page).locator('[data-search]').fill('zzzz');
    await expect(scr(page).locator('[data-auto-state="no-match"]')).toBeVisible();
    await shot(page, '03-state-no-match', '1440');
    await scr(page).locator('[data-clear-filters]').click();
    await expect(cards(page)).toHaveCount(12);
    // what the address carries survives a reload
    await open(page, '/devices/automations?state=attention');
    await ready(page);
    await expect(cards(page)).toHaveCount(1); // the boiler: a missing device and a failed last run
    await expect(card(page, 'דוד שמש בבוקר')).toBeVisible();
  });

  test('the phone folds the state filter behind "סינון" (the default) or keeps its row (the setting)', async ({ page }) => {
    await open(page, '/devices/automations', '390');
    await ready(page);
    await expect(scr(page).locator('[data-fold-toggle]')).toBeVisible();
    await expect(scr(page).locator('.stf')).toBeHidden();
    await scr(page).locator('[data-fold-toggle]').click();
    await expect(scr(page).locator('.stf')).toBeVisible();
    await shot(page, '04-phone-filter-fold-open', '390');
    await open(page, '/devices/automations', '390', { phoneFilter: 'rows' });
    await ready(page);
    await expect(scr(page).locator('.stf')).toBeVisible();
    await expect(scr(page).locator('[data-fold-toggle]')).toBeHidden();
    await shot(page, '05-phone-filter-rows', '390');
  });

  test('the sensitive chip is amber, or red by the setting', async ({ page }) => {
    await open(page, '/devices/automations');
    await ready(page);
    const amber = await card(page, 'כולם יצאו').locator('[data-chip="sensitive"]').evaluate((el) => getComputedStyle(el).color);
    await open(page, '/devices/automations', '1440', { sensitiveChip: 'red' });
    await ready(page);
    await expect(scr(page)).toHaveAttribute('data-sens', 'red');
    const red = await card(page, 'כולם יצאו').locator('[data-chip="sensitive"]').evaluate((el) => getComputedStyle(el).color);
    expect(red).not.toBe(amber);
    await shot(page, '06-sensitive-chip-red', '1440');
  });

  test('the targets are 44 px: the controls of a card on the phone', async ({ page }) => {
    await open(page, '/devices/automations', '390');
    await ready(page);
    const c = card(page, 'תנועה בפרוזדור');
    for (const sel of ['[data-card-menu]', '[data-card-why]']) {
      const b = await c.locator(sel).boundingBox();
      expect(b!.height, sel).toBeGreaterThanOrEqual(44);
    }
    // the switch is 30 px high but its hit area is 44 px: a point 7 px above its edge still lands on it
    const t = await c.locator('[data-card-toggle]').boundingBox();
    const hit = await page.evaluate(({ x, y }) => {
      let el: Element | null = document.elementFromPoint(x, y);
      while (el?.shadowRoot) {
        const inner = el.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === el) break;
        el = inner;
      }
      return el?.hasAttribute('data-card-toggle') ?? false;
    }, { x: t!.x + t!.width / 2, y: t!.y - 7 });
    expect(hit).toBe(true);
    for (const sel of ['button[data-segment="scenes"]', 'label.search', '[data-auto-new]', '[data-fold-toggle]']) {
      const b = await scr(page).locator(sel).first().boundingBox();
      expect(b!.height, sel).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe('the detail drawer', () => {
  test('detail: the sentence, כאשר · אם · אז, the devices it touches, the last runs, the actions', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations', size);
      await ready(page);
      await card(page, 'תנועה בפרוזדור').locator('a.name').click();
      await expect.poll(() => hashOf(page)).toContain('/devices/automations/1727700000002');
      const d = drawer(page);
      await expect(d.locator('[data-drawer-detail]')).toBeVisible();
      await expect(d.locator('[data-drawer-sentence]')).toContainText('תנועה');
      await expect(d.locator('[data-section="1"] [data-block]')).toHaveCount(1);
      await expect(d.locator('[data-section="2"] [data-block]')).toHaveCount(1);
      await expect(d.locator('[data-section="3"] [data-block]')).toHaveCount(3);
      await expect(d.locator('[data-target]')).toHaveCount(1);
      await expect(d.locator('[data-run-row]')).toHaveCount(3);
      await expect(d.locator('[data-chip="mode"]')).toHaveText('התחל מחדש');
      for (const a of ['edit', 'run', 'dry', 'why', 'versions', 'copy', 'delete']) await expect(d.locator(`[data-drawer-${a}]`)).toBeVisible();
      expect(await d.innerText()).not.toMatch(BRANDS);
      await shot(page, '10-detail', size);
    }
    // Escape closes it and the address returns to the list
    await page.keyboard.press('Escape');
    await expect.poll(() => hashOf(page)).not.toContain('1727700000002');
  });

  test('detail, dark and a locked block: the padlock row and the scheduler chip', async ({ page }) => {
    await open(page, '/devices/automations/1727700000008', '1440', { scheme: 'dark' });
    const d = drawer(page);
    await expect(d.locator('[data-block-kind="locked"]')).toHaveCount(1);
    await expect(d.locator('[data-chip="schedules"]')).toHaveText('שולט בתזמונים');
    await shot(page, '11-detail-locked', '1440', 'dark');
    await open(page, '/devices/automations/1727700000006', '1440');
    await expect(drawer(page).locator('[data-block-kind="locked"]')).toHaveCount(2);
  });

  test('"למה זה רץ": the run chips, the short sentence on top, the summary, the trigger, every condition, every step; secrets masked', async ({ page }) => {
    test.setTimeout(120_000); // five page loads and six screenshots
    for (const [size, scheme] of [['1440', 'light'], ['1440', 'dark'], ['390', 'light']] as const) {
      await open(page, '/devices/automations/1727700000002?view=trace', size, { scheme });
      const d = drawer(page);
      await expect(d.locator('[data-drawer-trace]')).toBeVisible();
      await expect(d.locator('[data-run-chip]')).toHaveCount(4);
      await expect(d.locator('[data-trace-sentence]')).toContainText('רצה ב־');
      await expect(d.locator('[data-trace-sentence]')).toContainText('חיישן תנועה פרוזדור');
      await expect(d.locator('[data-trace-summary] [data-trace-result]')).toHaveText('הושלמה');
      await expect(d.locator('[data-trace-trigger] [data-trace-row]')).toHaveCount(1);
      await expect(d.locator('[data-trace-conditions] [data-trace-row]')).toHaveCount(1);
      await expect(d.locator('[data-trace-steps] [data-trace-row]')).toHaveCount(3);
      await shot(page, '20-trace', size, scheme);
    }
    // the failed manual run: the error, "ידנית", and the secret-like variable masked
    await open(page, '/devices/automations/1727700000002?view=trace');
    const d = drawer(page);
    await d.locator('[data-run-chip="r4"]').click();
    await expect.poll(() => hashOf(page)).toContain('run=r4');
    await expect(d.locator('[data-trace-summary] [data-trace-result]')).toHaveText('נכשלה');
    await expect(d.locator('[data-trace-steps] .err')).toHaveText('המכשיר לא זמין');
    await expect(d.locator('[data-trace-summary]')).toContainText('יוני (ידנית)');
    const text = await d.locator('run-trace').evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).toContain('••••');
    expect(text).not.toContain('abc123secret');
    await shot(page, '21-trace-error', '1440');
    // a condition that failed: no actions ran, the sentence says why
    await d.locator('[data-run-chip="r2"]').click();
    await expect(d.locator('[data-trace-sentence]')).toContainText('נכשל');
    await expect(d.locator('[data-trace-steps]')).toContainText('לא בוצעו פעולות');
    // a trace with a choice: the branches are indented
    await open(page, '/devices/automations/1727700000005?view=trace', '1440', { scheme: 'dark' });
    expect(await drawer(page).locator('[data-trace-steps] .row.nest').count()).toBeGreaterThanOrEqual(3);
    await shot(page, '22-trace-choose', '1440', 'dark');
  });

  test('versions: the history with who and when, "מחוץ למערכת" marked, restore after a confirmation', async ({ page }) => {
    await open(page, '/devices/automations/1727700000002?view=versions');
    const d = drawer(page);
    await expect(d.locator('[data-version]')).toHaveCount(4);
    await expect(d.locator('[data-version="v12"]')).toContainText('נוכחית');
    await expect(d.locator('[data-version="v11"]')).toContainText('מחוץ למערכת');
    await expect(d.locator('[data-version-restore="v12"]')).toHaveCount(0);
    await shot(page, '30-versions', '1440');
    await d.locator('[data-version-restore="v10"]').click();
    await expect(d.locator('[data-dialog="restore"]')).toHaveAttribute('open', '');
    await d.locator('[data-dialog="restore"] [data-dialog-ok]').click();
    await expect(scr(page).locator('[data-auto-note]')).toContainText('הגרסה שוחזרה');
    await expect(d.locator('[data-version]')).toHaveCount(5);
    await open(page, '/devices/automations/1727700000002?view=versions', '390');
    await shot(page, '31-versions', '390');
  });

  test('"בדיקה": what the conditions say now and what would change; nothing runs', async ({ page }) => {
    await open(page, '/devices/automations/1727700000002');
    const d = drawer(page);
    await d.locator('[data-drawer-dry]').click();
    await expect.poll(() => hashOf(page)).toContain('view=dryrun');
    await expect(d.locator('[data-drawer-dryrun]')).toBeVisible();
    await expect(d.locator('[data-drawer-dryrun] .dry-row')).not.toHaveCount(0);
    await shot(page, '32-dry-run', '1440');
    await d.locator('[data-drawer-back]').click();
    await expect(d.locator('[data-drawer-detail]')).toBeVisible();
  });

  test('"הרץ עכשיו": a plain automation runs at once; one with a sensitive step asks first; a second run at once is refused kindly', async ({ page }) => {
    await open(page, '/devices/automations/1727700000002');
    const d = drawer(page);
    await d.locator('[data-drawer-run]').click();
    await expect(scr(page).locator('[data-auto-note]')).toContainText('האוטומציה הורצה');
    await expect(d.locator('[data-run-row]').first()).toContainText('היום');
    await d.locator('[data-drawer-run]').click();
    await expect(scr(page).locator('[data-auto-note]')).toContainText('הפריט הורץ ממש עכשיו');
    // sensitive: the same confirmation manual control shows, with the one line of what it includes
    await open(page, '/devices/automations/1727700000003', '390');
    const s = drawer(page);
    await s.locator('[data-drawer-run]').click();
    await expect(s.locator('[data-dialog="run"]')).toContainText('כולל אזעקה – כמו בשליטה ידנית.');
    await shot(page, '33-run-confirm', '390');
    await s.locator('[data-dialog="run"] [data-dialog-ok]').click();
    await expect(scr(page).locator('[data-auto-note]')).toContainText('האוטומציה הורצה');
  });

  test('a configuration-file item is view-only; an invalid one says so; a caller without automation.manage gets no automation at all (decision 1b)', async ({ page }) => {
    await open(page, '/devices/automations/entity%3Aautomation.irrigation_shabbat');
    let d = drawer(page);
    await expect(d.locator('[data-drawer-readonly="yaml_managed"]')).toContainText('מוגדרת בקובץ תצורה');
    await expect(d.locator('[data-drawer-readonly="yaml_managed"]')).toContainText('לצפייה בלבד');
    for (const a of ['edit', 'copy', 'delete']) await expect(d.locator(`[data-drawer-${a}]`)).toHaveCount(0); // running it still works (the platform allows it)
    await expect(d.locator('[data-drawer-why]')).toBeVisible();
    expect(await d.innerText()).not.toMatch(/YAML|yaml/);
    await shot(page, '40-state-view-only-file', '1440');
    await open(page, '/devices/automations', '1440', { invalid: ['automation.hall_motion'] });
    await ready(page);
    await expect(card(page, 'תנועה בפרוזדור').locator('[data-chip="invalid"]')).toHaveText('שגיאה בהגדרה');
    await expect(card(page, 'תנועה בפרוזדור').locator('[data-card-toggle]')).toHaveCount(0);
    await shot(page, '41-state-invalid-list', '1440');
    await card(page, 'תנועה בפרוזדור').locator('a.name').click();
    d = drawer(page);
    await expect(d.locator('[data-drawer-invalid]')).toContainText('לא פעילה – שגיאה בהגדרה');
    await shot(page, '42-state-invalid-drawer', '1440');
    await open(page, '/devices/automations/1727700000002', '390', { user: 'runner' });
    d = drawer(page);
    await expect(d.locator('[data-drawer-state="forbidden"]')).toContainText('אין הרשאה');
    await expect(d.locator('[data-drawer-detail], [data-drawer-why]')).toHaveCount(0);
    await shot(page, '43-state-runner-automation-link', '390');
  });

  test('a change made outside while the drawer is open: the write finds it changed, the banner offers the current version', async ({ page }) => {
    await open(page, '/devices/automations/1727700000004');
    const d = drawer(page);
    await expect(d.locator('[data-drawer-detail]')).toBeVisible();
    await page.evaluate(() => { (window as unknown as { __automationsMock: AutomationsMockStore }).__automationsMock.conflictNext = true; });
    await d.locator('[data-drawer-delete]').click();
    await d.locator('[data-dialog="delete"] [data-dialog-ok]').click();
    await expect(d.locator('[data-drawer-conflict]')).toContainText('הפריט שונה במקום אחר');
    await expect(scr(page).locator('[data-auto-note]')).toContainText('שונה במקום אחר');
    await shot(page, '44-state-conflict', '1440');
    await d.locator('[data-conflict-reload]').click();
    await expect(d.locator('[data-drawer-conflict]')).toHaveCount(0);
    // the item was not deleted
    await expect(card(page, 'דלת פתוחה יותר מ־5 דקות')).toBeVisible();
  });

  test('copy, delete with the undo in the toast, the trash drawer with its restore and the user-menu entry', async ({ page }) => {
    await open(page, '/devices/automations/1727700000002');
    const d = drawer(page);
    await d.locator('[data-drawer-copy]').click();
    await expect(d.locator('[data-copy-name]')).toHaveValue('תנועה בפרוזדור (עותק)');
    await d.locator('[data-dialog="copy"] [data-dialog-ok]').click();
    await expect(cards(page)).toHaveCount(13);
    await expect(card(page, 'תנועה בפרוזדור (עותק)')).toBeVisible();
    // delete the copy: it goes to the trash, the toast offers the undo
    await expect(d.locator('[data-drawer-detail]')).toBeVisible();
    await d.locator('[data-drawer-delete]').click();
    await shot(page, '50-delete-confirm', '1440');
    await d.locator('[data-dialog="delete"] [data-dialog-ok]').click();
    await expect(cards(page)).toHaveCount(12);
    await expect(scr(page).locator('[data-auto-note]')).toContainText('נמחק');
    await scr(page).locator('[data-note-action]').click();
    await expect(cards(page)).toHaveCount(13);
    // the trash: two items from before; the user menu opens it
    await page.locator('sw-app [data-profile-menu]').click();
    await page.locator('sw-app sw-user-menu [data-menu-screen-edit="automations-trash"]').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/automations/trash');
    const trash = drawer(page).locator('[data-drawer-trash]');
    await expect(trash.locator('[data-trash]')).toHaveCount(2);
    await expect(trash.locator('[data-trash="x2"]')).toContainText('רגישה');
    await expect(trash.locator('[data-trash="x2"] .urgent')).toHaveCount(1);
    await shot(page, '51-trash', '1440');
    await trash.locator('[data-trash-restore="x1"]').click();
    await expect(trash.locator('[data-trash]')).toHaveCount(1);
    await expect(scr(page).locator('[data-auto-note]')).toContainText('שוחזר');
    await open(page, '/devices/automations/trash', '390');
    await shot(page, '52-trash', '390');
  });

  test('edit and new are routes of the editors (S4): the screen opens the sheet over the list, by kind, with the id; closing returns to the drawer', async ({ page }) => {
    await open(page, '/devices/automations');
    await ready(page);
    await card(page, 'תנועה בפרוזדור').locator('[data-card-menu]').click();
    await card(page, 'תנועה בפרוזדור').locator('[data-card-action="edit"]').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/automations/1727700000002/edit');
    const b = scr(page).locator('automation-builder[data-auto-editor="automation"]');
    await expect(b.locator('[data-name-input]')).toHaveValue('תנועה בפרוזדור');
    await expect(cards(page)).toHaveCount(12); // the list stays mounted underneath
    await b.locator('[data-editor-cancel], [data-editor-close]').first().click();
    await expect.poll(() => hashOf(page)).toMatch(/\/devices\/automations\/1727700000002(\?|$)/);
    await expect(scr(page).locator('automation-builder')).toHaveCount(0);
    await expect(drawer(page).locator('[data-drawer-detail]')).toBeVisible();
    await open(page, '/devices/automations');
    await ready(page);
    await scr(page).locator('[data-auto-new]').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/automations/new/edit?kind=automation');
    await expect(scr(page).locator('automation-builder [data-stage="templates"]')).toBeVisible(); // a new automation starts at the gallery
    await open(page, '/devices/automations/scripts/1727700000100/edit');
    await expect(scr(page).locator('script-editor[data-auto-editor="script"] [data-name-input]')).not.toHaveValue('');
    await expect(scr(page).locator('automation-builder')).toHaveCount(0);
    // the drawer's own "עריכה" goes there too
    await open(page, '/devices/automations/1727700000002');
    await drawer(page).locator('[data-drawer-edit]').click();
    await expect.poll(() => hashOf(page)).toContain('/1727700000002/edit');
    await expect(scr(page).locator('automation-builder [data-name-input]')).toHaveValue('תנועה בפרוזדור');
  });
  test('the card menu lists what the caller may do; "גרסאות" opens that view of the drawer', async ({ page }) => {
    await open(page, '/devices/automations');
    await ready(page);
    const c = card(page, 'תנועה בפרוזדור');
    await c.locator('[data-card-menu]').click();
    await shot(page, '12-card-menu', '1440');
    await expect(c.locator('[data-card-action]')).toHaveCount(7);
    await c.locator('[data-card-action="versions"]').click();
    await expect.poll(() => hashOf(page)).toContain('view=versions');
    await expect(drawer(page).locator('[data-drawer-versions]')).toBeVisible();
  });
});

// ------------------------------------------------------------------------------------------------ scenes

const panel = (page: Page) => scr(page).locator('scenes-panel');
const scene = (page: Page, name: string) => panel(page).locator('.scard', { hasText: name });

test.describe('scenes', () => {
  test('grouped by area with the favourites first; a scene of a device is "הפעלה בלבד", one of ours "ניתנת לעריכה"', async ({ page }) => {
    for (const [size, scheme] of [['1440', 'light'], ['820', 'light'], ['390', 'light'], ['1440', 'dark'], ['390', 'dark']] as const) {
      await open(page, '/devices/automations/scenes', size, { scheme });
      await ready(page);
      await expect(panel(page).locator('.scard')).toHaveCount(5);
      await shot(page, '60-scenes', size, scheme);
    }
    await open(page, '/devices/automations/scenes');
    await ready(page);
    await expect(scr(page).locator('[data-auto-title]')).toHaveText('סצנות');
    await expect(scr(page).locator('button[data-segment="scenes"]')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page).locator('[data-scene-group="favourites"] .scard')).toHaveCount(2);
    expect(await panel(page).locator('[data-scene-group^="area:"]').count()).toBeGreaterThanOrEqual(2);
    await expect(scene(page, 'ברוכים הבאים').locator('[data-scene-badge]')).toHaveText('ניתנת לעריכה');
    await expect(scene(page, 'ברוכים הבאים').locator('[data-scene-edit]')).toBeVisible();
    await expect(scene(page, 'סלון · סרט').locator('[data-scene-badge]')).toHaveText('הפעלה בלבד');
    await expect(scene(page, 'סלון · סרט').locator('[data-scene-edit]')).toHaveCount(0);
    await expect(scene(page, 'סלון · סרט').locator('[data-scene-sub]')).toHaveText('עוד לא הופעלה');
    // the state filter belongs to automations only
    await expect(scr(page).locator('.stf')).toHaveCount(0);
    expect(await scr(page).innerText()).not.toMatch(BRANDS);
  });

  test('"הפעל" answers with a short confirmation; a star keeps a scene among the favourites; an administrator hides a scene of a device', async ({ page }) => {
    await open(page, '/devices/automations/scenes');
    await ready(page);
    const movie = scene(page, 'סלון · סרט');
    await movie.locator('[data-scene-activate]').click();
    await expect(movie.locator('[data-scene-activate]')).toHaveText('הופעלה');
    await expect(movie.locator('[data-scene-sub]')).toContainText('הופעלה');
    await movie.locator('[data-scene-fav]').click();
    await expect(panel(page).locator('[data-scene-group="favourites"] .scard')).toHaveCount(3);
    await expect(scene(page, 'סלון · סרט').locator('[data-scene-fav]')).toHaveAttribute('aria-pressed', 'true');
    // the hidden scene: counted for the administrator, listed on demand, never in the groups
    await expect(panel(page).locator('[data-scene-hidden-toggle]')).toContainText('1');
    await panel(page).locator('[data-scene-hidden-toggle]').click();
    await expect(panel(page).locator('[data-scene-group="hidden"] .scard')).toHaveCount(1);
    await panel(page).locator('[data-scene-group="hidden"] [data-scene-hide]').click();
    await expect(panel(page).locator('[data-scene-hidden-toggle]')).toHaveCount(0);
    await expect(panel(page).locator('.scard')).toHaveCount(6); // shown again: it joins its area
    // a second activation of the same scene at once is refused kindly
    await scene(page, 'סלון · סרט').locator('[data-scene-activate]').click();
    await expect(scr(page).locator('[data-auto-note]')).toContainText('ממש עכשיו');
  });

  test('a new scene: pick the devices, "צלם מצב נוכחי", correct a value in the table, save; edit it; delete it with the undo', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations/scenes', size);
      await ready(page);
      await scr(page).locator('[data-auto-new]').click();
      await expect.poll(() => hashOf(page)).toContain('/devices/automations/scenes/new');
      const cap = panel(page).locator('scene-capture');
      await expect(cap).toBeVisible();
      await expect(cap.locator('[data-scene-capture]')).toBeDisabled(); // no device yet
      await cap.locator('[data-scene-name]').fill('ערב בסלון');
      await shot(page, '61-scene-new-empty', size);
      for (const id of ['light.salon', 'cover.salon_shutter', 'climate.salon']) {
        await cap.locator('[data-scene-add]').click();
        await cap.locator(`[data-pick="${id}"]`).click();
      }
      await expect(cap.locator('[data-device-chip]')).toHaveCount(3);
      await cap.locator('[data-scene-capture]').click();
      await expect(cap.locator('[data-scene-captured]')).toBeVisible();
      await expect(cap.locator('[data-scene-row]')).toHaveCount(3);
      await expect(cap.locator('[data-row-attr="light.salon:brightness"]')).toHaveValue('50');
      await shot(page, '62-scene-capture', size);
      if (size === '390') break;
      // correct a value, add one more device after the capture (it is captured on its own), remove one
      await cap.locator('[data-row-attr="light.salon:brightness"]').fill('80');
      await cap.locator('[data-row-attr="light.salon:brightness"]').dispatchEvent('change');
      await cap.locator('[data-scene-add]').click();
      await cap.locator('[data-pick="media_player.salon_tv"]').click();
      await expect(cap.locator('[data-scene-row]')).toHaveCount(4);
      await cap.locator('[data-row-remove="climate.salon"]').click();
      await expect(cap.locator('[data-scene-row]')).toHaveCount(3);
      await cap.locator('[data-scene-save]').click();
      await expect(scr(page).locator('[data-auto-note]')).toContainText('נשמר');
      await expect.poll(() => hashOf(page)).not.toContain('/new');
      await expect(scene(page, 'ערב בסלון').locator('[data-scene-badge]')).toHaveText('ניתנת לעריכה');
      // the saved scene keeps the corrected brightness
      await scene(page, 'ערב בסלון').locator('[data-scene-edit]').click();
      await expect(cap.locator('[data-row-attr="light.salon:brightness"]')).toHaveValue('80');
      await expect(cap.locator('[data-scene-row]')).toHaveCount(3);
      await shot(page, '63-scene-edit', size);
      // delete it: a confirmation, then the toast with the undo
      await cap.locator('[data-scene-delete]').click();
      await expect(panel(page).locator('[data-dialog="delete-scene"]')).toHaveAttribute('open', '');
      await panel(page).locator('[data-dialog="delete-scene"] [data-dialog-ok]').click();
      await expect(scene(page, 'ערב בסלון')).toHaveCount(0);
      await scr(page).locator('[data-note-action]').click();
      await expect(scene(page, 'ערב בסלון')).toHaveCount(1);
    }
  });

  test('an alarm panel is not a capture device; a household member sees only the scenes of the floor; the empty state offers "סצנה חדשה"', async ({ page }) => {
    await open(page, '/devices/automations/scenes/new');
    const cap = panel(page).locator('scene-capture');
    await cap.locator('[data-scene-add]').click();
    await expect(cap.locator('[data-pick="alarm_control_panel.home"]')).toHaveCount(0);
    await expect(cap.locator('[data-pick="light.salon"]')).toHaveCount(1);
    await open(page, '/devices/automations/scenes', '1440', { empty: true });
    await expect(scr(page).locator('[data-auto-state="empty"]')).toContainText('אין עדיין סצנות');
    await expect(scr(page).locator('[data-auto-new-empty]')).toHaveText('סצנה חדשה');
    // the household member's floor holds no scene of its own: the panel is empty, "סצנה חדשה" is theirs to offer
    await open(page, '/devices/automations/scenes', '390', { user: 'household' });
    await expect(scr(page).locator('[data-auto-state="empty"]')).toContainText('אין עדיין סצנות');
    await expect(scr(page).locator('[data-auto-new-empty]')).toBeVisible();
    await shot(page, '64-scenes-household', '390');
  });
});

// ------------------------------------------------------------------------------------------------ scripts

const sp = (page: Page) => scr(page).locator('scripts-panel');
const script = (page: Page, name: string) => sp(page).locator('.pcard', { hasText: name });

test.describe('scripts', () => {
  test('the runner: a big "הפעל" per script; the chips say what is sensitive or locked', async ({ page }) => {
    for (const [size, scheme] of [['1440', 'light'], ['1440', 'dark'], ['390', 'light'], ['820', 'light']] as const) {
      await open(page, '/devices/automations/scripts', size, { scheme });
      await ready(page);
      await expect(sp(page).locator('.pcard')).toHaveCount(3);
      await shot(page, '70-scripts', size, scheme);
    }
    await open(page, '/devices/automations/scripts');
    await ready(page);
    await expect(scr(page).locator('[data-auto-title]')).toHaveText('סקריפטים');
    await expect(script(page, 'מצב חופשה').locator('[data-chip="sensitive"]')).toHaveText('רגישה');
    await expect(script(page, 'בוקר טוב').locator('[data-script-runline]')).toContainText('הורץ');
    await expect(script(page, 'תריסים לפי אחוז').locator('[data-script-run]')).toHaveText('הפעל…'); // has fields: the sheet opens
    await expect(script(page, 'בוקר טוב').locator('[data-script-run]')).toHaveText('הפעל');
    expect(await scr(page).innerText()).not.toMatch(BRANDS);
  });

  test('run: a plain script at once; a sensitive one asks first; a running script shows "רץ עכשיו" and "עצור"', async ({ page }) => {
    await open(page, '/devices/automations/scripts');
    await ready(page);
    await script(page, 'בוקר טוב').locator('[data-script-run]').click();
    await expect(scr(page).locator('[data-auto-note]')).toContainText('הסקריפט הופעל');
    // the sensitive one: the confirmation names what it includes
    const vac = script(page, 'מצב חופשה');
    await vac.locator('[data-script-run]').click();
    await expect(sp(page).locator('[data-dialog="run-script"]')).toContainText('כולל אזעקה – כמו בשליטה ידנית.');
    await shot(page, '71-script-confirm', '1440');
    await sp(page).locator('[data-dialog="run-script"] [data-dialog-ok]').click();
    await expect(vac.locator('[data-script-running]')).toHaveText('רץ עכשיו');
    await expect(vac.locator('[data-script-stop]')).toBeVisible();
    await shot(page, '72-script-running', '1440');
    await vac.locator('[data-script-stop]').click();
    await expect(vac.locator('[data-script-running]')).toHaveCount(0);
    await expect(vac.locator('[data-script-run]')).toBeVisible();
  });

  test('a script with fields: "הפעל…" opens its sheet with the short form; the run sends the values', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations/scripts', size);
      await ready(page);
      await script(page, 'תריסים לפי אחוז').locator('[data-script-run]').click();
      await expect.poll(() => hashOf(page)).toContain('/devices/automations/scripts/1727700000102');
      const d = drawer(page);
      const form = d.locator('script-fields-form');
      await expect(form.locator('[data-field-row]')).toHaveCount(4);
      await expect(form.locator('[data-field="percent"]')).toHaveValue('50');
      await form.locator('[data-field-plus="percent"]').click();
      await expect(form.locator('[data-field="percent"]')).toHaveValue('60');
      await form.locator('[data-field="slow"]').click();
      await expect(form.locator('[data-field="slow"]')).toHaveAttribute('aria-checked', 'true');
      await shot(page, '73-script-fields', size);
      // its step takes the device from the field (a template): the effect is unknown, so the same confirmation as manual control comes first
      await d.locator('[data-drawer-run]').click();
      await expect(d.locator('[data-dialog="run"]')).toContainText('פעולה מתקדמת');
      await d.locator('[data-dialog="run"] [data-dialog-ok]').click();
      await expect(scr(page).locator('[data-auto-note]')).toContainText('הסקריפט הופעל');
    }
  });

  test('the empty state of the scripts and the script runner: runs scripts but cannot edit', async ({ page }) => {
    await open(page, '/devices/automations/scripts', '1440', { empty: true });
    await expect(scr(page).locator('[data-auto-state="empty"]')).toContainText('אין עדיין סקריפטים');
    // a runner of floor 1 runs the scripts of that floor only (none here: they all touch the ground floor) and cannot create
    await open(page, '/devices/automations/scripts', '390', { user: 'runner' });
    await expect(scr(page).locator('[data-auto-state="empty"]')).toContainText('אין עדיין סקריפטים');
    await expect(scr(page).locator('[data-auto-new], [data-auto-new-empty]')).toHaveCount(0);
    await shot(page, '74-scripts-runner', '390');
    // the household editor sees the same floor and may create
    await open(page, '/devices/automations/scripts', '1440', { user: 'household' });
    await expect(scr(page).locator('[data-auto-new-empty]')).toBeVisible();
  });
});

// ------------------------------------------------------------------------------------------------ the three users

test.describe('the three users', () => {
  test('household editor (floor 1, saving through the delegation): the floors, the toggles, the new button', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations', size, { user: 'household' });
      await ready(page);
      await shot(page, '80-household', size);
    }
    await open(page, '/devices/automations', '1440', { user: 'household' });
    await ready(page);
    await expect(scr(page).locator('.rooms .rc')).toHaveText(['הכל', 'קומה 1']);
    const n = await cards(page).count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(12);
    await expect(scr(page).locator('[data-auto-new]')).toBeEnabled();
    await expect(scr(page).locator('[data-card-toggle]').first()).toBeVisible();
    await expect(scr(page).locator('[data-auto-banner]')).toHaveCount(0);
    // their menu may edit; the alarm item (a grant they do not hold) is read-only for them
    await cards(page).first().locator('[data-card-menu]').click();
    await expect(cards(page).first().locator('[data-card-action="edit"]')).toBeVisible();
  });

  test('household editor with the delegation off: the strip says what still works; saving is disabled with the reason', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations', size, { user: 'household', delegation: false });
      await ready(page);
      await expect(scr(page).locator('[data-auto-banner="delegation_off"]')).toContainText('שמירה דורשת מנהל');
      await shot(page, '81-delegation-off', size);
    }
    await expect(scr(page).locator('[data-auto-new]')).toBeDisabled();
    await expect(scr(page).locator('[data-auto-new]')).toHaveAttribute('title', 'שמירה דורשת מנהל');
    await cards(page).first().locator('[data-card-menu]').click();
    await expect(cards(page).first().locator('[data-card-action="edit"]')).toHaveCount(0);
    await expect(scr(page).locator('[data-card-toggle]').first()).toBeVisible(); // viewing, running, switching still work
  });

  test('script runner (decision 1b, no view-only access): no automations segment, no automation card, no new button', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations', size, { user: 'runner' });
      await expect(scr(page).locator('[data-screen="devices-automations"]')).toHaveAttribute('data-segment', 'scripts');
      await shot(page, '82-runner', size);
    }
    await open(page, '/devices/automations', '1440', { user: 'runner' });
    await expect(scr(page).locator('[data-screen="devices-automations"]')).toHaveAttribute('data-segment', 'scripts');
    await expect(scr(page).locator('button[data-segment="automations"]')).toHaveCount(0);
    await expect(cards(page)).toHaveCount(0);
    await expect(scr(page).locator('[data-auto-new], [data-auto-new-empty]')).toHaveCount(0);
    // a runner's settings tab: forbidden
    await open(page, '/system/automations', '1440', { user: 'runner' });
    await expect(page.locator('sw-app system-automations [data-automations-settings-forbidden]')).toBeVisible();
  });
});

// ------------------------------------------------------------------------------------------------ the states

test.describe('states', () => {
  test('loading: skeleton cards, no spinner text', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations?state=loading', size);
      await expect(scr(page).locator('[data-auto-state="loading"]')).toBeVisible();
      await expect(scr(page).locator('[data-auto-state="loading"] .skl').first()).toBeVisible();
      await shot(page, '90-state-loading', size);
    }
  });

  test('empty: each kind says so and offers the new button to who may create', async ({ page }) => {
    for (const [size, scheme] of [['1440', 'dark'], ['390', 'light']] as const) {
      await open(page, '/devices/automations', size, { empty: true, scheme });
      await expect(scr(page).locator('[data-auto-state="empty"]')).toContainText('אין עדיין אוטומציות');
      await expect(scr(page).locator('[data-auto-new-empty]')).toBeVisible();
      await shot(page, '91-state-empty', size, scheme);
    }
    await open(page, '/devices/automations', '1440', { empty: true, user: 'runner' });
    await expect(scr(page).locator('[data-auto-state="empty"]')).toContainText('אין עדיין סקריפטים');
    await expect(scr(page).locator('[data-auto-new-empty]')).toHaveCount(0);
  });

  test('error: the list cannot load; "נסו שוב" loads it once the platform answers', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations', size, { error: true });
      await expect(scr(page).locator('[data-auto-state="error"]')).toBeVisible();
      await shot(page, '92-state-error', size);
    }
    await page.evaluate(() => localStorage.setItem('sw.demo.automations', '{}'));
    await scr(page).locator('[data-auto-retry]').click();
    await expect(cards(page)).toHaveCount(12);
  });

  test('no permission, switched off, not configured', async ({ page }) => {
    await open(page, '/devices/automations', '1440', { noPermission: true });
    await expect(scr(page).locator('[data-auto-state="no_permission"]')).toContainText('אין הרשאה');
    await open(page, '/devices/automations', '1440', { available: 'feature_disabled' });
    await expect(scr(page).locator('[data-auto-state="feature_disabled"]')).toContainText('האוטומציות כבויות');
    await expect(scr(page).locator('[data-open-settings]')).toBeVisible(); // the installer may switch them on
    await shot(page, '93-state-switched-off', '1440');
    await open(page, '/devices/automations', '390', { available: 'not_configured' });
    await expect(scr(page).locator('[data-auto-state="not_configured"]')).toBeVisible();
    await open(page, '/devices/automations', '1440', { available: 'feature_disabled', user: 'runner' });
    await expect(scr(page).locator('[data-open-settings]')).toHaveCount(0);
  });

  test('offline: the last list stays with one strip and a retry; a configuration API that is down only blocks saving', async ({ page }) => {
    for (const size of ['1440', '390'] as const) {
      await open(page, '/devices/automations', size, { offline: true });
      await ready(page);
      await expect(scr(page).locator('[data-auto-banner="offline"]')).toContainText('תשתית המערכת אינה זמינה כרגע');
      await expect(cards(page)).toHaveCount(12);
      await shot(page, '94-state-offline', size);
    }
    await open(page, '/devices/automations', '1440', { available: 'config_api_unavailable' });
    await ready(page);
    await expect(scr(page).locator('[data-auto-banner="read_only"]')).toContainText('עריכה אינה זמינה כרגע');
    await expect(scr(page).locator('[data-auto-new]')).toBeDisabled();
  });
});

// ------------------------------------------------------------------------------------------------ הגדרות › אוטומציות

const settings = (page: Page) => page.locator('sw-app system-automations');

test.describe('הגדרות › אוטומציות', () => {
  test('every section of the feature lives here; the delegation switch is read-only', async ({ page }) => {
    for (const [size, scheme] of [['1440', 'light'], ['820', 'light'], ['390', 'light']] as const) {
      await open(page, '/system/automations', size, { scheme });
      await expect(settings(page).locator('[data-automations-settings]')).toBeVisible();
      await shot(page, '95-settings', size, scheme);
    }
    await open(page, '/system/automations');
    const s = settings(page);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('אוטומציות');
    for (const card of ['who', 'delegation', 'code', 'retention', 'limits', 'sensitive', 'templates', 'display', 'status', 'review']) await expect(s.locator(`[data-card="${card}"]`)).toBeVisible();
    await expect(s.locator('[data-roles-matrix] tbody tr')).toHaveCount(6);
    // the delegation card: its state as text, "לקריאה בלבד", and no control at all
    const d = s.locator('[data-card="delegation"]');
    await expect(d.locator('[data-delegation-state]')).toHaveText('מופעל');
    await expect(d.locator('[data-delegation-readonly]')).toContainText('לקריאה בלבד');
    await expect(d.locator('sw-toggle, input, select, button')).toHaveCount(0);
    await expect(d).toContainText('Home Assistant');
    // the trash, the review list
    await expect(s.locator('[data-review]')).not.toHaveCount(0);
    await s.locator('[data-open-trash]').click();
    await expect(s.locator('automation-drawer [data-trash]')).toHaveCount(2);
    await shot(page, '96-settings-trash', '1440');
  });

  test('dark scheme, and the delegation off', async ({ page }) => {
    await open(page, '/system/automations', '1440', { delegation: false });
    await expect(settings(page).locator('[data-delegation-state]')).toHaveText('כבוי');
    await shot(page, '97-settings-delegation-off', '1440');
  });

  test('a change is a draft with a save bar; saving writes it; the list follows (the sensitive chip, the phone filter)', async ({ page }) => {
    await open(page, '/system/automations');
    const s = settings(page);
    await expect(s.locator('[data-settings-bar]')).toHaveCount(0);
    await s.locator('[data-step-plus="trash_days"]').click();
    await s.locator('[data-step-plus="versions_keep"]').click();
    await expect(s.locator('[data-setting="trash_days"]')).toContainText('31');
    await expect(s.locator('[data-settings-bar]')).toContainText('יש שינויים שלא נשמרו');
    await s.locator('[data-settings-cancel]').click();
    await expect(s.locator('[data-setting="trash_days"]')).toContainText('30');
    await s.locator('[data-step-minus="trash_days"]').click();
    await s.locator('[data-code-role="aut_editor"]').click();
    await s.locator('[data-sensitive-chip="red"]').click();
    await s.locator('[data-phone-filter="rows"]').click();
    await s.locator('[data-notify="notify.mobile_app_dana"]').click();
    await s.locator('[data-toggle="storm_auto_disable"]').click();
    await s.locator('[data-template-down="t1"]').click();
    await s.locator('[data-toggle="tpl-t2"]').click();
    await shot(page, '98-settings-draft', '1440');
    await s.locator('[data-settings-save]').click();
    await expect(s.locator('[data-settings-saved]')).toHaveText('נשמר');
    await expect(s.locator('[data-setting="trash_days"]')).toContainText('29');
    await expect(s.locator('[data-roles-matrix] tr[data-role="aut_editor"] .yes')).toHaveCount(3); // run, create-edit and the code view switched on for the editor role (no view column, decision 1b)
    // the list reads the new display settings from the status
    await page.evaluate(() => { location.hash = '#/devices/automations'; });
    await ready(page);
    await expect(scr(page)).toHaveAttribute('data-sens', 'red');
    await expect(scr(page)).toHaveAttribute('data-phone-filter', 'rows');
    // the gallery management sticks: t1 moved down, t2 hidden
    await page.evaluate(() => { location.hash = '#/system/automations'; });
    await expect.poll(async () => (await settings(page).locator('[data-template]').evaluateAll((els) => els.map((e) => e.getAttribute('data-template')))).slice(0, 2)).toEqual(['t2', 't1']);
    await expect(settings(page).locator('[data-template="t2"]')).toHaveClass(/off/);
  });

  test('an out-of-range or refused save shows the server\'s message and keeps the draft', async ({ page }) => {
    await open(page, '/system/automations');
    const s = settings(page);
    await s.locator('[data-step-plus="trash_days"]').click();
    await page.evaluate(() => { (window as unknown as { __automationsMock: AutomationsMockStore }).__automationsMock.failNext('rate_limited'); });
    await s.locator('[data-settings-save]').click();
    await expect(s.locator('[data-settings-error]')).toContainText('יותר מדי שינויים');
    await expect(s.locator('[data-settings-bar]')).toContainText('שינויים');
    await expect(s.locator('[data-setting="trash_days"]')).toContainText('31');
  });
});

// ------------------------------------------------------------------------------------------------ with a session

const VIEWER_PERMS = ['video.live', 'video.playback', 'devices.read', 'map.read', 'entity.state.read', 'events.read'];

interface ApiState {
  perms: string[];
  settings: Record<string, unknown>;
  store: AutomationsMockStore;
  calls: { method: string; path: string; body: unknown }[];
  listStatus: number;
  statusCode: number;
  /** a caller who may only run scripts: the server answers the scripts alone */
  scriptsOnly: boolean;
  lists: number;
  patches: Record<string, unknown>[];
  ws: { send: (m: string) => void } | null;
}

async function install(page: Page, st: ApiState) {
  await page.routeWebSocket('**/ha/ws', (ws) => {
    st.ws = { send: (m) => ws.send(m) };
  });
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const err = (status: number, code: string, msg: string) => json({ code, user_message: msg, retryable: false, correlation_id: '', details: {} }, status);
    if (p === 'me') {
      return json({
        channel: 'local', remote: null,
        user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' },
        active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: st.perms, permissions_any: st.perms, has_access: true, permission_revision: 1,
        permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      Object.assign(st.settings, body);
    }
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.security_snapshot': 'true', ...st.settings }, can_edit: st.perms.includes('system.configure') });
    if (p.startsWith('automations')) {
      const body = req.method() === 'GET' ? null : req.postDataJSON();
      st.calls.push({ method: req.method(), path: p + url.search, body });
      const s = st.store;
      try {
        if (p === 'automations/status') {
          if (st.statusCode !== 200) return err(st.statusCode, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
          const status = await s.status();
          return json(st.scriptsOnly ? { ...status, can: { ...status.can, view: true, manage: false, scene_manage: false, script_manage: false, code_view: false, configure: false, scene_run: false } } : status);
        }
        if (p === 'automations' && req.method() === 'GET') {
          st.lists += 1;
          if (st.listStatus !== 200) return err(st.listStatus, 'internal', 'שגיאה בשרת (בדיקה)');
          const r = await s.list({ limit: 500 });
          return json(st.scriptsOnly ? { items: r.items.filter((i) => i.kind === 'script'), total: 3 } : r);
        }
        if (p === 'automations/catalog') return json(await s.catalog());
        if (p === 'automations/templates') return json(await s.templates());
        if (p === 'automations/trash') return json(await s.trash());
        if (p === 'automations/review') return json(await s.review());
        const m = /^automations\/(automation|script|scene)\/([^/]+)(?:\/(.+))?$/.exec(p);
        if (m) {
          const [, kind, rawId, rest] = m;
          const id = decodeURIComponent(rawId);
          const k = kind as 'automation' | 'script' | 'scene';
          const b = body as Record<string, unknown>;
          if (!rest && req.method() === 'GET') return json(await s.get(k, id));
          if (rest === 'runs') return json(await s.runs(k, id));
          if (rest?.startsWith('runs/')) return json(await s.runTrace(k, id, rest.slice(5)));
          if (rest === 'versions') return json(await s.versions(k, id));
          if (rest === 'enable' || rest === 'disable') return json(await s.setEnabled(id, rest === 'enable', b as never));
          if (rest === 'run' && k === 'automation') return json(await s.run(id, b as never), 202);
          if (rest === 'run') return json(await s.runScript(id, b as never), 202);
          if (rest === 'stop') return json(await s.stopScript(id, b as never));
          if (rest === 'apply') return json(await s.applyScene(id, b as never), 202);
          if (rest === 'dry-run') return json(await s.dryRun(k, id));
          if (rest === 'delete') return json(await s.remove(k, id, b as never));
          if (rest === 'copy') return json(await s.copy(k, id, b as never), 201);
        }
      } catch (e) {
        if (e instanceof ApiError) return json(e.body, e.status);
        throw e;
      }
      return err(404, 'not_found', 'לא נמצא (בדיקה)');
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 0, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json({ panels: [], counts: { panels: 0 } });
    return err(404, 'not_found', 'לא נמצא (בדיקה)');
  });
}

async function openApi(page: Page, hash: string, size: Size = '1440') {
  await page.setViewportSize(SIZES[size]);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}

const rowTabs = (page: Page) => page.locator('sw-app .subnav sw-tabs a').allTextContents();

test.describe('with a session: permissions, the setting, the push frame and what the client sends', () => {
  let st: ApiState;

  test.beforeEach(async ({ page }) => {
    st = { perms: [...VIEWER_PERMS, 'automation.manage', 'scene.manage', 'script.run', 'script.manage', 'system.configure'], settings: {}, store: resetAutomationsMock({ user: 'installer' }), calls: [], listStatus: 200, statusCode: 200, scriptsOnly: false, lists: 0, patches: [], ws: null };
    await install(page, st);
  });

  const post = (re: RegExp) => st.calls.filter((c) => c.method === 'POST' && re.test(c.path));

  test('the tab is for automation.manage, a script run or a scene activation (decision 1b); the settings tab for system.configure; automations.enabled off hides it', async ({ page }) => {
    st.perms = VIEWER_PERMS;
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
    st.perms = [...VIEWER_PERMS, 'automation.view']; // the removed permission opens nothing
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
    st.perms = [...VIEWER_PERMS, 'automation.manage'];
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual(['מבט על', 'אוטומציות']);
    st.perms = [...VIEWER_PERMS, 'script.run'];
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual(['מבט על', 'אוטומציות']);
    st.perms = [...VIEWER_PERMS, 'schedule.view', 'automation.manage'];
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual(['מבט על', 'תזמונים', 'אוטומציות']);
    // the settings tab
    st.perms = [...VIEWER_PERMS, 'automation.manage'];
    await openApi(page, '/system/diagnostics');
    expect(await rowTabs(page)).not.toContain('אוטומציות');
    st.perms = [...VIEWER_PERMS, 'system.configure'];
    await openApi(page, '/system/diagnostics');
    expect(await rowTabs(page)).toContain('אוטומציות');
    // the product setting
    st.perms = [...VIEWER_PERMS, 'automation.manage'];
    st.settings = { 'automations.enabled': 'false' };
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
  });

  test('the list answers from the real routes; the toggle, the run and the delete send what the contract says', async ({ page }) => {
    await openApi(page, '/devices/automations');
    await ready(page);
    await expect(cards(page)).toHaveCount(12);
    expect(st.calls.some((c) => c.path === 'automations/status')).toBe(true);
    expect(st.calls.some((c) => c.path.startsWith('automations?') && c.path.includes('limit=500'))).toBe(true);
    const hall = card(page, 'תנועה בפרוזדור');
    await hall.locator('[data-card-toggle]').click();
    await expect.poll(() => post(/automations\/automation\/1727700000002\/disable/).length).toBe(1);
    const dis = post(/disable/)[0].body as { client_request_id: string; confirm?: boolean };
    expect(dis.client_request_id.length).toBeGreaterThanOrEqual(8);
    expect(dis.confirm).toBeUndefined();
    await expect(hall.locator('[data-card-toggle]')).toHaveAttribute('aria-checked', 'false');
    await hall.locator('a.name').click();
    await drawer(page).locator('[data-drawer-versions]').click();
    await expect(drawer(page).locator('[data-version]').first()).toBeVisible();
    await drawer(page).locator('[data-drawer-back]').click();
    await drawer(page).locator('[data-drawer-run]').click();
    await expect.poll(() => post(/automations\/automation\/1727700000002\/run/).length).toBe(1);
    expect(post(/\/run/)[0].body).toMatchObject({ skip_condition: true });
    await drawer(page).locator('[data-drawer-delete]').click();
    await drawer(page).locator('[data-dialog="delete"] [data-dialog-ok]').click();
    await expect.poll(() => post(/automations\/automation\/1727700000002\/delete/).length).toBe(1);
    const del = post(/delete/)[0].body as { base_revision: string; confirm: boolean };
    expect(del.confirm).toBe(true);
    expect(del.base_revision).toMatch(/^[0-9a-f]{16}$/);
    await expect(cards(page)).toHaveCount(11);
    // a scene and a script
    await openApi(page, '/devices/automations/scenes');
    await scene(page, 'סלון · סרט').locator('[data-scene-activate]').click();
    await expect.poll(() => post(/automations\/scene\/entity%3Ascene\.salon_movie\/apply/).length).toBe(1);
    await openApi(page, '/devices/automations/scripts');
    await script(page, 'בוקר טוב').locator('[data-script-run]').click();
    await expect.poll(() => post(/automations\/script\/1727700000100\/run/).length).toBe(1);
    expect(post(/script\/1727700000100\/run/)[0].body).toMatchObject({ fields: {} });
  });

  test('the push frame automations_changed refetches the list', async ({ page }) => {
    await openApi(page, '/devices/automations');
    await ready(page);
    const before = st.lists;
    await expect.poll(() => st.ws !== null).toBe(true);
    await st.store.setEnabled(st.store.idOf('automation.hall_motion'), false, { client_request_id: 'push-test-1' });
    st.ws!.send(JSON.stringify({ type: 'automations_changed', payload: { kinds: ['automation'], ids: [] } }));
    await expect(card(page, 'תנועה בפרוזדור').locator('[data-card-toggle]')).toHaveAttribute('aria-checked', 'false');
    expect(st.lists).toBeGreaterThan(before);
  });

  test('a failing list shows the error state with a retry; a refused status says "no permission"; a script-only caller sees the scripts', async ({ page }) => {
    st.listStatus = 500;
    await openApi(page, '/devices/automations');
    await expect(scr(page).locator('[data-auto-state="error"]')).toBeVisible();
    st.listStatus = 200;
    await scr(page).locator('[data-auto-retry]').click();
    await expect(cards(page)).toHaveCount(12);
    st.statusCode = 403;
    await openApi(page, '/devices/automations');
    await expect(scr(page).locator('[data-auto-state="no_permission"]')).toBeVisible();
    st.statusCode = 200;
    st.scriptsOnly = true;
    st.perms = [...VIEWER_PERMS, 'script.run'];
    await openApi(page, '/devices/automations');
    await expect(sp(page).locator('.pcard')).toHaveCount(3);
    await expect(scr(page).locator('[data-auto-title]')).toHaveText('סקריפטים'); // the segment falls back to what the caller sees
    await expect(scr(page).locator('button[data-segment]')).toHaveCount(0); // one kind: no switch
    await expect(scr(page).locator('[data-auto-new]')).toHaveCount(0);
    await shot(page, '99-script-only-caller', '1440');
  });

  test('הגדרות › אוטומציות sends only what changed, and applies the feature switch at once', async ({ page }) => {
    await openApi(page, '/system/automations');
    const s = settings(page);
    await expect(s.locator('[data-automations-settings]')).toBeVisible();
    await s.locator('[data-step-plus="trash_days"]').click();
    await s.locator('[data-sensitive-chip="red"]').click();
    await s.locator('[data-settings-save]').click();
    await expect(s.locator('[data-settings-saved]')).toBeVisible();
    expect(st.patches).toEqual([{ 'automations.trash_days': 31, 'automations.sensitive_chip': 'red' }]);
    await s.locator('[data-toggle="enabled"]').click();
    await s.locator('[data-settings-save]').click();
    await expect.poll(() => st.patches.length).toBe(2);
    expect(st.patches[1]).toEqual({ 'automations.enabled': 'false' });
    await expect.poll(async () => (await rowTabs(page)).includes('אוטומציות')).toBe(true); // the settings tab stays; the home tab goes
    await page.evaluate(() => { location.hash = '#/devices/building'; });
    await page.waitForTimeout(400);
    expect(await rowTabs(page)).toEqual([]);
  });
});

test.describe('"+ חדש" asks "מתי?" (the setting, off by default)', () => {
  test('on: "בשעות קבועות" opens the schedules editor, "כשמשהו קורה" the builder; off: the button goes straight to the builder', async ({ page }) => {
    await open(page, '/system/automations');
    const s = settings(page);
    await s.locator('[data-toggle="ask_when_on_new"]').click();
    await s.locator('[data-settings-save]').click();
    await expect(s.locator('[data-settings-saved]')).toBeVisible();
    await page.evaluate(() => { location.hash = '#/devices/automations'; });
    await ready(page);
    await scr(page).locator('[data-auto-new]').click();
    await expect(scr(page).locator('[data-dialog="when"]')).toHaveAttribute('open', '');
    await shot(page, '100-new-asks-when', '1440');
    await scr(page).locator('[data-when="event"]').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/automations/new/edit?kind=automation');
    await page.goBack();
    await ready(page);
    await scr(page).locator('[data-auto-new]').click();
    await scr(page).locator('[data-when="time"]').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/schedules/new/edit');
  });
});

// ------------------------------------------------------------------------------------------------ S3 x S4: the editors over the list

test.describe('the editors over the list (S3 x S4 wiring)', () => {
  test('the builder, the script editor and the scene editor open over the list at 1440 / 820 / 390, light and dark, naming no product', async ({ page }) => {
    // ten page loads and ten full-page screenshots; on the mobile project (device scale 2.625) a 1440-wide shot is ~3800 px and takes
    // 5-9 s each, so the default 60 s ran out at a random call (goto / setViewportSize / screenshot). Nothing hangs: a budget, not a bug.
    test.setTimeout(240_000);
    for (const scheme of ['light', 'dark'] as const) {
      for (const size of ['1440', '820', '390'] as const) {
        await open(page, '/devices/automations/1727700000002/edit', size, { scheme });
        const b = scr(page).locator('automation-builder');
        await expect(b.locator('[data-name-input]')).toHaveValue('תנועה בפרוזדור');
        await expect(b.locator('[data-sentence]').first()).toBeVisible();
        expect(await b.innerText()).not.toMatch(BRANDS);
        await shot(page, '110-builder-over-list', size, scheme);
      }
      await open(page, '/devices/automations/scripts/1727700000100/edit', '1440', { scheme });
      await expect(scr(page).locator('script-editor [data-name-input]')).not.toHaveValue('');
      expect(await scr(page).locator('script-editor').innerText()).not.toMatch(BRANDS);
      await shot(page, '111-script-editor-over-list', '1440', scheme);
      await open(page, '/devices/automations/scripts/new/edit', '390', { scheme });
      await expect(scr(page).locator('script-editor [data-name-input]')).toHaveValue('');
      await shot(page, '112-script-editor-new', '390', scheme);
    }
  });

  test('a new automation from a gallery template: saved through the sheet, which closes into the new item\'s drawer; the list has it', async ({ page }) => {
    await open(page, '/devices/automations/new/edit?kind=automation&template=t6');
    const b = scr(page).locator('automation-builder');
    await expect(b.locator('[data-name-input]')).toHaveValue('תאורה בשקיעה');
    await b.locator('[data-name-input]').fill('תאורה בשקיעה · חדשה');
    await b.locator('[data-editor-save]').click();
    const ok = b.locator('[data-confirm-save]');
    if (await ok.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) await ok.click();
    await expect(scr(page).locator('automation-builder')).toHaveCount(0);
    await expect.poll(() => hashOf(page)).toMatch(/\/devices\/automations\/[^/?]+(\?|$)/);
    expect(await hashOf(page)).not.toContain('/edit');
    await expect(scr(page).locator('[data-auto-note]')).toContainText('נשמר');
    await expect(drawer(page)).toContainText('תאורה בשקיעה · חדשה');
    await expect(drawer(page).locator('[data-drawer-detail]')).toContainText('בשקיעה');
    await expect(cards(page)).toHaveCount(13);
    await shot(page, '113-saved-into-drawer', '1440');
  });

  test('a runner\'s deep link to an automation editor shows the forbidden state, never the draft (decision 1b)', async ({ page }) => {
    await open(page, '/devices/automations/1727700000002/edit', '390', { user: 'runner' });
    await expect(scr(page).locator('automation-builder [data-editor-state="forbidden"]')).toBeVisible();
    await expect(scr(page).locator('automation-builder [data-block-main]')).toHaveCount(0);
    await expect(scr(page).locator('automation-builder [data-name-input]')).toHaveValue('');
    await shot(page, '114-runner-editor-link', '390');
  });
});

// ------------------------------------------------------------------------------------------------ the evidence matrix (release 0.1.152)

test.describe('evidence matrix: the three kinds and the settings tab at 1440 / 820 / 390, light and dark', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`automations, scenes, scripts and הגדרות › אוטומציות (${scheme}); no product name`, async ({ page }) => {
      for (const size of ['1440', '820', '390'] as const) {
        await open(page, '/devices/automations', size, { scheme });
        await ready(page);
        await expect(cards(page)).toHaveCount(12);
        expect(await scr(page).innerText()).not.toMatch(BRANDS);
        await shot(page, '120-matrix-automations', size, scheme);
        await open(page, '/devices/automations/scenes', size, { scheme });
        await ready(page);
        await expect(scr(page).locator('[data-scenes-panel]')).toBeVisible();
        expect(await scr(page).innerText()).not.toMatch(BRANDS);
        await shot(page, '121-matrix-scenes', size, scheme);
        await open(page, '/devices/automations/scripts', size, { scheme });
        await ready(page);
        await expect(sp(page).locator('.pcard').first()).toBeVisible();
        expect(await scr(page).innerText()).not.toMatch(BRANDS);
        await shot(page, '122-matrix-scripts', size, scheme);
        if (scheme === 'dark') continue; // the settings area has no dark scheme of its own yet (the design unification, after development ends)
        await open(page, '/system/automations', size);
        await expect(page.locator('sw-app system-automations [data-automations-settings]')).toBeVisible();
        await shot(page, '123-matrix-settings', size);
      }
    });
  }
});