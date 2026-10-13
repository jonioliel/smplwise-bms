import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AcPerson } from '../src/api/access-people';
import type { IntercomEditorPerson } from '../src/api/intercom';
import {
  CONFIRMED,
  DAYS,
  PHOTO_MAX_BYTES,
  PHOTO_PREFIX,
  WEEK_ORDER,
  categoryProblem,
  dataUrlBytes,
  deleteSettled,
  failureOf,
  fitSize,
  personActions,
  photoFits,
  stateOfReply,
  timingFormOf,
  timingPatch,
  timingProblem,
  timingSchedule,
  validCardNumber,
  type TimingForm,
} from '../src/access-control/people-writes-logic';
import { WRITES_KEYS, wt } from '../src/i18n/access-writes';

// CR-036 S11: the pure logic of the person writes (access-control/people-writes-logic.ts) and their strings. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-people-writes-logic.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const person = (o: Partial<AcPerson> = {}): AcPerson => ({
  id: 'p1', display_name: 'דנה', active: true, archived: false, valid_from: null, valid_until: null, revision: 3, access_category: 'staff', user_type: 'normal',
  identity_locked: false, employee_no: '1001', group_ids: [], stations: [], timing: null, level: 'sensitive', editable: true, phone: null, phone_set: true,
  credentials: { pin: true, cards: 1 }, photo_configured: true, profile: null, responsible_person: null, access_purpose: null, ...o,
});

// ---------------------------------------------------------------- the actions a person's page offers

test('the actions follow the server: nothing without manage or on a person the caller may not change', () => {
  expect(personActions(person(), { manage: false }, { photoEnabled: true })).toEqual([]);
  expect(personActions(person({ editable: false }), { manage: true }, { photoEnabled: true })).toEqual([]);
  expect(personActions(null, { manage: true }, { photoEnabled: true })).toEqual([]);
  expect(personActions(person(), { manage: true }, { photoEnabled: true })).toEqual(['edit', 'deactivate', 'cards', 'photo', 'archive', 'delete']);
});

test('the actions follow the person: switched off, archived, a visitor, the names level, no photo switch', () => {
  expect(personActions(person({ active: false }), { manage: true }, { photoEnabled: true })).toContain('activate');
  const archived = personActions(person({ archived: true, active: false }), { manage: true }, { photoEnabled: true });
  expect(archived).toContain('restore');
  expect(archived).not.toContain('archive');
  expect(archived).not.toContain('activate'); // an archived person is restored first (WisKey: user_archived)
  expect(personActions(person({ access_category: 'contractor' }), { manage: true }, { photoEnabled: true })).toContain('temporary_cancel');
  expect(personActions(person({ access_category: 'visitor', active: false }), { manage: true }, { photoEnabled: true })).not.toContain('temporary_cancel');
  const names = personActions(person({ level: 'names' }), { manage: true }, { photoEnabled: true });
  expect(names).not.toContain('cards');
  expect(names).not.toContain('photo');
  expect(personActions(person(), { manage: true }, { photoEnabled: false })).not.toContain('photo');
  for (const a of ['deactivate', 'activate', 'temporary_cancel', 'archive', 'restore', 'delete'] as const) expect(CONFIRMED.has(a), a).toBe(true);
  expect(CONFIRMED.has('cards')).toBe(false);
});

// ---------------------------------------------------------------- how an answer reads

test('a success is saved only when the server says so; an unknown effect is pending', () => {
  expect(stateOfReply({ pending: false, effect: 'sync' })).toBe('saved');
  expect(stateOfReply({ pending: true, effect: 'unknown_effect' })).toBe('pending');
  expect(stateOfReply({ pending: false, effect: 'unknown_effect' })).toBe('pending');
  expect(stateOfReply({})).toBe('pending'); // an answer that does not say: the safe side, never "done"
  expect(stateOfReply(null)).toBe('pending');
});

