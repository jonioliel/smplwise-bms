import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, url } from './access-control-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-LIVE-VALIDATION-2390: הגדרות › "בדיקת קבלה לעמדות" (#/system/wiskey-validation) against a MOCKED backend (synthetic stations and results;
// nothing reaches WisKey, a station or a door). One station's run with its progress, the run of all stations (never a pulse), the four kinds
// of result with their reasons, the physical pulse dialog (typed confirmation, witness, "פעולה פיזית - דלת תיפתח"), the witness verdict, the
// CSV export, the forbidden state, the settings card that leads here. Desktop 1440 and phone 390, RTL. Pixel baselines (linux, runner):
//   python private/runner/run_smart.py spec pilot/WISKEY-LIVE-VALIDATION-2390 tests/evidence-wiskey-live-validation-2390.spec.ts --project=desktop --project=mobile [--update-snapshots]
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-live-validation-2390');
const HOME = '/system/wiskey-validation';
const PAGE = 'sw-app system-wiskey-validation';
const READY = `${PAGE} [data-lv-state="ready"]`;

type Body = Record<string, unknown>;
const CHECKS: Array<[string, string]> = [
  ['identity', 'זהות העמדה'], ['door_capabilities', 'יכולות הדלת'], ['door_read', 'קריאת הגדרות הדלת'], ['media_arx', 'תמונה דרך Arx'],
  ['media_wiskey', 'תמונה דרך WisKey'], ['talk', 'זמינות דיבור'], ['events', 'זרם אירועים'], ['clock', 'סטיית שעון'],
];
const STATUS_TEXT: Record<string, string> = { pending: 'ממתין', running: 'בבדיקה', pass: 'עבר', fail: 'נכשל', unsupported: 'לא נתמך ב-WisKey', not_run: 'לא הורץ' };
const REASONS: Record<string, string> = {
  relay_map_missing: 'לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות.',
  not_listed: 'WisKey אינו מפרסם את פקודות המדיה בערוץ השירות.',
  provider_local: 'מקור הווידאו והדיבור מוגדר Arx, ולכן WisKey לא נבדק כאן.',
  skew_over_tolerance: 'שעון העמדה סוטה מעבר ל-2 שניות.',
  step_failed: 'WisKey ניסה את הצעד והתוצאה לא אושרה.',
  aborted_after_failure: 'לא הורץ: צעד קודם נכשל, ו-WisKey עוצר את שאר הצעדים.',
  awaiting_witness: 'WisKey אישר את שליחת הפקודה; ממתין לאישור העד.',
  witness_opened: 'העד אישר שהדלת נפתחה.',
  offline: 'העמדה מנותקת.',
};
const STATIONS = [
  { id: 'st-lobby', name: 'לובי ראשי', online: true, doors: [{ door: 1, name: 'כניסה' }, { door: 2, name: 'מחסום' }], can_pulse: true },
  { id: 'st-garage', name: 'חניון', online: true, doors: [], can_pulse: false },
  { id: 'st-roof', name: 'גג', online: false, doors: [{ door: 1, name: null }], can_pulse: true },
];

function check(key: string, status: string, reason: string | null = null, detail: Body = {}): Body {
  return { check: key, label: CHECKS.find((c) => c[0] === key)?.[1] ?? key, status, status_text: STATUS_TEXT[status], reason, reason_text: reason ? REASONS[reason] ?? reason : null,
    detail, started_at: '2026-09-27T10:29:00Z', finished_at: status === 'pending' || status === 'running' ? null : '2026-09-27T10:29:30Z' };
}

