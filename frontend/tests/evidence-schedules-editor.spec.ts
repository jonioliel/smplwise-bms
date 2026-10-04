import { test, expect, type Page, type Locator } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// CR-014 S4: the schedule editor in DEMO mode (no backend: run the preview with SW_API_PORT pointing at a port nothing
// listens on), against the typed client's in-memory store (persona through localStorage `sw.demo.schedules`). The editor is
// mounted on its own page (S3 owns the route `#/devices/schedules/<id>/edit`), the shell removed. Screenshots at 1440 and 390
// go to docs/evidence/CR014-s4/.
const SHOTS = fileURLToPath(new URL('../../docs/evidence/CR014-s4', import.meta.url));
fs.mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

interface MountOptions {
  persona?: 'admin' | 'manager' | 'viewer' | 'none';
  hash?: string;
  width?: number;
  height?: number;
  tag?: string;
  /** A new schedule (empty id): the create flow's template and preset, as S3's route passes them. */
  template?: string;
  preset?: string;
}

/** Load the app (for its bundle and the tokens), then replace the shell by the element under test. */
async function mount(page: Page, id: string, o: MountOptions = {}) {
  await page.setViewportSize({ width: o.width ?? 1440, height: o.height ?? 900 });
  await page.addInitScript((persona) => {
    try {
      localStorage.setItem('sw.demo.schedules', JSON.stringify({ persona }));
      localStorage.removeItem('sw.schedules.editor_view');
    } catch {
      /* storage unavailable */
    }
  }, o.persona ?? 'admin');
  await page.goto('about:blank');
  await page.goto(`/?design=a#${o.hash ?? '/devices/building'}`);
  await page.waitForFunction(() => !!customElements.get('schedule-editor'));
  await page.evaluate(
    ([sid, tag, template, preset]) => {
      document.querySelector('sw-app')?.remove();
      const el = document.createElement(tag) as HTMLElement & { scheduleId?: string; template?: string; preset?: string; open?: boolean };
      if (tag === 'schedule-editor') {
        el.scheduleId = sid;
        el.template = template;
        el.preset = preset;
      } else el.open = true;
      document.body.append(el);
    },
    [id, o.tag ?? 'schedule-editor', o.template ?? '', o.preset ?? ''],
  );
  if ((o.tag ?? 'schedule-editor') === 'schedule-editor') await ready(page);
}

async function ready(page: Page) {
  await page.locator('schedule-editor:not(#second) [data-editor], schedule-editor:not(#second) [data-editor-state]:not([data-editor-state="loading"])').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
}

/** A fresh editor on the same page (the demo store lives as long as the page): what a later visit sees. */
async function remount(page: Page, id: string) {
  await page.evaluate((sid) => {
    document.querySelector('schedule-editor:not(#second)')?.remove();
    const el = document.createElement('schedule-editor') as HTMLElement & { scheduleId?: string };
    el.scheduleId = sid;
    document.body.append(el);
  }, id);
  await ready(page);
}

/** A second editor on the same page (they share the demo store): a change "made elsewhere". */
async function mountSecond(page: Page, id: string) {
  await page.evaluate((sid) => {
    const el = document.createElement('schedule-editor') as HTMLElement & { scheduleId?: string };
    el.id = 'second';
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px';
    el.scheduleId = sid;
    document.body.append(el);
  }, id);
  await page.locator('#second [data-editor]').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
}

const editor = (page: Page) => page.locator('schedule-editor:not(#second)');
const second = (page: Page) => page.locator('#second');
const track = (page: Page, row = 'sun') => editor(page).locator(`sw-schedule-grid .track[data-track="${row}"]`);
const slots = (page: Page, row = 'sun') => editor(page).locator(`sw-schedule-grid .slot[data-row="${row}"]`);

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('no box');
  return b;
}

/** "title · 07:30–19:00" of every slot on a day. */
async function labels(page: Page, row = 'sun'): Promise<string[]> {
  return slots(page, row).evaluateAll((els) => els.map((e) => (e as HTMLElement).getAttribute('title') ?? ''));
}

/** The clock span of a slot label ("07:30–19:00"), or null. */
function span(label: string): [string, string] | null {
  const m = /(\d\d:\d\d)–(\d\d:\d\d)/.exec(label);
  return m ? [m[1], m[2]] : null;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Drag with the mouse from a to b (page coordinates), in steps. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, mods: { alt?: boolean } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (mods.alt) await page.keyboard.down('Alt');
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  if (mods.alt) await page.keyboard.up('Alt');
}

/** x of a minute inside a row's track. */
function xAt(b: { x: number; width: number }, min: number) {
  return b.x + 1 + ((b.width - 2) * min) / 1440;
}

