import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// CR-019 S3 evidence: הגדרות › חשמל והתקנים › מתגים מוגנים (<devices-protected-switches>) - the suggestions strip (owner decision 2026-10-02: a classifier suggestion is NOT protected), the filters, the
// table and the cards, approve all, protect (Shift range) and remove protection (danger confirmation, focus on Cancel), the
// read-only rows, chunking over 500 ids, and the error / empty / loading states. The app runs in demo mode on the Vite DEV
// server; the two routes of the screen are answered by an in-spec fake server that keeps the same rules as the backend
// (a refusal for alarm / door / multimedia rows, approve only on auto rows) and records every request body.
//   npx vite --host 127.0.0.1 --port 5205   then   SW_BASE_URL=http://127.0.0.1:5205/ npx playwright test evidence-protected-switches --project=desktop --workers=1
// SW_SHOTS=<dir> saves the screenshots there (docs/evidence/CR-019). Runs in every project: row locators take the layout that is visible (table from 600 px, cards below).
const SHOTS = process.env.SW_SHOTS ?? '';
const SIZES = [
  { w: 1440, h: 900 },
  { w: 820, h: 1180 },
  { w: 390, h: 844 },
] as const;

interface Row {
  entity_id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  state: string;
  available: boolean;
  protected: boolean;
  suggested: boolean;
  source: 'manual' | 'auto' | null;
  category: string | null;
  category_label: string | null;
  rule: string | null;
  reviewed: boolean | null;
  included: boolean;
  reason: string;
  reason_label: string | null;
  alarm_managed: boolean;
  doors_layer: boolean;
  media_managed: boolean;
  marked_by: string | null;
  marked_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

const CATEGORIES = [
  { id: 'water_heating', label: 'משאבות ודודים' },
  { id: 'network', label: 'רשת, שרתים ואל־פסק' },
  { id: 'cold', label: 'מקררים ומקפיאים' },
  { id: 'infrastructure', label: 'תשתית המערכת' },
];

function base(id: string, name: string, floor: [string, string] | null, area: [string, string] | null, over: Partial<Row> = {}): Row {
  return {
    entity_id: `switch.${id}`, name, area_id: area?.[0] ?? null, area_name: area?.[1] ?? null, floor_id: floor?.[0] ?? null, floor_name: floor?.[1] ?? null,
    state: 'off', available: true, protected: false, suggested: false, source: null, category: null, category_label: null, rule: null, reviewed: null, included: true, reason: 'allowed',
    reason_label: null, alarm_managed: false, doors_layer: false, media_managed: false, marked_by: null, marked_at: null, reviewed_by: null, reviewed_at: null, ...over,
  };
}
/** A classifier suggestion: listed with its category, not protected, still included in group actions. */
const AUTO = { suggested: true, source: 'auto' as const, reviewed: false, marked_at: '2026-10-02T06:00:00Z' };

function house(): Row[] {
  const G: [string, string] = ['g', 'קרקע'];
  const U: [string, string] = ['u', 'קומה 1'];
  return [
    base('pool_pump', 'משאבת בריכה', G, ['yard', 'חצר'], { ...AUTO, category: 'water_heating', category_label: 'משאבות ודודים', rule: 'name:משאבה' }),
    base('solar_boiler', 'דוד שמש', G, ['roof', 'גג'], { ...AUTO, category: 'water_heating', category_label: 'משאבות ודודים', rule: 'name:דוד' }),
    base('rack_router', 'ראוטר ארון תקשורת', G, ['tech', 'חדר תקשורת'], { ...AUTO, category: 'network', category_label: 'רשת, שרתים ואל־פסק', rule: 'name:router' }),
    base('addon_ssh', 'מתג תוסף SSH', null, null, { ...AUTO, category: 'infrastructure', category_label: 'תשתית המערכת', rule: 'platform:hassio' }),
    base('fridge', 'מקרר מטבחון', U, ['kit', 'מטבחון'], { protected: true, source: 'manual', category: null, reviewed: true, included: false, reason: 'protected', marked_by: 'מנהל', marked_at: '2026-10-01T10:00:00Z', reviewed_by: 'מנהל', reviewed_at: '2026-10-01T10:00:00Z' }),
    base('lobby_sign', 'שלט לובי', G, ['lobby', 'לובי'], { state: 'on' }),
    base('hall_lights', 'תאורת מסדרון', U, ['hall', 'מסדרון']),
    base('office_fan', 'מאוורר משרד', U, ['office', 'משרד'], { state: 'on' }),
    base('garden_lights', 'תאורת גינה', G, ['yard', 'חצר']),
    base('stairs_lights', 'תאורת מדרגות', G, ['stairs', 'חדר מדרגות']),
    base('zone9_bypass', 'עקיפת חיישן אזור 9', U, ['hall', 'מסדרון'], { alarm_managed: true, included: false, reason: 'alarm_managed' }),
    base('gate_relay', 'ממסר שער חניה', G, ['gate', 'כניסה'], { doors_layer: true, included: false, reason: 'doors_layer' }),
    base('lobby_screen', 'מסך לובי', G, ['lobby', 'לובי'], { media_managed: true, included: false, reason: 'media_managed' }),
  ];
}

interface Fake {
  rows: Row[];
  posts: { entity_ids: string[]; action: string }[];
  mode: 'ok' | 'forbidden' | 'slow';
}

/** The two routes of the screen, with the backend's rules. */
async function serve(page: Page, fake: Fake) {
  await page.route('**/api/v1/devices/bulk-protected', async (route: Route) => {
    const req = route.request();
    if (fake.mode === 'forbidden') {
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', user_message: 'אין הרשאה לפעולה זו.', retryable: false, correlation_id: 'x', details: {} }) });
    }
    if (req.method() === 'GET') {
      if (fake.mode === 'slow') await new Promise((r) => setTimeout(r, 1500));
      const rows = fake.rows;
      const summary = {
        switches: rows.length, protected: rows.filter((r) => r.protected).length, suggested: rows.filter((r) => r.suggested).length,
        unprotected: rows.filter((r) => !r.protected).length, gone_protected: 0,
      };
      return route.fulfill({ json: { switches: rows, summary, categories: CATEGORIES, note: '' } });
    }
    const body = JSON.parse(req.postData() ?? '{}') as { entity_ids: string[]; action: 'protect' | 'unprotect' | 'approve' };
    fake.posts.push(body);
    const results = body.entity_ids.map((id) => {
      const r = fake.rows.find((x) => x.entity_id === id);
      if (!r) return { entity_id: id, ok: false, reason: 'not_switch', changed: false };
      if (body.action !== 'approve' && (r.alarm_managed || r.doors_layer || r.media_managed)) return { entity_id: id, ok: false, reason: 'refused', changed: false };
      let changed = false;
      if ((body.action === 'approve' && r.suggested) || (body.action === 'protect' && r.suggested)) {
        Object.assign(r, { protected: true, suggested: false, reviewed: true, included: false, reason: 'protected', reviewed_by: 'מנהל', reviewed_at: '2026-10-02T09:00:00Z' });
        changed = true;
      } else if (body.action === 'protect' && !r.protected) {
        Object.assign(r, { protected: true, suggested: false, source: 'manual', reviewed: true, included: false, reason: 'protected', marked_by: 'מנהל', marked_at: '2026-10-02T09:00:00Z' });
        changed = true;
      } else if (body.action === 'unprotect' && (r.protected || r.suggested)) {
        Object.assign(r, { protected: false, suggested: false, source: null, category: null, category_label: null, rule: null, reviewed: null, included: true, reason: 'allowed' });
        changed = true;
      }
      return { entity_id: id, ok: true, reason: null, changed };
    });
    return route.fulfill({ json: { results, changed: results.filter((x) => x.changed).length, refused: results.filter((x) => !x.ok).length } });
  });
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

async function shots(page: Page, name: string, widths: readonly number[] = [1440, 820, 390]) {
  for (const s of SIZES) {
    if (!widths.includes(s.w)) continue;
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(350);
    await shot(page, `${name}-${s.w}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function open(page: Page, fake: Fake, scheme: 'light' | 'dark' = 'light') {
  await serve(page, fake);
  await mount(page, scheme);
}

async function mount(page: Page, scheme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto('./');
  await page.waitForFunction(() => !!customElements.get('devices-protected-switches'));
  await page.evaluate((dark) => {
    document.querySelectorAll('#ps-stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'ps-stage';
    st.style.cssText = `position:fixed;inset:0;z-index:50;overflow:auto;padding:16px;background:${dark ? '#0f1115' : 'var(--sw-bg, #f5f6f8)'};direction:rtl`;
    st.innerHTML = '<devices-protected-switches></devices-protected-switches>';
    document.body.appendChild(st);
  }, scheme === 'dark');
}

const el = (page: Page) => page.locator('devices-protected-switches');
// Under 600 px the screen shows cards (label.card[data-entity]) and hides the table, so every locator takes the VISIBLE layout.
const rowOf = (page: Page, id: string) => el(page).locator(`[data-entity="switch.${id}"]:visible`);
const boxOf = (page: Page, id: string) => el(page).locator(`[data-entity="switch.${id}"]:visible input[data-protected-row]`);
const listed = (page: Page) => el(page).locator('[data-entity]:visible');

test.describe('מתגים מוגנים (CR-019 S3)', () => {
  test('the suggestions strip, the counts line and the rows of every kind', async ({ page }) => {
    const fake: Fake = { rows: house(), posts: [], mode: 'ok' };
    await open(page, fake);
    await expect(el(page).locator('[data-protected-strip]')).toContainText('4 מתגים מוצעים להגנה לפי השם או הסוג שלהם. הם נכללים ב\'כבה הכל\' עד שתאשרו');
    await expect(el(page).locator('[data-protected-counts]')).toHaveText('13 מתוך 13 מתגים · 1 מוגנים · 4 מוצעים להגנה');
    await expect(rowOf(page, 'pool_pump').locator('[data-status]')).toHaveAttribute('data-status', 'suggested');
    await expect(rowOf(page, 'fridge').locator('[data-status]')).toHaveAttribute('data-status', 'protected');
    await expect(rowOf(page, 'lobby_sign').locator('[data-status]')).toHaveAttribute('data-status', 'unprotected');
    await expect(rowOf(page, 'zone9_bypass')).toContainText('נשלט ממסך האזעקה');
    await expect(rowOf(page, 'gate_relay')).toContainText('בשכבת הדלתות');
    await expect(rowOf(page, 'lobby_screen')).toContainText('נשלט ממסך המולטימדיה');
    for (const id of ['zone9_bypass', 'gate_relay', 'lobby_screen']) await expect(boxOf(page, id)).toBeDisabled();
    await expect(rowOf(page, 'pool_pump')).toContainText('מוצע להגנה');
    await expect(rowOf(page, 'addon_ssh')).toContainText('תשתית המערכת'); // no product names
    await expect(el(page)).not.toContainText(/Home Assistant|Ingress|\bHA\b/);
    await shots(page, 'ps-01-review-light');
    await expect(boxOf(page, 'lobby_sign')).toBeEnabled();
  });

  test('dark colour scheme (1440)', async ({ page }) => {
    await open(page, { rows: house(), posts: [], mode: 'ok' }, 'dark');
    await expect(el(page).locator('[data-protected-strip]')).toBeVisible();
    await shots(page, 'ps-02-review-dark', [1440]);
  });

  test('"הצג" applies the suggestions filter; filters combine and reset', async ({ page }) => {
    await open(page, { rows: house(), posts: [], mode: 'ok' });
    await el(page).locator('[data-protected-show]').click();
    await expect(listed(page)).toHaveCount(4);
    await expect(el(page).locator('[data-protected-counts]')).toContainText('4 מתוך 13 מתגים');
    await el(page).locator('select[data-protected-category]').selectOption('network');
    await expect(listed(page)).toHaveCount(1);
    await el(page).locator('[data-protected-reset]').click();
    await expect(listed(page)).toHaveCount(13);
    await el(page).locator('input[data-protected-search]').fill('חצר');
    await expect(listed(page)).toHaveCount(2);
    await el(page).locator('input[data-protected-search]').fill('אין כזה מתג');
    await expect(el(page).locator('[data-protected-empty]')).toBeVisible();
    await shots(page, 'ps-03-empty-filter-light', [1440]);
  });

  test('"הגן על כולם" asks once, protects the suggested rows and the strip goes away', async ({ page }) => {
    const fake: Fake = { rows: house(), posts: [], mode: 'ok' };
    await open(page, fake);
    await el(page).locator('[data-protected-approve-all]').click();
    const dlg = el(page).locator('sw-dialog[data-protected-dialog="approve"]');
    await expect(dlg.locator('[data-protected-question]')).toHaveText("להגן על 4 מתגים? הם לא ייכללו ב'כבה הכל' ובפעולות קבוצתיות.");
    await shots(page, 'ps-04-approve-all-dialog-light', [1440, 390]);
    await dlg.locator('sw-button[data-protected-confirm]').click();
    await expect(el(page).locator('[data-protected-result]')).toHaveText('הוגנו 4 מתגים');
    await expect(el(page).locator('[data-protected-strip]')).toHaveCount(0);
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0].action).toBe('approve');
    expect(fake.posts[0].entity_ids.sort()).toEqual(['switch.addon_ssh', 'switch.pool_pump', 'switch.rack_router', 'switch.solar_boiler']);
    await expect(rowOf(page, 'pool_pump').locator('[data-status]')).toHaveAttribute('data-status', 'protected');
    await expect(el(page).locator('[data-protected-counts]')).toHaveText('13 מתוך 13 מתגים · 5 מוגנים');
    await shots(page, 'ps-05-after-approve-light');
  });

  test('remove protection: danger confirmation names the consequence, focus is on Cancel, Cancel sends nothing', async ({ page }) => {
    const fake: Fake = { rows: house(), posts: [], mode: 'ok' };
    await open(page, fake);
    await boxOf(page, 'fridge').click();
    await expect(el(page).locator('[data-protected-selected]')).toHaveText(/נבחרו\D*1\D*מתוך\D*13/);
    await el(page).locator('sw-button[data-protected-do-unprotect]').click();
    const dlg = el(page).locator('sw-dialog[data-protected-dialog="unprotect"]');
    await expect(dlg.locator('[data-protected-question]')).toHaveText("1 מתגים ייכללו ב'כבה הכל' ובפעולות קבוצתיות. להמשיך?");
    await expect(dlg.locator('sw-button[data-protected-confirm]')).toHaveAttribute('variant', 'danger');
    await expect(dlg.locator('sw-button[data-protected-cancel]')).toHaveAttribute('autofocus', '');
    await shots(page, 'ps-06-unprotect-dialog-light', [1440, 820, 390]);
    await dlg.locator('sw-button[data-protected-cancel]').click();
    await expect(dlg).toHaveCount(0);
    expect(fake.posts).toHaveLength(0);
    await el(page).locator('sw-button[data-protected-do-unprotect]').click();
    await el(page).locator('sw-button[data-protected-confirm]').click();
    await expect(el(page).locator('[data-protected-result]')).toHaveText('הוסרה ההגנה מ־1 מתגים');
    expect(fake.posts).toEqual([{ entity_ids: ['switch.fridge'], action: 'unprotect' }]);
    await expect(rowOf(page, 'fridge').locator('[data-status]')).toHaveAttribute('data-status', 'unprotected');
    await expect(el(page).locator('[data-protected-selected]')).toHaveText(/נבחרו\D*0\D/);
  });

  test('"דחה הצעה" rejects a suggestion: the switch stays included and the suggestion goes away', async ({ page }) => {
    const fake: Fake = { rows: house(), posts: [], mode: 'ok' };
    await open(page, fake);
    await boxOf(page, 'pool_pump').click();
    await expect(el(page).locator('sw-button[data-protected-do-unprotect]')).toHaveAttribute('disabled', ''); // nothing protected in the selection
    await el(page).locator('sw-button[data-protected-do-dismiss]').click();
    const dlg = el(page).locator('sw-dialog[data-protected-dialog="dismiss"]');
    await expect(dlg.locator('[data-protected-question]')).toContainText('ימשיכו להיכלל');
    await shots(page, 'ps-06b-dismiss-dialog-light', [1440]);
    await dlg.locator('sw-button[data-protected-confirm]').click();
    await expect(el(page).locator('[data-protected-result]')).toHaveText('נדחתה ההצעה ל־1 מתגים');
    expect(fake.posts).toEqual([{ entity_ids: ['switch.pool_pump'], action: 'unprotect' }]);
    await expect(rowOf(page, 'pool_pump').locator('[data-status]')).toHaveAttribute('data-status', 'unprotected');
  });

  test('protect more: Shift+click selects a range of selectable rows only; the action sends only what it can change', async ({ page }) => {
    const fake: Fake = { rows: house(), posts: [], mode: 'ok' };
    await open(page, fake);
    const sortByArea = el(page).locator('th button[data-protected-sort="area"]');
    if (await sortByArea.isVisible()) await sortByArea.click(); // the table header exists on wide screens only
    const ids = await listed(page).evaluateAll((trs) => trs.map((t) => (t as HTMLElement).dataset.entity!));
    const a = ids.indexOf('switch.garden_lights');
    const b = ids.indexOf('switch.lobby_sign');
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    await boxOf(page, ids[Math.min(a, b)].replace('switch.', '')).click();
    await boxOf(page, ids[Math.max(a, b)].replace('switch.', '')).click({ modifiers: ['Shift'] });
    const picked = await el(page).locator('input[data-protected-row]:checked:visible').count();
    expect(picked).toBeGreaterThanOrEqual(2);
    await el(page).locator('sw-button[data-protected-do-protect]').click();
    await shots(page, 'ps-07-protect-dialog-light', [1440]);
    await el(page).locator('sw-button[data-protected-confirm]').click();
    await expect(el(page).locator('[data-protected-result]')).toContainText('הוגנו');
    expect(fake.posts[0].action).toBe('protect');
    expect(fake.posts[0].entity_ids.every((id) => !['switch.zone9_bypass', 'switch.gate_relay', 'switch.lobby_screen'].includes(id))).toBe(true);
    await expect(rowOf(page, 'lobby_sign').locator('[data-status]')).toHaveAttribute('data-status', 'protected');
    await expect(rowOf(page, 'lobby_sign')).toContainText('ידני');
  });

  test('"בחר הכול" never selects a read-only row, and unprotect / dismiss are disabled when the selection has nothing for them', async ({ page }) => {
    await open(page, { rows: house(), posts: [], mode: 'ok' });
    await el(page).locator('sw-button[data-protected-all]').click();
    await expect(el(page).locator('[data-protected-selected]')).toHaveText(/נבחרו\D*10\D*מתוך\D*13/);
    for (const id of ['zone9_bypass', 'gate_relay', 'lobby_screen']) await expect(boxOf(page, id)).not.toBeChecked();
    await el(page).locator('sw-button[data-protected-clear]').click();
    await boxOf(page, 'lobby_sign').click();
    await expect(el(page).locator('sw-button[data-protected-do-dismiss]')).toHaveAttribute('disabled', '');
    await expect(el(page).locator('sw-button[data-protected-do-unprotect]')).toHaveAttribute('disabled', '');
  });

  test('over 500 suggested rows: 100 at a time, and approve-all goes in chunks of 500', async ({ page }) => {
    const rows: Row[] = Array.from({ length: 1103 }, (_, i) => base(`auto_${i}`, `משאבה ${i}`, ['g', 'קרקע'], ['a', 'אזור'], { ...AUTO, category: 'water_heating', category_label: 'משאבות ודודים', rule: 'name:משאבה' }));
    const fake: Fake = { rows, posts: [], mode: 'ok' };
    await open(page, fake);
    await expect(listed(page)).toHaveCount(100);
    await expect(el(page).locator('[data-protected-more]')).toContainText('הצג עוד');
    await expect(el(page).locator('[data-protected-counts]')).toHaveText('1103 מתוך 1103 מתגים · 0 מוגנים · 1103 מוצעים להגנה');
    await el(page).locator('[data-protected-approve-all]').click();
    await el(page).locator('sw-button[data-protected-confirm]').click();
    await expect(el(page).locator('[data-protected-result]')).toHaveText('הוגנו 1103 מתגים');
    expect(fake.posts.map((p) => p.entity_ids.length)).toEqual([500, 500, 103]);
  });

  test('states: loading, no permission (403), empty installation', async ({ page }) => {
    const fake: Fake = { rows: house(), posts: [], mode: 'slow' };
    await serve(page, fake);
    await mount(page);
    await expect(el(page).locator('sw-state-panel[state="loading"]')).toBeVisible();
    await shots(page, 'ps-08-loading-light', [1440]);
    await expect(el(page).locator('[data-protected-strip]')).toBeVisible({ timeout: 10000 });
    fake.mode = 'forbidden';
    await mount(page);
    await expect(el(page).locator('sw-state-panel[state="error"]')).toBeVisible();
    await expect(el(page)).toContainText('אין הרשאה לפעולה זו.');
    await shots(page, 'ps-09-forbidden-light', [1440, 390]);
    fake.mode = 'ok';
    fake.rows = [];
    await mount(page);
    await expect(el(page).locator('[data-protected-empty]')).toContainText('אין מתגים');
    await shots(page, 'ps-10-no-switches-light', [1440]);
  });

  test('a failing write is reported and the list reloads (nothing is shown as changed)', async ({ page }) => {
    const fake: Fake = { rows: house(), posts: [], mode: 'ok' };
    await open(page, fake);
    await page.route('**/api/v1/devices/bulk-protected', async (route) => {
      if (route.request().method() === 'POST') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', user_message: 'אין הרשאה לפעולה זו.', retryable: false, correlation_id: 'x', details: {} }) });
      return route.fallback();
    });
    await boxOf(page, 'fridge').click();
    await el(page).locator('sw-button[data-protected-do-unprotect]').click();
    await el(page).locator('sw-button[data-protected-confirm]').click();
    await expect(el(page).locator('[data-protected-result]')).toHaveText('אין הרשאה לפעולה זו.');
    await expect(rowOf(page, 'fridge').locator('[data-status]')).toHaveAttribute('data-status', 'protected');
  });
});