test('a failure: not sent / refused only when the server says so, everything else unknown and never retried', () => {
  expect(failureOf({ status: 403, code: 'intercom_person_scope', outcome: 'not_sent' })).toEqual({ state: 'not_sent', reason: 'err.scope' });
  expect(failureOf({ status: 403, code: 'forbidden', outcome: null })).toEqual({ state: 'not_sent', reason: 'err.forbidden' });
  expect(failureOf({ status: 409, code: 'intercom_archive_state_changed', outcome: 'refused' })).toEqual({ state: 'refused', reason: 'err.archive_state' });
  expect(failureOf({ status: 409, code: 'intercom_card_conflict', outcome: 'refused' }).reason).toBe('err.card_conflict');
  expect(failureOf({ status: 409, code: 'intercom_photo_disabled', outcome: 'refused' })).toEqual({ state: 'refused', reason: 'err.photo_disabled' });
  expect(failureOf({ status: 504, code: 'intercom_outcome_unknown', outcome: 'unknown' }).state).toBe('unknown');
  expect(failureOf({ status: 502, code: 'http_502', outcome: null }).state).toBe('unknown'); // a proxy's bare 502
  expect(failureOf({ status: null, code: null, outcome: null }).state).toBe('unknown'); // the connection dropped
  expect(failureOf({ status: 409, code: 'some_new_code', outcome: 'refused' }).reason).toBe('err.generic');
});

test('a delete is confirmed only by the read model: the person page answers 404', () => {
  expect(deleteSettled(404)).toBe('confirmed');
  for (const s of [200, 403, 503, 0]) expect(deleteSettled(s), String(s)).toBe('pending');
});

// ---------------------------------------------------------------- cards and the photo

test('a card number is WisKey identifier text', () => {
  for (const ok of ['A1', 'QX7731ZK', '1234-5678', 'a_b', ' 99 ']) expect(validCardNumber(ok), ok).toBe(true);
  for (const bad of ['', 'two words', 'קלף', 'x'.repeat(33), 'a/b']) expect(validCardNumber(bad), bad).toBe(false);
});

test('the photo budget: within 512 x 512, never enlarged, the aspect kept; a JPEG data URL within 32 KB', () => {
  expect(fitSize(1024, 768)).toEqual({ width: 512, height: 384 });
  expect(fitSize(300, 2000)).toEqual({ width: 77, height: 512 });
  expect(fitSize(100, 80)).toEqual({ width: 100, height: 80 });
  expect(fitSize(0, 10)).toEqual({ width: 1, height: 1 });
  const small = PHOTO_PREFIX + 'A'.repeat(400);
  expect(dataUrlBytes(small)).toBe(300);
  expect(dataUrlBytes(PHOTO_PREFIX + 'AAA=')).toBe(2);
  expect(photoFits(small)).toBe(true);
  expect(photoFits('data:image/png;base64,AAAA')).toBe(false);
  expect(photoFits(PHOTO_PREFIX + 'A'.repeat(Math.ceil((PHOTO_MAX_BYTES + 3) / 3) * 4))).toBe(false);
});

// ---------------------------------------------------------------- the timing form

const ZONE = 'Asia/Jerusalem';
const weekly = (o: Partial<TimingForm> = {}): TimingForm => ({ mode: 'weekly', enforce: 'draft', timezone: ZONE, days: ['Sunday', 'Thursday'], dates: [], periods: [{ start: '08:00', end: '12:00' }], ...o });

test('the form opens with the enforced policy, else the proposal, else "always"', () => {
  expect(timingFormOf(null, ZONE).mode).toBe('none');
  const schedule = { mode: 'weekly' as const, timezone: 'UTC', days: ['Monday'], dates: [], periods: [{ start: '09:00', end: '10:00' }] };
  expect(timingFormOf({ timing_draft: schedule, timing_policy: null }, ZONE)).toMatchObject({ mode: 'weekly', enforce: 'draft', timezone: 'UTC', days: ['Monday'] });
  expect(timingFormOf({ timing_draft: null, timing_policy: { mode: 'ha', schedule, bindings: {} } }, ZONE).enforce).toBe('ha');
  expect(timingFormOf({ timing_draft: null, timing_policy: { mode: 'native', schedule, bindings: { s1: { template: 1, weekly: 2, holiday_group: null, holidays: [] } } } }, ZONE).enforce).toBe('native');
});