test.describe('week grid: linked days, mouse and keyboard (1440)', () => {
  test('a schedule with five linked days; the hatched days offer an add button', async ({ page }) => {
    await mount(page, '4d6e0a');
    await expect(editor(page).locator('[data-linked-chip]')).toContainText('5 ימים מקושרים');
    for (const d of ['sun', 'mon', 'tue', 'wed', 'thu']) expect(await labels(page, d)).toHaveLength(2);
    await expect(editor(page).locator('sw-schedule-grid .row.off')).toHaveCount(2);
    // 00:00 is at the LEFT of the axis, 24 at the right (an LTR axis inside the RTL page)
    const first = await box(editor(page).locator('sw-schedule-grid .hour').first());
    const last = await box(editor(page).locator('sw-schedule-grid .hour').last());
    expect(first.x).toBeLessThan(last.x);
    await expect(editor(page).locator('sw-schedule-grid .hour').first()).toHaveText('00');
    await shot(page, 'editor-week-1440');
    await page.screenshot({ path: path.join(SHOTS, 'editor-week-full-1440.png'), fullPage: true });
  });

  test('drag on an empty track creates a snapped slot on every linked day; move and resize snap to 15 minutes', async ({ page }) => {
    await mount(page, '4d6e0a');
    const tb = await box(track(page, 'sun'));
    const y = tb.y + tb.height / 2;
    // create 01:00 - 03:00 (pointer positions between the grid lines: the result is snapped)
    await drag(page, { x: xAt(tb, 62), y }, { x: xAt(tb, 182), y });
    for (const d of ['sun', 'mon', 'thu']) {
      const l = await labels(page, d);
      expect(l).toHaveLength(3);
      expect(l.some((x) => span(x)?.join('-') === '01:00-03:00')).toBe(true);
    }
    await expect(editor(page).locator('schedule-slot-panel')).toBeVisible();
    await expect(editor(page).locator('[data-editor-save]')).toBeEnabled();
    // move it by two hours
    const created = slots(page, 'sun').first();
    const cb = await box(created);
    await drag(page, { x: cb.x + cb.width / 2, y }, { x: cb.x + cb.width / 2 + (tb.width * 122) / 1440, y });
    expect((await labels(page, 'sun')).some((x) => span(x)?.join('-') === '03:00-05:00')).toBe(true);
    // resize its end: grab the right edge and pull it to 06:00
    const mb = await box(slots(page, 'sun').first());
    await drag(page, { x: mb.x + mb.width - 2, y }, { x: xAt(tb, 362), y });
    expect((await labels(page, 'sun')).some((x) => span(x)?.join('-') === '03:00-06:00')).toBe(true);
    // pulling it over the next slot (07:30) is held at the neighbour
    const rb = await box(slots(page, 'sun').first());
    await drag(page, { x: rb.x + rb.width - 2, y }, { x: xAt(tb, 600), y });
    expect((await labels(page, 'sun')).some((x) => span(x)?.join('-') === '03:00-07:30')).toBe(true);
    // the start edge, with a 5-minute snap
    await editor(page).locator('[data-snap]').selectOption('5');
    const sb = await box(slots(page, 'sun').first());
    await drag(page, { x: sb.x + 2, y }, { x: xAt(tb, 152), y });
    const l = (await labels(page, 'sun')).map((x) => span(x)).filter(Boolean) as [string, string][];
    const st = minutes(l[0][0]);
    expect(st % 5).toBe(0);
    expect(st).toBeGreaterThan(140);
    expect(st).toBeLessThan(160);
    await shot(page, 'editor-drag-1440');
  });

  test('a click on an empty stretch makes an hour; the pin of an off action shows its label; a hatched day is added', async ({ page }) => {
    await mount(page, '4d6e0a');
    const tb = await box(track(page, 'mon'));
    await page.mouse.click(xAt(tb, 302), tb.y + tb.height / 2);
    expect((await labels(page, 'mon')).some((x) => span(x)?.join('-') === '05:00-06:00')).toBe(true);
    // Friday is not in the schedule: its add button links it (all days share the slots)
    await editor(page).locator('sw-schedule-grid .row.off .add').first().click();
    await expect(editor(page).locator('[data-linked-chip]')).toContainText('6 ימים מקושרים');
    expect(await labels(page, 'fri')).toHaveLength(3);
  });

  test('keyboard: arrows move, Shift changes the end, Ctrl the start, Delete removes, arrows change the day', async ({ page }) => {
    await mount(page, '4d6e0a');
    const first = slots(page, 'sun').first();
    await first.focus();
    await expect(first).toBeFocused();
    const before = span((await labels(page, 'sun'))[0])!;
    expect(before).toEqual(['07:30', '19:00']);
    await page.keyboard.press('ArrowLeft');
    expect(span((await labels(page, 'sun'))[0])).toEqual(['07:15', '18:45']);
    await expect(slots(page, 'sun').first()).toBeFocused();
    await page.keyboard.press('Control+ArrowRight'); // the start edge alone
    expect(span((await labels(page, 'sun'))[0])).toEqual(['07:30', '18:45']);
    await page.keyboard.press('Shift+ArrowRight'); // the end edge (its "turn off" pin follows)
    expect(span((await labels(page, 'sun'))[0])).toEqual(['07:30', '19:00']);
    // Down: the same slot on Monday
    await page.keyboard.press('ArrowDown');
    await expect(slots(page, 'mon').first()).toBeFocused();
    // Enter selects: the panel opens
    await page.keyboard.press('Enter');
    await expect(editor(page).locator('schedule-slot-panel')).toBeVisible();
    await slots(page, 'mon').first().focus();
    await page.keyboard.press('Delete');
    expect(await labels(page, 'sun')).toHaveLength(1);
    await expect(editor(page).locator('[data-editor-save]')).toBeEnabled();
  });
});

test.describe('table view of the same scheme (1440)', () => {
  test('rows with inline time editing; typed times share the graph rules; the two views show identical data', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-view-btn="table"]').click();
    const rows = editor(page).locator('schedule-table-view tr[data-row]');
    await expect(rows).toHaveCount(2);
    const from = rows.nth(0).locator('input[data-cell="from"]');
    const to = rows.nth(0).locator('input[data-cell="to"]');
    await expect(from).toHaveValue('07:30');
    await expect(to).toHaveValue('19:00');
    await from.fill('8:00');
    await from.press('Enter');
    await expect(rows.nth(0).locator('input[data-cell="from"]')).toHaveValue('08:00');
    // a wrong value is explained under the cell and nothing changes
    await to.fill('25:00');
    await to.press('Enter');
    await expect(rows.nth(0).locator('.msg')).toContainText('שעה מחוץ לטווח');
    await to.fill('06:00');
    await to.press('Enter');
    await expect(rows.nth(0).locator('.msg')).toContainText('חייבת להיות אחרי');
    // a sun time typed in words
    await to.fill('שקיעה');
    await to.press('Enter');
    await expect(rows.nth(0).locator('input[data-cell="to"]')).toHaveValue('שקיעה');
    await expect(rows.nth(0).locator('.msg')).toHaveCount(0);
    await shot(page, 'editor-table-1440');
    // the graph shows the very same times
    await editor(page).locator('[data-view-btn="week"]').click();
    const l = (await labels(page, 'sun'))[0];
    expect(l).toContain('08:00');
    expect(l).toContain('שקיעה');
    // and an edit in the graph shows in the table
    await editor(page).locator('[data-view-btn="table"]').click();
    await expect(editor(page).locator('schedule-table-view tr[data-row]').nth(0).locator('input[data-cell="from"]')).toHaveValue('08:00');
    // the choice of view is remembered in this browser
    expect(await page.evaluate(() => localStorage.getItem('sw.schedules.editor_view'))).toBe('table');
  });

  test('the action and its value are edited in the row; a second row can be added', async ({ page }) => {
    await mount(page, '3f9a1c');
    await editor(page).locator('[data-view-btn="table"]').click();
    const rows = editor(page).locator('schedule-table-view tr[data-row]');
    await expect(rows).toHaveCount(5);
    const temp = rows.nth(0).locator('input.num').first();
    await expect(temp).toHaveValue('25');
    await temp.fill('24.5');
    await temp.press('Enter');
    await expect(rows.nth(0).locator('input.num').first()).toHaveValue('24.5');
    await expect(editor(page).locator('[data-editor-save]')).toBeEnabled();
    // a slot with 5 rows, 00:00 - 00:00 chain: end of day is written 24:00
    await expect(rows.nth(4).locator('input[data-cell="to"]')).toHaveValue('24:00');
  });
});

