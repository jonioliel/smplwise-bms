import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HaActionSpec } from '../src/api/ha';
import { argKey, argOptional, argsToSend } from '../src/screens/map-action-args';
import { changeArrow, changeText } from '../src/i18n/bidi';
import { mergeById, systemTile, CAMERA_REFRESH_MS } from '../src/screens/wall-refresh';
import { PushRefresh, PUSH_MAX_WAIT_MS, homeDraws, keepLocal } from '../src/home/home-refresh';
import type { HLight, HRoom, HZone } from '../src/home/home-api';
import { newBuildAvailable } from '../src/wall/wall-logic';

// MEDIUM-REST-2540 (deep review SCR-17, SCR-26, SCR-27, SCR-30, SCR-31 and the wall display's new-build notice): the pure rules, in Node.
// The drawn screens and the requests they send are in evidence-medium-rest-2540.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-medium-rest-2540.spec.ts

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '..', 'src', f), 'utf8');
const FSI = '⁨';
const PDI = '⁩';

// ------------------------------------------------------------------------------------------------ SCR-17: the map's action arguments

const SET_T: HaActionSpec = { id: 'climate.set_temperature', label: 'טמפרטורת יעד', sensitive: false, argument_specs: [{ name: 'temperature', type: 'float', min: 5, max: 35 }] } as HaActionSpec;
const LIGHT_ON: HaActionSpec = { id: 'light.turn_on', label: 'הדלקה', sensitive: false, argument_specs: [{ name: 'brightness_pct', type: 'int', min: 1, max: 100 }] } as HaActionSpec;

