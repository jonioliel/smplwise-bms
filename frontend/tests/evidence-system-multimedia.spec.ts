import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN, EDITOR, OUT, expandAll, fresh, install, open, type St } from './media-players-harness';

// CR-016 S2: the new sections of הגדרות › מולטימדיה - נגנים ורמקולים (kind, approval, room, linked amplifier, volume ceiling WITHOUT a
// default, night window), איחוד כפילויות (the merge wizard fed by the suggestions, the folded non-physical entries), קבוצות שמורות
// (CRUD), מועדפים ותחנות (order, hide, the lists on / off), חיבור (with / without a music library) and הרשאות - in demo / mock mode: a
// MOCKED backend (tests/media-players-harness.ts) answered by the S0 client's MOCK stores, BOTH houses. Settings keep the exact technical
// names (docs/design/UI_COPY_RULES.md); there is no announcement anywhere. Screenshots: docs/design/evidence/CR-016/s2/ (1440 and 390).
//   SW_BASE_URL=http://127.0.0.1:4491/ npx playwright test tests/evidence-system-multimedia.spec.ts --project=desktop --workers=1

const callsTo = (st: St, re: RegExp) => st.calls.filter((c) => re.test(c.path));
const sys = (page: Page) => page.locator('sw-app system-multimedia');
const row = (page: Page, key: string) => sys(page).locator(`[data-mm-admin-device="${key}"]`);

async function tall(page: Page, name: string, width: number, height: number) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) });
}

