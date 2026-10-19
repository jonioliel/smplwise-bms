import { test, expect } from '@playwright/test';
import { cycleMode, effectiveDept, matrixOf, setCell, setChannel, setDeptField, setSla, slaKey, toggleId, type NotifyDoc, type NotifyMatrix } from '../src/tickets/notify-matrix-model';
import { NMT_KEYS, NMT_TABLES, nmt, sourceLabel } from '../src/i18n/notify-matrix';

// TKNOTIFMATRIX: the pure model of the notification matrix screen. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-notify-matrix.spec.ts

test('a missing cell is "now"; the department wins over "*"', () => {
  const m: NotifyMatrix = { '*': { 'ticket.done': 'off' }, d1: { 'ticket.done': 'now', 'ticket.stuck': 'digest' } };
  expect(matrixOf({}, 'd1', 'ticket.done')).toBe('now');
  expect(matrixOf(m, 'd2', 'ticket.done')).toBe('off');
  expect(matrixOf(m, 'd1', 'ticket.done')).toBe('now');
  expect(matrixOf(m, 'd1', 'ticket.stuck')).toBe('digest');
  expect(matrixOf(m, '*', 'ticket.stuck')).toBe('now');
});

test('setCell does not mutate, drops empty rows, and keeps "now" only as a department override', () => {
  const m: NotifyMatrix = { '*': { 'ticket.done': 'off' } };
  const a = setCell(m, 'd1', 'ticket.done', 'now');
  expect(a).toEqual({ '*': { 'ticket.done': 'off' }, d1: { 'ticket.done': 'now' } });
  expect(m).toEqual({ '*': { 'ticket.done': 'off' } });
  expect(setCell(m, '*', 'ticket.done', 'now')).toEqual({});
  expect(setCell(a, 'd1', 'ticket.done', null)).toEqual(m);
});

test('clicking the selected mode clears the cell', () => {
  expect(cycleMode('off', 'off')).toBeNull();
  expect(cycleMode('now', 'digest')).toBe('digest');
});

const DOC: NotifyDoc = { matrix_enabled: true, matrix: {}, digest_enabled: true, digest_time: '08:00' };

test('2.9.1: a department inherits time, recipients and channels from "*" field by field', () => {
  const doc: NotifyDoc = { ...DOC, departments: { '*': { recipients: { managers: false, users: ['u1'], roles: [] }, channels: { push: 'off' } },
    d1: { digest_time: '09:30', channels: { email: 'on' } } } };
  const d1 = effectiveDept(doc, 'd1');
  expect(d1.digestTime).toBe('09:30');
  expect(d1.timeInherited).toBe(false);
  expect(d1.recipients).toEqual({ managers: false, users: ['u1'], roles: [] });
  expect(d1.recipientsInherited).toBe(true);
  expect(d1.channels.push).toEqual({ value: 'off', inherited: true });
  expect(d1.channels.email).toEqual({ value: 'on', inherited: false });
  expect(d1.channels.whatsapp).toEqual({ value: 'inherit', inherited: false });
  const d2 = effectiveDept(doc, 'd2');
  expect(d2.digestTime).toBe('08:00');
  expect(effectiveDept(DOC, 'd2').recipients).toEqual({ managers: true, users: [], roles: [] });
});

test('2.9.1: setDeptField / setChannel / setSla / toggleId are immutable and drop empty values', () => {
  const deps = { d1: { digest_time: '09:00' } };
  expect(setDeptField(deps, 'd1', 'digest_time', undefined)).toEqual({});
  expect(deps).toEqual({ d1: { digest_time: '09:00' } });
  expect(setDeptField(deps, 'd1', 'channels', setChannel(undefined, 'push', 'off'))).toEqual({ d1: { digest_time: '09:00', channels: { push: 'off' } } });
  expect(setDeptField({ d1: { channels: { push: 'off' } } }, 'd1', 'channels', setChannel({ push: 'off' }, 'push', 'inherit'))).toEqual({});
  expect(setSla({ [slaKey('d1', 'p1')]: 'matrix' }, 'd1/p1', 'inherit')).toEqual({});
  expect(setSla(undefined, slaKey('d1', 'p1'), 'immediate')).toEqual({ 'd1/p1': 'immediate' });
  expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
});

test('2.9.1: every string exists in English; Arabic / Russian cover every key; placeholders survive', () => {
  for (const lang of ['en', 'ar', 'ru'] as const) {
    for (const k of NMT_KEYS) expect(NMT_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
  }
  expect(nmt('pending', { n: 3 }, 'en')).toBe('3 events waiting');
  expect(sourceLabel('ticket.done', 'x', 'en')).toBe('Work done - waiting to close');
  expect(sourceLabel('ticket.future', 'server label', 'en')).toBe('server label');
});