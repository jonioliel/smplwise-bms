import { test, expect } from '@playwright/test';
import {
  activeState, advance, classifyEntity, coverageText, daysText, defaultSwitches, drawnStates, gapAt, gapsInWindow, laneOf, layerStatusText, parseSwitches,
  replayFromRange, replayFromSnapshot, roomsKnown, seriesStateAt, serializeSwitches, type SeriesContext,
} from '../src/map/history-replay';
import type { HistoryRange, HistorySnapshot, RangeSeries } from '../src/api/history-scrub';

// CR-TIMESCRUB101: the time scrub's pure logic - the state of a series at an instant (gaps, forward fill, bounded_after,
// buckets), the layer switches and their memory, the drawn states (known + enabled + permitted only), the lanes, the legend
// texts. Runs in node: no page, no backend.

const T0 = Date.parse('2026-10-21T10:00:00Z');
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const ctx = (over: Partial<SeriesContext> = {}): SeriesContext => ({ from: T0, to: T0 + 60 * MIN, gaps: [], forwardFillMaxS: 3600, bucketS: null, ...over });
const series = (points: [number, string | null, number][], over: Partial<RangeSeries> = {}): RangeSeries => ({
  initial: { state: 'off', known: true }, points: points.map(([t, s, n]) => [iso(t), s, n]), bounded_after: false, ...over,
});

test.describe('seriesStateAt', () => {
  test('the last point at or before t; before the first point the initial state', () => {
    const s = series([[T0 + 10 * MIN, 'on', 1], [T0 + 20 * MIN, 'off', 1]]);
    expect(seriesStateAt(s, T0 + 5 * MIN, ctx())).toMatchObject({ state: 'off', known: true, changedAt: null });
    expect(seriesStateAt(s, T0 + 10 * MIN, ctx())).toMatchObject({ state: 'on', known: true, changedAt: iso(T0 + 10 * MIN) });
    expect(seriesStateAt(s, T0 + 15 * MIN, ctx())).toMatchObject({ state: 'on', known: true });
    expect(seriesStateAt(s, T0 + 25 * MIN, ctx())).toMatchObject({ state: 'off', known: true });
  });

  test('an unknown initial state stays unknown until the first point', () => {
    const s = series([[T0 + 10 * MIN, 'on', 1]], { initial: { state: null, known: false } });
    expect(seriesStateAt(s, T0 + 5 * MIN, ctx())).toMatchObject({ known: false, state: null, reason: 'before_history' });
    expect(seriesStateAt(s, T0 + 11 * MIN, ctx())).toMatchObject({ known: true, state: 'on' });
  });

  test('forward fill: the last point is carried at most forward_fill_max_s unless a later change is recorded', () => {
    const s = series([[T0, 'on', 1]]);
    const c = ctx({ forwardFillMaxS: 600, to: T0 + 120 * MIN });
    expect(seriesStateAt(s, T0 + 9 * MIN, c)).toMatchObject({ known: true, state: 'on' });
    expect(seriesStateAt(s, T0 + 11 * MIN, c)).toMatchObject({ known: false, reason: 'forward_fill_exceeded' });
    // bounded_after: a later change exists after the range, so the state holds until then
    expect(seriesStateAt({ ...s, bounded_after: true }, T0 + 100 * MIN, c)).toMatchObject({ known: true, state: 'on' });
    // a later point in the range bounds it too
    const s2 = series([[T0, 'on', 1], [T0 + 110 * MIN, 'off', 1]]);
    expect(seriesStateAt(s2, T0 + 100 * MIN, c)).toMatchObject({ known: true, state: 'on' });
  });

  test('inside a gap the state is unknown; a state is never carried across a gap', () => {
    const gap = { from: T0 + 20 * MIN, to: T0 + 30 * MIN };
    const s = series([[T0 + 10 * MIN, 'on', 1], [T0 + 40 * MIN, 'off', 1]]);
    const c = ctx({ gaps: [gap] });
    expect(seriesStateAt(s, T0 + 15 * MIN, c)).toMatchObject({ known: true, state: 'on' });
    expect(seriesStateAt(s, T0 + 25 * MIN, c)).toMatchObject({ known: false, reason: 'gap' });
    expect(seriesStateAt(s, T0 + 35 * MIN, c)).toMatchObject({ known: false, reason: 'gap' }); // after the gap, before a new point
    expect(seriesStateAt(s, T0 + 45 * MIN, c)).toMatchObject({ known: true, state: 'off' });
    // the initial state is not carried across a gap either
    expect(seriesStateAt(series([]), T0 + 35 * MIN, c)).toMatchObject({ known: false, reason: 'gap' });
    // a point recorded at the reconnect is known
    const s3 = series([[gap.to, 'on', 1]]);
    expect(seriesStateAt(s3, gap.to + MIN, c)).toMatchObject({ known: true, state: 'on' });
  });

  test('a bucketed point with several changes marks "changed during" inside its bucket', () => {
    const s = series([[T0, 'on', 4], [T0 + 5 * MIN, 'off', 1]]);
    const c = ctx({ bucketS: 300 });
    expect(seriesStateAt(s, T0 + 2 * MIN, c)).toMatchObject({ state: 'on', known: true, changedDuring: true });
    expect(seriesStateAt(s, T0 + 6 * MIN, c)).toMatchObject({ state: 'off', changedDuring: false });
    expect(seriesStateAt(s, T0 + 2 * MIN, ctx())).toMatchObject({ changedDuring: false }); // exact points never
  });
});