test.describe('settings › מולטימדיה: the players sections (mocked backend)', () => {
  let st: St;
  test.beforeEach(async ({ page }) => {
    st = fresh(ADMIN);
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sw.nav.order');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('the sections in order; the players with their counts; screenshots', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expect(sys(page).locator('[data-mm-players]')).toBeVisible();
    expect(await sys(page).locator('sw-card[heading]').evaluateAll((els) => els.map((e) => e.getAttribute('heading')))).toEqual([
      'כללי', 'מסכים', 'שלט', 'נגנים ורמקולים', 'איחוד כפילויות', 'קבוצות שמורות', 'מועדפים ותחנות', 'חיבור', 'הרשאות',
    ]);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('מולטימדיה');
    // the screens card lists screens only; the speakers, players and receivers have their own card
    await expect(sys(page).locator('[data-mm-devices] [data-mm-admin-device]')).toHaveCount(6);
    await expect(sys(page).locator('[data-mm-players] [data-mm-admin-device]')).toHaveCount(19);
    await expect(sys(page).locator('[data-mm-players-count]')).toHaveText('17 מאושרים · 2 ממתינים · 6 ללא חדר · 2 לא זמינים');
    await row(page, 'mp-new1').locator('[data-mm-edit]').click();
    await expect(row(page, 'mp-new1')).toContainText('חלש');
    await tall(page, 'settings-ma', 1440, 4600);
    await tall(page, 'settings-ma', 390, 7600);
    // no announcements anywhere, no brand outside the settings' technical names
    expect(await sys(page).innerText()).not.toContain('הכרזות');
  });

  test('"אשר את כל הנגנים שזוהו": one action for every device still waiting', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const btn = sys(page).locator('[data-mm-approve-players]');
    await expect(btn).toContainText('(2)');
    await expect(sys(page).locator('[data-mm-approve-all]')).toContainText('(1)'); // the screens' own button is a different one
    await btn.click();
    await expect.poll(() => callsTo(st, /admin\/approve/).map((c) => c.body)).toContainEqual({ approved: true, kinds: ['speaker', 'player', 'receiver', 'group'] });
    await expect(btn).toHaveAttribute('disabled', '');
    await expect(sys(page).locator('[data-mm-players-count]')).toContainText('19 מאושרים');
    // one device's approval is one write of one field
    await row(page, 'mp-bath').locator('sw-toggle[data-mm-approved]').click();
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-bath/).map((c) => c.body)).toContainEqual({ approved: false });
  });

  test('the volume ceiling is EMPTY unless an administrator sets it - there is no default; invalid input is refused', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const field = (k: string) => row(page, k).locator(`[data-mm-volmax="${k}"]`);
    for (const k of ['mp-kit', 'mp-per', 'mp-ampl', 'mp-new1']) {
      await expect(field(k)).toHaveValue('');
      await expect(field(k)).toHaveAttribute('placeholder', 'ללא');
    }
    await expect(field('mp-liv')).toHaveValue('70');
    await expect(field('mp-kids')).toHaveValue('50');
    await field('mp-kit').fill('55');
    await field('mp-kit').press('Enter');
    await row(page, 'mp-kit').locator('[data-mm-name]').focus();
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-kit/).map((c) => c.body)).toContainEqual({ volume_max: 55 });
    await field('mp-liv').fill('');
    await row(page, 'mp-kit').locator('[data-mm-name]').focus();
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-liv/).map((c) => c.body)).toContainEqual({ volume_max: null });
    const n = callsTo(st, /admin\/devices\/mp-per/).length;
    await field('mp-per').fill('150');
    await row(page, 'mp-kit').locator('[data-mm-name]').focus();
    expect(callsTo(st, /admin\/devices\/mp-per/).length).toBe(n); // nothing sent for 150
  });

  test('the night window: a second ceiling inside a time window, set per speaker', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    await expect(row(page, 'mp-par').locator('[data-mm-night-from]')).toHaveValue('22:00');
    await expect(row(page, 'mp-par').locator('[data-mm-night-to]')).toHaveValue('07:00');
    await expect(row(page, 'mp-par').locator('[data-mm-night-max]')).toHaveValue('25');
    await expect(row(page, 'mp-kit').locator('[data-mm-night-from]')).toHaveCount(0); // off: no fields, nothing applies
    await row(page, 'mp-kit').locator('sw-toggle[data-mm-night]').click();
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-kit/).map((c) => c.body)).toContainEqual({ volume_night: { from: '22:00', to: '07:00', max: 20 } });
    await row(page, 'mp-kit').locator('[data-mm-night-from]').fill('23:30');
    await row(page, 'mp-kit').locator('[data-mm-night-from]').blur();
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-kit/).map((c) => c.body)).toContainEqual({ volume_night: { from: '23:30', to: '07:00', max: 20 } });
    await row(page, 'mp-par').locator('[data-mm-night-max]').fill('15');
    await row(page, 'mp-par').locator('[data-mm-night-max]').blur();
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-par/).map((c) => c.body)).toContainEqual({ volume_night: { from: '22:00', to: '07:00', max: 15 } });
    await row(page, 'mp-par').locator('sw-toggle[data-mm-night]').click();
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-par/).map((c) => c.body)).toContainEqual({ volume_night: null });
    await row(page, 'mp-kit').scrollIntoViewIfNeeded();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await row(page, 'mp-kit').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'settings-night-window-1440.png') });
  });

  test('a device without a room is placed from the settings (an administrator action); a placed one shows its place', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    await expect(row(page, 'mp-liv').locator('[data-mm-place="mp-liv"]')).toHaveText('קומת קרקע › סלון');
    await expect(row(page, 'mp-liv').locator('[data-mm-area]')).toHaveCount(0);
    await expect(row(page, 'mp-balc').locator('[data-mm-area]')).toHaveCount(1);
    await row(page, 'mp-balc').locator('[data-mm-area]').selectOption('balcony');
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-balc/).map((c) => c.body)).toContainEqual({ area_id: 'balcony' });
    await expect(row(page, 'mp-balc').locator('[data-mm-place]')).toHaveText('מרפסת');
    await expect(sys(page).locator('[data-mm-players-count]')).toContainText('5 ללא חדר');
  });

  test('kinds, a receiver with zones, the linked amplifier, the connections of a device', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    await expect(row(page, 'mp-ampl').locator('[data-mm-kind]')).toHaveValue('receiver');
    await expect(row(page, 'mp-ampl')).toContainText('ראשי · אזור 2');
    await expect(row(page, 'mp-ampl').locator('[data-mm-link]')).toHaveCount(0); // a receiver has no amplifier of its own
    await row(page, 'mp-kit').locator('[data-mm-link]').selectOption('mp-ampl');
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-kit/).map((c) => c.body)).toContainEqual({ audio_link_key: 'mp-ampl' });
    await row(page, 'mp-kit').locator('[data-mm-kind]').selectOption('player');
    await expect.poll(() => callsTo(st, /admin\/devices\/mp-kit/).map((c) => c.body)).toContainEqual({ kind: 'player' });
    await row(page, 'mp-per').locator('[data-mm-toggle-endpoints]').click();
    const eps = row(page, 'mp-per').locator('[data-mm-endpoint]');
    await expect(eps).toHaveCount(2);
    await expect(eps.first()).toContainText('שכבת המוזיקה');
    await expect(row(page, 'mp-per').locator('sw-badge[label="מוסתר"]')).toHaveCount(1); // the Cast twin
    await shot(page, 'settings-connections');
  });

  test('the merge wizard: one row per pair with its reason; "אחד" or "התעלם"; the counter follows', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const w = sys(page).locator('[data-mm-wizard]');
    await expect(w.locator('[data-mm-wizard-count]')).toHaveText('3 הצעות');
    await expect(w.locator('[data-mm-wizard-row]')).toHaveCount(3);
    await expect(w.locator('[data-mm-wizard-row]').first()).toContainText('דגם זהה');
    await expect(w.locator('[data-mm-wizard-row]').last()).toContainText('שם זהה · חדר באחד הצדדים');
    await expect(w.locator('[data-mm-nonphysical]')).toHaveCount(0); // this house has none
    await w.locator('[data-mm-wizard-accept="s1"]').click();
    await expect.poll(() => callsTo(st, /admin\/links/).map((c) => c.body)).toContainEqual({ op: 'link', endpoint_id: 'ha:media_player.cast_pergola', device_key: 'mp-per' });
    await w.locator('[data-mm-wizard-ignore="s2"]').click();
    await expect.poll(() => callsTo(st, /admin\/links/).map((c) => c.body)).toContainEqual({ op: 'ignore', endpoint_id: 'ha:media_player.cast_kids', device_key: 'mp-kids' });
    await expect(w.locator('[data-mm-wizard-row]')).toHaveCount(1);
    await expect(w.locator('[data-mm-wizard-count]')).toHaveText('1 הצעות');
    await w.locator('[data-mm-wizard-accept="s3"]').click();
    await expect(w.locator('[data-mm-wizard-count]')).toHaveText('אין הצעות פתוחות');
  });

  test('the folded non-physical entries (the house without a music library): counted, never devices, listed on a press', async ({ page }) => {
    st = fresh(ADMIN, 'sonos');
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const w = sys(page).locator('[data-mm-wizard]');
    await expect(w.locator('[data-mm-nonphysical]')).toContainText('11 רשומות');
    await expect(w.locator('[data-mm-np-row]')).toHaveCount(0);
    await w.locator('[data-mm-np-toggle]').click();
    await expect(w.locator('[data-mm-np-row]')).toHaveCount(11);
    await expect(w.locator('[data-mm-np-row]', { hasText: 'Jellyfin' })).toHaveCount(8);
    await expect(w.locator('sw-badge[label="קבוצה וירטואלית"]')).toHaveCount(2);
    await expect(w.locator('sw-badge[label="שירות"]')).toHaveCount(1);
    // the sessions are not devices: they never get a card of their own in the players section
    await expect(sys(page).locator('[data-mm-players] [data-mm-admin-device]')).toHaveCount(8); // six Sonos + the two new ones
    await w.scrollIntoViewIfNeeded();
    await shot(page, 'settings-non-physical');
  });

  test('saved groups: list, new, edit, delete', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const c = sys(page).locator('[data-mm-presets]');
    await expect(c.locator('[data-mm-preset]')).toHaveCount(4);
    await expect(c.locator('[data-mm-preset]', { hasText: 'מסיבה' })).toContainText('2 קומות · דורש אישור בהפעלה');
    await c.locator('[data-mm-preset-new]').click();
    const ed = sys(page).locator('media-preset-editor');
    await ed.locator('[data-pe-name]').fill('ערב חג');
    await ed.locator('[data-pe-row="mp-liv"] input[type="checkbox"]').check();
    await ed.locator('[data-pe-row="mp-hal"] input[type="checkbox"]').check();
    await ed.locator('[data-pe-save]').click();
    await expect.poll(() => callsTo(st, /groups\/presets$/).filter((x) => x.method === 'POST').map((x) => x.body)).toContainEqual(
      expect.objectContaining({ name: 'ערב חג', leader_key: 'mp-liv', member_keys: ['mp-hal'], volumes: null }));
    await expect(c.locator('[data-mm-preset]')).toHaveCount(5);
    await c.locator('[data-mm-preset]', { hasText: 'ערב חג' }).locator('[data-mm-preset-edit]').click();
    await ed.locator('[data-pe-name]').fill('ערב חג שמח');
    await ed.locator('[data-pe-save]').click();
    await expect(c.locator('[data-mm-preset]', { hasText: 'ערב חג שמח' })).toHaveCount(1);
    await c.locator('[data-mm-preset]', { hasText: 'ערב חג שמח' }).locator('[data-mm-preset-delete]').click();
    await sys(page).locator('[data-mm-pd-yes]').click();
    await expect(c.locator('[data-mm-preset]')).toHaveCount(4);
  });

  test('favourites and radio: which lists appear, and per item the order and the show / hide - one list for everyone', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const f = sys(page).locator('[data-mm-favs]');
    await expect(f.locator('[data-mm-fav-kind]')).toHaveCount(3);
    await expect(f.locator('[data-mm-fav-group="favourites"] [data-mm-fav]')).toHaveCount(6);
    const first = await f.locator('[data-mm-fav-group="favourites"] [data-mm-fav]').first().getAttribute('data-mm-fav');
    const second = await f.locator('[data-mm-fav-group="favourites"] [data-mm-fav]').nth(1).getAttribute('data-mm-fav');
    // hide the first
    await f.locator(`[data-mm-fav-show="${first}"]`).click();
    await expect.poll(() => callsTo(st, /multimedia\/favourites/).filter((c) => c.method === 'PUT').length).toBe(1);
    const put1 = callsTo(st, /multimedia\/favourites/).find((c) => c.method === 'PUT')!.body as { kinds_on: string[]; items: { item_ref: string; hidden: boolean; order: number }[]; base_revision: number };
    expect(put1.base_revision).toBe(1);
    expect(put1.items.find((i) => i.item_ref === first)).toMatchObject({ hidden: true });
    await expect(f.locator(`[data-mm-fav="${first}"].off`)).toHaveCount(1);
    // move the second one up
    await f.locator(`[data-mm-fav-up="${second}"]`).click();
    await expect.poll(() => callsTo(st, /multimedia\/favourites/).filter((c) => c.method === 'PUT').length).toBe(2);
    const put2 = callsTo(st, /multimedia\/favourites/).filter((c) => c.method === 'PUT')[1].body as { items: { item_ref: string; order: number }[] };
    expect(put2.items.find((i) => i.item_ref === second)!.order).toBeLessThan(put2.items.find((i) => i.item_ref === first)!.order);
    // a list off
    await f.locator('sw-toggle[data-mm-fav-kind="playlists"]').click();
    await expect.poll(() => (callsTo(st, /multimedia\/favourites/).filter((c) => c.method === 'PUT').at(-1)!.body as { kinds_on: string[] }).kinds_on).toEqual(['favourites', 'stations']);
    await f.scrollIntoViewIfNeeded();
    await shot(page, 'settings-favourites');
  });

  test('favourites without Music Assistant: the speakers\' own list, no playlists', async ({ page }) => {
    st = fresh(ADMIN, 'sonos');
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const f = sys(page).locator('[data-mm-favs]');
    await expect(f.locator('[data-mm-fav-kind]')).toHaveCount(2);
    await expect(f.locator('[data-mm-fav-kind="playlists"]')).toHaveCount(0);
    await expect(f).toContainText('Sonos');
    await expect(f.locator('[data-mm-fav-group="playlists"]')).toHaveCount(0);
  });

  test('connection: with a music library (MA), without one (Sonos), and with the library unavailable', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const c = sys(page).locator('[data-mm-connection]');
    await expect(c).toContainText('Music Assistant דרך Home Assistant');
    await expect(c.locator('sw-badge[label="מחובר"]')).toHaveCount(1);
    await expect(c).toContainText('music_assistant על');
    await expect(c).toContainText('חיבור ישיר ל־Music Assistant');
    await expect(c.locator('media-ma-connection [data-mc-state]')).toHaveAttribute('data-mc-state', 'off'); // phase 2b: configurable, off until an installer sets it
    await expect(c).toContainText('מוכן לנגנים');
    st.library = 'unavailable';
    await open(page, '/system/multimedia');
    await expect(sys(page).locator('[data-mm-connection] sw-badge[label="ספרייה לא זמינה"]')).toHaveCount(1);
    st = fresh(ADMIN, 'sonos');
    await install(page, st);
    await open(page, '/system/multimedia');
    const s = sys(page).locator('[data-mm-connection]');
    await expect(s.locator('[data-mm-conn-text]').first()).toContainText('לא מותקן במערכת זו');
    await expect(s.locator('[data-mm-conn-text]').first()).toContainText('sonos');
    await expect(s).not.toContainText('חיבור ישיר'); // absent without Music Assistant
    await s.scrollIntoViewIfNeeded();
    await shot(page, 'settings-connection-sonos');
  });

  test('permissions: the line names media.group and leads to the roles; no announcements', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    await expandAll(page);
    const p = sys(page).locator('[data-mm-permissions]');
    await expect(p).toContainText('media.group');
    await expect(p).toContainText('קבוצה של 4 חדרים ומעלה');
    await expect(p.locator('a[href="#/system/access"]')).toHaveText(/תפקידים והרשאות/);
    await expect(p).not.toContainText('הכרזות');
    await expect(sys(page)).not.toContainText('announce');
  });

  test('settings need system.configure: anyone else sees the closed state and none of the sections', async ({ page }) => {
    st.perms = EDITOR;
    await install(page, st);
    await open(page, '/system/multimedia');
    await expect(sys(page).locator('[data-mm-admin-state="forbidden"]')).toHaveCount(1);
    await expect(sys(page).locator('[data-mm-players]')).toHaveCount(0);
  });

  test('a section whose route does not answer stays out; the page still works (an older server)', async ({ page }) => {
    await install(page, st);
    await page.route('**/api/v1/multimedia/admin/suggestions', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'x', retryable: false, correlation_id: '', details: {} }) }));
    await page.route('**/api/v1/multimedia/groups/presets', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'x', retryable: false, correlation_id: '', details: {} }) }));
    await open(page, '/system/multimedia');
    await expandAll(page);
    await expect(sys(page).locator('[data-mm-players]')).toBeVisible();
    await expect(sys(page).locator('[data-mm-wizard]')).toHaveCount(0);
    await expect(sys(page).locator('[data-mm-presets]')).toHaveCount(0);
  });
});

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}-1440.png`) });
}