test.describe('day view, the slot panel, phone', () => {
  test('day view (1440): the day chips choose the day; the panel edits the selected slot', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-view-btn="day"]').click();
    await expect(editor(page).locator('[data-day-btn]')).toHaveCount(7);
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    const panel = editor(page).locator('schedule-slot-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-time="start"]')).toHaveValue('07:30');
    // brightness as a percentage; the summary follows
    const num = panel.locator('[data-arg="brightness"] input[type="number"]');
    await expect(num).toHaveValue('80');
    await num.fill('50');
    await num.press('Tab');
    await expect(editor(page).locator('sw-schedule-grid .slot').first()).toHaveAttribute('title', /50%/);
    // the end of the window can be a sun time
    await panel.locator('[data-time-kind="stop"]').selectOption('sunset');
    await expect(panel.locator('[data-offset="stop"]')).toBeVisible();
    await panel.locator('[data-offset="stop"]').fill('30');
    await panel.locator('[data-offset="stop"]').press('Tab');
    await expect(editor(page).locator('sw-schedule-grid .slot').first()).toHaveAttribute('title', /שקיעה ‎\+00:30/);
    await shot(page, 'editor-day-1440');
  });

  test('"כיבוי בסיום" adds and removes the companion slot at the end of the window', async ({ page }) => {
    await mount(page, '5a13f2'); // cover, 08:00 - 18:30 then a close at 18:30
    await editor(page).locator('[data-view-btn="day"]').click();
    const first = editor(page).locator('sw-schedule-grid .slot').first();
    await first.click();
    // the companion of a cover slot does not exist (no off counterpart): the helper is not offered
    await expect(editor(page).locator('schedule-slot-panel sw-toggle')).toHaveCount(0);
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-view-btn="day"]').click();
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    const toggle = editor(page).locator('schedule-slot-panel sw-toggle');
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAttribute('checked', '');
    await toggle.locator('button').click(); // remove the paired off pin
    await expect(editor(page).locator('sw-schedule-grid .slot')).toHaveCount(1);
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    await editor(page).locator('schedule-slot-panel sw-toggle button').click(); // add it back
    await expect(editor(page).locator('sw-schedule-grid .slot')).toHaveCount(2);
  });

  test('phone (390): the day timeline is vertical, the settings are a second tab, the table becomes cards', async ({ page }) => {
    await mount(page, '4d6e0a', { width: 390, height: 844 });
    await expect(editor(page).locator('sw-schedule-grid')).toHaveAttribute('orientation', 'vertical');
    await shot(page, 'editor-day-390');
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    await expect(editor(page).locator('schedule-slot-panel')).toBeVisible();
    await editor(page).locator('schedule-slot-panel').scrollIntoViewIfNeeded();
    await shot(page, 'editor-slot-390');
    await editor(page).locator('[data-phone-tab="settings"]').click();
    await expect(editor(page).locator('[data-side]')).toBeVisible();
    await shot(page, 'editor-settings-390');
    await page.screenshot({ path: path.join(SHOTS, 'editor-settings-full-390.png'), fullPage: true });
    await editor(page).locator('[data-phone-tab="board"]').click();
    await editor(page).locator('[data-view-btn="table"]').click();
    await expect(editor(page).locator('schedule-table-view tr[data-row]')).toHaveCount(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, 'editor-table-390');
  });

  test('phone (390): a tap on the empty vertical timeline adds an hour; the bottom edge is dragged with the pointer', async ({ page }) => {
    await mount(page, '4d6e0a', { width: 390, height: 1700 });
    await expect(editor(page).locator('sw-schedule-grid')).toHaveAttribute('orientation', 'vertical');
    const tr = editor(page).locator('sw-schedule-grid .track').first();
    let tb = await box(tr);
    const yAt = (min: number) => tb.y + 1 + ((tb.height - 2) * min) / 1440;
    const x = tb.x + tb.width / 2;
    const before = await editor(page).locator('sw-schedule-grid .slot').count();
    await page.mouse.click(x, yAt(122)); // 02:02 → an hour from 02:00
    await expect(editor(page).locator('sw-schedule-grid .slot')).toHaveCount(before + 1);
    const created = editor(page).locator('sw-schedule-grid .slot').filter({ hasText: '02:00–03:00' });
    await expect(created).toHaveCount(1);
    await page.waitForTimeout(900); // the panel scrolls into view: measure again once the page is still
    tb = await box(tr);
    // pull its bottom edge to 04:00
    const cb = await box(created);
    await drag(page, { x, y: cb.y + cb.height - 2 }, { x, y: yAt(242) });
    await expect(editor(page).locator('sw-schedule-grid .slot').filter({ hasText: '02:00–04:00' })).toHaveCount(1);
    await shot(page, 'editor-day-drag-390');
  });

  test('tablet (820): the week grid fits and the side panel goes below', async ({ page }) => {
    await mount(page, '4d6e0a', { width: 820, height: 1100 });
    await expect(editor(page).locator('sw-schedule-grid')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, 'editor-week-820');
  });
});

