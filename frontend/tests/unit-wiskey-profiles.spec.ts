import { test, expect } from '@playwright/test';
import type { ImpactPerson, PolicyValues } from '../src/api/access-profiles';
import { ApiError } from '../src/api/client';
import {
  canRemove, changeCount, diffRows, draftProblems, freshId, move, newField, newGroup, outcomeOf, parentCandidates, parseOptions, personDelta, problemsOf, resultTone,
  secondsLeft, sortPeople, toggleStation, valueText,
} from '../src/access-control/profiles-logic';
import { PF_HE, pft, pftDynamic } from '../src/i18n/wiskey-profiles';

// WISKEY-PROFILES-EDIT-2390: the pure part of the groups and profile fields editor. Node only; synthetic names and ids (no lab data).

const base = (): PolicyValues => ({
  photo_enabled: true,
  fields: [
    { id: 'department', label: 'מחלקה', enabled: true, type: 'select', required: false, unique: false, options: ['הנדסה', 'ביטחון'], depends_on: null },
    { id: 'badge', label: 'מספר תג', enabled: true, type: 'text', required: false, unique: false, options: [], depends_on: null },
  ],
  groups: [
    { id: 'staff', label: 'צוות', enabled: true, station_ids: ['st-a', 'st-b'] },
    { id: 'visitors', label: 'מבקרים', enabled: false, station_ids: null },
  ],
});
const KNOWN = new Set(['st-a', 'st-b', 'st-c']);

test('fresh ids follow the access-control pattern and never collide', () => {
  expect(freshId('field', [])).toBe('field_1');
  expect(freshId('group', ['group_1', 'group_2'])).toBe('group_3');
  const v = base();
  const f = newField(v, 'שדה חדש');
  expect(f).toEqual({ id: 'field_1', label: 'שדה חדש', enabled: true, type: 'text', required: false, unique: false, options: [], depends_on: null });
  expect(newGroup(v, 'קבוצה').station_ids).toEqual([]);
  expect(/^[a-z][a-z0-9_]{0,47}$/.test(f.id)).toBe(true);
});

test('saved definitions cannot be removed, new ones can', () => {
  const v = base();
  expect(canRemove(v, 'fields', 'badge')).toBe(false);
  expect(canRemove(v, 'groups', 'staff')).toBe(false);
  expect(canRemove(v, 'groups', 'group_9')).toBe(true);
});

test('a valid draft has no problems; every WisKey limit is caught with the server path and code', () => {
  expect(draftProblems(base(), KNOWN)).toEqual({});
  const d = base();
  d.fields.push({ id: 'Bad Id', label: '', enabled: true, type: 'select', required: false, unique: false, options: [], depends_on: null });
  d.groups[0] = { ...d.groups[0], station_ids: ['st-a', 'nowhere'] };
  d.groups.push({ id: 'staff', label: 'x'.repeat(65), enabled: true, station_ids: [] });
  expect(draftProblems(d, KNOWN)).toEqual({
    'fields.2.id': 'id',
    'fields.2.label': 'label',
    'fields.2.options': 'empty',
    'groups.0.station_ids': 'unknown_station',
    'groups.2.id': 'duplicate',
    'groups.2.label': 'label',
  });
  const many = base();
  for (let i = 0; i < 11; i++) many.fields.push(newField(many, 'x'));
  expect(draftProblems(many, KNOWN).fields).toBe('too_many');
  const dupOpt = base();
  dupOpt.fields[0].options = ['א', 'א'];
  expect(draftProblems(dupOpt, KNOWN)['fields.0.options']).toBe('duplicate');
});

test('conditions: the parent must exist, a select value must be one of its options, and no cycle', () => {
  const d = base();
  d.fields[1].depends_on = { field_id: 'department', value: 'ביטחון' };
  expect(draftProblems(d, KNOWN)).toEqual({});
  d.fields[1].depends_on = { field_id: 'department', value: 'שיווק' };
  expect(draftProblems(d, KNOWN)['fields.1.depends_on']).toBe('value');
  d.fields[1].depends_on = { field_id: 'nothing', value: '' };
  expect(draftProblems(d, KNOWN)['fields.1.depends_on']).toBe('parent');
  d.fields[1].depends_on = { field_id: 'department', value: '' };
  d.fields[0].depends_on = { field_id: 'badge', value: 'x' };
  const p = draftProblems(d, KNOWN);
  expect(p['fields.0.depends_on']).toBe('cycle');
  expect(p['fields.1.depends_on']).toBe('cycle');
});

test('the parent candidates leave out the field itself and everything below it', () => {
  const d = base();
  d.fields.push({ id: 'room', label: 'חדר', enabled: true, type: 'text', required: false, unique: false, options: [], depends_on: { field_id: 'badge', value: '1' } });
  expect(parentCandidates(d.fields, 'badge').map((f) => f.id)).toEqual(['department']);
  expect(parentCandidates(d.fields, 'room').map((f) => f.id)).toEqual(['department', 'badge']);
});

