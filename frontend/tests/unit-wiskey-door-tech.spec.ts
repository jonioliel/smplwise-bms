import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import {
  WEEK,
  codeBody,
  codeFormProblem,
  emptyBody,
  normalized,
  outcomeOf,
  phraseFor,
  policyProblems,
  reasonText,
  runWrite,
  statusText,
  statusTone,
  toBody,
  weekLines,
  type DoorTechReply,
  type PolicyBody,
} from '../src/api/door-tech';
import { enDoorTechText, heDoorTechText } from '../src/i18n/wiskey-door-tech';

// WISKEY-DOOR-TECH-2390: the pure logic and the words of the door technical writes (hold-open schedules, public codes, programs): how an
// answer is read (acknowledged / partial / WisKey's refusal with its reason / not sent / unknown - never "done" without the server saying
// so), the schedule editor's model and its checks (the server's rules), the code form's checks and body (a value is never echoed, the
// current code only when the slot is set), and the Hebrew / English strings. Runs in Node (no page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-door-tech.spec.ts

const he = heDoorTechText;
const err = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message: 'x', retryable: false, correlation_id: 'c', details });
const body = (over: Partial<PolicyBody> = {}): PolicyBody => ({ ...emptyBody('Asia/Jerusalem', 'Lobby'), ...over });

test('an answer is read honestly: refused is WisKey with its reason, a 4xx before sending is not sent, a 504 / network is unknown', () => {
  expect(outcomeOf(err(409, 'door_tech_refused', { outcome: 'refused', wiskey_code: 'revision_conflict' }), 'hold_save')).toMatchObject({ status: 'refused', code: 'revision_conflict' });
  expect(outcomeOf(err(409, 'confirmation_required', { outcome: 'not_sent' }), 'hold_save')).toMatchObject({ status: 'not_sent', code: 'confirmation_required' });
  expect(outcomeOf(err(403, 'forbidden', { outcome: 'not_sent', reason: 'explicit_deny' }), 'code_write')).toMatchObject({ status: 'not_sent', code: 'explicit_deny' });
  expect(outcomeOf(err(429, 'door_tech_cooldown', { outcome: 'not_sent', retry_after_s: 2.5 }), 'program_save')).toMatchObject({ status: 'not_sent', retry_after_s: 2.5 });
  expect(outcomeOf(err(504, 'door_tech_outcome_unknown', { outcome: 'unknown', wiskey_code: 'timeout' }), 'program_action')).toMatchObject({ status: 'unknown', code: 'timeout' });
  expect(outcomeOf(err(500, 'internal'), 'hold_delete').status).toBe('unknown');
  expect(outcomeOf(new TypeError('fetch failed'), 'hold_delete')).toMatchObject({ status: 'unknown', code: 'network' });
});

test('runWrite: the server success is the status (acknowledged / partial), a failure is read once and never retried', async () => {
  let calls = 0;
  const ok = await runWrite('hold_save', async () => {
    calls++;
    return { station_id: 's', kind: 'hold_save', status: 'acknowledged', partial: null, command_id: 'c', at: null, data: { active: false } } as DoorTechReply;
  });
  expect(ok).toMatchObject({ status: 'acknowledged', code: null, data: { active: false } });
  const partial = await runWrite('program_save', async () => ({ station_id: 's', kind: 'program_save', status: 'partial', partial: 'program_saved_draft_cleanup_unknown', command_id: 'c', at: null, data: {} }) as DoorTechReply);
  expect(partial).toMatchObject({ status: 'partial', code: 'program_saved_draft_cleanup_unknown' });
  const failed = await runWrite('hold_save', async () => {
    calls++;
    throw err(504, 'door_tech_outcome_unknown', { outcome: 'unknown' });
  });
  expect(failed.status).toBe('unknown');
  expect(calls).toBe(2);
});

test('the result line: done, partly done, "WisKey סירב: <reason>", not sent with the reason, no clear answer', () => {
  expect(statusText({ status: 'acknowledged', code: null }, he)).toBe('בוצע ואושר');
  expect(statusText({ status: 'partial', code: 'program_saved_draft_cleanup_unknown' }, he)).toContain('בוצע חלקית');
  expect(statusText({ status: 'refused', code: 'revision_conflict' }, he)).toBe('WisKey סירב: הנתונים השתנו מאז שנטענו');
  expect(statusText({ status: 'refused', code: 'some_new_code' }, he)).toBe('WisKey סירב: some_new_code');
  expect(statusText({ status: 'refused', code: null }, he)).toBe('WisKey סירב: סיבה לא ידועה');
  expect(statusText({ status: 'refused', code: 'reauth_required' }, enDoorTechText)).toBe('WisKey refused: a fresh sign-in is required for sensitive actions');
  expect(statusText({ status: 'not_sent', code: 'door_tech_cooldown' }, he)).toBe('לא נשלח: נשלח לפני רגע');
  expect(statusText({ status: 'unknown', code: 'timeout' }, he)).toContain('ייתכן שבוצע');
  expect(statusText({ status: 'unknown', code: 'network' }, he)).toBe(he.status.unknown);
  expect(reasonText('schedule_overlap', he)).toBe(he.reasons.schedule_invalid);
  expect([statusTone('acknowledged'), statusTone('refused'), statusTone('not_sent'), statusTone('unknown'), statusTone('partial'), statusTone('sending')]).toEqual(['ok', 'err', 'err', 'warn', 'warn', 'busy']);
});

