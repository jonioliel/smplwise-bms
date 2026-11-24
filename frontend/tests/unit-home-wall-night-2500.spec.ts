import { expect, test } from '@playwright/test';
import type { IdleScheduler } from '../src/map/kiosk-idle';
import {
  WALL_DEFAULTS, WallRest, dimOpacity, fmtHm, inWindow, isNight, localMinutes, parseHm, takeoverFor, wallSettings,
  type NoticeLike, type PanelLike, type WallSettings,
} from '../src/home/wall-rest-logic';

// HOME-WALL-NIGHT-2500 (owner 22.11, Q70 / Q71 / Q73 / Q74) in node: the wall panel's rest timer, night window and screen takeover
// against a fake clock - the exact second the rest screen comes, a touch / a door call / a takeover keeping it away, the night window
// across midnight and daylight saving (by IANA zone), the dim levels, and which alarm or notice takes the screen over.

/** A scheduler whose time only moves when the test says so; timers fire in order of their due time (as unit-kiosk-idle.spec.ts). */
class FakeClock implements IdleScheduler {
  t = Date.parse('2026-11-23T10:00:00Z'); // 12:00 in the installation's zone
  private seq = 0;
  private readonly timers = new Map<number, { at: number; fn: () => void }>();
  now(): number { return this.t; }
  setTimeout(fn: () => void, ms: number): unknown { const id = ++this.seq; this.timers.set(id, { at: this.t + Math.max(0, ms), fn }); return id; }
  clearTimeout(h: unknown): void { this.timers.delete(h as number); }
  tick(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      const next = [...this.timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.t = Math.max(this.t, next[1].at);
      this.timers.delete(next[0]);
      next[1].fn();
    }
    this.t = end;
  }
}

const S = (o: Partial<WallSettings> = {}): WallSettings => ({ ...WALL_DEFAULTS, ...o });
const at = (iso: string) => Date.parse(iso);

test.describe('HOME-WALL-NIGHT-2500 settings', () => {
  test('the defaults are the owner answers: rest on after 2 minutes, night 23:00-06:00, medium dim, alarm + urgent notice', () => {
    expect(wallSettings(undefined)).toEqual({ rest: true, restAfterMin: 2, night: true, nightStart: 1380, nightEnd: 360, nightDim: 'medium', takeover: 'alarm_urgent', noticeNewH: 48 });
    expect(wallSettings({ rest: 'yes', rest_after_min: -1, night: 1, night_start: '24:00', night_end: '6:00', night_dim: 'off', takeover: 'all' })).toEqual(WALL_DEFAULTS);
    expect(wallSettings({ rest: false, rest_after_min: 10, night: false, night_start: '22:30', night_end: '07:15', night_dim: 'strong', takeover: 'call_only' }))
      .toEqual({ rest: false, restAfterMin: 10, night: false, nightStart: 1350, nightEnd: 435, nightDim: 'strong', takeover: 'call_only', noticeNewH: 48 });
  });
  test('times read and write as HH:MM', () => {
    expect(parseHm('00:00')).toBe(0);
    expect(parseHm('23:59')).toBe(1439);
    for (const bad of ['24:00', '7:00', '12:60', '', null, 1380]) expect(parseHm(bad)).toBeNull();
    expect(fmtHm(1380)).toBe('23:00');
    expect(fmtHm(-60)).toBe('23:00');
    expect(fmtHm(1440 + 6 * 60)).toBe('06:00');
  });
});

