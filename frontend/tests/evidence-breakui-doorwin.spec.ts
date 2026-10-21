import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { installDoorwinMock } from './door-windows-mocks';
import { AR, BIDI, EMAIL, EMOJI, LONG_HE, MIXED, ONE, RU, UNBREAK, UNBREAK_HE, digest, measure } from './breakui-worst';

// BREAKUI-295: the door-windows event-rule editor, holiday drawer and "open for N hours" dialog against WORST-CASE data (very long and
// unbreakable names, one letter, Arabic / Russian / mixed RTL-LTR / emoji / bidi controls, 60 doors, 40 rules, 400 holidays, empty lists).
// Invented data on the mocked backend of tests/door-windows-mocks.ts; no device. A finding fails the test. Phone widths run in the `mobile`
// project (coarse pointer = the 44 px rule), desktop in `desktop`. SW_SHOTS=1 writes small PNGs to docs/design/evidence/BREAKUI-295.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/BREAKUI-295');
const SCREEN = 'sw-app door-windows-screen';
const ZONE = 'Asia/Jerusalem';
const NAMES = [LONG_HE, UNBREAK, UNBREAK_HE, EMAIL, MIXED, AR, RU, ONE, EMOJI, BIDI];

type Worst = 'full' | 'empty';

function worstState(kind: Worst) {
  const n = kind === 'full' ? 60 : 0;
  const doors = Array.from({ length: n }, (_, i) => {
    const name = NAMES[i % NAMES.length] + (i < 10 ? '' : ` ${i}`);
    const station = i % 7 === 0 ? UNBREAK : i % 3 === 0 ? 'מבנה' : LONG_HE.slice(0, 40);
    return { key: `st${i % 9}:${i}`, station_id: `st${i % 9}`, relay: i, label: `${station} · ${name}`, station_name: station, name, zone: ZONE, manage: true, cancel: true, exterior: false };
  });
  const rules = Array.from({ length: kind === 'full' ? 40 : 0 }, (_, i) => ({
    id: `ev${i}`, name: NAMES[i % NAMES.length] || 'x', kind: 'event', state: ['enabled', 'draft', 'paused', 'retired'][i % 4], calendar_policy: 'skip_holidays', notes: '', revision: 1,
    updated_at: '2026-10-30T08:00:00Z', approved: true, manageable: true,
    doors: doors.slice(i, i + (i % 5 === 0 ? 12 : 2)).map((d) => ({ station_id: d.station_id, relay: d.relay, key: d.key, label: d.label, visible: true })), periods: [],
    trigger: { source: i % 2 ? 'arx_automation' : 'ha_event', duration_s: 3600 * 24 * 365, automation_id: i % 2 ? `automation.${UNBREAK.toLowerCase()}_${i}` : null, allowed_from: '00:00', allowed_to: '24:00',
      max_per_day: 999999, cooldown_s: 86399, arm_state: i % 3 ? 'simulate' : 'armed', has_token: i % 2 === 0, token_set_at: null, can_arm: i % 4 === 0 },
  }));
  const triggers = Array.from({ length: kind === 'full' ? 40 : 0 }, (_, i) => ({
    at: `2026-11-0${1 + (i % 2)}T0${i % 10}:15:00Z`, source: (['arx_button', 'arx_automation', 'ha_event'] as const)[i % 3], door: doors[i % Math.max(1, doors.length)]?.key ?? 'x',
    decision: (['started', 'extended', 'simulated', 'refused'] as const)[i % 4], reason: i % 4 === 3 ? ['quiet_hours', 'unknown_reason_' + UNBREAK, 'closed_day'][i % 3] : null, end_at: null,
  }));
  return {
    enabled: true, tier: 'program', go_live_permitted: false,
    settings: { enabled: 'on', max_hours: kind === 'full' ? '24' : '4', max_per_day_per_door: '99999', quiet_from: '22:00', quiet_to: '06:00', relock_grace_s: '120', relock_retries: '3', reraise_min: '15', exterior_allowed: 'false' },
    can: { manage: true, cancel: true, configure: true }, doors, rules, occurrences: [], triggers, automation_actor: false, now: '2026-11-02T07:10:00Z',
  };
}

function holidays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 2 + i));
    const date = d.toISOString().slice(0, 10);
    const kind = (['holiday', 'holiday_eve', 'regular', 'closed'] as const)[i % 4];
    return { date, kind, name_he: [LONG_HE, UNBREAK, AR, RU, '', ONE, MIXED, EMOJI, BIDI][i % 9], source: i % 3 === 0 ? 'manual' : 'generated', generated_kind: i % 3 === 0 ? 'holiday' : null };
  });
}

