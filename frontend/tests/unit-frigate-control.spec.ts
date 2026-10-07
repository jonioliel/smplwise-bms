import { test, expect } from '@playwright/test';
import {
  SWITCH_ORDER, alarmText, anyWriteOn, changeLine, confirmCopy, exportRangeError, featureText, groupSwitches, isFirstWriteRefusal, needsConfirm,
  openManualEvents, typedMatches, visibleClasses,
  type CameraControl, type ChangeRow, type ControlPolicy,
} from '../src/api/frigate-control';
import { ApiError } from '../src/api/client';
import { he } from '../src/i18n/he';

// NN5-F2: the pure logic of the Frigate control screens - which switches are drawn and in which order, what needs a confirmation, the
// wording of a confirmation and of a change-log line, which write classes the settings list. Node only, no server.

const cam = (over: Partial<CameraControl> = {}): CameraControl => ({
  recorder_id: 'nvr-2', camera_id: 'c1', writable: { analytics: true, record: true, ptz: false },
  features: [
    { feature: 'birdseye', class: 'analytics', value: true }, { feature: 'detect', class: 'analytics', value: true }, { feature: 'audio', class: 'analytics', value: null },
    { feature: 'motion', class: 'analytics', value: false }, { feature: 'snapshots', class: 'record', value: false }, { feature: 'recordings', class: 'record', value: true },
  ], ...over,
});

test('the switches of a group come in screen order and a switch Frigate does not report is not drawn', () => {
  expect(groupSwitches(cam(), 'analytics').map((s) => s.feature)).toEqual(['detect', 'motion', 'birdseye']);
  expect(groupSwitches(cam(), 'record').map((s) => s.feature)).toEqual(['recordings', 'snapshots']);
  expect(groupSwitches(cam({ features: [] }), 'analytics')).toEqual([]);
  // every feature the server can switch has a label and a place
  for (const g of ['analytics', 'record'] as const) for (const f of SWITCH_ORDER[g]) expect(featureText(f)).not.toBe(f);
});

test('only recording switches need a confirmation, and only turning recording OFF carries the warning', () => {
  expect(needsConfirm('analytics')).toBe(false);
  expect(needsConfirm('record')).toBe(true);
  const off = confirmCopy('record', 'recordings', false);
  expect(off.title).toBe(he.frigate.control.confirmTitleOff);
  expect(off.text).toBe(he.frigate.control.confirmRecordOff);
  const snap = confirmCopy('record', 'snapshots', false);
  expect(snap.title).toContain(featureText('snapshots'));
  expect(snap.text).toBe(he.frigate.control.confirmRecordOff);
  expect(confirmCopy('record', 'recordings', true).text).toBe('');
});

const change = (over: Partial<ChangeRow>): ChangeRow => ({
  id: 'x', recorder_id: 'nvr-2', camera_id: 'c1', camera_key: 'cam_front', class: 'analytics', kind: 'feature', target: 'detect', before: { value: true }, after: { value: false },
  status: 'applied', error: null, reversible: true, reverts_id: null, actor: 'יוני', at: '2026-10-06T07:30:00Z', ...over,
});

test('a change-log line names what changed and to what', () => {
  expect(changeLine(change({}))).toBe(`${featureText('detect')}: ${he.frigate.summary.off}`);
  expect(changeLine(change({ target: 'motion', after: { value: true } }))).toBe(`${featureText('motion')}: ${he.frigate.summary.on}`);
  expect(changeLine(change({ kind: 'profile', after: { profile: 'away' } }))).toBe(`${he.frigate.control.profile}: away`);
  expect(changeLine(change({ kind: 'profile', after: { profile: null } }))).toBe(`${he.frigate.control.profile}: ${he.frigate.control.noProfile}`);
  expect(changeLine(change({ kind: 'event_retain', after: { retain: true } }))).toContain(he.frigate.control.retain);
  expect(changeLine(change({ kind: 'event_sub_label', after: { sub_label: 'דנה' } }))).toBe('דנה');
});

const policy = (ptzAvailable: boolean, on: string[] = []): ControlPolicy => ({
  recorder_id: 'nvr-2', ptz_released: ptzAvailable,
  classes: (['ptz', 'events', 'review', 'profile', 'record', 'analytics'] as const).map((c) => ({ class: c, enabled: on.includes(c), per_action: ['record', 'profile', 'ptz'].includes(c), permission: `p.${c}`, available: c !== 'ptz' || ptzAvailable })),
});