test.describe('HOME-WALL-NIGHT-2500 night window', () => {
  test('a window across midnight, a window inside the day, and start == end (no window)', () => {
    const n = (h: number, m = 0) => h * 60 + m;
    expect([n(22, 59), n(23), n(0), n(3), n(5, 59), n(6), n(12)].map((x) => inWindow(x, n(23), n(6)))).toEqual([false, true, true, true, true, false, false]);
    expect([n(12, 59), n(13), n(14, 59), n(15)].map((x) => inWindow(x, n(13), n(15)))).toEqual([false, true, true, false]);
    expect(inWindow(n(23), n(23), n(23))).toBe(false);
  });
  test('local time by the IANA zone, in winter and in summer (no fixed offset)', () => {
    expect(localMinutes(at('2026-11-23T21:30:00Z'))).toBe(23 * 60 + 30); // UTC+2
    expect(localMinutes(at('2026-07-01T20:30:00Z'))).toBe(23 * 60 + 30); // UTC+3
    expect(isNight(S(), at('2026-11-23T21:30:00Z'))).toBe(true);
    expect(isNight(S(), at('2026-07-01T20:30:00Z'))).toBe(true);
    expect(isNight(S(), at('2026-11-23T20:59:00Z'))).toBe(false); // 22:59
    expect(isNight(S(), at('2026-11-24T03:59:00Z'))).toBe(true); // 05:59
    expect(isNight(S(), at('2026-11-24T04:00:00Z'))).toBe(false); // 06:00
    expect(isNight(S({ night: false }), at('2026-11-23T21:30:00Z'))).toBe(false);
    // the night daylight saving ends (25.10.2026, 02:00 -> 01:00): still night on both sides of the repeated hour
    expect(isNight(S(), at('2026-10-24T22:30:00Z'))).toBe(true); // 01:30 summer time
    expect(isNight(S(), at('2026-10-24T23:30:00Z'))).toBe(true); // 01:30 winter time
    expect(localMinutes(at('2026-10-25T03:00:00Z'))).toBe(5 * 60); // 05:00 winter time
    expect(isNight(S(), at('2026-10-25T04:00:00Z'))).toBe(false); // 06:00 winter time
  });
  test('dim only: the chosen dim on an idle panel at night, a lighter one while in use, none by day or under a takeover', () => {
    expect(dimOpacity(S(), true, 'idle', false)).toBe(0.68);
    expect(dimOpacity(S(), true, 'active', false)).toBe(0.27);
    expect(dimOpacity(S({ nightDim: 'soft' }), true, 'idle', false)).toBe(0.5);
    expect(dimOpacity(S({ nightDim: 'strong' }), true, 'idle', false)).toBe(0.82);
    expect(dimOpacity(S(), false, 'idle', false)).toBe(0);
    expect(dimOpacity(S(), true, 'idle', true)).toBe(0);
  });
});

test.describe('HOME-WALL-NIGHT-2500 rest timer (fake clock)', () => {
  test('the rest screen comes exactly 2 minutes after the last touch; a touch wakes it and counts again', () => {
    const c = new FakeClock();
    let changes = 0;
    const w = new WallRest(S(), () => changes++, c);
    expect(w.state(c.now()).rest).toBe(false);
    c.tick(119_999);
    expect(w.state(c.now()).rest).toBe(false);
    c.tick(1);
    expect(w.state(c.now())).toMatchObject({ rest: true, phase: 'idle', night: false, dim: 0 });
    expect(changes).toBe(1);
    w.input();
    expect(w.state(c.now()).rest).toBe(false);
    c.tick(60_000);
    w.input(); // touched again after a minute: the two minutes start over
    c.tick(119_000);
    expect(w.state(c.now()).rest).toBe(false);
    c.tick(1_000);
    expect(w.state(c.now()).rest).toBe(true);
    w.dispose();
  });
  test('a ringing door call and a takeover hold the panel awake; released, the two minutes count from then', () => {
    const c = new FakeClock();
    const w = new WallRest(S(), () => undefined, c);
    c.tick(120_000);
    expect(w.state(c.now()).rest).toBe(true);
    w.hold('call', true); // the doorbell rings on a resting panel: it wakes
    expect(w.state(c.now())).toMatchObject({ rest: false, woken: true });
    c.tick(10 * 60_000);
    expect(w.state(c.now()).rest).toBe(false);
    w.hold('takeover', true);
    w.hold('call', false);
    c.tick(10 * 60_000);
    expect(w.state(c.now()).rest).toBe(false); // the takeover still holds it
    w.hold('takeover', false);
    c.tick(119_000);
    expect(w.state(c.now()).rest).toBe(false);
    c.tick(1_000);
    expect(w.state(c.now()).rest).toBe(true);
    w.dispose();
  });
  test('at night: dimmed while in use, dimmed more at rest, not dimmed under a takeover', () => {
    const c = new FakeClock();
    c.t = at('2026-11-23T21:30:00Z'); // 23:30
    const w = new WallRest(S(), () => undefined, c);
    expect(w.state(c.now())).toMatchObject({ night: true, rest: false, dim: 0.27 });
    c.tick(120_000);
    expect(w.state(c.now())).toMatchObject({ night: true, rest: true, dim: 0.68 });
    w.hold('takeover', true);
    expect(w.state(c.now())).toMatchObject({ rest: false, dim: 0 });
    w.dispose();
  });
  test('rest screen off: the panel still goes idle at night (dim only), and by day nothing is drawn', () => {
    const c = new FakeClock();
    const w = new WallRest(S({ rest: false }), () => undefined, c);
    c.tick(120_000);
    expect(w.state(c.now())).toMatchObject({ rest: false, phase: 'idle', dim: 0 });
    c.t = at('2026-11-23T21:30:00Z');
    expect(w.state(c.now())).toMatchObject({ rest: false, phase: 'idle', dim: 0.68 });
    w.dispose();
  });
  test('a changed rest time (a policy reload) starts the count again from now', () => {
    const c = new FakeClock();
    const w = new WallRest(S(), () => undefined, c);
    c.tick(90_000);
    w.configure(S({ restAfterMin: 5 }));
    c.tick(4 * 60_000 + 59_000);
    expect(w.state(c.now()).rest).toBe(false);
    c.tick(1_000);
    expect(w.state(c.now()).rest).toBe(true);
    w.configure(S({ restAfterMin: 5, nightDim: 'strong' })); // the same time: the panel stays at rest
    expect(w.state(c.now()).rest).toBe(true);
    w.dispose();
  });
});