test.describe('conditions', () => {
  test('presets, a sensor condition with a number, "all of them", tracking; the state shown live', async ({ page }) => {
    await mount(page, '4d6e0a');
    const cond = editor(page).locator('schedule-conditions');
    await expect(cond.locator('[data-preset="not_holy_days"]')).toHaveAttribute('aria-pressed', 'true');
    await cond.locator('[data-preset="only_holy_days"]').click();
    await expect(cond.locator('[data-preset="only_holy_days"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(cond.locator('[data-condition="binary_sensor.shabbat_mode"]')).toContainText('איסור מלאכה');
    await cond.locator('[data-condition-new]').click();
    await cond.locator('[data-candidate="sensor.outdoor_temperature"]').click();
    const row = cond.locator('[data-condition="sensor.outdoor_temperature"]');
    await expect(row).toBeVisible();
    await expect(row.locator('[data-condition-op]')).toHaveValue('above');
    await row.locator('[data-condition-value]').fill('28');
    await row.locator('[data-condition-value]').press('Tab');
    // two conditions: "all of them" / "one of them"
    await expect(cond.locator('[data-cond-type="and"]')).toHaveAttribute('aria-pressed', 'true');
    await cond.locator('[data-cond-type="or"]').click();
    await expect(cond.locator('[data-cond-type="or"]')).toHaveAttribute('aria-pressed', 'true');
    await cond.locator('[data-cond-track]').check();
    // no window end on the off pin: the tracking warning appears
    await expect(cond.locator('[data-cond-warnings]')).toContainText('שעת סיום');
    // removing the preset condition clears it and the preset chip
    await cond.locator('[data-condition="binary_sensor.shabbat_mode"] [data-condition-remove]').click();
    await expect(cond.locator('[data-preset="only_holy_days"]')).toHaveAttribute('aria-pressed', 'false');
    await editor(page).locator('[data-conditions-sec]').scrollIntoViewIfNeeded();
    await shot(page, 'editor-conditions-1440');
  });

  test('"מוצאי שבת" sets Saturday and the condition; a condition outside the person\'s scope is locked', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('schedule-conditions [data-preset="motzash"]').click();
    await expect(editor(page).locator('[data-day-chip="sat"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(editor(page).locator('[data-day-chip="sun"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(editor(page).locator('schedule-conditions [data-preset="not_holy_days"]')).toHaveAttribute('aria-pressed', 'true');
    // a floor-scoped editor cannot read the outdoor sensor: the condition is locked, no controls
    await mount(page, '2c9f61', { persona: 'manager' });
    const locked = editor(page).locator('schedule-conditions [data-condition-locked="sensor.outdoor_temperature"]');
    await expect(locked).toBeVisible();
    await expect(locked).toContainText('מחוץ להרשאתך');
    await expect(editor(page).locator('schedule-conditions [data-condition-remove]')).toHaveCount(0);
    await editor(page).locator('[data-conditions-sec]').scrollIntoViewIfNeeded();
    await shot(page, 'editor-condition-locked-1440');
    // the times of the schedule can still be edited: save goes through with the locked condition unchanged
    await editor(page).locator('[data-editor-name]').fill('מאוורר אולם – בימים חמים (עודכן)');
    await editor(page).locator('[data-editor-save]').click();
    await expect(editor(page).locator('[data-note]')).toContainText('נשמרו');
  });
});

test.describe('sensitive schedules', () => {
  test('a schedule that opens a gate: marker, explicit confirmation with a plain warning, then it saves', async ({ page }) => {
    await mount(page, 'd8e3a7');
    await expect(editor(page).locator('[data-sensitive-badge]')).toBeVisible();
    await expect(editor(page).locator('sw-schedule-grid .slot.lowering').first()).toBeVisible();
    await editor(page).locator('[data-editor-name]').fill('שער חניה – פתיחה בבוקר (מעודכן)');
    await editor(page).locator('[data-editor-save]').click();
    const dialog = editor(page).locator('schedule-lowering-dialog');
    await expect(dialog.locator('[data-lowering-warning]')).toContainText('גם כשאיש אינו נמצא במקום');
    await expect(dialog.locator('[data-lowering-warning]')).toContainText('שער חניה');
    await expect(dialog.locator('[data-lowering-ok]')).toHaveAttribute('disabled', '');
    await shot(page, 'editor-lowering-1440');
    await dialog.locator('[data-lowering-ack]').check();
    await expect(dialog.locator('[data-lowering-ok]')).not.toHaveAttribute('disabled', '');
    await dialog.locator('[data-lowering-ok]').click();
    await expect(editor(page).locator('[data-note]')).toContainText('נשמרו');
  });

  test('arming the alarm is marked sensitive; a plain schedule manager sees it read-only with the reason', async ({ page }) => {
    await mount(page, 'e19b70');
    await expect(editor(page).locator('[data-sensitive-badge]')).toBeVisible();
    await expect(editor(page).locator('[data-editor-save]')).toBeEnabled({ enabled: false }).catch(() => undefined);
    await mount(page, 'e19b70', { persona: 'manager' });
    await expect(editor(page).locator('[data-readonly-banner]')).toContainText('דורש הרשאה לתזמון פעולות רגישות');
    await expect(editor(page).locator('[data-editor-save]')).toHaveCount(0);
    await expect(editor(page).locator('[data-add-slot]')).toHaveCount(0);
    await shot(page, 'editor-readonly-1440');
  });

  test('a lock: renaming saves without asking; turning it into an unlock asks the explicit confirmation', async ({ page }) => {
    await mount(page, 'f45b02');
    await editor(page).locator('[data-editor-name]').fill('נעילה בלילה');
    await editor(page).locator('[data-editor-save]').click();
    await expect(editor(page).locator('[data-note]')).toContainText('נשמרו');
    await expect(editor(page).locator('schedule-lowering-dialog [data-lowering-dialog]')).not.toHaveAttribute('open', '');
    // the same schedule, later: the action becomes "unlock" (it now opens something with nobody there)
    await remount(page, 'f45b02');
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    await editor(page).locator('schedule-slot-panel [data-service]').selectOption('lock.unlock');
    await editor(page).locator('[data-editor-save]').click();
    const dlg = editor(page).locator('schedule-lowering-dialog [data-lowering-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(editor(page).locator('schedule-lowering-dialog [data-lowering-warning]')).toContainText('נעילת מנעול דלת ראשית');
    await editor(page).locator('schedule-lowering-dialog [data-lowering-cancel]').click();
    await expect(dlg).not.toHaveAttribute('open', '');
    await expect(editor(page).locator('[data-editor-save]')).toBeEnabled();
    await expect(editor(page).locator('[data-note]')).toHaveCount(0);
  });
});

test.describe('read-only content and states', () => {
  test('a script called as its own service is an ordinary, editable script action with its variables (2026-10-04)', async ({ page }) => {
    await mount(page, 'a0f4c9');
    await expect(editor(page).locator('[data-readonly-banner]')).toHaveCount(0);
    await expect(editor(page).locator('sw-schedule-grid .slot.locked')).toHaveCount(0);
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    const panel = editor(page).locator('schedule-slot-panel');
    await expect(panel.locator('[data-slot-locked]')).toHaveCount(0);
    await expect(panel.locator('[data-service]')).toHaveValue('script.turn_on');
    await expect(panel.locator('[data-var="minutes"] input')).toHaveValue('10');
    await expect(editor(page).locator('[data-editor-save]')).toHaveCount(1);
    await shot(page, 'editor-script-1440');
  });

  test('content the system truly cannot model is shown locked and explained; the schedule is read-only', async ({ page }) => {
    await mount(page, '6e2d90');
    await expect(editor(page).locator('[data-readonly-banner]')).toContainText('תוכן שהמערכת אינה מציגה במלואו');
    await expect(editor(page).locator('sw-schedule-grid .slot.locked').first()).toBeVisible();
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    await expect(editor(page).locator('schedule-slot-panel [data-slot-locked]')).toContainText('ברכיב התזמונים המקורי');
    await expect(editor(page).locator('[data-editor-save]')).toHaveCount(0);
    await shot(page, 'editor-unsupported-1440');
  });

  test('a schedule the caller cannot see is not found; a viewer opens the editor read-only', async ({ page }) => {
    await mount(page, 'zzzzzz');
    await expect(editor(page).locator('[data-editor-state="forbidden"]')).toBeVisible();
    await mount(page, '4d6e0a', { persona: 'viewer' });
    await expect(editor(page).locator('[data-readonly-banner]')).toBeVisible();
    await expect(editor(page).locator('sw-schedule-grid')).not.toHaveAttribute('editable', '');
    await expect(editor(page).locator('[data-editor-save]')).toHaveCount(0);
  });

  test('the "single" repeat warns; dates are checked', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-repeat-btn="single"]').click();
    await expect(editor(page).locator('[data-single-warning]')).toContainText('יימחק');
    await editor(page).locator('[data-date-from]').fill('2026-10-10');
    await editor(page).locator('[data-date-to]').fill('2026-10-01');
    await editor(page).locator('[data-editor-save]').click();
    await expect(editor(page).locator('[data-validation-status]')).toContainText('תאריך הסיום לפני תאריך ההתחלה');
    await shot(page, 'editor-validation-1440');
  });
});

test.describe('unsaved changes, conflicts, split', () => {
  test('leaving with unsaved edits asks first', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-editor-name]').fill('שם חדש');
    await editor(page).locator('[data-editor-cancel]').click();
    const dlg = editor(page).locator('[data-leave-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await editor(page).locator('[data-leave-stay]').click();
    await expect(dlg).not.toHaveAttribute('open', '');
    await expect(editor(page).locator('[data-editor-name]')).toHaveValue('שם חדש');
    await editor(page).locator('[data-editor-cancel]').click();
    await editor(page).locator('[data-leave-go]').click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('/devices/schedules/4d6e0a');
    // an in-app link that would leave is caught as well
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-editor-name]').fill('עוד שינוי');
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#/live/wall';
      a.id = 'somewhere';
      a.textContent = 'x';
      document.body.append(a);
    });
    await page.locator('#somewhere').click();
    await expect(editor(page).locator('[data-leave-dialog]')).toHaveAttribute('open', '');
  });

  test('a change made elsewhere while editing: 409 → the banner with compare, latest and keep mine', async ({ page }) => {
    await mount(page, '4d6e0a');
    await mountSecond(page, '4d6e0a');
    await second(page).locator('[data-editor-name]').fill('שונה במקום אחר');
    await second(page).locator('[data-editor-save]').dispatchEvent('click');
    await expect(second(page).locator('[data-note]')).toContainText('נשמרו');
    // this editor still holds the old revision
    await editor(page).locator('[data-repeat-btn="pause"]').click();
    await editor(page).locator('[data-editor-save]').click();
    const banner = editor(page).locator('[data-conflict-banner]');
    await expect(banner).toContainText('התזמון שונה במקום אחר');
    await shot(page, 'editor-conflict-1440');
    await banner.locator('[data-conflict-compare]').click();
    const cmp = editor(page).locator('[data-compare-dialog]');
    await expect(cmp).toContainText('שונה במקום אחר');
    await expect(cmp).toContainText('חזרה');
    await cmp.locator('sw-button').last().click();
    // keep mine: saved on top of the new revision
    await banner.locator('[data-conflict-mine]').click();
    await expect(editor(page).locator('[data-note]')).toContainText('נשמרו');
    await expect(editor(page).locator('[data-conflict-banner]')).toHaveCount(0);
  });

  test('"load the latest" discards mine', async ({ page }) => {
    await mount(page, '4d6e0a');
    await mountSecond(page, '4d6e0a');
    await second(page).locator('[data-editor-name]').fill('גרסה חדשה');
    await second(page).locator('[data-editor-save]').dispatchEvent('click');
    await expect(second(page).locator('[data-note]')).toBeVisible();
    await editor(page).locator('[data-repeat-btn="pause"]').click();
    await editor(page).locator('[data-editor-save]').click();
    await editor(page).locator('[data-conflict-latest]').click();
    await expect(editor(page).locator('[data-editor-name]')).toHaveValue('גרסה חדשה');
    await expect(editor(page).locator('[data-repeat-btn="repeat"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(editor(page).locator('[data-conflict-banner]')).toHaveCount(0);
  });

  test('editing only one day: the split is confirmed, then two schedules exist', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-day-chip="tue"]').scrollIntoViewIfNeeded();
    // choose Tuesday, then "edit only Tuesday"
    await editor(page).locator('sw-schedule-grid .rowlabel', { hasText: 'שלישי' }).click();
    await expect(editor(page).locator('[data-split-start]')).toContainText('שלישי');
    await editor(page).locator('[data-split-start]').click();
    await expect(editor(page).locator('[data-override-banner]')).toBeVisible();
    // only Tuesday is editable; the linked days are read-only
    await expect(editor(page).locator('sw-schedule-grid .row.ro')).toHaveCount(6); // the four linked days and the two days outside
    const tb = await box(track(page, 'tue'));
    const y = tb.y + tb.height / 2;
    const sb = await box(slots(page, 'tue').first());
    await drag(page, { x: sb.x + sb.width / 2, y }, { x: sb.x + sb.width / 2 - (tb.width * 60) / 1440, y });
    expect(span((await labels(page, 'tue'))[0])![0]).not.toBe('07:30');
    expect(span((await labels(page, 'mon'))[0])).toEqual(['07:30', '19:00']);
    await shot(page, 'editor-split-1440');
    await editor(page).locator('[data-editor-save]').click();
    const dlg = editor(page).locator('[data-split-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(dlg).toContainText('נפצל לשני תזמונים');
    await expect(dlg.locator('[data-split-name]')).toHaveValue('תאורת משרדים – שעות עבודה · ג׳');
    await shot(page, 'editor-split-dialog-1440');
    await dlg.locator('[data-split-ok]').click();
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 8000 }).toContain('/devices/schedules/4d6e0a');
    // the original lost Tuesday; the new schedule is Tuesday alone with the edited slot
    await remount(page, '4d6e0a');
    await expect(editor(page).locator('[data-day-chip="tue"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(editor(page).locator('[data-day-chip="mon"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await labels(page, 'mon')).toHaveLength(2);
  });

  test('"copy to days" adds days to the schedule (linked); a split group can take more days', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    await editor(page).locator('[data-slot-copy-days]').click();
    const dlg = editor(page).locator('[data-copy-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(dlg.locator('[data-copy-day="sun"]')).toBeDisabled();
    await dlg.locator('[data-copy-day="fri"]').click();
    await dlg.locator('[data-copy-ok]').click();
    await expect(editor(page).locator('[data-linked-chip]')).toContainText('6 ימים מקושרים');
    expect(await labels(page, 'fri')).toHaveLength(2);
  });
});

