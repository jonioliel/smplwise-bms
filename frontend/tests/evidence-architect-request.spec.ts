import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRequest } from '../src/components/architect-request';

// "בקשה לאדריכל": while an installation has no plan yet, the request to the architect can be read, copied, shared, downloaded and mailed
// from a dialog that opens only on demand. Entry points: the setup wizard's floor step (server problem codes no_plan / no_floor), the
// "לקומה אין תוכנית" panel of the plan editor, the floors list and the plan import screen - and none of them when a plan exists.
// Mock mode: the wizard runs as an API session against page.route answers (GET /me, GET /setup/state), the other screens in the demo
// fixture (floor f-2 has no plan, f0 has one). No backend, no device.
//   SW_BASE_URL=http://127.0.0.1:4851/ npx playwright test tests/evidence-architect-request.spec.ts --project=desktop --project=mobile
// Screenshots: docs/design/evidence/architect-request/. The shell has no dark theme yet (design unification is later): the dark shot
// overrides the colour tokens on :root to show the dialog keeps to them.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'architect-request');
const TEXT = normalizeRequest(fs.readFileSync(path.resolve(HERE, '..', 'src', 'content', 'architect-request.he.txt'), 'utf8'));

const DARK = `:root{--sw-bg:#101319;--sw-surface:#171b23;--sw-surface-2:#1d222c;--sw-surface-3:#262c38;--sw-text:#eceff5;--sw-text-2:#b7bfce;--sw-text-3:#8a93a6;--sw-border:#2a3140;--sw-border-strong:#394256;--sw-accent:#5b8cff;--sw-accent-hover:#7aa0ff;--sw-accent-text:#8fb0ff;--sw-heading:#f4f6fa;--sw-overlay:rgba(0,0,0,.6);--sw-text-inverse:#0b0e14;color-scheme:dark}`;

type Floor = 'no_plan' | 'no_floor' | 'draft' | 'plan';

function wizardState(floor: Floor) {
  const at = '2026-10-01T08:30:00Z';
  const step = (id: string, index: number, title: string, status: string, summary: string, extra: Record<string, unknown> = {}) => ({
    id, index, title, status, summary, facts: [], evidence: {}, problem: null, warnings: [], source: 'local', checked_at: at,
    settings_link: { href: '#/system/setup', label: 'הגדרות › חיבורים' }, ...extra,
  });
  const link = { href: '#/explore/floors/f0/import', label: 'ייבוא תוכנית לקומה' };
  const problems: Record<string, unknown> = {
    no_plan: { code: 'no_plan', message: 'לקומה "קרקע" עדיין אין תוכנית.', action: 'העלו תוכנית (PDF, PNG, JPG או DXF), כווננו סיבוב וחיתוך ופרסמו.', link },
    no_floor: { code: 'no_floor', message: 'למבנה עדיין אין קומות.', action: 'הוסיפו קומה למבנה.', link: { href: '#/explore/buildings/bld-a', label: 'מפה › קומות המבנה' } },
    draft: { code: 'plan_not_published', message: 'לקומה "קרקע" יש תוכנית בטיוטה שעוד לא פורסמה.', action: 'פתחו את הייבוא, בדקו ופרסמו.', link },
  };
  const floorStep = floor === 'plan' ? step('floor', 5, 'קומה ותוכנית', 'done', '2 קומות עם תוכנית מפורסמת') : step('floor', 5, 'קומה ותוכנית', 'todo', String((problems[floor] as { message: string }).message), { problem: problems[floor] });
  const steps = [
    step('install', 1, 'התקנת ה־Add-on', 'done', 'גרסה 0.1.150'), step('nvr', 2, 'חיבור ל־NVR', 'done', '10 ערוצים', { source: 'live' }),
    step('ha', 3, 'Home Assistant והגשר', 'done', 'הגשר פעיל', { source: 'live' }), step('go2rtc', 4, 'go2rtc (וידאו חי)', 'done', '20 זרמים', { source: 'live' }),
    floorStep, step('camera', 6, 'מצלמה על המפה', 'skipped', 'ממתין לשלב קודם'),
  ];
  const done = steps.filter((s) => s.status === 'done').length;
  return { version: '0.1.150', mode: 'full', checked_at: at, steps, done, total: 6, ready: false, next: 'floor', thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600 };
}

