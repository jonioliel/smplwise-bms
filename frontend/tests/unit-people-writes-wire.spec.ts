import { test, expect } from '@playwright/test';
import { newMock, type PeopleMock } from './wiskey-people-mock';
import { WIRE, contextReply, deleteReply, editorReply, errorBody, newWrites, pinReply, saveReply, writeReply, type WritesMock } from './wiskey-writes-mock';

// CR-036 S11: the writes mock (tests/wiskey-writes-mock.ts) answers in the WIRE shapes of tests/fixtures/access_writes_wire.json - the file
// smplwise_vms/backend/tests/test_access_writes_wire.py holds to the real endpoints. Same comparison as there: the same keys, the same scalar
// types (null = any), an empty list matches any list, the dicts keyed by station id compared by their values. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-people-writes-wire.spec.ts

const FREE_KEYS = new Set(['person.permission_overrides', 'person.timing_policy.bindings']);
type Shape = string | Shape[] | { [k: string]: Shape };

function merge(a: Shape, b: Shape): Shape {
  if (a === 'any') return b;
  if (b === 'any') return a;
  if (Array.isArray(a) && a[0] === 'empty') return b;
  if (Array.isArray(b) && b[0] === 'empty') return a;
  if (Array.isArray(a) && Array.isArray(b)) return [merge(a[0], b[0])];
  if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out: { [k: string]: Shape } = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = k in a && k in b ? merge(a[k], b[k]) : (a[k] ?? b[k]);
    return out;
  }
  return a === b ? a : [...new Set([...String(a).split('|'), ...String(b).split('|')])].sort().join('|');
}

function shape(value: unknown, at = ''): Shape {
  if (value === null || value === undefined) return 'any';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'str';
  if (Array.isArray(value)) return value.length ? [value.map((v) => shape(v, at)).reduce(merge)] : ['empty'];
  const entries = Object.entries(value as Record<string, unknown>);
  if (FREE_KEYS.has(at)) return { '*': entries.length ? entries.map(([, v]) => shape(v, `${at}.*`)).reduce(merge) : 'any' };
  return Object.fromEntries(entries.map(([k, v]) => [k, shape(v, at ? `${at}.${k}` : k)]));
}

function mismatches(real: Shape, mock: Shape, at = ''): string[] {
  if (real === 'any' || mock === 'any') return [];
  if (Array.isArray(real) && Array.isArray(mock)) return real[0] === 'empty' || mock[0] === 'empty' ? [] : mismatches(real[0], mock[0], `${at}[]`);
  if (typeof real === 'object' && typeof mock === 'object' && !Array.isArray(real) && !Array.isArray(mock)) {
    const a = Object.keys(real).sort();
    const b = Object.keys(mock).sort();
    if (a.join() !== b.join()) return [`${at || '<root>'}: keys differ - only in the fixture: ${a.filter((k) => !b.includes(k))}, only in the mock: ${b.filter((k) => !a.includes(k))}`];
    return a.flatMap((k) => mismatches(real[k], mock[k], at ? `${at}.${k}` : k));
  }
  return real === mock ? [] : [`${at}: the fixture has ${JSON.stringify(real)}, the mock ${JSON.stringify(mock)}`];
}

const fixture = (name: string) => shape({ ...WIRE[name], sync: WIRE.sync });
const person = (st: PeopleMock, id: string) => st.people.find((p) => p.id === id)!;

function world(): { st: PeopleMock; w: WritesMock } {
  const st = newMock('admin');
  const w = newWrites();
  // a proposal on one person (the other people's timing comes from the read model: p1 is enforced by the device)
  w.timing.p2 = { draft: { mode: 'weekly', timezone: 'Asia/Jerusalem', days: ['Monday'], dates: [], periods: [{ start: '08:00', end: '12:00' }] }, policy: null };
  return { st, w };
}

test('the comparison itself: a missing key, a wrong type and a station-keyed map are told apart', () => {
  expect(mismatches(shape({ a: 1, b: 'x' }), shape({ a: 2 }))).toHaveLength(1);
  expect(mismatches(shape({ a: 1 }), shape({ a: 'one' }))).toEqual(['a: the fixture has "number", the mock "str"']);
  expect(mismatches(shape({ a: null }), shape({ a: 'one' }))).toEqual([]);
  expect(mismatches(shape({ person: { permission_overrides: { gate: 'allow' } } }), shape({ person: { permission_overrides: { lobby: 'deny', mgmt: 'allow' } } }))).toEqual([]);
  expect(mismatches(shape({ person: { permission_overrides: { gate: 'allow' } } }), shape({ person: { permission_overrides: { lobby: 1 } } }))).toHaveLength(1);
});

test('the editor context and the person in the editor projection have the server shape (both levels)', () => {
  const { st, w } = world();
  expect(mismatches(fixture('editor_context'), shape(contextReply(st, w)))).toEqual([]);
  const people = st.people.map((p) => shape(editorReply(st, w, p))).reduce(merge);
  expect(mismatches(fixture('editor_person'), people)).toEqual([]);
  const names = newMock('operator');
  const nw = newWrites();
  nw.manager = true;
  const reply = editorReply(names, nw, person(names, 'p1'));
  expect(mismatches(fixture('editor_person_names'), shape(reply))).toEqual([]);
  const p = reply.person as Record<string, unknown>;
  for (const k of ['phone', 'pin_configured', 'cards', 'photo_configured', 'responsible_person', 'access_purpose']) expect(p[k], k).toBeNull();
  expect(p.level).toBe('names');
});

test('a write, a save, a delete and the PIN answer in the server shape, with the server effect classes', () => {
  const { st, w } = world();
  const write = writeReply(st, w, person(st, 'p1'));
  expect(mismatches(fixture('write_reply'), shape(write))).toEqual([]);
  expect([write.effect, write.pending]).toEqual(['sync', false]);
  expect(mismatches(fixture('save_reply'), shape(saveReply(st, w, person(st, 'p1'))))).toEqual([]);
  const del = deleteReply(w);
  expect(mismatches(fixture('delete_reply'), shape(del))).toEqual([]);
  expect([del.effect, del.pending]).toEqual(['unknown_effect', true]);
  expect(mismatches(fixture('pin_reply'), shape(pinReply()))).toEqual([]);
});

test('the error bodies are the server bodies: not sent, refused by name, unknown, not found, forbidden', () => {
  for (const kind of ['scope', 'unknown', 'not_found', 'forbidden'] as const) {
    const e = errorBody(kind);
    expect(mismatches(shape(WIRE.errors[kind]), shape(e.body)), kind).toEqual([]);
  }
  const refused = errorBody('refused', { code: 'intercom_card_conflict', wiskey: 'card_conflict' });
  expect(refused.status).toBe(409);
  expect(mismatches(shape(WIRE.errors.refused), shape(refused.body))).toEqual([]);
  expect((refused.body.details as Record<string, unknown>).outcome).toBe('refused');
  expect((errorBody('scope').body.details as Record<string, unknown>).outcome).toBe('not_sent');
  expect((errorBody('unknown').body.details as Record<string, unknown>).outcome).toBe('unknown');
  expect(errorBody('unknown').status).toBe(504);
});