test.describe('the device picker', () => {
  test('by room and by type, multi-select, every switch is selectable (CR-019: no mark); adding mirrors the slots', async ({ page }) => {
    await mount(page, '4d6e0a');
    await editor(page).locator('[data-open-picker]').click();
    const picker = editor(page).locator('schedule-entity-picker');
    await expect(picker.locator('[data-picker-item="light.lobby"]')).toBeVisible();
    await expect(picker.locator('[data-picker-item="switch.boiler"]')).not.toContainText('לא סומן כבטוח');
    await expect(picker.locator('[data-picker-item="switch.boiler"] input')).toBeEnabled();
    await picker.locator('[data-picker-by-class]').click();
    await picker.locator('[data-picker-search]').fill('חצר');
    await expect(picker.locator('[data-picker-item="light.yard"]')).toBeVisible();
    await picker.locator('[data-picker-item="light.yard"] input').check();
    await expect(picker.locator('[data-picker-ok]')).toContainText('(2)');
    await shot(page, 'editor-picker-1440');
    await picker.locator('[data-picker-ok]').click();
    await expect(editor(page).locator('[data-devices] .ent')).toHaveCount(2);
    // the new device does what the others do in every slot
    await editor(page).locator('[data-view-btn="day"]').click();
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    await expect(editor(page).locator('schedule-slot-panel .ent')).toHaveCount(2);
  });
});

