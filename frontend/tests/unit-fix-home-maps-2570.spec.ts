import { test, expect } from '@playwright/test';
import { makeTargetSender, type TargetOutcome } from '../src/home/home-target';
import { doorOpen, doorsText, doorsTone, doorState, doorPhaseOf, doorTone } from '../src/home/home-logic';
import { bulkBusyKind } from '../src/screens/map-room-bulk';
import type { HDoor } from '../src/home/home-api';

// FIX-HOME-MAPS-2570 (deep review MH-02, MH-03, MH-04): the pure rules, in Node.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-home-maps-2570.spec.ts

test.describe('MH-02: two quick +/- on an A/C that is off - the value sent last is the value the screen shows', () => {
  const Z = { id: 'climate.a', min: 16, max: 30, modes: ['off', 'cool'] };
  const mode = () => 'cool';

  function rig() {
    const sent: { action: string; args: Record<string, unknown> }[] = [];
    let releaseMode: (o: TargetOutcome) => void = () => undefined;
    const send = (_k: string, _id: string, action: string, args: Record<string, unknown>): Promise<TargetOutcome> => {
      sent.push({ action, args });
      return action === 'climate.set_hvac_mode' ? new Promise((r) => (releaseMode = r)) : Promise.resolve({ ok: true, note: null });
    };
    return { sent, send, release: (o: TargetOutcome = { ok: true, note: null }) => releaseMode(o) };
  }

  test('the second tap\'s setpoint is the last one sent, once, after the turn-on', async () => {
    const r = rig();
    const set = makeTargetSender(r.send, mode);
    const first = set(Z, 24, true);
    const second = set(Z, 25, false); // the screen's optimistic mode: wasOff is false now
    r.release();
    await Promise.all([first, second]);
    expect(r.sent.map((s) => s.action)).toEqual(['climate.set_hvac_mode', 'climate.set_temperature']);
    expect(r.sent[1].args).toEqual({ temperature: 25 });
  });

  test('a failed turn-on sends no setpoint and both taps get the failure', async () => {
    const r = rig();
    const set = makeTargetSender(r.send, mode);
    const a = set(Z, 24, true);
    const b = set(Z, 25, false);
    r.release({ ok: false, note: 'x' });
    expect((await a).ok).toBe(false);
    expect((await b).ok).toBe(false);
    expect(r.sent.map((s) => s.action)).toEqual(['climate.set_hvac_mode']);
  });

  test('a unit that is on gets the setpoint at once, clamped', async () => {
    const r = rig();
    const set = makeTargetSender(r.send, mode);
    await set(Z, 99, false);
    expect(r.sent).toEqual([{ action: 'climate.set_temperature', args: { temperature: 30 } }]);
  });
});

const D = (state: string | null, locked: boolean): HDoor => ({ id: 'lock.d', name: 'דלת', locked, known: true, phase: doorPhaseOf(state, true), can: true, ok: true, wiskey: false, room: 'r', kind: 'door', noOpen: null });

test.describe('MH-03: a jammed or moving lock is not announced as an open door', () => {
  test('jammed is its own warning, never open', () => {
    const d = D('jammed', false);
    expect(doorOpen(d)).toBe(false);
    expect(doorsText([d])).toBe('דלת תקועה');
    expect(doorState(d)).toBe('תקועה');
    expect(doorTone(d)).toBe('warn');
    expect(doorsTone([d])).toBe('warn');
  });
  test('locking / unlocking are transitions, not open', () => {
    for (const [st, word] of [['locking', 'ננעלת…'], ['unlocking', 'נפתחת…']] as const) {
      const d = D(st, false);
      expect(doorOpen(d)).toBe(false);
      expect(doorState(d)).toBe(word);
      expect(doorsText([d])).toBe(`דלת ${word}`);
      expect(doorTone(d)).toBe('neutral');
    }
  });
  test('an unlocked door is still open', () => {
    const d = D('unlocked', false);
    expect(doorOpen(d)).toBe(true);
    expect(doorsText([d])).toBe('דלת פתוחה');
  });
});

test('MH-04: a tap while a batch runs says whose batch it is', () => {
  expect(bulkBusyKind('z1', 'z1')).toBe('same');
  expect(bulkBusyKind('z1', 'z2')).toBe('other');
  expect(bulkBusyKind(null, 'z2')).toBe('other');
});