/** The final result per station (each kind of result at least once). */
const FINAL: Record<string, Body[]> = {
  'st-lobby': [check('identity', 'pass'), check('door_capabilities', 'pass', null, { doors: [{ door: 1, result: 'pass' }, { door: 2, result: 'pass' }] }),
    check('door_read', 'pass', null, { doors: [{ door: 1, result: 'pass' }, { door: 2, result: 'pass' }] }), check('media_arx', 'pass', null, { source: 'arx', bytes: 48211 }),
    check('media_wiskey', 'unsupported', 'not_listed'), check('talk', 'fail', 'provider_local'), check('events', 'pass', null, { stream: 'connected', source: 'wiskey' }),
    check('clock', 'pass', null, { skew_seconds: 0.4, source: 'wiskey' })],
  'st-garage': CHECKS.slice(0, 3).map(([k]) => check(k, 'not_run', 'relay_map_missing')).concat([check('media_arx', 'pass', null, { source: 'arx', bytes: 39017 }),
    check('media_wiskey', 'unsupported', 'not_listed'), check('talk', 'fail', 'provider_local'), check('events', 'pass', null, { stream: 'connected', source: 'feed' }),
    check('clock', 'fail', 'skew_over_tolerance', { skew_seconds: 7.2, source: 'feed' })]),
  'st-roof': [check('identity', 'pass'), check('door_capabilities', 'fail', 'step_failed', { doors: [{ door: 1, result: 'fail', reason: 'step_failed' }] }),
    check('door_read', 'not_run', 'aborted_after_failure', { doors: [{ door: 1, result: 'not_run', reason: 'aborted_after_failure' }] }), ...CHECKS.slice(3).map(([k]) => check(k, 'fail', 'offline'))],
};

const counts = (cs: Body[]) => Object.fromEntries(Object.keys(STATUS_TEXT).map((s) => [s, cs.filter((c) => c.status === s).length]));

interface World {
  runs: Map<string, { scope: 'one' | 'all'; ids: string[]; polls: number; pulses: Body[] }>;
  calls: Array<{ method: string; path: string; body: unknown }>;
  persona: 'admin' | 'forbidden';
  /** polls a run answers `running` before it is done */
  runningPolls: number;
}

function runBody(id: string, w: World): Body {
  const r = w.runs.get(id)!;
  const done = r.polls > w.runningPolls;
  const stations = r.ids.map((sid, i) => {
    const final = FINAL[sid];
    const cs = done ? final : final.map((c, j) => (i === 0 && j < 3 ? c : check(String(c.check), i === 0 && j === 3 ? 'running' : 'pending')));
    return { station_id: sid, name: STATIONS.find((s) => s.id === sid)!.name, checks: cs, counts: counts(cs), progress: { done: cs.filter((c) => !['pending', 'running'].includes(String(c.status))).length, total: 8 } };
  });
  const all = stations.flatMap((s) => s.checks as Body[]);
  return { id, kind: 'checks', scope: r.scope, parent_run_id: null, state: done ? 'done' : 'running', created_by: 'u-admin', created_by_name: 'מנהל מערכת',
    created_at: '2026-09-27T10:29:00Z', finished_at: done ? '2026-09-27T10:29:40Z' : null, cancel_requested: false, station_count: r.ids.length, stations, counts: counts(all),
    progress: { done: all.filter((c) => !['pending', 'running'].includes(String(c.status))).length, total: all.length }, pulses: r.pulses };
}