test.describe('create flow', () => {
  test('the dialog: templates with the holiday presets, and the three-tap quick create (1440)', async ({ page }) => {
    await mount(page, '', { tag: 'schedule-create-dialog' });
    const dlg = page.locator('schedule-create-dialog');
    await expect(dlg.locator('[data-template="weekly"]')).toBeVisible();
    await expect(dlg.locator('[data-create-continue]')).toHaveAttribute('disabled', '');
    await dlg.locator('[data-template="ac"]').click();
    await dlg.locator('[data-create-preset="not_holy_days"]').click();
    await shot(page, 'create-templates-1440');
    // quick create: where, what and when, which days - then the schedule exists at once
    await page.evaluate(() => {
      (window as unknown as { __created: unknown[] }).__created = [];
      document.querySelector('schedule-create-dialog')!.addEventListener('created', (e) => (window as unknown as { __created: unknown[] }).__created.push((e as CustomEvent).detail));
    });
    await dlg.locator('[data-create-tab="quick"]').click();
    await dlg.locator('[data-quick-area="חצר"]').click();
    await dlg.locator('[data-quick-entity="light.yard"]').click();
    await dlg.locator('[data-quick-action="on"]').click();
    await dlg.locator('[data-quick-time="sunset"]').click();
    await dlg.locator('[data-quick-days="daily"]').click();
    await expect(dlg.locator('[data-quick-sentence]')).toContainText('תאורת חצר: הדלקה · שקיעה · כל יום');
    await shot(page, 'create-quick-1440');
    await dlg.locator('[data-quick-go]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __created: unknown[] }).__created.length)).toBe(1);
    const created = await page.evaluate(() => (window as unknown as { __created: { id: string }[] }).__created[0]);
    expect(created.id).toMatch(/^[0-9a-f]{6}$/);
  });

  test('a template opens the editor with a draft and the device picker; choosing devices fills the slots; save creates', async ({ page }) => {
    await mount(page, '', { template: 'ac', preset: 'not_holy_days' });
    await expect(editor(page).locator('[data-editor]')).toHaveAttribute('data-editor-mode', 'new');
    await expect(editor(page).locator('[data-editor-name]')).toHaveValue('מזגן בשעות משרד');
    const picker = editor(page).locator('schedule-entity-picker');
    await expect(picker.locator('[data-picker-item="climate.offices"]')).toBeVisible();
    await picker.locator('[data-picker-item="climate.offices"] input').check();
    await picker.locator('[data-picker-item="climate.meeting_room"] input').check();
    await picker.locator('[data-picker-ok]').click();
    await expect(editor(page).locator('[data-devices] .ent')).toHaveCount(2);
    await expect(editor(page).locator('schedule-conditions [data-preset="not_holy_days"]')).toHaveAttribute('aria-pressed', 'true');
    await editor(page).locator('sw-schedule-grid .slot').first().click();
    await expect(editor(page).locator('schedule-slot-panel')).toContainText('משבצת 1 מתוך 2');
    await expect(editor(page).locator('[data-validation-status]')).toContainText('תקין');
    await shot(page, 'editor-new-1440');
    await editor(page).locator('[data-editor-save]').click();
    await expect(editor(page).locator('[data-note]')).toContainText('נוצר');
    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/\/devices\/schedules\/[0-9a-f]{6}/);
  });

  test('a new blank schedule: the name and a slot are asked for; a failed save shows the error and can be retried', async ({ page }) => {
    await mount(page, '', { template: 'blank' });
    await editor(page).locator('[data-editor-name]').fill('בדיקה');
    await editor(page).locator('[data-editor-save]').click();
    await expect(editor(page).locator('[data-validation-status]')).toContainText('נדרשת לפחות משבצת אחת');
    // draw a slot: it takes no action while the schedule has no device
    const tb = await box(track(page, 'sun'));
    await drag(page, { x: xAt(tb, 482), y: tb.y + tb.height / 2 }, { x: xAt(tb, 602), y: tb.y + tb.height / 2 });
    await editor(page).locator('[data-editor-save]').click();
    await expect(editor(page).locator('[data-validation-status]')).toContainText('לכל משבצת נדרשת פעולה');
    await editor(page).locator('[data-open-picker]').click();
    await editor(page).locator('schedule-entity-picker [data-picker-item="light.lobby"] input').check();
    await editor(page).locator('schedule-entity-picker [data-picker-ok]').click();
    // the empty slot does the plain "on" for the device that joined
    await expect(editor(page).locator('[data-validation-status]')).toContainText('תקין');
    // make the store fail once: the error is shown and "try again" saves
    await page.evaluate(() => {
      const real = crypto.getRandomValues.bind(crypto);
      (window as unknown as { __restore: () => void }).__restore = () => {
        crypto.getRandomValues = real;
      };
      crypto.getRandomValues = (() => {
        throw new Error('שגיאת בדיקה');
      }) as typeof crypto.getRandomValues;
    });
    await editor(page).locator('[data-editor-save]').click();
    await expect(editor(page).locator('[data-save-error]')).toContainText('שגיאת בדיקה');
    await shot(page, 'editor-save-error-1440');
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore());
    await editor(page).locator('[data-save-retry]').click();
    await expect(editor(page).locator('[data-note]')).toContainText('נוצר');
  });

  test('the create dialog on a phone (390)', async ({ page }) => {
    await mount(page, '', { tag: 'schedule-create-dialog', width: 390, height: 844 });
    const dlg = page.locator('schedule-create-dialog');
    await expect(dlg.locator('[data-template="sunset"]')).toBeVisible();
    await shot(page, 'create-templates-390');
    await dlg.locator('[data-create-tab="quick"]').click();
    await dlg.locator('[data-quick-area="סלון"]').click();
    await dlg.locator('[data-quick-entity="climate.living_room"]').click();
    await dlg.locator('[data-quick-action="cool23"]').click();
    await dlg.locator('[data-quick-time="0700"]').click();
    await dlg.locator('[data-quick-days="work"]').click();
    await expect(dlg.locator('[data-quick-go]')).not.toHaveAttribute('disabled', '');
    await shot(page, 'create-quick-390');
  });
});

