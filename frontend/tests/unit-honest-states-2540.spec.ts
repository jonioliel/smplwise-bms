import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptOverview, type HDoor, type Overview } from '../src/home/home-api';
import { doorNotLocked, doorOpen, doorState, doorTone, doorsText, doorsTone, lockKnown } from '../src/home/home-logic';
import { sceneSuggestions } from '../src/home/home-favgrid';
import { alarmLook, securityChip } from '../src/home/home-v3-words';
import { toggled } from '../src/components/toggle-value';

// HONEST-STATES-2540 (deep review SCR-09, SCR-10, FC-01): the home interface never shows an offline / unknown lock as an open door or an
// unavailable / unknown alarm panel as armed, and a controlled sw-toggle's asked value is read from the event (the switch has not moved).
// Pure rules in Node; the drawn screens and the switch itself are in evidence-honest-states-2540.spec.ts.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '..', 'src', f), 'utf8');

const D = (name: string, o: Partial<HDoor> = {}): HDoor => ({ id: `lock.${name}`, name, locked: false, known: true, can: true, ok: true, wiskey: false, room: 'r1', kind: 'door', noOpen: null, ...o });
const off = (name: string) => D(name, { ok: false, known: false, can: false });
const unk = (name: string) => D(name, { known: false });

test.describe('SCR-10: a lock the screen cannot read is not an open door', () => {
  test('lockKnown: available and a lock state; null, unknown, unavailable or a new word is not known', () => {
    for (const s of ['locked', 'unlocked', 'open', 'opening', 'locking', 'unlocking', 'jammed']) expect(lockKnown(s, true), s).toBe(true);
    for (const s of [null, 'unknown', 'unavailable', 'something_new']) expect(lockKnown(s, true), String(s)).toBe(false);
    expect(lockKnown('locked', false)).toBe(false);
  });

  test('the overview adapter: an offline lock and an unknown state are known=false and never locked', () => {
    const lock = (id: string, state: string | null, available: boolean) => ({
      entity_id: `lock.${id}`, name: id, domain: 'lock', state, available, active: state === 'locked', can_control: true, locked: state === 'locked',
      wiskey_door: false, unlock_reason: 'ok', can_unlock: true,
    });
    const ov = {
      floors: [],
      rooms: [{
        id: 'r1', name: 'r1', floor_id: 'g', temperature: null, open_count: 0, can_bulk: true, lights: [], switches: [], climate: [], shades: [],
        locks: [lock('a', 'locked', true), lock('b', 'unlocked', true), lock('c', 'unavailable', false), lock('d', 'unknown', true), lock('e', null, true)],
      }],
      can_bulk: true, modules: ['doors'], policy: {}, weather: null,
    } as unknown as Overview;
    const doors = adaptOverview(ov, []).rooms[0].doors;
    expect(doors.map((d) => [d.id, d.known, d.locked, d.ok])).toEqual([
      ['lock.a', true, true, true], ['lock.b', true, false, true], ['lock.c', false, false, false], ['lock.d', false, false, true], ['lock.e', false, false, true],
    ]);
  });

  test('open / not locked / tone of one door', () => {
    expect(doorOpen(D('a'))).toBe(true);
    expect(doorOpen(unk('a'))).toBe(false);
    expect(doorOpen(off('a'))).toBe(false);
    expect(doorNotLocked(unk('a'))).toBe(true); // the "not locked" filter keeps a door it cannot vouch for
    expect(doorNotLocked(D('a', { locked: true }))).toBe(false);
    expect([doorTone(D('a', { locked: true })), doorTone(D('a')), doorTone(unk('a')), doorTone(off('a'))]).toEqual(['ok', 'warn', 'neutral', 'neutral']);
  });

  test('the state words of one door', () => {
    expect(doorState(D('a', { locked: true }))).toBe('נעולה');
    expect(doorState(D('a'))).toBe('פתוחה');
    expect(doorState(D('g', { kind: 'gate' }))).toBe('פתוח');
    expect(doorState(unk('a'))).toBe('לא ידוע');
    expect(doorState(off('a'))).toBe('לא זמינה כרגע');
  });

  test('the doors summary: an open door wins; an unknown lock is never "open" and never lets "all locked" through', () => {
    const lockedFront = D('דלת הכניסה', { locked: true });
    expect(doorsText([off('דלת המחסן')])).toBe('מצב דלת המחסן לא ידוע');
    expect(doorsText([off('a'), unk('b')])).toBe('מצב הדלתות לא ידוע');
    expect(doorsText([lockedFront, off('דלת המחסן')])).toBe('מצב דלת המחסן לא ידוע');
    expect(doorsText([lockedFront, off('a'), unk('b')])).toBe('מצב 2 דלתות לא ידוע');
    expect(doorsText([D('דלת אחורית'), off('a')])).toBe('דלת אחורית פתוחה');
    expect(doorsText([lockedFront])).toBe('כל הדלתות נעולות');
    expect(doorsText([])).toBe('אין דלתות מחוברות');
    expect(doorsTone([lockedFront, off('a')])).toBe('neutral');
    expect(doorsTone([D('b'), off('a')])).toBe('warn');
    expect(doorsTone([lockedFront])).toBe('ok');
    expect(doorsTone([])).toBe('neutral');
  });

  test('the leaving / night suggestion never offers to lock a door whose state is unknown', () => {
    const [first] = sceneSuggestions('leave', [], [D('back'), unk('side')]);
    expect(first.kind === 'lock' && first.doors.map((d) => d.id)).toEqual(['lock.back']);
    expect(sceneSuggestions('leave', [], [unk('side')])).toEqual([]);
  });

  test('source: no home screen counts doors with a bare !locked any more', () => {
    for (const f of ['home/sw-home.ts', 'home/home-wall-rest.ts', 'home/home-logic.ts']) expect(src(f), f).not.toMatch(/filter\(\(\w\) => !\w\.locked\)/);
  });
});