test('the form is checked as WisKey checks it', () => {
  expect(timingProblem(weekly())).toBeNull();
  expect(timingProblem(weekly({ days: [] }))).toBe('timing.err.days');
  expect(timingProblem(weekly({ days: ['Funday'] }))).toBe('timing.err.days');
  expect(timingProblem(weekly({ periods: [] }))).toBe('timing.err.periods');
  expect(timingProblem(weekly({ periods: Array.from({ length: 9 }, () => ({ start: '08:00', end: '09:00' })) }))).toBe('timing.err.periods');
  expect(timingProblem(weekly({ periods: [{ start: '10:00', end: '09:00' }] }))).toBe('timing.err.order');
  expect(timingProblem(weekly({ periods: [{ start: '08:00', end: '12:00' }, { start: '11:00', end: '13:00' }] }))).toBe('timing.err.overlap');
  expect(timingProblem(weekly({ periods: [{ start: '08:00', end: '24:00' }] }))).toBeNull();
  expect(timingProblem(weekly({ periods: [{ start: '24:00', end: '24:00' }] }))).toBe('timing.err.order');
  expect(timingProblem(weekly({ timezone: 'Mars/Base' }), (z) => z !== 'Mars/Base')).toBe('timing.err.zone');
  const dates = weekly({ mode: 'dates', days: [], dates: ['2026-12-01'] });
  expect(timingProblem(dates)).toBeNull();
  expect(timingProblem({ ...dates, dates: [] })).toBe('timing.err.dates');
  expect(timingProblem({ ...dates, dates: ['2026-02-30'] })).toBe('timing.err.dates');
  expect(timingProblem({ ...dates, dates: ['2099-01-01'] })).toBe('timing.err.dates');
  expect(timingProblem(weekly({ mode: 'none', days: [] }))).toBeNull();
  expect(timingProblem(weekly({ enforce: 'native', days: [] }))).toBeNull(); // the device's enforcement is shown, not edited
});

test("WisKey's normal form: the days Monday first, the dates sorted and unique, the windows by start", () => {
  const s = timingSchedule(weekly({ days: ['Sunday', 'Monday', 'Thursday'], periods: [{ start: '13:00', end: '17:00' }, { start: '08:00', end: '12:00' }] }));
  expect(s).toEqual({ mode: 'weekly', timezone: ZONE, days: ['Monday', 'Thursday', 'Sunday'], dates: [], periods: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }] });
  expect(timingSchedule(weekly({ mode: 'dates', days: [], dates: ['2026-12-05', '2026-12-01', '2026-12-05'] }))?.dates).toEqual(['2026-12-01', '2026-12-05']);
  expect(timingSchedule(weekly({ mode: 'none' }))).toBeNull();
  expect([...DAYS]).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  expect(WEEK_ORDER[0]).toBe('Sunday');
});

test('the timing patch: nothing when unchanged, one of the proposal or the policy otherwise, the device enforcement untouched', () => {
  const original: Pick<IntercomEditorPerson, 'timing_draft' | 'timing_policy'> = { timing_draft: timingSchedule(weekly()), timing_policy: null };
  expect(timingPatch(timingFormOf(original, ZONE), original, ZONE)).toEqual({});
  expect(timingPatch(weekly({ enforce: 'ha' }), original, ZONE)).toEqual({ access_timing_draft: null, access_timing_policy: { mode: 'ha', schedule: timingSchedule(weekly()), bindings: {} } });
  expect(timingPatch(weekly({ days: ['Monday'] }), original, ZONE)).toEqual({ access_timing_draft: timingSchedule(weekly({ days: ['Monday'] })), access_timing_policy: null });
  expect(timingPatch(weekly({ mode: 'none' }), original, ZONE)).toEqual({ access_timing_draft: null, access_timing_policy: null });
  expect(timingPatch(weekly({ mode: 'none' }), { timing_draft: null, timing_policy: null }, ZONE)).toEqual({});
  expect(timingPatch(weekly({ enforce: 'native' }), original, ZONE)).toEqual({});
});