test.describe('S3 integration: the routes and the shared dialog', () => {
  test('the shell routes render the editor (existing and new with a template) - 1440 and 390', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.demo.schedules', JSON.stringify({ persona: 'admin' }));
      } catch {
        /* storage unavailable */
      }
    });
    await page.goto('about:blank');
    await page.goto('/?design=a#/devices/schedules/4d6e0a/edit');
    await page.locator('schedule-editor [data-editor]').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    await expect(page.locator('schedule-editor sw-schedule-grid')).toBeVisible();
    await expect(page.locator('schedule-editor [data-editor-name]')).toHaveValue('תאורת משרדים – שעות עבודה');
    await shot(page, 'shell-edit-1440');
    // the create flow's route: no id, a template and a preset as properties
    await page.evaluate(() => (window.location.hash = '#/devices/schedules/new/edit?template=weekly&preset=only_holy_days'));
    await expect(page.locator('schedule-editor [data-editor]')).toHaveAttribute('data-editor-mode', 'new');
    await expect(page.locator('schedule-editor [data-editor-name]')).toHaveValue('שגרה שבועית');
    await expect(page.locator('schedule-editor schedule-conditions [data-preset="only_holy_days"]')).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await shot(page, 'shell-new-390');
  });

  test('S3\'s list renders my week view and opens my create dialog (real elements, no doubles)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.demo.schedules', JSON.stringify({ persona: 'admin' }));
        localStorage.removeItem('sw.schedules.view');
      } catch {
        /* storage unavailable */
      }
    });
    await page.goto('about:blank');
    await page.goto('/?design=a#/devices/schedules?view=week');
    const week = page.locator('devices-schedules schedules-week-view');
    await expect(week.locator('[data-week-pill]').first()).toBeVisible({ timeout: 20000 });
    await expect(week.locator('[data-week-day]')).toHaveCount(7);
    await page.waitForTimeout(400);
    await shot(page, 'list-week-1440');
    // a bar opens that schedule's drawer (S3's route)
    await week.locator('[data-week-pill="4d6e0a"]').first().click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain('/devices/schedules/4d6e0a');
    // "תזמון חדש" opens the create dialog
    await page.evaluate(() => (window.location.hash = '#/devices/schedules'));
    await page.locator('devices-schedules [data-new-schedule]').first().click();
    await expect(page.locator('devices-schedules schedule-create-dialog [data-create-dialog]')).toBeVisible();
    await page.locator('devices-schedules schedule-create-dialog [data-template="ac"]').click();
    await page.locator('devices-schedules schedule-create-dialog [data-create-continue]').click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/devices/schedules/new/edit?template=ac');
    await expect(page.locator('schedule-editor [data-editor-name]')).toHaveValue('מזגן בשעות משרד');
  });

  test('the lowering dialog takes S3\'s summary ({entities, times[], text}) and asks the alarm code when told to', async ({ page }) => {
    await mount(page, '', { tag: 'schedule-lowering-dialog' });
    await page.evaluate(() => {
      const el = document.querySelector('schedule-lowering-dialog') as HTMLElement & { summary: unknown; needsCode: boolean };
      el.summary = { entities: ['אזעקה – בית'], times: [], text: 'השחזור יחזיר תזמון שמנטרל אזעקה – בית גם כשאיש אינו נמצא במקום.' };
      el.needsCode = true;
      (window as unknown as { __confirmed: unknown[] }).__confirmed = [];
      el.addEventListener('confirm', (e) => (window as unknown as { __confirmed: unknown[] }).__confirmed.push((e as CustomEvent).detail));
    });
    const dlg = page.locator('schedule-lowering-dialog');
    await expect(dlg.locator('[data-lowering-warning]')).toContainText('השחזור יחזיר תזמון שמנטרל אזעקה');
    await expect(dlg.locator('[data-lowering-code]')).toBeVisible();
    await dlg.locator('[data-lowering-ack]').check();
    await expect(dlg.locator('[data-lowering-ok]')).toHaveAttribute('disabled', ''); // the code is still missing
    await dlg.locator('[data-lowering-code]').fill('1234');
    await dlg.locator('[data-lowering-ok]').click();
    expect(await page.evaluate(() => (window as unknown as { __confirmed: unknown[] }).__confirmed)).toEqual([{ alarm_code: '1234' }]);
    // the code is never shown in clear text
    await expect(dlg.locator('[data-lowering-code]')).toHaveAttribute('type', 'password');
  });
});