test.describe('HOME-WALL-NIGHT-2500 takeover', () => {
  const now = at('2026-11-23T21:30:00Z');
  const panel = (state: string | null, o: Partial<PanelLike> = {}): PanelLike => ({ entity_id: 'alarm_control_panel.house', name: 'אזעקת הבית', state, available: true, last_changed: '2026-11-23T21:29:00Z', ...o });
  const notice = (id: string, severity: string, minsAgo: number, o: Partial<NoticeLike> = {}): NoticeLike => ({ id, title: id, body: '', severity, published_at: new Date(now - minsAgo * 60_000).toISOString(), starts_at: null, ends_at: null, ...o });
  const none = new Set<string>();

  test('the alarm takes the screen when it sounds or waits for the code, not when armed or disarmed', () => {
    expect(takeoverFor('alarm_urgent', [panel('triggered')], [], none, now)?.kind).toBe('alarm');
    expect(takeoverFor('alarm_urgent', [panel('pending')], [], none, now)?.kind).toBe('alarm');
    for (const s of ['disarmed', 'armed_away', 'armed_night', 'arming', null]) expect(takeoverFor('alarm_urgent', [panel(s)], [], none, now)).toBeNull();
    expect(takeoverFor('alarm_urgent', [panel('triggered', { available: false })], [], none, now)).toBeNull();
  });
  test('"הבנתי" hides this episode only: the next change of the panel takes the screen again', () => {
    const first = takeoverFor('alarm', [panel('triggered')], [], none, now)!;
    expect(takeoverFor('alarm', [panel('triggered')], [], new Set([first.key]), now)).toBeNull();
    expect(takeoverFor('alarm', [panel('triggered', { last_changed: '2026-11-23T21:40:00Z' })], [], new Set([first.key]), now)?.kind).toBe('alarm');
  });
  test('an urgent notice takes the screen while it is new (48 hours), once per panel, newest first; the alarm comes before it', () => {
    const list = [notice('old', 'critical', 49 * 60), notice('a', 'critical', 30), notice('b', 'urgent', 5), notice('imp', 'important', 1), notice('ended', 'critical', 2, { ends_at: new Date(now - 60_000).toISOString() })];
    const t = takeoverFor('alarm_urgent', [], list, none, now);
    expect(t).toMatchObject({ kind: 'notice', key: 'notice:b' });
    expect(takeoverFor('alarm_urgent', [], list, new Set(['notice:b']), now)).toMatchObject({ key: 'notice:a' });
    expect(takeoverFor('alarm_urgent', [], list, new Set(['notice:b', 'notice:a']), now)).toBeNull();
    expect(takeoverFor('alarm_urgent', [panel('triggered')], list, none, now)?.kind).toBe('alarm');
  });
  test('the setting: "alarm" ignores notices, "call_only" never takes the screen (the door call has its own screen)', () => {
    const list = [notice('b', 'critical', 5)];
    expect(takeoverFor('alarm', [], list, none, now)).toBeNull();
    expect(takeoverFor('call_only', [panel('triggered')], list, none, now)).toBeNull();
  });
});