async function boot(page: Page, opts: Partial<Pick<World, 'persona' | 'runningPolls'>> & { preRun?: boolean; hash?: string } = {}): Promise<World> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const w: World = { runs: new Map(), calls: [], persona: opts.persona ?? 'admin', runningPolls: opts.runningPolls ?? 1 };
  if (opts.preRun) w.runs.set('lv_' + 'a'.repeat(32), { scope: 'all', ids: STATIONS.map((s) => s.id), polls: 99, pulses: [] });
  await installAccessMock(page, { persona: 'admin' });
  // the system administrator of the installation: access.stations.manage + access.doors.open are installation permissions
  await page.route('**/api/v1/me', (route: Route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      user: { id: 'u-admin', username: 'admin', display_name: 'מנהל מערכת', source: 'ingress' }, channel: 'local', remote: null, bindings: [], has_access: true, permission_revision: 1, bootstrap_state: 'done',
      permissions_installation: ['access.read', 'access.stations.read', 'access.admin.read', 'access.stations.manage', 'access.doors.open', 'system.configure'],
      permissions_any: ['access.read', 'access.stations.read', 'access.admin.read', 'access.stations.manage', 'access.doors.open', 'system.configure'] }) }));
  await page.route('**/api/v1/wiskey-validation**', async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const body = req.method() === 'GET' ? null : req.postDataJSON();
    w.calls.push({ method: req.method(), path: p, body });
    const json = (status: number, b: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (w.persona === 'forbidden') return json(403, { code: 'forbidden', user_message: 'אין הרשאה לפעולה זו בהיקף המבוקש.', retryable: false, correlation_id: 'mock', details: {} });
    if (p === 'wiskey-validation') {
      const runs = [...w.runs.entries()].reverse().map(([id]) => {
        const b = runBody(id, { ...w, runningPolls: -1 });
        return { id, scope: b.scope, state: w.runs.get(id)!.polls > w.runningPolls ? 'done' : 'running', created_by_name: 'מנהל מערכת', created_at: b.created_at, finished_at: b.finished_at, station_count: b.station_count, counts: b.counts };
      });
      const active = [...w.runs.entries()].find(([, r]) => r.polls <= w.runningPolls)?.[0] ?? null;
      return json(200, { feed_state: 'ready', stations: STATIONS, checks: CHECKS.map(([key, label]) => ({ key, label })), runs, active_run_id: active, rights: { run: true, pulse: true, pulse_local: true } });
    }
    if (p === 'wiskey-validation/runs' && req.method() === 'POST') {
      const b = body as { station_id?: string; all?: boolean };
      const id = 'lv_' + String(w.runs.size + 1).padStart(32, '0');
      w.runs.set(id, { scope: b.all ? 'all' : 'one', ids: b.all ? STATIONS.map((s) => s.id) : [String(b.station_id)], polls: 0, pulses: [] });
      return json(202, { run_id: id });
    }
    const m = /^wiskey-validation\/runs\/(lv_[0-9a-f]{32})(\/export\.csv|\/cancel)?$/.exec(p);
    if (m && w.runs.has(m[1])) {
      if (m[2] === '/export.csv') return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: '﻿ריצה,עמדה\r\n' });
      if (m[2] === '/cancel') return json(200, { run_id: m[1], cancel_requested: true });
      w.runs.get(m[1])!.polls += 1;
      return json(200, runBody(m[1], w));
    }
    if (p === 'wiskey-validation/pulse') {
      const b = body as { station_id: string; door: number; witness_name: string; parent_run_id: string };
      const pulse = check('pulse', 'pending', 'awaiting_witness', { door: b.door, witness_name: b.witness_name, wiskey: 'acknowledged' });
      const pid = 'lv_' + 'b'.repeat(32);
      const run = w.runs.get(b.parent_run_id);
      run?.pulses.push({ id: pid, kind: 'pulse', scope: 'one', parent_run_id: b.parent_run_id, state: 'done', stations: [{ station_id: b.station_id, name: 'לובי ראשי', checks: [pulse], counts: counts([pulse]), progress: { done: 0, total: 1 } }], pulses: [] });
      return json(200, { run_id: pid, result: pulse });
    }
    const wm = /^wiskey-validation\/pulse\/(lv_[0-9a-f]{32})\/witness$/.exec(p);
    if (wm) {
      for (const r of w.runs.values()) for (const pr of r.pulses as Array<{ id: string; stations: Array<{ checks: Body[] }> }>) {
        if (pr.id === wm[1]) pr.stations[0].checks[0] = check('pulse', 'pass', 'witness_opened', { ...(pr.stations[0].checks[0].detail as Body), witness: 'opened' });
      }
      return json(200, { run_id: wm[1], status: 'pass', reason: 'witness_opened' });
    }
    return json(404, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} });
  });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url(opts.hash ?? HOME));
  await page.waitForSelector('sw-app');
  return w;
}

