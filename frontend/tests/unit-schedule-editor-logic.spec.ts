import { test, expect } from '@playwright/test';
import {
  addPeriod,
  bindingFaults,
  canonical,
  copyDay,
  defaultBindings,
  draftOf,
  emptyDraft,
  faults,
  gridOf,
  libraryManage,
  nextPeriod,
  removePeriod,
  sameDraft,
  transferDocument,
  weekFromGrid,
  weekMinutes,
  WORKDAYS,
} from '../src/access-control/schedule-editor-logic';
import { outcomeOf, type Draft, type Readiness } from '../src/api/schedule-writes';
import { ApiError } from '../src/api/client';
import { reasonOf, sed } from '../src/i18n/schedule-editor';

// WISKEY-SCHED-WRITE-2390: the schedule library editor's pure logic - the integration's own draft rules (mirrored), the edits, the week
// grid, the device slots, the outcome reading. Node only (no page).
//   npx playwright test tests/unit-schedule-editor-logic.spec.ts --project=desktop

const draft = (patch: Partial<Draft> = {}): Draft => ({ ...emptyDraft('שעות משרד'), ...patch });

test.describe('schedule editor logic', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'node-only spec: one project'));

  test('the administrator: access.schedules.manage or system.configure at the installation', () => {
    expect(libraryManage((p) => p === 'access.schedules.manage')).toBe(true);
    expect(libraryManage((p) => p === 'system.configure')).toBe(true);
    expect(libraryManage((p) => p === 'access.stations.read')).toBe(false);
  });

  test('the integration rules: name, times, overlap, limits, holidays', () => {
    expect(faults(draft())).toEqual([]);
    expect(faults(draft({ name: '  ' }))).toEqual([{ code: 'invalid_text', where: 'name' }]);
    expect(faults(draft({ name: 'x'.repeat(33) }))[0].code).toBe('invalid_text');
    const w = draft().weekly;
    expect(faults(draft({ weekly: { ...w, Monday: [{ start: '09:00', end: '08:00' }] } }))).toEqual([{ code: 'schedule_invalid_time', where: 'weekly.Monday.0' }]);
    expect(faults(draft({ weekly: { ...w, Monday: [{ start: '24:00', end: '24:00' }] } }))[0].code).toBe('schedule_invalid_time');
    expect(faults(draft({ weekly: { ...w, Monday: [{ start: '20:00', end: '24:00' }] } }))).toEqual([]);
    expect(faults(draft({ weekly: { ...w, Monday: [{ start: '08:00', end: '12:00' }, { start: '11:00', end: '13:00' }] } }))).toEqual([{ code: 'schedule_overlap', where: 'weekly.Monday' }]);
    expect(faults(draft({ weekly: { ...w, Monday: [{ start: '08:00', end: '12:00' }, { start: '12:00', end: '13:00' }] } }))).toEqual([]); // [start, end): touching is fine
    expect(faults(draft({ weekly: { ...w, Monday: Array.from({ length: 9 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` })) } }))[0].code).toBe('schedule_period_limit');
    const hol = (start: string, end: string) => ({ name: 'חג', start, end, periods: [] });
    expect(faults(draft({ holidays: [hol('2027-01-05', '2027-01-01')] }))).toEqual([{ code: 'schedule_invalid_date', where: 'holidays.0' }]);
    expect(faults(draft({ holidays: [hol('1999-01-01', '1999-01-02')] }))[0].code).toBe('schedule_invalid_date');
    expect(faults(draft({ holidays: [hol('2027-02-30', '2027-03-01')] }))[0]).toEqual({ code: 'schedule_invalid_date', where: 'holidays.0.start' });
    expect(faults(draft({ holidays: [hol('2027-01-01', '2027-01-05'), hol('2027-01-05', '2027-01-07')] }))).toEqual([{ code: 'schedule_holiday_overlap', where: 'holidays' }]);
  });

  test('the edits: a next window, remove, copy Sunday to the workdays', () => {
    expect(nextPeriod([])).toEqual({ start: '08:00', end: '17:00' });
    expect(nextPeriod([{ start: '08:00', end: '17:00' }])).toEqual({ start: '17:00', end: '18:00' });
    expect(nextPeriod([{ start: '20:00', end: '23:30' }])).toEqual({ start: '23:30', end: '24:00' });
    expect(nextPeriod([{ start: '20:00', end: '24:00' }])).toBeNull();
    let d = addPeriod(draft(), 'Sunday');
    d = copyDay(d, 'Sunday', WORKDAYS);
    for (const day of WORKDAYS) expect(d.weekly[day]).toEqual([{ start: '08:00', end: '17:00' }]);
    expect(d.weekly.Friday).toEqual([]);
    d.weekly.Sunday[0].start = '07:00';
    expect(d.weekly.Monday[0].start).toBe('08:00'); // copies, not shared objects
    expect(weekMinutes(d.weekly)).toBe(10 * 60 + 4 * 9 * 60);
    expect(removePeriod(d, 'Monday', 0).weekly.Monday).toEqual([]);
  });

  test('the week grid: painting changes whole hours, an untouched day keeps its minutes', () => {
    const d = draft({ weekly: { ...draft().weekly, Monday: [{ start: '08:15', end: '12:45' }], Tuesday: [{ start: '09:00', end: '10:00' }] } });
    const g = gridOf(d.weekly);
    expect(g[0]).toEqual([{ begin: '08:15:00', end: '12:45:00' }]); // grid row 0 = Monday
    const painted = g.map((r) => [...r]);
    painted[1] = [{ begin: '09:00:00', end: '11:00:00' }];
    painted[6] = [{ begin: '22:00:00', end: '24:00:00' }];
    const w = weekFromGrid(painted, d.weekly);
    expect(w.Monday).toEqual([{ start: '08:15', end: '12:45' }]);
    expect(w.Tuesday).toEqual([{ start: '09:00', end: '11:00' }]);
    expect(w.Sunday).toEqual([{ start: '22:00', end: '24:00' }]);
  });

  test('a library schedule as a draft, canonical order, same draft', () => {
    const s = { id: 'x', revision: 2, updated_at: null, name: 'א', weekly: { Monday: [{ start: '13:00', end: '14:00' }, { start: '08:00', end: '09:00' }] }, holidays: [] };
    const d = draftOf(s);
    expect(Object.keys(d.weekly).sort()).toEqual(['Friday', 'Monday', 'Saturday', 'Sunday', 'Thursday', 'Tuesday', 'Wednesday']);
    expect(canonical(d).weekly.Monday[0].start).toBe('08:00');
    expect(sameDraft(d, canonical(d))).toBe(true);
    expect(sameDraft(d, { ...d, name: 'ב' })).toBe(false);
    const doc = JSON.parse(transferDocument([d]));
    expect(doc.format).toBe('hikvision_intercom.schedule_drafts');
    expect(doc.version).toBe(1);
  });

  test('device slots: the previous proposal, else the advertised range; faults against it', () => {
    const r: Readiness = { checked_at: null, can_apply: false, reason: null, checks: [
      { kind: 'template', advertised: true, capabilities: { ids: [1, 32] }, read_state: 'readable', error: null, coverage: 'complete', read: 1, total: 1 },
      { kind: 'weekly', advertised: true, capabilities: { ids: [1, 64] }, read_state: 'readable', error: null, coverage: 'complete', read: 1, total: 1 },
      { kind: 'holiday_group', advertised: true, capabilities: { ids: [1, 16] }, read_state: 'readable', error: null, coverage: 'complete', read: 1, total: 1 },
      { kind: 'holiday', advertised: true, capabilities: { ids: [1, 128] }, read_state: 'readable', error: null, coverage: 'complete', read: 1, total: 1 },
    ] };
    expect(defaultBindings(0, r)).toEqual({ template: 32, weekly: 64, holiday_group: null, holidays: [] });
    expect(defaultBindings(2, r)).toEqual({ template: 32, weekly: 64, holiday_group: 16, holidays: [128, 127] });
    const prev = { template: 3, weekly: 4, holiday_group: null, holidays: [] };
    expect(defaultBindings(0, r, prev)).toEqual(prev);
    expect(defaultBindings(1, r, prev).holiday_group).toBe(16); // a previous proposal for another holiday count is not reused
    expect(bindingFaults({ template: 32, weekly: 64, holiday_group: null, holidays: [] }, r)).toEqual({});
    expect(bindingFaults({ template: 33, weekly: 0, holiday_group: null, holidays: [] }, r)).toEqual({ template: 'schedule_binding_out_of_range', weekly: 'schedule_binding_invalid' });
    expect(bindingFaults({ template: 1, weekly: 1, holiday_group: 2, holidays: [5, 5] }, r).holidays).toBe('schedule_binding_invalid');
  });

  test('outcomes: refused (the integration), not sent (Arx first), unknown', () => {
    const e = (status: number, details: Record<string, unknown>, code = 'x') => new ApiError(status, { code, user_message: 'm', retryable: false, correlation_id: 'c', details });
    expect(outcomeOf(e(409, { outcome: 'refused', wiskey_code: 'revision_conflict' }))).toMatchObject({ status: 'refused', code: 'revision_conflict' });
    expect(outcomeOf(e(422, { outcome: 'not_sent', wiskey_code: 'schedule_overlap', field: 'weekly.Monday' }))).toMatchObject({ status: 'not_sent', field: 'weekly.Monday' });
    expect(outcomeOf(e(504, { outcome: 'unknown' }))).toMatchObject({ status: 'unknown' });
    expect(outcomeOf(e(429, { retry_after_s: 4 }, 'schedule_rate_limited'))).toMatchObject({ status: 'not_sent', code: 'schedule_rate_limited', retryAfter: 4 });
    expect(outcomeOf(new TypeError('fetch'))).toMatchObject({ status: 'unknown', code: 'network' });
    expect(sed('refusedBy', { reason: reasonOf('unauthorized') })).toContain('WisKey סירב');
    expect(reasonOf('schedule_writes_unverified')).toContain('לא אומתה');
  });

  test('owner 04.11 (Q11 "a"): the deploy warning says plainly that nothing reaches a station, without a version number', () => {
    for (const key of ['deployWritesOff', 'confirmDeployWritesOff'] as const) {
      const he = sed(key);
      expect(he).toContain('חסום');
      expect(he).toMatch(/לא (ייכתב|כותב)/);
      expect(he).not.toMatch(/rc\.?\d|2\.0\.1|\d+\.\d+\.\d+|schedule_|home\s*assistant|\bHA\b/i);
    }
    expect(sed('deployWritesOff')).toContain('תיעלם'); // it says the note goes away once writing is enabled
  });
});