test.describe('SCR-09: an alarm panel the screen cannot read is not armed', () => {
  test('alarmLook', () => {
    expect(alarmLook('armed_away')).toBe('armed');
    expect(alarmLook('pending')).toBe('armed');
    expect(alarmLook('disarmed')).toBe('disarmed');
    expect(alarmLook('triggered')).toBe('triggered');
    expect(alarmLook('unavailable')).toBe('unavailable');
    expect(alarmLook('armed_away', false)).toBe('unavailable');
    expect(alarmLook('unknown')).toBe('unknown');
    expect(alarmLook(null)).toBe('unknown');
    expect(alarmLook('something_new')).toBe('unknown');
  });

  test('the security chip', () => {
    const P = (state: string | null, available = true) => ({ state, available });
    expect(securityChip([P('unavailable', false)])).toEqual({ text: 'לא זמין', tone: 'warn' });
    expect(securityChip([P('armed_home', false)])).toEqual({ text: 'לא זמין', tone: 'warn' });
    expect(securityChip([P('unknown')])).toEqual({ text: 'לא ידוע', tone: '' });
    expect(securityChip([P(null)])).toEqual({ text: 'לא ידוע', tone: '' });
    expect(securityChip([P('disarmed'), P('unavailable', false)])).toEqual({ text: 'לא ידוע', tone: '' });
    expect(securityChip([P('disarmed')])).toEqual({ text: 'לא דרוך', tone: '' });
    expect(securityChip([P('armed_away')])).toEqual({ text: 'דרוך', tone: 'ok' });
    expect(securityChip([P('armed_away'), P('unknown')])).toEqual({ text: 'דרוך', tone: 'ok' });
    expect(securityChip([P('triggered'), P('armed_away')])).toEqual({ text: 'אזעקה!', tone: 'warn' });
  });

  test('source: the chip and the alarm screen read the shared rule, not "state !== disarmed"', () => {
    expect(src('home/sw-home.ts')).toContain('securityChip(this.panels)');
    expect(src('home/sw-home.ts')).not.toContain("p.state !== 'disarmed'");
    expect(src('home/home-alarm.ts')).not.toContain("p.state !== 'disarmed'");
  });
});

test.describe('FC-01: a controlled sw-toggle', () => {
  test('toggled(): the asked value from detail.checked; a native check box (no detail) reads its own checked', () => {
    const asked = { detail: { checked: true }, target: { checked: false } } as unknown as Event;
    expect(toggled(asked)).toBe(true);
    const native = { target: { checked: true } } as unknown as Event;
    expect(toggled(native)).toBe(true);
  });

  test('source: the switch does not move itself when controlled; the automation editor and the camera OSD switches are controlled', () => {
    const t = src('components/sw-toggle.ts');
    expect(t).toContain('if (!this.controlled) this.checked = want;');
    expect(t).toContain('detail: { checked: want }');
    expect(src('screens/automation-editor-base.ts')).toMatch(/<sw-toggle class="tgl" controlled [^>]*data-enable-toggle/);
    const cam = src('screens/live-camera.ts');
    expect(cam).toMatch(/<sw-toggle size="sm" controlled [^>]*data-osd-name-enabled/);
    expect(cam).toMatch(/<sw-toggle size="sm" controlled [^>]*data-osd-datetime-enabled/);
  });
});