const snapshot = (over: Partial<HistorySnapshot['layers']> = {}): HistorySnapshot => ({
  at: iso(T0), floor_id: 'f1', settings: { range_max_days: 7, presence_retention_days: 7 },
  coverage: { from: iso(T0 - 86400_000), to: iso(T0), gaps: [], forward_fill_max_s: 86400 },
  layers: {
    lights: { status: 'ok', retention_days: 30, from: null, entities: { 'light.a': { state: 'on', changed_at: iso(T0 - MIN), known: true, reason: null }, 'light.b': { state: 'on', changed_at: null, known: false, reason: 'forward_fill_exceeded' } } },
    presence: { status: 'not_permitted', retention_days: 7, from: null, entities: { 'binary_sensor.leak': { state: 'on', changed_at: null, known: true, reason: null } } },
    openings: { status: 'ok', retention_days: 30, from: null, entities: { 'binary_sensor.door': { state: 'on', changed_at: iso(T0), known: true, reason: null } } },
    temperature: { status: 'empty', retention_days: 30, from: null, entities: {} },
    devices: { status: 'ok', retention_days: 30, from: null, entities: {} },
    alarm: { status: 'ok', retention_days: 30, from: null, entities: { 'alarm_control_panel.home': { state: 'armed_home', changed_at: iso(T0 - 60 * MIN), known: true, reason: null } } },
    elevators: { status: 'ok', retention_days: 8, from: null, position: 'not_recorded', items: { e1: { name: 'צפונית', state: 'ok', at: iso(T0), known: true } } },
    cameras: { status: 'ok', camera_ids: ['c1', 'c2'] },
    events: { status: 'ok', retention_days: 30 },
    ...over,
  },
});