test('the diff is WisKey compare rows plus the photo switch, station lists compared as sets', () => {
  const a = base();
  const b = base();
  b.groups[0].station_ids = ['st-b', 'st-a'];
  expect(diffRows(a, b)).toEqual([]);
  b.groups[0].station_ids = ['st-c', 'st-a', 'st-b'];
  b.fields[1] = { ...b.fields[1], required: true };
  b.photo_enabled = false;
  b.groups.push({ id: 'group_1', label: 'חדשה', enabled: true, station_ids: [] });
  const rows = diffRows(a, b);
  expect(rows.map((r) => `${r.kind}.${r.id}.${r.state}`)).toEqual(['settings.photo_enabled.changed', 'fields.badge.changed', 'groups.group_1.added', 'groups.staff.changed']);
  expect(rows[3].changes).toEqual([{ property: 'station_ids', before: ['st-a', 'st-b'], after: ['st-a', 'st-b', 'st-c'] }]);
  expect(changeCount(rows)).toBe(1 + 1 + 3 + 1);
});

test('small edits: move, toggle a station, options from lines', () => {
  expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  expect(toggleStation({ id: 'g', label: 'g', enabled: true, station_ids: null }, 'st-b').station_ids).toEqual(['st-b']);
  expect(toggleStation({ id: 'g', label: 'g', enabled: true, station_ids: ['st-a', 'st-b'] }, 'st-a').station_ids).toEqual(['st-b']);
  expect(parseOptions(' א \n\nב\r\n ג ')).toEqual(['א', 'ב', 'ג']);
});

test('the impact: gains and losses per person, changed people first', () => {
  const p = (id: string, before: string[], after: string[], name: string): ImpactPerson => ({ user_id: id, display_name: name, employee_no: null, before, after, changed: before.join() !== after.join(), overrides: 0 });
  expect(personDelta(p('1', ['a', 'b'], ['b', 'c'], 'x'))).toEqual({ gains: ['c'], loses: ['a'] });
  const sorted = sortPeople([p('1', ['a'], ['a'], 'אבי'), p('2', ['a'], ['b'], 'תמר'), p('3', [], ['a'], 'בני')]);
  expect(sorted.map((x) => x.user_id)).toEqual(['3', '2', '1']);
});

test('outcomes: the server details decide; a refusal without one is not sent; no answer is unknown', () => {
  const err = (status: number, code: string, details: Record<string, unknown> = {}) => new ApiError(status, { code, user_message: 'm', details, retryable: false } as never);
  expect(outcomeOf(err(409, 'profiles_review_stale', { outcome: 'refused', wiskey_code: 'bulk_review_stale' }))).toEqual({ outcome: 'refused', code: 'profiles_review_stale' });
  expect(outcomeOf(err(504, 'profiles_outcome_unknown', { outcome: 'unknown' })).outcome).toBe('unknown');
  expect(outcomeOf(err(404, 'profiles_review_not_found')).outcome).toBe('not_sent');
  expect(outcomeOf(err(502, 'x')).outcome).toBe('unknown');
  expect(outcomeOf(new TypeError('fetch failed'))).toEqual({ outcome: 'unknown', code: 'network' });
  expect(problemsOf(err(422, 'profiles_invalid_draft', { problems: [{ path: 'fields.0.label', code: 'label' }] }))).toEqual({ 'fields.0.label': 'label' });
});

test('the result tone is ok only when the readback matches the confirmed policy', () => {
  const r = (matches: boolean | null) => ({ status: 'saved', review_id: 'x', revision_before: 7, receipt: null, readback: { state: 'ready', revision: 8, matches, last_error: null }, sync: 'none', physical_result: 'not_verified' }) as const;
  expect(resultTone(r(true) as never)).toBe('ok');
  expect(resultTone(r(false) as never)).toBe('warn');
  expect(resultTone(r(null) as never)).toBe('warn');
});

test('seconds left and value words', () => {
  expect(secondsLeft('2026-11-03T10:00:30Z', Date.parse('2026-11-03T10:00:00Z'))).toBe(30);
  expect(secondsLeft('2026-11-03T10:00:00Z', Date.parse('2026-11-03T10:01:00Z'))).toBe(0);
  const words = { yes: 'כן', no: 'לא', none: 'אין', types: { select: 'בחירה' } };
  expect(valueText('station_ids', ['st-a', 'x'], { 'st-a': 'שער' }, {}, words)).toBe('שער, x');
  expect(valueText('depends_on', { field_id: 'department', value: 'ביטחון' }, {}, { department: 'מחלקה' }, words)).toBe('מחלקה = ביטחון');
  expect(valueText('required', true, {}, {}, words)).toBe('כן');
  expect(valueText('type', 'select', {}, {}, words)).toBe('בחירה');
  expect(valueText('station_ids', null, {}, {}, words)).toBe('אין');
});

test('the words: placeholders fill, dynamic keys fall back, and no platform or vendor is named', () => {
  expect(pft('confirmText', { from: 7, to: 8, people: 3, stations: 2 })).toContain('7 ← 8');
  expect(pftDynamic('e_nope', 'e_network')).toBe(pft('e_network'));
  const banned = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;
  for (const [k, v] of Object.entries(PF_HE)) expect(v, k).not.toMatch(banned);
});