async function boot(page: Page, kind: Worst, scheme: 'light' | 'dark', hol = 400) {
  await installDoorwinMock(page, {});
  const st = worstState(kind);
  await page.route('**/api/v1/doors/windows/state', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await page.route('**/api/v1/doors/windows/calendar', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ days: [], generator: 'israel', holidays: holidays(hol) }) }));
  await page.route('**/api/v1/doors/windows/rules', (r) => r.fulfill({ status: 201, contentType: 'application/json',
    body: JSON.stringify({ rule: st.rules[0] ?? {}, token: 'T'.repeat(64), snippet: `event: smplwise_door_event\ndata:\n  rule: ${UNBREAK}\n  token: ${'T'.repeat(64)}` }) }));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url('/wiskey/door-windows', 'classic', scheme));
  await expect(page.locator(`${SCREEN} [data-dw-week], ${SCREEN} [data-dw-week-empty]`).first()).toBeVisible({ timeout: 30_000 });
  return errors;
}

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

async function check(page: Page, label: string, within = SCREEN) {
  const r = await measure(page, label, within);
  const text = digest(label, r);
  console.log(text);
  expect(r.scroll, `${label} horizontal page scroll`).toBeLessThanOrEqual(1);
  expect(r.found, text).toEqual([]);
  if ((page.viewportSize()?.width ?? 1440) <= 480) expect(r.targets, text).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const kind of ['full', 'empty'] as const) {
    test(`door windows worst case [${kind}, ${scheme}]`, async ({ page }) => {
      const w = test.info().project.name === 'mobile' ? 400 : 1440;
      await page.setViewportSize({ width: w, height: w === 400 ? 844 : 900 });
      const errors = await boot(page, kind, scheme);
      const s = page.locator(SCREEN);
      await check(page, `list ${kind} ${scheme}`);
      await shot(page, `dw-list-${kind}-${scheme}`);

      // event-rule editor
      if (await s.locator('[data-dw-new-event]').count()) {
        await s.locator('[data-dw-new-event]').click();
        await expect(s.locator('[data-dw-event-editor]')).toBeVisible();
        await s.locator('#dwe-name').fill(kind === 'full' ? LONG_HE + UNBREAK : ONE);
        await s.locator('[data-dw-source-pick="arx_automation"]').click();
        await s.locator('#dwe-auto').fill(UNBREAK + '.' + UNBREAK);
        await s.locator('#dwe-dur').fill('99999999999');
        await s.locator('#dwe-cap').fill('٣٤٥'); // Arabic-Indic digits
        await s.locator('[data-dw-save-draft]').click(); // the validation error with a long field value
        await check(page, `editor ${kind} ${scheme}`);
        await shot(page, `dw-editor-${kind}-${scheme}`);
        if (kind === 'full') {
          await s.locator('[data-dw-door]').first().check();
          await s.locator('#dwe-dur').fill('30');
          await s.locator('#dwe-cap').fill('3');
          await s.locator('#dwe-cool').fill('5');
          await s.locator('[data-dw-save-draft]').click();
          if (await s.locator('[data-dw-secret]').count()) { // one-time code dialog with a long unbreakable snippet
            await check(page, `secret ${scheme}`);
            await shot(page, `dw-secret-${scheme}`);
          }
        }
        await page.keyboard.press('Escape');
      }

      // holidays
      await s.locator('[data-dw-holidays-btn]').click();
      await expect(s.locator('[data-dw-holidays]')).toBeVisible();
      await expect(s.locator('[data-dw-month], [data-dw-holidays-empty]').first()).toBeVisible();
      await check(page, `holidays ${kind} ${scheme}`);
      await shot(page, `dw-holidays-${kind}-${scheme}`);
      if (kind === 'full') {
        await s.locator('[data-dw-kind-pick]').first().selectOption('closed');
        await check(page, `holidays-confirm ${scheme}`);
        await shot(page, `dw-holidays-confirm-${scheme}`);
      }
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');

      // open for N hours
      if (await s.locator('[data-dw-openfor-btn]').count()) {
        await s.locator('[data-dw-openfor-btn]').click();
        await expect(s.locator('[data-dw-openfor] .seg, [data-dw-openfor-none]').first()).toBeVisible();
        await check(page, `openfor ${kind} ${scheme}`);
        await shot(page, `dw-openfor-${kind}-${scheme}`);
        await s.locator('[data-dw-hours]').last().click();
        await s.locator('[data-dw-openfor-next]').click();
        await check(page, `openfor-confirm ${kind} ${scheme}`);
        await shot(page, `dw-openfor-confirm-${kind}-${scheme}`);
      }
      expect(errors).toEqual([]);
    });
  }
}