test('a visitor or a contractor needs a responsible person and an end date', () => {
  expect(categoryProblem('staff', '', false)).toBeNull();
  expect(categoryProblem('visitor', 'רינה', true)).toBeNull();
  expect(categoryProblem('visitor', ' ', true)).toBe('err.guest');
  expect(categoryProblem('contractor', 'רינה', false)).toBe('err.guest');
});

// ---------------------------------------------------------------- the strings

const FILES = ['screens/wiskey-person-actions.ts', 'screens/wiskey-person-editor.ts', 'screens/wiskey-person-drawer.ts', 'screens/wiskey-people.ts', 'access-control/people-writes-logic.ts'];

test('every key the writes ask for exists, and every key is used', () => {
  const known = new Set<string>(WRITES_KEYS);
  const used = new Set<string>();
  const missing: string[] = [];
  for (const f of FILES) {
    const text = readFileSync(path.join(SRC, f), 'utf8');
    for (const m of text.matchAll(/\bwt\('([^']+)'/g)) if (!known.has(m[1])) missing.push(`${f}: ${m[1]}`);
    // a key is used when it is written as a literal anywhere (a wt() call, a ternary, a table of keys, a returned problem)
    for (const m of text.matchAll(/'([a-z_]+(?:\.[A-Za-z_]+)+)'/g)) if (known.has(m[1])) used.add(m[1]);
  }
  // the keys built from a template: `reason.${r}`, `day.${d}`, `cat.${c}`
  const built = [
    ...['visit_completed', 'visit_cancelled', 'access_no_longer_needed'].map((r) => `reason.${r}`),
    ...DAYS.map((d) => `day.${d}`),
    ...['staff', 'visitor', 'contractor'].map((c) => `cat.${c}`),
  ];
  for (const k of built) {
    if (!known.has(k)) missing.push(`template: ${k}`);
    used.add(k);
  }
  expect(missing).toEqual([]);
  expect(WRITES_KEYS.filter((k) => !used.has(k))).toEqual([]);
});

test('no string names the platform, an internal code or a permission id; placeholders are filled', () => {
  const bad: string[] = [];
  for (const key of WRITES_KEYS) {
    const text = wt(key);
    if (/WisKey|Home Assistant|Ingress|hikvision|\bHA\b/i.test(text)) bad.push(`${key}: platform name`);
    if (/\bCR-\d+|\bS\d+\b|access\.[a-z]+/.test(text)) bad.push(`${key}: internal code`);
  }
  expect(bad).toEqual([]);
  expect(wt('confirm.archive', { name: 'דנה' })).toBe('להעביר את דנה לארכיון? הגישה תושבת.');
  expect(wt('res.not_sent', { reason: wt('err.scope') })).toBe('לא נשלח · האדם משויך גם לעמדה שאינה בניהולך');
  expect(wt('res.pending')).toBe('נשלח · ממתין לאישור');
});

test('the screens the writes touch type no platform word next to their Hebrew copy', () => {
  const bad: string[] = [];
  const files = ['screens/wiskey-person-actions.ts', 'screens/wiskey-person-editor.ts', 'screens/wiskey-card-capture.ts', 'screens/wiskey-person-drawer.ts', 'screens/wiskey-people.ts'];
  for (const f of files) {
    const code = readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    code.split('\n').forEach((line, i) => {
      if (/[א-ת]/.test(line) && /WisKey|Home Assistant|Ingress|\bHA\b/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(bad).toEqual([]);
});