test.describe('replay + drawn states', () => {
  test('a snapshot: known states only; a locked layer brings no data even if the body carried some', () => {
    const r = replayFromSnapshot(snapshot());
    expect(r.entities['light.a']).toMatchObject({ state: 'on', known: true, layer: 'lights' });
    expect(r.entities['light.b']).toMatchObject({ state: null, known: false });
    expect(r.entities['binary_sensor.leak']).toBeUndefined();
    expect(r.status.presence).toBe('not_permitted');
    expect(r.elevators.e1).toMatchObject({ state: 'ok', known: true });
    expect(r.status.cameras).toBe('ok');
  });

  test('drawn: known + switched on + permitted; everything else an explicit null', () => {
    const r = replayFromSnapshot(snapshot());
    const sw = defaultSwitches();
    const ids = ['light.a', 'light.b', 'binary_sensor.door', 'binary_sensor.leak', 'switch.unlisted'];
    const d = drawnStates(r, sw, ids);
    expect(d.states).toEqual({ 'binary_sensor.door': 'on', 'binary_sensor.leak': null, 'light.a': 'on', 'light.b': null, 'switch.unlisted': null });
    expect(d.lastChanged['light.a']).toBe(iso(T0 - MIN));
    const off = drawnStates(r, { ...sw, lights: false }, ids);
    expect(off.states['light.a']).toBeNull();
    expect(off.states['binary_sensor.door']).toBe('on');
    expect(drawnStates(null, sw, ['light.a']).states).toEqual({ 'light.a': null });
  });

  test('a range at t: the layer status turns "gap" inside a gap and the states are unknown', () => {
    const range: HistoryRange = {
      from: iso(T0), to: iso(T0 + 60 * MIN), floor_id: 'f1', bucket_s: null,
      coverage: { from: iso(T0 - 86400_000), to: iso(T0 + 60 * MIN), gaps: [{ from: iso(T0 + 20 * MIN), to: iso(T0 + 30 * MIN), reason: 'disconnected' }], forward_fill_max_s: 86400 },
      layers: {
        lights: { status: 'ok', retention_days: 30, from: null, entities: { 'light.a': series([[T0 + 5 * MIN, 'on', 1]], { bounded_after: true }) } },
        presence: { status: 'not_permitted', retention_days: 7, from: null, entities: {} },
        elevators: { status: 'ok', retention_days: 8, from: null, position: 'not_recorded', items: { e1: { name: 'צפונית', ...series([[T0, 'fault', 1]], { bounded_after: true }) } } },
      },
    };
    const base = replayFromSnapshot(snapshot());
    const a = replayFromRange(range, T0 + 10 * MIN, base);
    expect(a.entities['light.a']).toMatchObject({ state: 'on', known: true, layer: 'lights' });
    expect(a.status.lights).toBe('ok');
    expect(a.status.cameras).toBe('ok'); // carried from the snapshot
    expect(a.elevators.e1).toMatchObject({ state: 'fault', known: true });
    const g = replayFromRange(range, T0 + 25 * MIN, base);
    expect(g.status.lights).toBe('gap');
    expect(g.entities['light.a']).toMatchObject({ known: false });
    expect(g.elevators.e1.known).toBe(false);
    expect(g.status.presence).toBe('not_permitted');
  });

  test('lanes: active spans cut by gaps, bucket hatching, marks; a locked layer draws nothing', () => {
    const range: HistoryRange = {
      from: iso(T0), to: iso(T0 + 60 * MIN), floor_id: 'f1', bucket_s: 300,
      coverage: { from: iso(T0 - 86400_000), to: iso(T0 + 60 * MIN), gaps: [{ from: iso(T0 + 20 * MIN), to: iso(T0 + 30 * MIN), reason: 'disconnected' }], forward_fill_max_s: 86400 },
      layers: {
        lights: { status: 'ok', retention_days: 30, from: null, entities: {
          'light.a': series([[T0 + 5 * MIN, 'on', 3], [T0 + 40 * MIN, 'off', 1]]),
          'light.b': series([[T0 + 10 * MIN, 'on', 1], [T0 + 15 * MIN, 'off', 1]]),
        } },
        presence: { status: 'not_permitted', retention_days: 7, from: null, entities: {} },
      },
    };
    const lane = laneOf(range, 'lights', T0, T0 + 60 * MIN, defaultSwitches(), {});
    const on = lane.spans.filter((s) => s.kind === 'on').map((s) => [(s.from - T0) / MIN, (s.to - T0) / MIN]);
    expect(on).toEqual([[5, 20]]); // light.a on from 5, cut by the gap at 20 and unknown until its next point at 40 (off)
    expect(lane.spans.filter((s) => s.kind === 'changed').map((s) => [(s.from - T0) / MIN, (s.to - T0) / MIN])).toEqual([[5, 10]]);
    expect(lane.marks.map((m) => (m - T0) / MIN)).toEqual([5, 10, 15, 40]);
    expect(lane.off).toBe(false);
    const pres = laneOf(range, 'presence', T0, T0 + 60 * MIN, { ...defaultSwitches(), presence: true }, {});
    expect(pres).toMatchObject({ locked: true, off: true, spans: [], marks: [] });
    expect(laneOf(range, 'lights', T0, T0 + 60 * MIN, { ...defaultSwitches(), lights: false }, {}).off).toBe(true);
    expect(gapsInWindow(range.coverage.gaps, T0 + 25 * MIN, T0 + 60 * MIN).map((g) => [(g.from - T0) / MIN, (g.to - T0) / MIN])).toEqual([[25, 30]]);
  });

  test('active states per layer', () => {
    expect(activeState('lights', 'on')).toBe(true);
    expect(activeState('lights', 'off')).toBe(false);
    expect(activeState('openings', 'open')).toBe(true);
    expect(activeState('alarm', 'armed_away')).toBe(true);
    expect(activeState('alarm', 'disarmed')).toBe(false);
    expect(activeState('elevators', 'fault')).toBe(true);
    expect(activeState('devices', 'on')).toBe(false);
    expect(activeState('lights', null)).toBe(false);
  });
});