test.describe('SCR-17: an argument belongs to one entity; an optional one is sent only when typed', () => {
  test('the key names the entity, the action and the argument', () => {
    expect(argKey('climate.a', 'climate.set_temperature', 'temperature')).not.toBe(argKey('climate.b', 'climate.set_temperature', 'temperature'));
  });

  test('a target typed for thermostat A is not sent for thermostat B (B gets its own default)', () => {
    const typed = { [argKey('climate.a', SET_T.id, 'temperature')]: '19' };
    expect(argsToSend('climate.a', SET_T, typed, () => '24')).toEqual({ temperature: 19 });
    expect(argsToSend('climate.b', SET_T, typed, () => '24')).toEqual({ temperature: 24 });
  });

  test('a light turned on with nothing typed gets no brightness (it keeps its own level); a typed level is sent', () => {
    expect(argOptional('light.turn_on', 'brightness_pct')).toBe(true);
    expect(argOptional('climate.set_temperature', 'temperature')).toBe(false);
    expect(argsToSend('light.l', LIGHT_ON, {}, () => '100')).toEqual({});
    expect(argsToSend('light.l', LIGHT_ON, { [argKey('light.l', 'light.turn_on', 'brightness_pct')]: '35' }, () => '100')).toEqual({ brightness_pct: 35 });
    // another light's level is not this light's
    expect(argsToSend('light.m', LIGHT_ON, { [argKey('light.l', 'light.turn_on', 'brightness_pct')]: '35' }, () => '100')).toEqual({});
  });

  test('a volume goes back to a fraction; an empty or broken number is not sent', () => {
    const vol = { id: 'media_player.volume_set', label: 'v', sensitive: false, argument_specs: [{ name: 'volume_level', type: 'float', min: 0, max: 1 }] } as HaActionSpec;
    expect(argsToSend('media_player.x', vol, {}, () => '40')).toEqual({ volume_level: 0.4 });
    expect(argsToSend('media_player.x', vol, { [argKey('media_player.x', vol.id, 'volume_level')]: '' }, () => '40')).toEqual({});
  });

  test('the map uses these rules, keys by entity, and forgets typed values when the selection changes', () => {
    const m = src('screens/explore-floor-map.ts');
    expect(m).toContain("import { argKey, argsToSend } from './map-action-args';");
    expect(m).toContain('return argsToSend(e.entity_id, spec, this.actionArgs, (a) => this.argDefault(e, a));');
    expect(m).toContain('[argKey(d.entityId, d.spec.id, k)]: String(v)');
    expect(m).not.toMatch(/this\.actionArgs\[`\$\{spec\.id\}:/);
    expect(m).toMatch(/changed\.has\('selectedId'\) && Object\.keys\(this\.actionArgs\)\.length/);
  });
});

// ------------------------------------------------------------------------------------------------ SCR-27: before -> after

test.describe('SCR-27: the arrow of a change points from the old value to the new one in the reading direction', () => {
  test('Hebrew points left, English right; each value is isolated', () => {
    expect(changeArrow(true)).toBe('←');
    expect(changeArrow(false)).toBe('→');
    expect(changeText(40, 60, true)).toBe(`${FSI}40${PDI} ← ${FSI}60${PDI}`);
    expect(changeText('Off', 'On', false)).toBe(`${FSI}Off${PDI} → ${FSI}On${PDI}`);
    expect(changeText(null, 5, true)).toBe(`${FSI}${PDI} ← ${FSI}5${PDI}`);
  });

  test('no fixed arrow is left in the motion confirmation and the three recorder dialogs', () => {
    const cam = src('screens/live-camera.ts');
    expect(cam).not.toMatch(/'כבוי → פעיל'|'פעיל → כבוי'|'שמאל → ימין'|'ימין → שמאל'/);
    expect(cam).toContain("changeText(m.sensitivity ?? '—', e.sensitivity)");
    for (const f of ['screens/nvr-confirm.ts', 'screens/nvr-encoding-batch.ts', 'screens/nvr-camera-editor.ts']) {
      const s = src(f);
      expect(s, f).toContain('${changeArrow()}');
      expect(s, f).not.toMatch(/<\/bdi>\s*(<span class="arrow" aria-hidden="true">)?←/);
    }
  });
});

// ------------------------------------------------------------------------------------------------ SCR-26: the walls read their cameras again

test.describe('SCR-26: the camera walls merge a new camera list by id; the kiosk system tile follows the health summary', () => {
  const a = { id: 'a', status: 'offline' };
  const b = { id: 'b', status: 'online' };

  test('an unchanged list keeps its array; an unchanged camera keeps its object; a changed one is new', () => {
    const prev = [a, b];
    expect(mergeById(prev, [{ ...a }, { ...b }])).toBe(prev);
    const next = mergeById(prev, [{ id: 'a', status: 'online' }, { ...b }]);
    expect(next).not.toBe(prev);
    expect(next[1]).toBe(b);
    expect(next[0]).toEqual({ id: 'a', status: 'online' });
    expect(mergeById(prev, [{ ...b }])).toEqual([b]);
    expect(mergeById(null, [a])).toEqual([a]);
    expect(CAMERA_REFRESH_MS).toBe(60_000);
  });

  test('the system tile: ok green, error red, warn / off neutral, no answer yet neutral, no connection red', () => {
    expect(systemTile('ok', false)).toEqual({ key: 'ok', tone: 'green', icon: 'check' });
    expect(systemTile('error', false)).toEqual({ key: 'error', tone: 'red', icon: 'warning' });
    expect(systemTile('warn', false)).toEqual({ key: 'warn', tone: '', icon: 'warning' });
    expect(systemTile('off', false).tone).toBe('');
    expect(systemTile(null, false).key).toBe('unknown');
    expect(systemTile('ok', true).key).toBe('offline');
  });

  test('both walls poll the list through the shared poll; the kiosk no longer names vendor components', () => {
    const kiosk = src('screens/kiosk-wall.ts');
    expect(kiosk).toContain("this.poller.every('cameras', CAMERA_REFRESH_MS, () => this.refreshCameras()");
    expect(kiosk).not.toContain('go2rtc + NVR');
    expect(kiosk).not.toMatch(/tr\('פעיל'\)/);
    const wall = src('screens/live-wall.ts');
    expect(wall).toContain("this.poller.every('cameras', CAMERA_REFRESH_MS, () => this.refreshCameras()");
  });
});

// ------------------------------------------------------------------------------------------------ SCR-30: the home's push refresh

function fakeTimers() {
  let now = 0;
  let seq = 0;
  const due = new Map<number, { at: number; fn: () => void }>();
  return {
    t: {
      set: (fn: () => void, ms: number) => { const id = ++seq; due.set(id, { at: now + ms, fn }); return id; },
      clear: (id: number) => void due.delete(id),
      now: () => now,
    },
    async advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...due.entries()].filter(([, d]) => d.at <= end).sort((x, y) => x[1].at - y[1].at)[0];
        if (!next) break;
        now = next[1].at;
        due.delete(next[0]);
        next[1].fn();
        for (let i = 0; i < 5; i++) await Promise.resolve();
      }
      now = end;
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}

test.describe('SCR-30: a burst of pushes refreshes within the maximum wait; a read is never overlapped', () => {
  test('pushes every 300 ms for 5 s: refreshes at most every 2 s (the plain trailing debounce never fired)', async () => {
    const f = fakeTimers();
    const runs: number[] = [];
    const r = new PushRefresh(() => void runs.push(f.t.now()), PUSH_MAX_WAIT_MS, f.t);
    for (let t = 0; t < 5000; t += 300) {
      r.poke();
      await f.advance(300);
    }
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs[0]).toBeLessThanOrEqual(PUSH_MAX_WAIT_MS);
    await f.advance(1000);
    const n = runs.length;
    await f.advance(5000);
    expect(runs.length).toBe(n); // quiet: nothing more
  });

  test('a single push still waits the quiet period; a command follow-up keeps its own delay', async () => {
    const f = fakeTimers();
    const runs: number[] = [];
    const r = new PushRefresh(() => void runs.push(f.t.now()), PUSH_MAX_WAIT_MS, f.t);
    r.poke();
    await f.advance(2000);
    expect(runs).toEqual([600]);
    r.poke(900);
    await f.advance(2000);
    expect(runs).toEqual([600, 2900]);
  });

  test('a refresh due while a read is still running runs once, after it', async () => {
    const f = fakeTimers();
    let open = 0;
    let most = 0;
    let finish: (() => void) | null = null;
    const r = new PushRefresh(() => new Promise<void>((res) => { open++; most = Math.max(most, open); finish = () => { open--; res(); }; }), PUSH_MAX_WAIT_MS, f.t);
    r.poke(0);
    await f.advance(10);
    r.poke(0);
    await f.advance(10);
    r.poke(0);
    await f.advance(10);
    expect(most).toBe(1);
    finish!();
    await f.advance(10);
    expect(open).toBe(1); // the one queued read
    finish!();
    await f.advance(10);
    expect(open).toBe(0);
    expect(most).toBe(1);
  });

  test('cancel drops a pending refresh', async () => {
    const f = fakeTimers();
    const runs: number[] = [];
    const r = new PushRefresh(() => void runs.push(1), PUSH_MAX_WAIT_MS, f.t);
    r.poke();
    r.cancel();
    await f.advance(5000);
    expect(runs).toEqual([]);
  });

  test('only what the home draws asks for a refresh', () => {
    for (const e of [{ entity_id: 'light.a' }, { entity_id: 'switch.b' }, { entity_id: 'climate.c' }, { entity_id: 'cover.d' }, { entity_id: 'lock.e' }, { entity_id: 'weather.home' },
      { entity_id: 'sensor.t', domain: 'sensor', device_class: 'temperature' }, { entity_id: 'binary_sensor.door', domain: 'binary_sensor', device_class: 'door' }]) {
      expect(homeDraws(e), e.entity_id).toBe(true);
    }
    for (const e of [{ entity_id: 'sensor.power', domain: 'sensor', device_class: 'power' }, { entity_id: 'binary_sensor.motion', domain: 'binary_sensor', device_class: 'motion' },
      { entity_id: 'media_player.tv' }, { entity_id: 'sensor.energy', domain: 'sensor', device_class: 'energy' }]) {
      expect(homeDraws(e), e.entity_id).toBe(false);
    }
    expect(homeDraws(null)).toBe(true);
  });

  test('keepLocal: a device with a command in flight keeps the object the screen shows; the others take the new answer', () => {
    const L = (id: string, on: boolean): HLight => ({ id, name: id, on, lvl: 50, sw: false, can: true, ok: true, room: 'r' });
    const Z = (id: string, mode: string): HZone => ({ id, name: id, room: 'r', temp: 24, target: 23, mode, modes: ['off', 'cool'], min: 16, max: 30, step: 1, can: true, ok: true, unit: '°C', action: null });
    const R = (lights: HLight[], zones: HZone[]): HRoom => ({ id: 'r', name: 'r', floor: 'g', temp: 24, canBulk: true, lights, loads: [], zones, shades: [], doors: [], cams: [] });
    const shown = L('light.a', false);
    const prev = [R([shown, L('light.b', false)], [Z('climate.z', 'cool')])];
    const next = [R([L('light.a', true), L('light.b', true)], [Z('climate.z', 'off')])];
    const out = keepLocal(prev, next, new Set(['light.a', 'climate.z']));
    expect(out[0].lights[0]).toBe(shown);
    expect(out[0].lights[1].on).toBe(true);
    expect(out[0].zones[0].mode).toBe('cool');
    expect(keepLocal(prev, next, new Set())).toBe(next);
  });

  test('the home wires the throttle, the domain filter, the sequence guard and the in-flight guard', () => {
    const h = src('home/sw-home.ts');
    expect(h).toContain("homeDraws(m.entity)");
    expect(h).toContain('this.refresher.poke(ms);');
    expect(h).toContain('if (seq !== this.ovSeq) return;');
    expect(h).toContain('base.rooms = keepLocal(this.data?.rooms, base.rooms, act.localIds(since));');
    expect(h).not.toContain('refreshT');
  });
});

// ------------------------------------------------------------------------------------------------ SCR-31: +/- on a zone that is off

test.describe('SCR-31: +/- on a zone that is off turns it on with the new target', () => {
  test('the screen reads "off" before its optimistic change and passes it on', () => {
    const h = src('home/sw-home.ts');
    const body = h.slice(h.indexOf('  a_temp(el: HTMLElement) {'), h.indexOf('  a_preset(el: HTMLElement) {'));
    expect(body.indexOf('const wasOff = z.mode === \'off\';')).toBeGreaterThan(-1);
    expect(body.indexOf('const wasOff')).toBeLessThan(body.indexOf('z.mode = mode'));
    expect(body).toContain('act.setTarget(z, z.target, wasOff)');
    const a = src('home/home-actions.ts');
    expect(a).toContain('export const setTarget = (z: HZone, target: number, wasOff = z.mode === \'off\'): Promise<Outcome> => sendTarget(z, target, wasOff);');
  });

  test('"room off" reads what is on before showing it off (the per-light path and the climate sent nothing)', () => {
    const h = src('home/sw-home.ts');
    const body = h.slice(h.indexOf('  private offLights('), h.indexOf('  // ---------------------------------------------------------------- events'));
    expect(body.indexOf('const lit = ')).toBeLessThan(body.indexOf('l.on = false'));
    expect(body.indexOf('const zonesOn = ')).toBeLessThan(body.indexOf("z.mode = 'off'"));
    expect(body).toContain('act.lightsOff(rs, this.bulkScope(rs), lit)');
    expect(body).toContain('act.climateOff(zonesOn)');
  });
});

// ------------------------------------------------------------------------------------------------ the wall display: a new build

test.describe('wall display: a quiet notice when the add-on was updated under it', () => {
  test('another release version on the server is a new build; the same, none, a test or development build is not', () => {
    expect(newBuildAvailable('2.54.0', '2.53.0')).toBe(true);
    expect(newBuildAvailable('2.53.0', '2.53.0')).toBe(false);
    expect(newBuildAvailable(undefined, '2.53.0')).toBe(false);
    expect(newBuildAvailable('', '2.53.0')).toBe(false);
    expect(newBuildAvailable('test', '2.53.0')).toBe(false);
    expect(newBuildAvailable('2.54.0', 'dev')).toBe(false);
    expect(newBuildAvailable('2.54.0', '')).toBe(false);
    expect(newBuildAvailable('x'.repeat(80), '2.53.0')).toBe(false);
  });

  test('the wall reads it from the health summary it already polls, and nothing reloads by itself', () => {
    const w = src('wall/sw-wall.ts');
    expect(w).toContain("newBuildAvailable(h.version, typeof __ARX_BUILD__ === 'string' ? __ARX_BUILD__ : '')");
    expect(w).toContain('data-wall-new-build @click=${() => location.reload()}');
    expect((w.match(/location\.reload\(/g) ?? []).length).toBe(1);
  });
});