test('the settings list the write classes in a fixed order and offer PTZ only once the code releases it', () => {
  expect(visibleClasses(policy(false)).map((c) => c.class)).toEqual(['analytics', 'record', 'profile', 'review', 'events']);
  expect(visibleClasses(policy(true)).map((c) => c.class)).toEqual(['analytics', 'record', 'profile', 'review', 'events', 'ptz']);
  expect(anyWriteOn(null)).toBe(false);
  expect(anyWriteOn(policy(false))).toBe(false);
  expect(anyWriteOn(policy(false, ['review']))).toBe(true);
});

// ---- FRGD: the F2b helpers ----

test('the F2b write classes join the list in a fixed place, before PTZ', () => {
  const p: ControlPolicy = {
    recorder_id: 'nvr-2', ptz_released: false,
    classes: (['cases', 'exports', 'ptz', 'events', 'review', 'profile', 'record', 'analytics'] as const).map((c) => ({ class: c, enabled: false, per_action: false, permission: `p.${c}`, available: c !== 'ptz', confirm_actions: c === 'exports' || c === 'cases' ? ['delete'] : [] })),
  };
  expect(visibleClasses(p).map((c) => c.class)).toEqual(['analytics', 'record', 'profile', 'review', 'events', 'exports', 'cases']);
});

test('a change-log line of an F2b kind names the kind and the object', () => {
  expect(changeLine(change({ kind: 'export_create', class: 'exports', target: 'exp-1', after: { name: 'כניסה 06.10', id: 'exp-1' } }))).toBe(`${he.frigate.control.settings.kinds.export_create}: כניסה 06.10`);
  expect(changeLine(change({ kind: 'export_delete', class: 'exports', target: 'exp-1', before: { name: 'ישן' }, after: null }))).toBe(`${he.frigate.control.settings.kinds.export_delete}: ישן`);
  expect(changeLine(change({ kind: 'event_create', class: 'events', target: 'ev-9', after: { label: 'בדיקה' } }))).toBe(`${he.frigate.control.settings.kinds.event_create}: בדיקה`);
  expect(changeLine(change({ kind: 'case_rename', class: 'cases', target: 'c1', after: { name: 'חדש' } }))).toBe(`${he.frigate.control.settings.kinds.case_rename}: חדש`);
});

test('the open manual events are the reversible event_create rows without an end row', () => {
  const rows: ChangeRow[] = [
    change({ id: 'a', kind: 'event_create', class: 'events', target: 'ev-1', after: { label: 'בדיקה', sub_label: 'טכנאי' }, reversible: true }),
    change({ id: 'b', kind: 'event_create', class: 'events', target: 'ev-2', after: { label: 'ישן' }, reversible: false }), // ended: the undo is gone
    change({ id: 'c', kind: 'event_create', class: 'events', target: 'ev-3', after: { label: 'נגמר' }, reversible: true }),
    change({ id: 'd', kind: 'event_end', class: 'events', target: 'ev-3', after: { end_time: 1 }, reversible: false }),
    change({ id: 'e', kind: 'event_create', class: 'events', target: 'ev-4', after: { label: 'נכשל' }, status: 'failed', reversible: true }),
  ];
  expect(openManualEvents(rows).map((o) => [o.id, o.label, o.sub_label])).toEqual([['ev-1', 'בדיקה', 'טכנאי']]);
});

test('an export range is at most two hours, ordered, and never in the future', () => {
  const now = 1_800_000_000;
  expect(exportRangeError(null, now)).toBe('missing');
  expect(exportRangeError(now - 10, now - 20, now)).toBe('order');
  expect(exportRangeError(now - 7201 - 100, now - 100, now)).toBe('long');
  expect(exportRangeError(now, now + 120, now)).toBe('future');
  expect(exportRangeError(now - 3600, now - 1, now)).toBeNull();
  expect(exportRangeError(now - 60, now + 30, now)).toBeNull(); // one minute of slack
});

test('a typed confirmation matches the name exactly (trimmed) and never an empty string; the first-write refusal is told by its code', () => {
  expect(typedMatches(' כניסה ', 'כניסה')).toBe(true);
  expect(typedMatches('כניס', 'כניסה')).toBe(false);
  expect(typedMatches('  ', '  ')).toBe(false);
  expect(isFirstWriteRefusal(new ApiError(409, { code: 'frigate_first_write_unsupervised', user_message: '', retryable: false, correlation_id: '', details: {} }))).toBe(true);
  expect(isFirstWriteRefusal(new ApiError(409, { code: 'frigate_object_not_arx', user_message: '', retryable: false, correlation_id: '', details: {} }))).toBe(false);
  expect(isFirstWriteRefusal(new Error('x'))).toBe(false);
});

test('alarm states have Hebrew names and an unknown one is shown as it is', () => {
  expect(alarmText('armed_away')).toBe(he.frigate.control.alarm.armed_away);
  expect(alarmText('something_new')).toBe('something_new');
});