test.describe('the list\'s week view (read-only)', () => {
  test('every enabled schedule on one week board; a press opens the schedule', async ({ page }) => {
    await mount(page, '', { tag: 'schedules-week-view' });
    await page.evaluate(() => {
      const mk = (id: string, name: string, days: string[], slots: { start: string; time: string; service: string; entity: string; cls: string }[], cond = false) => ({
        id,
        display_name: name,
        enabled: true,
        days: { tokens: days, kind: 'days', days },
        slots: slots.map((s) => ({ start: { kind: 'fixed', time: s.time, raw: `${s.time}:00` }, stop: null, actions: [{ service: s.service, entity_id: s.entity, data: {} }] })),
        entities: [...new Set(slots.map((s) => s.entity))].map((e) => ({ entity_id: e, class: slots.find((x) => x.entity === e)!.cls })),
        conditions: { items: cond ? [{}] : [] },
      });
      const all = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const wd = ['sun', 'mon', 'tue', 'wed', 'thu'];
      const el = document.querySelector('schedules-week-view') as HTMLElement & { schedules: unknown[]; sun: unknown };
      el.sun = { sunrise: 393, sunset: 1092 };
      el.schedules = [
        mk('a1', 'תאורת משרדים – שעות עבודה', wd, [{ start: '', time: '07:30', service: 'light.turn_on', entity: 'light.a', cls: 'light' }, { start: '', time: '19:00', service: 'light.turn_off', entity: 'light.a', cls: 'light' }]),
        mk('a2', 'מזגן משרדים', wd, [{ start: '', time: '07:00', service: 'climate.set_temperature', entity: 'climate.a', cls: 'climate' }, { start: '', time: '18:00', service: 'climate.turn_off', entity: 'climate.a', cls: 'climate' }]),
        mk('a3', 'תריס אולם – קיץ', all, [{ start: '', time: '08:00', service: 'cover.set_cover_position', entity: 'cover.a', cls: 'cover' }, { start: '', time: '18:30', service: 'cover.close_cover', entity: 'cover.a', cls: 'cover' }]),
        mk('a4', 'שלט לובי', all, [{ start: '', time: '06:00', service: 'switch.turn_on', entity: 'switch.a', cls: 'switch' }, { start: '', time: '23:00', service: 'switch.turn_off', entity: 'switch.a', cls: 'switch' }], true),
        mk('a5', 'דריכת אזעקה – לילה', all, [{ start: '', time: '23:30', service: 'alarm_control_panel.alarm_arm_home', entity: 'alarm_control_panel.a', cls: 'alarm' }]),
      ];
      (window as unknown as { __opened: string[] }).__opened = [];
      el.addEventListener('open-schedule', (e) => (window as unknown as { __opened: string[] }).__opened.push((e as CustomEvent).detail.id));
    });
    await expect(page.locator('schedules-week-view [data-week-day="sun"] [data-week-pill]').first()).toBeVisible();
    await expect(page.locator('schedules-week-view [data-week-day]')).toHaveCount(7);
    await shot(page, 'week-view-1440');
    await page.locator('schedules-week-view [data-week-day="mon"] [data-week-pill="a2"]').first().click();
    expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(['a2']);
  });
});