const noBaseline = (info: TestInfo, name: string) => !['all', 'changed', 'missing'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: TestInfo, name: string) {
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (process.env.SW_SHOTS) {
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  }
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

/** The dialog's own box only: the page behind the scrim (its scroll position after the tap that opened it) is not part of the case. */
async function compareBox(page: Page, info: TestInfo, name: string) {
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  const box = page.locator(`${PAGE} sw-dialog[data-lv-pulse-dialog][open] .box`);
  if (process.env.SW_SHOTS) {
    fs.mkdirSync(OUT, { recursive: true });
    await box.screenshot({ path: path.join(OUT, file) });
  }
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(box).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

const stationCard = (page: Page, sid: string) => page.locator(`${PAGE} [data-lv-station="${sid}"]`);
const checkRow = (page: Page, sid: string, key: string) => page.locator(`${PAGE} [data-lv-station="${sid}"] [data-lv-check="${key}"]`);

test.describe('WISKEY-LIVE-VALIDATION-2390: the station acceptance tool', () => {
  test.beforeEach(({}, info) => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
  });

  test('one station: progress while it runs, then every check with its result and reason', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const w = await boot(page, { runningPolls: 2 });
    await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${PAGE} [data-lv-no-runs]`)).toBeVisible();
    expect(w.calls.filter((c) => c.method === 'POST'), 'nothing runs by itself').toEqual([]);
    await page.locator(`${PAGE} [data-lv-run-one="st-lobby"]`).click();
    await expect(page.locator(`${PAGE} [data-lv-progress="running"]`)).toBeVisible();
    await expect(page.locator(`${PAGE} [data-lv-run-all]`)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${PAGE} [data-lv-progress="done"]`)).toBeVisible({ timeout: 15_000 });
    for (const [key] of CHECKS) await expect(checkRow(page, 'st-lobby', key)).toHaveAttribute('data-status', String(FINAL['st-lobby'].find((c) => c.check === key)!.status));
    await expect(checkRow(page, 'st-lobby', 'media_wiskey')).toContainText('לא נתמך ב-WisKey');
    await expect(checkRow(page, 'st-lobby', 'talk')).toContainText(REASONS.provider_local);
    await expect(stationCard(page, 'st-garage').locator('[data-lv-not-checked]')).toBeVisible();
    expect(w.calls.filter((c) => c.method === 'POST')).toEqual([{ method: 'POST', path: 'wiskey-validation/runs', body: { station_id: 'st-lobby' } }]);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    await expect(page.locator(PAGE)).not.toContainText('Home Assistant');
    await expect(page.locator(PAGE)).not.toContainText('undefined');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, 'no sideways scroll').toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('run all never sends a pulse; the CSV export asks the server', async ({ page }) => {
    const w = await boot(page, { runningPolls: 0 });
    await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
    await page.locator(`${PAGE} [data-lv-run-all]`).click();
    await expect(page.locator(`${PAGE} [data-lv-progress="done"]`)).toBeVisible({ timeout: 15_000 });
    await expect(checkRow(page, 'st-roof', 'door_read')).toContainText(REASONS.aborted_after_failure);
    await expect(checkRow(page, 'st-garage', 'identity')).toHaveAttribute('data-status', 'not_run');
    await page.locator(`${PAGE} [data-lv-export]`).click();
    await expect.poll(() => w.calls.some((c) => c.path.endsWith('/export.csv'))).toBe(true);
    expect(w.calls.filter((c) => c.path.includes('pulse'))).toEqual([]);
    expect(w.calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([{ all: true }]);
  });

  test('the pulse is physical: marked, confirmed by typing the station name, with a witness, then the witness verdict', async ({ page }) => {
    const w = await boot(page, { preRun: true });
    await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${PAGE} [data-lv-pulse-open]`)).toHaveCount(2);
    await expect(stationCard(page, 'st-garage').locator('[data-lv-pulse-off]')).toBeVisible();
    await page.locator(`${PAGE} [data-lv-pulse-open="st-lobby"]`).click();
    const dlg = page.locator(`${PAGE} sw-dialog[data-lv-pulse-dialog][open]`);
    await expect(dlg.locator('[data-lv-physical]')).toBeVisible(); // the host is a zero-size wrapper of a fixed backdrop
    await expect(dlg).toHaveAttribute('heading', 'פעולה פיזית - דלת תיפתח');
    await expect(dlg.locator('[data-lv-physical]')).toContainText('הדלת תיפתח באמת');
    const send = dlg.locator('[data-lv-pulse-send]');
    await expect(send).toHaveAttribute('disabled', '');
    await dlg.locator('[data-lv-door]').selectOption('2');
    await dlg.locator('[data-lv-witness-name]').fill('דנה כהן');
    await dlg.locator('[data-lv-confirm]').fill('לובי');
    await expect(send).toHaveAttribute('disabled', '');
    await dlg.locator('[data-lv-confirm]').fill('לובי ראשי');
    await expect(send).not.toHaveAttribute('disabled', '');
    expect(w.calls.filter((c) => c.path === 'wiskey-validation/pulse'), 'nothing is sent before the click').toEqual([]);
    await send.click();
    await expect(page.locator(`${PAGE} sw-dialog[data-lv-pulse-dialog][open]`)).toHaveCount(0);
    const pulses = w.calls.filter((c) => c.path === 'wiskey-validation/pulse');
    expect(pulses.map((c) => c.body)).toEqual([{ station_id: 'st-lobby', door: 2, confirm_text: 'לובי ראשי', witness_name: 'דנה כהן', parent_run_id: 'lv_' + 'a'.repeat(32) }]);
    const result = stationCard(page, 'st-lobby').locator('[data-lv-pulse-result]');
    await expect(result).toHaveAttribute('data-lv-pulse-result', 'pending');
    await expect(result).toContainText(REASONS.awaiting_witness);
    await result.locator('[data-lv-verdict="opened"]').click();
    await expect(result).toHaveAttribute('data-lv-pulse-result', 'pass');
    await expect(result).toContainText('עד: דנה כהן');
    await expect(page.locator(`${PAGE} [data-lv-pulse-open="st-lobby"]`)).toHaveCount(0);
  });

  test('without the right: the forbidden state', async ({ page }) => {
    await boot(page, { persona: 'forbidden' });
    await expect(page.locator(`${PAGE} [data-lv-state="forbidden"]`)).toBeVisible({ timeout: 30_000 });
  });

  test('the settings card next to the WisKey status leads here', async ({ page }) => {
    await boot(page, { hash: '/system/diagnostics?tab=access-control' });
    const link = page.locator('sw-app system-diagnostics system-wiskey-validation-card [data-lv-card-link]');
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toHaveAttribute('href', '#/system/wiskey-validation');
  });

  test('classic is pixel-stable: the acceptance page after a run of all stations', async ({ page }, info) => {
    await boot(page, { preRun: true });
    await expect(page.locator(`${PAGE} [data-lv-progress="done"]`)).toBeVisible({ timeout: 30_000 });
    await compare(page, info, 'lv-run-all');
  });

  test('classic is pixel-stable: the physical pulse dialog', async ({ page }, info) => {
    await boot(page, { preRun: true });
    await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
    await page.locator(`${PAGE} [data-lv-pulse-open="st-lobby"]`).click();
    const dlg = page.locator(`${PAGE} sw-dialog[data-lv-pulse-dialog][open]`);
    await dlg.locator('[data-lv-witness-name]').fill('דנה כהן');
    await expect(dlg.locator('[data-lv-physical]')).toBeVisible();
    // a still picture: no hover under the pointer that opened the dialog, and the focus on ONE known field (a bare blur hands the
    // focus to the dialog's focus trap, which picks its target by timing)
    await page.mouse.move(0, 0);
    await dlg.locator('[data-lv-confirm]').focus();
    await compareBox(page, info, 'lv-pulse-dialog-box');
  });

  test('classic is pixel-stable: the page before any run', async ({ page }, info) => {
    await boot(page);
    await expect(page.locator(`${PAGE} [data-lv-no-runs]`)).toBeVisible({ timeout: 30_000 });
    await compare(page, info, 'lv-empty');
  });
});