test.describe('switches, texts, helpers', () => {
  test('presence is off by default; the memory round-trips and ignores damage', () => {
    const d = defaultSwitches();
    expect(d.presence).toBe(false);
    expect(d.lights && d.cameras && d.events).toBe(true);
    expect(parseSwitches(serializeSwitches({ ...d, presence: true, lights: false }))).toMatchObject({ presence: true, lights: false, openings: true });
    expect(parseSwitches('not json')).toEqual(d);
    expect(parseSwitches('[1,2]')).toEqual(d);
    expect(parseSwitches('{"lights":"yes","alarm":false}')).toMatchObject({ lights: true, alarm: false });
    expect(parseSwitches(null)).toEqual(d);
  });

  test('legend status and coverage texts', () => {
    expect(layerStatusText('ok')).toEqual({ text: 'ידוע', look: 'ok' });
    expect(layerStatusText('empty').text).toBe('אין בקומה');
    expect(layerStatusText('not_recorded').text).toBe('לא מוקלט');
    expect(layerStatusText('gap')).toEqual({ text: 'פער בהקלטה', look: 'warn' });
    expect(layerStatusText('not_permitted')).toEqual({ text: 'לא מורשה', look: 'lock' });
    expect(coverageText(30)).toBe('· 30 יום');
    expect(coverageText(7)).toBe('· 7 ימים');
    expect(coverageText(null)).toBe('');
    expect(daysText(1)).toBe('יום אחד');
  });

  test('gapAt, classification, room counts, playback steps', () => {
    const gaps = [{ from: iso(T0), to: iso(T0 + 10 * MIN), reason: 'disconnected' }];
    expect(gapAt(gaps, T0 + MIN)?.reason).toBe('disconnected');
    expect(gapAt(gaps, T0 + 10 * MIN)).toBeNull();
    expect(classifyEntity({ id: 'binary_sensor.m', domain: 'binary_sensor', device_class: 'motion' })).toBe('presence');
    expect(classifyEntity({ id: 'lock.front', domain: 'lock', device_class: null })).toBe('openings');
    expect(classifyEntity({ id: 'switch.x', domain: 'switch', device_class: null, layer_id: 'lights' })).toBe('lights');
    expect(classifyEntity({ id: 'switch.x', domain: 'switch', device_class: null, layer_id: 'devices' })).toBe('devices');
    expect(classifyEntity({ id: 'sensor.t', domain: 'sensor', device_class: 'temperature' })).toBe('temperature');
    expect(classifyEntity({ id: 'alarm_control_panel.h', domain: 'alarm_control_panel', device_class: null })).toBe('alarm');
    const sq = (x: number) => [{ x, y: 0 }, { x: x + 0.2, y: 0 }, { x: x + 0.2, y: 0.2 }, { x, y: 0.2 }];
    expect(roomsKnown([{ polygon: sq(0) }, { polygon: sq(0.5) }, { polygon: [] }], [{ x: 0.1, y: 0.1, state: 'on' }, { x: 0.6, y: 0.1, state: null }])).toEqual({ known: 1, total: 2 });
    expect(advance(T0, 1000, 60, T0 + 120_000)).toEqual({ t: T0 + 60_000, ended: false });
    expect(advance(T0, 1000, 600, T0 + 120_000)).toEqual({ t: T0 + 120_000, ended: true });
  });
});
