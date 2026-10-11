import { test, expect } from '@playwright/test';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneInput } from '../src/map/scene-builder';
import { REPLAY_VIEW, replayInstant, replayStates, stateAtOf, type ReplayAnchor } from '../src/map/replay-3d';

// ST7HIST (CR-029 section 14) in node: the states a past instant replays (known only, explicit nulls, sorted keys - the same
// bundle in any anchor order gives the same description), the instant for the sun, the replay screens' switches, and the
// realistic part on a replayed description being additive and deterministic (levels 1-2 get the description of before).

const ent = (id: string, state: string | null, known: boolean): ReplayAnchor => ({ resource_type: 'ha_entity', resource_id: id, entity: { state_at: { state, known } } });
const cam = (id: string): ReplayAnchor => ({ resource_type: 'camera', resource_id: id, entity: null });

test('replayStates: known states only, explicit nulls, a circuit only when known, cameras ignored', () => {
  const anchors: ReplayAnchor[] = [
    ent('lock.front', 'locked', true),
    ent('light.hall', 'on', false), // the last value before the history began: never drawn
    ent('binary_sensor.door', null, true),
    { resource_type: 'ha_entity', resource_id: 'sensor.no_history', entity: null },
    { resource_type: 'ha_entity', resource_id: 'sensor.live_only', entity: { state_at: null } },
    cam('cam-1'),
  ];
  const r = replayStates(anchors, { c2: { state: 'on', known: true }, c1: { state: 'on', known: false }, c3: { state: null, known: true } });
  expect(r.entityStates).toEqual({ 'binary_sensor.door': null, 'light.hall': null, 'lock.front': 'locked', 'sensor.live_only': null, 'sensor.no_history': null });
  expect(r.circuitStates).toEqual({ c1: null, c2: 'on', c3: null });
  expect(Object.keys(r.entityStates)).toEqual([...Object.keys(r.entityStates)].sort());
  expect(Object.keys(r.circuitStates)).toEqual(['c1', 'c2', 'c3']);
  expect(stateAtOf(cam('cam-1'))).toBeNull();
});

test('replayStates: the same bundle in any order gives the same answer; a known state wins over an unknown twin', () => {
  const a = [ent('light.b', 'off', true), ent('light.a', 'on', true), ent('light.a', null, false)];
  const b = [ent('light.a', null, false), ent('light.a', 'on', true), ent('light.b', 'off', true)];
  expect(JSON.stringify(replayStates(a, {}))).toBe(JSON.stringify(replayStates(b, {})));
  expect(replayStates(b, {}).entityStates['light.a']).toBe('on');
});

test('replayInstant: ISO and epoch ms; anything else is null', () => {
  expect(replayInstant('2026-06-21T09:30:00Z')).toBe(Date.UTC(2026, 5, 21, 9, 30));
  expect(replayInstant('2026-06-21T09:30:00.250Z')).toBe(Date.UTC(2026, 5, 21, 9, 30, 0, 250));
  expect(replayInstant(1234)).toBe(1234);
  for (const bad of [null, undefined, '', 'yesterday', Number.NaN]) expect(replayInstant(bad as never)).toBeNull();
});

test('a replay screen offers no walk and no stills', () => {
  expect(REPLAY_VIEW).toEqual({ walkable: false, stillsAvailable: false });
});

test('a replayed description: the realistic part is additive and deterministic; the walk world never rides on it', () => {
  const base = demoSceneInput('f0')!;
  const input = (): SceneInput => ({ ...base, doc: JSON.parse(JSON.stringify(base.doc)), anchors: JSON.parse(JSON.stringify(base.anchors)), entityStates: replayStates([], {}).entityStates, circuitStates: {}, anchorsEveryLevel: true });
  const plain = buildScene(input());
  expect('real' in plain).toBe(false);
  expect('walk' in plain).toBe(false);
  const realA = buildScene({ ...input(), realistic: true });
  const realB = buildScene({ ...input(), realistic: true });
  expect(JSON.stringify(realB)).toBe(JSON.stringify(realA)); // same input -> same description (and so the same scene graph)
  expect(realA.real).toBeTruthy();
  expect('walk' in realA).toBe(false);
  // the base parts are those of levels 1-2: the realistic level only adds its own part
  expect(JSON.stringify({ ...realA, real: undefined })).toBe(JSON.stringify({ ...plain, real: undefined }));
});