async function mockWizard(page: Page, floor: Floor) {
  await page.addInitScript(() => {
    (window as unknown as { __clip: string[] }).__clip = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void (window as unknown as { __clip: string[] }).__clip.push(t) } });
  });
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['system.configure', 'map.read', 'map.edit'];
      return json({ user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    }
    if (p === 'setup/state') return json(wizardState(floor));
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function openWizard(page: Page, floor: Floor) {
  await mockWizard(page, floor);
  await page.goto('/#/system/wizard');
  await page.waitForSelector('sw-app');
  await expect(page.locator('system-wizard [data-wizard]')).toBeVisible({ timeout: 30000 });
}

async function openDemo(page: Page, hash: string, ready: string) {
  await page.goto(`/#${hash}`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30000 });
}

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
const shot = (page: Page, name: string, project: string) => page.screenshot({ path: path.join(OUT, `${name}-${project}.png`) });
const request = (page: Page) => page.locator('system-wizard [data-architect-request], explore-plan-editor [data-architect-request], explore-floors [data-architect-request], explore-plan-import [data-architect-request]');
const dialog = (page: Page) => page.locator('architect-request-dialog');

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

test.describe('wizard: the floor step offers the request only while there is no plan', () => {
  test('no plan: the link sits next to the action; the dialog shows the text; copy, download, mail; light and dark', async ({ page }, info) => {
    const project = info.project.name;
    await openWizard(page, 'no_plan');
    const floor = page.locator('system-wizard [data-step="floor"]');
    await expect(floor.locator('[data-step-problem="no_plan"]')).toBeVisible();
    const link = floor.locator('[data-architect-request]');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText('בקשה לאדריכל ›');
    await expect(floor.locator('[data-step-link]')).toBeVisible();
    // only the floor step has it
    await expect(page.locator('system-wizard [data-architect-request]')).toHaveCount(1);
    await floor.scrollIntoViewIfNeeded();
    await noOverflow(page);
    await shot(page, 'wizard-no-plan', project);
    if (project === 'mobile') expect((await link.boundingBox())!.height, '44px touch target').toBeGreaterThanOrEqual(43.5);

    // nothing of the request on the operator screen until it is asked for
    await expect(dialog(page)).toHaveCount(0);
    await link.click();
    const dlg = dialog(page);
    await expect(dlg.locator('sw-dialog')).toHaveAttribute('open', '');
    await expect(dlg.getByRole('dialog')).toHaveAttribute('aria-label', 'בקשה לאדריכל');
    const pre = dlg.locator('[data-architect-text]');
    await expect(pre).toBeVisible();
    expect(normalizeRequest((await pre.evaluate((e) => e.textContent)) ?? '')).toBe(TEXT);
    expect(await pre.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('pre-wrap');
    expect(await pre.evaluate((e) => e.scrollHeight > e.clientHeight), 'long text scrolls inside the box').toBe(true);
    expect(parseFloat(await pre.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(13);
    await noOverflow(page);
    await shot(page, 'dialog', project);

    // copy: the exact text on the clipboard, the toast says "הועתק"
    await dlg.locator('[data-architect-copy]').click();
    await expect(dlg.locator('[data-architect-notice]')).toHaveText('הועתק');
    expect(await page.evaluate(() => (window as unknown as { __clip: string[] }).__clip)).toEqual([TEXT]);
    await shot(page, 'dialog-copied', project);

    // download: a .txt file with the same text
    const [file] = await Promise.all([page.waitForEvent('download'), dlg.locator('[data-architect-download]').click()]);
    expect(file.suggestedFilename()).toBe('בקשה_לאדריכל.txt');
    const bytes = fs.readFileSync((await file.path())!);
    expect(Array.from(bytes.subarray(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8')).toBe(TEXT);

    // mail: a mailto link with the subject and the short body (the full text is far beyond a mail link)
    const mail = dlg.locator('[data-architect-mail]');
    const href = (await mail.getAttribute('href'))!;
    expect(href.startsWith('mailto:?subject=')).toBe(true);
    expect(href.length).toBeLessThanOrEqual(1800);
    expect(decodeURIComponent(href.split('&body=')[1])).toBe('הבקשה המלאה מצורפת');
    expect(await mail.evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(project === 'mobile' ? 43.5 : 35);

    // share is offered only where the browser has it
    const hasShare = await page.evaluate(() => typeof navigator.share === 'function');
    await expect(dlg.locator('[data-architect-share]')).toHaveCount(hasShare ? 1 : 0);

    // dark tokens
    await page.addStyleTag({ content: DARK });
    await dlg.locator('[data-architect-copy]').click();
    await shot(page, 'dialog-dark', project);

    // Escape closes it; the focus returns to the link
    await page.keyboard.press('Escape');
    await expect(dlg.locator('sw-dialog')).not.toHaveAttribute('open', '');
  });

  test('a clipboard that refuses falls back to the hidden textarea copy', async ({ page }) => {
    await openWizard(page, 'no_plan');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
      (window as unknown as { __exec: number }).__exec = 0;
      document.execCommand = (cmd: string) => ((window as unknown as { __exec: number }).__exec += cmd === 'copy' ? 1 : 0, true);
    });
    await page.locator('system-wizard [data-architect-request]').click();
    await dialog(page).locator('[data-architect-copy]').click();
    await expect(dialog(page).locator('[data-architect-notice]')).toHaveText('הועתק');
    expect(await page.evaluate(() => (window as unknown as { __exec: number }).__exec)).toBe(1);
  });

  test('no floors at all: the link is there as well', async ({ page }) => {
    await openWizard(page, 'no_floor');
    await expect(page.locator('system-wizard [data-step="floor"] [data-architect-request]')).toHaveCount(1);
  });

  test('a plan exists (done, or a draft waiting for publishing): no link', async ({ page }, info) => {
    await openWizard(page, 'plan');
    await expect(page.locator('system-wizard [data-step="floor"]')).toHaveAttribute('data-status', 'done');
    await expect(page.locator('system-wizard [data-architect-request]')).toHaveCount(0);
    await shot(page, 'wizard-with-plan', info.project.name);
    await page.unrouteAll();
    await mockWizard(page, 'draft');
    await page.reload();
    await expect(page.locator('system-wizard [data-step-problem="plan_not_published"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('system-wizard [data-step-link]')).toBeVisible();
    await expect(page.locator('system-wizard [data-architect-request]')).toHaveCount(0);
  });
});

test.describe('plan screens (demo fixture: floor f-2 has no plan, f0 has one)', () => {
  test('floors list: offered beside "העלאת תוכנית" for a floor without a plan, not for one with a plan', async ({ page }, info) => {
    await openDemo(page, '/explore/buildings/bld-a', 'explore-floors .floor');
    await expect(request(page), 'the first floor (f0) has a plan').toHaveCount(0);
    await page.locator('explore-floors button.floor', { hasText: 'קומה 2-' }).click();
    await expect(page.locator('explore-floors [data-architect-request]')).toHaveCount(1);
    await expect(page.locator('explore-floors [data-architect-request]')).toHaveText('בקשה לאדריכל');
    await noOverflow(page);
    await shot(page, 'floors-list', info.project.name);
    await page.locator('explore-floors [data-architect-request]').click();
    await expect(dialog(page).locator('[data-architect-text]')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('plan editor: the empty panel has it; an editor with a plan does not', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the plan editor is a desktop screen (the phone shows a short notice)');
    await openDemo(page, '/explore/floors/f-2/edit', 'explore-plan-editor sw-state-panel');
    await expect(page.locator('explore-plan-editor sw-state-panel')).toContainText('לקומה אין תוכנית');
    await expect(page.locator('explore-plan-editor [data-architect-request]')).toHaveCount(1);
    await shot(page, 'editor-no-plan', info.project.name);
    await page.locator('explore-plan-editor [data-architect-request]').click();
    await expect(dialog(page).locator('[data-architect-text]')).toBeVisible();
    await page.keyboard.press('Escape');
    await openDemo(page, '/explore/floors/f0/edit', 'explore-plan-editor .mapwrap');
    await expect(page.locator('explore-plan-editor [data-architect-request]')).toHaveCount(0);
  });

  test('plan import: a quiet link for a floor without a plan, none for a floor with one', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'plan import is a desktop screen (the phone shows a short notice)');
    await openDemo(page, '/explore/floors/f-2/import', 'explore-plan-import sw-page');
    await expect(page.locator('explore-plan-import [data-architect-request]')).toHaveCount(1);
    await shot(page, 'import-no-plan', info.project.name);
    await openDemo(page, '/explore/floors/f0/import', 'explore-plan-import sw-page');
    await expect(page.locator('explore-plan-import [data-architect-request]')).toHaveCount(0);
  });
});