test('the editor model: a served policy becomes a full week, nothing invented; normalized sorts and trims', () => {
  const b = toBody({ timezone: null, name: 'Morning', weekly: { Monday: [{ start: '07:00', end: '19:00' }], Friday: [{ start: '', end: '12:00' }] }, holidays: [{ name: null, start: '2026-12-25', end: null, periods: [] }] }, 'Asia/Jerusalem');
  expect(b.timezone).toBe('Asia/Jerusalem');
  expect(Object.keys(b.weekly).sort()).toEqual([...WEEK].sort());
  expect(b.weekly.Monday).toEqual([{ start: '07:00', end: '19:00' }]);
  expect(b.weekly.Friday).toEqual([]);
  expect(b.holidays).toEqual([]);
  const n = normalized(body({ name: '  Lobby  ', weekly: { ...emptyBody('x').weekly, Sunday: [{ start: '20:00', end: '24:00' }, { start: '06:00', end: '08:00' }] } }));
  expect(n.name).toBe('Lobby');
  expect(n.weekly.Sunday.map((p) => p.start)).toEqual(['06:00', '20:00']);
  expect(weekLines(n, he)).toEqual(['א׳ 06:00–08:00, 20:00–24:00']);
});

test('the editor checks the server rules: name, times, order, overlap, eight periods, dates', () => {
  expect(policyProblems(body())).toEqual([]);
  expect(policyProblems(body({ name: ' ' }))).toEqual([{ field: 'name', key: 'name' }]);
  const week = emptyBody('x').weekly;
  expect(policyProblems(body({ weekly: { ...week, Monday: [{ start: '7:00', end: '19:00' }] } }))).toEqual([{ field: 'weekly.Monday.0', key: 'time' }]);
  expect(policyProblems(body({ weekly: { ...week, Monday: [{ start: '19:00', end: '07:00' }] } }))).toEqual([{ field: 'weekly.Monday.0', key: 'order' }]);
  expect(policyProblems(body({ weekly: { ...week, Monday: [{ start: '07:00', end: '12:00' }, { start: '11:00', end: '13:00' }] } }))).toEqual([{ field: 'weekly.Monday', key: 'overlap' }]);
  expect(policyProblems(body({ weekly: { ...week, Monday: [{ start: '07:00', end: '12:00' }, { start: '12:00', end: '24:00' }] } }))).toEqual([]);
  expect(policyProblems(body({ weekly: { ...week, Monday: Array.from({ length: 9 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` })) } }))).toEqual([{ field: 'weekly.Monday', key: 'tooMany' }]);
  expect(policyProblems(body({ weekly: { ...week, Monday: [{ start: '24:00', end: '24:00' }] } }))).toEqual([{ field: 'weekly.Monday.0', key: 'time' }]);
  const h = (start: string, end: string) => ({ name: 'H', start, end, periods: [] });
  expect(policyProblems(body({ holidays: [h('2026-12-26', '2026-12-25')] }))).toEqual([{ field: 'holidays.0', key: 'dateOrder' }]);
  expect(policyProblems(body({ holidays: [h('2026-12-25', '2026-12-26'), h('2026-12-26', '2026-12-27')] }))).toEqual([{ field: 'holidays', key: 'dateOverlap' }]);
  expect(policyProblems(body({ holidays: [h('', '2026-12-26')] }))).toEqual([{ field: 'holidays.0', key: 'date' }]);
});

test('the code form: digits 4-16, the repeat, the current code only when set, the typed phrase "קוד <n>"', () => {
  const phrase = phraseFor('קוד {slot}', 3);
  expect(phrase).toBe('קוד 3');
  const f = { action: 'set' as const, expected: false, newCode: '123456', repeatCode: '123456', currentCode: '', typed: 'קוד 3', phrase };
  expect(codeFormProblem(f)).toBeNull();
  expect(codeFormProblem({ ...f, newCode: '12a456', repeatCode: '12a456' })).toBe('newCode');
  expect(codeFormProblem({ ...f, newCode: '123', repeatCode: '123' })).toBe('newCode');
  expect(codeFormProblem({ ...f, repeatCode: '123457' })).toBe('repeat');
  expect(codeFormProblem({ ...f, expected: true })).toBe('currentCode');
  expect(codeFormProblem({ ...f, typed: 'קוד 2' })).toBe('typed');
  expect(codeFormProblem({ ...f, typed: '  קוד 3 ' })).toBeNull();
  expect(codeFormProblem({ action: 'clear', expected: true, newCode: '', repeatCode: '', currentCode: '4321', typed: 'קוד 3', phrase })).toBeNull();
});

test('the code body: a new code only for a set, the current code only when the slot is set, never anything else', () => {
  expect(codeBody({ slot: 2, action: 'set', door: 1, expected: false, newCode: '111111', currentCode: '999999', confirmText: 'קוד 2' })).toEqual({
    action: 'set', door: 1, expected: false, new_code: '111111', compatibility: false, confirm_text: 'קוד 2',
  });
  expect(codeBody({ slot: 2, action: 'clear', door: 2, expected: true, newCode: '111111', currentCode: '999999', confirmText: 'קוד 2' })).toEqual({
    action: 'clear', door: 2, expected: true, current_code: '999999', compatibility: false, confirm_text: 'קוד 2',
  });
});

test('every string exists in Hebrew and English, and no string holds a value placeholder for a code', () => {
  const keys = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p];
  expect(keys(enDoorTechText).sort()).toEqual(keys(heDoorTechText).sort());
  const all = JSON.stringify(heDoorTechText) + JSON.stringify(enDoorTechText);
  expect(all).not.toMatch(/\{(code|pin|value|new_code|current_code)\}/);
  expect(all).not.toMatch(/home\s*assistant/i);
});
