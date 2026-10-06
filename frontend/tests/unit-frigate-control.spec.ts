import { test, expect } from '@playwright/test';
import {
  SWITCH_ORDER, alarmText, anyWriteOn, changeLine, confirmCopy, featureText, groupSwitches, needsConfirm, visibleClasses,
  type CameraControl, type ChangeRow, type ControlPolicy,
} from '../src/api/frigate-control';
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

test('alarm states have Hebrew names and an unknown one is shown as it is', () => {
  expect(alarmText('armed_away')).toBe(he.frigate.control.alarm.armed_away);
  expect(alarmText('something_new')).toBe('something_new');
});
