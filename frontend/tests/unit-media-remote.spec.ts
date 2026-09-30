import { test, expect } from '@playwright/test';
// the mock first: media-screens.ts and its mock import each other (see the S3 report)
import { resetMediaMock } from '../src/api/media-screens-mock';
import { KEY_IDS, type MediaDeviceDetail, type MediaCommand } from '../src/api/media-screens';
import { ICON, KEY_GLYPH, KEY_LABEL, hslTriplet, tint } from '../src/components/media-remote-keys';
import {
  CommandGate, HoldRepeater, artSwitchOffered, cleanText, digitOf, expectation, isRepeatable, keyFromEvent, layoutOf, mmss, moveSection, openSends, padModes, positionNow,
  powerOffer, pushDigit, recentChips, remoteMode, remoteTabs, setMore, toggleSection, unavailableLine, viewOnly, volumeTarget, type Timers,
} from '../src/components/media-remote-logic';
import { KeyPress } from '../src/components/media-remote-press';

// CR-015 S3: the remote's rules (components/media-remote-logic.ts, -press.ts, -keys.ts) - no browser page, no timers of the
// real clock (a fake scheduler drives hold-to-repeat), real shapes from the S0 mock.

/** A fake clock + scheduler: `advance(ms)` runs every timer due in that span, in order. */
function fakeTimers(): Timers & { advance: (ms: number) => void } {
  let now = 0;
  let id = 0;
  const timeouts = new Map<number, { at: number; fn: () => void }>();
  const intervals = new Map<number, { every: number; next: number; fn: () => void }>();
  return {
    now: () => now,
    setTimeout: (fn, ms) => { timeouts.set(++id, { at: now + ms, fn }); return id; },
    clearTimeout: (h) => void timeouts.delete(h as number),
    setInterval: (fn, ms) => { intervals.set(++id, { every: ms, next: now + ms, fn }); return id; },
    clearInterval: (h) => void intervals.delete(h as number),
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [
          ...[...timeouts].map(([k, v]) => ({ k, at: v.at, kind: 't' as const })),
          ...[...intervals].map(([k, v]) => ({ k, at: v.next, kind: 'i' as const })),
        ].filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        now = due.at;
        if (due.kind === 't') {
          const t = timeouts.get(due.k)!;
          timeouts.delete(due.k);
          t.fn();
        } else {
          const i = intervals.get(due.k)!;
          i.next += i.every;
          i.fn();
        }
      }
      now = end;
    },
  };
}

const dev = async (key: string): Promise<MediaDeviceDetail> => resetMediaMock().get(key);

test.describe('media remote: what is drawn', () => {
  test('there is no power key anywhere in the vocabulary, the labels or the glyph map', () => {
    expect(KEY_IDS.some((k) => /power|off$/i.test(k))).toBe(false);
    expect(Object.keys(KEY_LABEL).sort()).toEqual([...KEY_IDS].sort());
    expect(Object.values(KEY_GLYPH)).not.toContain('power');
    // the power glyph exists (the turn_on / turn_off buttons use it) but no key maps to it
    expect(ICON.power).toBeTruthy();
  });

  test('mode follows the power state; a screen without remote wake keeps power-on disabled with its reason', async () => {
    expect(remoteMode(await dev('md-living'))).toBe('on');
    expect(remoteMode(await dev('md-parents'))).toBe('off');
    expect(remoteMode(await dev('md-pergola'))).toBe('art');
    expect(remoteMode(await dev('md-gym'))).toBe('unavailable');
    expect(powerOffer(await dev('md-living'))).toEqual({ action: 'off', enabled: true, reason: null });
    expect(powerOffer(await dev('md-parents'))).toEqual({ action: 'on', enabled: true, reason: null });
    expect(powerOffer(await dev('md-office'))).toEqual({ action: 'on', enabled: false, reason: 'no_remote_wake' });
    expect(powerOffer(await dev('md-gym'))).toMatchObject({ action: 'none', enabled: false, reason: 'unavailable' });
    const art = await dev('md-pergola');
    expect(powerOffer(art)).toMatchObject({ action: 'off', enabled: true });
    expect(artSwitchOffered(art)).toBe(true);
  });

  test('opening a remote sends nothing', () => {
    expect(openSends()).toEqual([]);
  });

  test('view-only: no controls at all; power without control: only the recent picks; control without power: no sources or apps', async () => {
    const d = await dev('md-living');
    const ro = { ...d, can: { control: false, power: false, public_ok: true, bulk: false } };
    expect(viewOnly(ro)).toBe(true);
    expect(layoutOf(ro)).toEqual({ main: [], more: [] });
    expect(remoteTabs(ro)).toEqual(['pad']);
    const pw = { ...d, can: { control: false, power: true, public_ok: true, bulk: false } };
    expect(viewOnly(pw)).toBe(false);
    expect(layoutOf(pw)).toEqual({ main: ['recent'], more: [] });
    const ctl = { ...d, can: { control: true, power: false, public_ok: true, bulk: false } };
    expect(remoteTabs(ctl)).toEqual(['pad']);
    expect(recentChips(ctl)).toEqual([]);
    expect(layoutOf(ctl).main).not.toContain('recent');
  });

  test('the default remote: d-pad, volume, channels, playback, back/home/menu; numbers, colours, text and extras behind "עוד מקשים"', async () => {
    const d = await dev('md-living');
    const L = layoutOf(d);
    expect(L.main).toEqual(['recent', 'nav', 'dpad', 'vol', 'ch', 'pbk']);
    expect(L.more).toEqual(['nums', 'colors', 'text', 'xtra']);
    expect(recentChips(d)).toHaveLength(3);
    expect(remoteTabs(d)).toEqual(['pad', 'sources', 'apps']);
    // the four profiles differ only by what caps allows
    const kids = await dev('md-kids'); // generic: no keys
    expect(layoutOf(kids).main).toEqual(['recent', 'vol', 'pbk']); // the slider is the volume; no arrows, no rockers
    expect(layoutOf(kids).more).toEqual([]);
    const android = await dev('md-parents');
    expect(layoutOf(android).more).toContain('text');
    expect(android.caps.text).toBe(true);
    const lg = await dev('md-kitchen');
    expect(lg.caps.text).toBe(false);
    expect(layoutOf(lg).more).not.toContain('text');
  });

  test('the touchpad replaces the arrows only when it is on and the arrows are off; both on = one slot with a switch', async () => {
    const d = await dev('md-living');
    const both = { ...d, remote: toggleSection(d.remote, 'touch', true) };
    expect(padModes(both)).toEqual({ dpad: true, touch: true });
    expect(layoutOf(both).main).toContain('dpad');
    expect(layoutOf(both).main).not.toContain('touch');
    const touchOnly = { ...both, remote: toggleSection(both.remote, 'dpad', false) };
    expect(layoutOf(touchOnly).main).toContain('touch');
    expect(layoutOf(touchOnly).main).not.toContain('dpad');
  });

  test('the audio target: a linked receiver answers volume unless the user picks the screen', async () => {
    const d = await dev('md-living');
    expect(volumeTarget(d, null)).toBe('linked');
    expect(volumeTarget(d, 'screen')).toBe('screen');
    expect(volumeTarget(await dev('md-kitchen'), 'linked')).toBe('screen'); // no receiver linked: always the screen
  });

  test('editor primitives are immutable and keep the list whole', async () => {
    const d = await dev('md-living');
    const off = toggleSection(d.remote, 'recent', false);
    expect(off.sections.find((s) => s.id === 'recent')?.on).toBe(false);
    expect(d.remote.sections.find((s) => s.id === 'recent')?.on).toBe(true);
    expect(moveSection(d.remote, 'pbk', 0).sections.map((s) => s.id)[0]).toBe('pbk');
    expect(moveSection(d.remote, 'pbk', 0).sections).toHaveLength(d.remote.sections.length);
    expect(setMore(d.remote, 'nav', true).more).toContain('nav');
    expect(setMore(setMore(d.remote, 'nav', true), 'nav', false).more).not.toContain('nav');
  });
});

test.describe('media remote: hold to repeat', () => {
  test('arrows and volume repeat; nothing else does', () => {
    for (const k of ['up', 'down', 'left', 'right', 'volup', 'voldown'] as const) expect(isRepeatable(k)).toBe(true);
    for (const k of ['ok', 'back', 'home', 'menu', 'mute', 'chup', 'chdown', 'n1', 'red', 'play'] as const) expect(isRepeatable(k)).toBe(false);
  });

  test('fires at once, repeats every 200 ms after the hold delay, stops on release', () => {
    const t = fakeTimers();
    let n = 0;
    const h = new HoldRepeater(() => n++, t);
    h.start();
    expect(n).toBe(1);
    t.advance(399);
    expect(n).toBe(1);
    t.advance(1); // the hold delay passed, the interval starts
    t.advance(200);
    expect(n).toBe(2);
    t.advance(600);
    expect(n).toBe(5);
    h.stop();
    t.advance(5000);
    expect(n).toBe(5);
    expect(h.active).toBe(false);
  });

  test('never longer than 10 s, however long the press is held', () => {
    const t = fakeTimers();
    let n = 0;
    const h = new HoldRepeater(() => n++, t);
    h.start();
    t.advance(10_000);
    const atCap = n;
    expect(atCap).toBeGreaterThan(40);
    expect(atCap).toBeLessThanOrEqual(1 + Math.ceil((10_000 - 400) / 200));
    t.advance(30_000);
    expect(n).toBe(atCap);
    expect(h.active).toBe(false);
  });

  test('KeyPress: a pointer press fires on the down stroke, arrows repeat, the click that follows is ignored', () => {
    const t = fakeTimers();
    const sent: string[] = [];
    const p = new KeyPress((k) => sent.push(k), t);
    p.down({ pointerType: 'mouse', button: 0 }, 'home');
    p.up();
    p.click({ detail: 1 }, 'home');
    expect(sent).toEqual(['home']);
    p.down({ pointerType: 'touch' }, 'up');
    t.advance(1000);
    p.up();
    const held = sent.filter((k) => k === 'up').length;
    expect(held).toBeGreaterThanOrEqual(4);
    t.advance(2000);
    expect(sent.filter((k) => k === 'up')).toHaveLength(held);
    // a right-button press sends nothing
    p.down({ pointerType: 'mouse', button: 2 }, 'ok');
    expect(sent).not.toContain('ok');
  });

  test('KeyPress: keyboard activation behaves like a press, the operating system\'s key repeat is swallowed, a bare click fires once', () => {
    const t = fakeTimers();
    const sent: string[] = [];
    const p = new KeyPress((k) => sent.push(k), t);
    p.keyDown({ key: 'Enter' }, 'ok');
    p.keyDown({ key: 'Enter', repeat: true }, 'ok');
    p.keyDown({ key: 'Enter', repeat: true }, 'ok');
    p.keyUp({ key: 'Enter' }, 'ok');
    expect(sent).toEqual(['ok']);
    p.click({ detail: 0 }, 'back'); // screen-reader activation
    expect(sent).toEqual(['ok', 'back']);
    p.keyDown({ key: ' ' }, 'down');
    t.advance(1000);
    p.keyUp({ key: ' ' }, 'down');
    const n = sent.filter((k) => k === 'down').length;
    expect(n).toBeGreaterThan(2);
    t.advance(1000);
    expect(sent.filter((k) => k === 'down')).toHaveLength(n);
    // the desktop keyboard: auto-repeat ignored, key up stops
    p.global('volup', true);
    p.global('volup', true, true);
    p.global('volup', true, true);
    p.global('volup', false);
    t.advance(2000);
    expect(sent.filter((k) => k === 'volup')).toHaveLength(1);
  });
});

test.describe('media remote: the keyboard and the gate', () => {
  const target = { tagName: 'DIV' };
  test('arrows, Enter, Backspace, +/-, M map to keys; typing, modifiers, Escape and a focused button\'s own Enter do not', () => {
    expect(keyFromEvent({ key: 'ArrowUp', target })).toBe('up');
    expect(keyFromEvent({ key: 'ArrowLeft', target })).toBe('left'); // never mirrored
    expect(keyFromEvent({ key: 'Enter', target })).toBe('ok');
    expect(keyFromEvent({ key: 'Backspace', target })).toBe('back');
    expect(keyFromEvent({ key: '+', target })).toBe('volup');
    expect(keyFromEvent({ key: '-', target })).toBe('voldown');
    expect(keyFromEvent({ key: 'm', target })).toBe('mute');
    expect(keyFromEvent({ key: 'ArrowUp', target: { tagName: 'INPUT' } })).toBeNull();
    expect(keyFromEvent({ key: 'Backspace', target: { tagName: 'TEXTAREA' } })).toBeNull();
    expect(keyFromEvent({ key: 'a', target: { tagName: 'DIV', isContentEditable: true } })).toBeNull();
    expect(keyFromEvent({ key: 'ArrowUp', ctrlKey: true, target })).toBeNull();
    expect(keyFromEvent({ key: 'Escape', target })).toBeNull();
    expect(keyFromEvent({ key: 'Enter', target: { tagName: 'BUTTON' } })).toBeNull();
    expect(keyFromEvent({ key: 'x', target })).toBeNull();
  });

  test('keys go through ONE token bucket: a burst of 8, then 5 a second; over it the press is dropped, never queued', async () => {
    const d = await dev('md-living');
    const g = new CommandGate();
    const key: MediaCommand = { command: 'key', key: 'up' };
    const t0 = 1_000_000;
    const verdicts = Array.from({ length: 10 }, () => g.check(d, key, t0));
    expect(verdicts.filter((v) => v === 'send')).toHaveLength(8);
    expect(verdicts.slice(8)).toEqual(['dropped', 'dropped']);
    // volume steps, mute and transport share the bucket with keys
    expect(g.check(d, { command: 'volume_step', direction: 'up' }, t0)).toBe('dropped');
    expect(g.check(d, { command: 'mute', muted: true }, t0)).toBe('dropped');
    expect(g.check(d, { command: 'transport', action: 'play_pause' }, t0)).toBe('dropped');
    // 200 ms later one token is back
    expect(g.check(d, key, t0 + 200)).toBe('send');
    expect(g.check(d, key, t0 + 200)).toBe('dropped');
    // a sustained 5/s (the hold-repeat rate) is never dropped
    const g2 = new CommandGate();
    let dropped = 0;
    for (let i = 0; i < 50; i++) if (g2.check(d, key, t0 + i * 200) !== 'send') dropped++;
    expect(dropped).toBe(0);
  });

  test('not offered = not sent: a screen that is off takes only power-on; the generic profile has no keys; no control permission', async () => {
    const g = new CommandGate();
    const off = await dev('md-parents');
    expect(g.check(off, { command: 'key', key: 'up' })).toBe('not_offered');
    expect(g.check(off, { command: 'volume_step', direction: 'up' })).toBe('not_offered');
    expect(g.check(off, { command: 'power_on' })).toBe('send');
    const kids = await dev('md-kids');
    expect(g.check(kids, { command: 'key', key: 'ok' })).toBe('not_offered');
    const living = await dev('md-living');
    const ro = { ...living, can: { ...living.can, control: false } };
    expect(g.check(ro, { command: 'key', key: 'ok' })).toBe('not_offered');
    const noWake = await dev('md-office');
    expect(g.check(noWake, { command: 'power_on' })).toBe('not_offered');
    // a public screen without media.public: source / app / text, every key but volume / mute / play / pause and transport stop /
    // next / previous are not offered (the server's needs_public rule); volume, mute and play / pause stay
    const pub = { ...living, public: true, can: { ...living.can, public_ok: false } };
    expect(g.check(pub, { command: 'app', app_id: 'Netflix' })).toBe('not_offered');
    expect(g.check(pub, { command: 'key', key: 'ok' })).toBe('not_offered');
    expect(g.check(pub, { command: 'transport', action: 'next' })).toBe('not_offered');
    expect(g.check(pub, { command: 'key', key: 'volup' })).toBe('send');
    expect(g.check(pub, { command: 'transport', action: 'play_pause' })).toBe('send');
  });

  test('one power command in flight, at least 2 s between power commands; text at most once a second', async () => {
    const g = new CommandGate();
    const on = await dev('md-living');
    const t0 = 5_000_000;
    expect(g.check(on, { command: 'power_off' }, t0)).toBe('send');
    expect(g.check(on, { command: 'power_off' }, t0 + 100)).toBe('busy');
    g.powerDone();
    expect(g.check(on, { command: 'power_off' }, t0 + 1500)).toBe('busy'); // the 2 s minimum
    expect(g.check(on, { command: 'power_off' }, t0 + 2100)).toBe('send');
    expect(g.check(on, { command: 'text', text: 'abc' }, t0)).toBe('send');
    expect(g.check(on, { command: 'text', text: 'abd' }, t0 + 500)).toBe('cooldown');
    expect(g.check(on, { command: 'text', text: 'abe' }, t0 + 1200)).toBe('send');
    expect(g.check(on, { command: 'text', text: '' }, t0 + 9000)).toBe('not_offered');
  });
});

test.describe('media remote: confirmation, formatting, text', () => {
  test('what confirms which command; keys, steps and text are never "confirmed"', async () => {
    const d = await dev('md-living');
    const before = d.live;
    expect(expectation({ command: 'key', key: 'up' }, before)).toBeNull();
    expect(expectation({ command: 'volume_step', direction: 'up' }, before)).toBeNull();
    expect(expectation({ command: 'text', text: 'x' }, before)).toBeNull();
    expect(expectation({ command: 'transport', action: 'next' }, before)).toBeNull();
    const vol = expectation({ command: 'volume_set', level: 40 }, before)!;
    expect(vol({ ...before, volume: { ...before.volume, level: 40 } })).toBe(true);
    expect(vol({ ...before, volume: { ...before.volume, level: 41 } })).toBe(true);
    expect(vol(before)).toBe(false);
    expect(expectation({ command: 'power_on' }, before)!({ ...before, power: 'on' })).toBe(true);
    expect(expectation({ command: 'power_on' }, before)!({ ...before, power: 'off' })).toBe(false);
    expect(expectation({ command: 'power_off' }, before)!({ ...before, power: 'art' })).toBe(true);
    expect(expectation({ command: 'mute', muted: true }, before)!({ ...before, volume: { ...before.volume, muted: true } })).toBe(true);
    expect(expectation({ command: 'app', app_id: 'YouTube' }, before)!({ ...before, now: { ...before.now, app_id: 'YouTube' } })).toBe(true);
    const pp = expectation({ command: 'transport', action: 'play_pause' }, before)!;
    expect(pp({ ...before, play: 'paused' })).toBe(true);
    expect(pp(before)).toBe(false);
  });

  test('a real round trip through the mock: the expectation holds after the command, not before', async () => {
    const m = resetMediaMock();
    const before = (await m.get('md-parents')).live;
    const exp = expectation({ command: 'power_on' }, before)!;
    expect(exp(before)).toBe(false);
    await m.command('md-parents', { command: 'power_on', client_request_id: 'c-abcdefgh', expires_at: new Date(Date.now() + 10_000).toISOString() });
    expect(exp((await m.get('md-parents')).live)).toBe(true);
  });

  test('progress interpolates while playing and stops at the duration; durations read like a player', async () => {
    const d = await dev('md-living');
    const at = '2026-09-30T18:00:00Z';
    const live = { play: 'playing' as const, now: { ...d.live.now, position_s: 100, duration_s: 130, position_at: at } };
    expect(positionNow(live, Date.parse(at) + 10_000)).toBe(110);
    expect(positionNow(live, Date.parse(at) + 99_000)).toBe(130);
    expect(positionNow({ ...live, play: 'paused' }, Date.parse(at) + 10_000)).toBe(100);
    expect(positionNow({ play: 'playing', now: { ...d.live.now, position_s: null } }, 0)).toBeNull();
    expect(mmss(1520)).toBe('25:20');
    expect(mmss(3725)).toBe('1:02:05');
    expect(mmss(null)).toBe('');
  });

  test('the unavailable state says only "not available" and since when', () => {
    expect(unavailableLine({ power: 'unavailable', since: null })).toEqual({ title: 'המסך לא זמין', since: '' });
    expect(unavailableLine({ power: 'unknown', since: null }).title).toBe('מצב לא ידוע');
    expect(unavailableLine({ power: 'unavailable', since: 'nonsense' }).since).toBe('');
    expect(unavailableLine({ power: 'unavailable', since: '2026-09-30T11:20:00Z' }).since).toMatch(/^\d{2}:\d{2}$/);
  });

  test('typed text: control characters out, at most 200 characters; channel digits keep the last three', () => {
    expect(cleanText('a\u0000b\nc\u007f')).toBe('abc');
    expect(cleanText('x'.repeat(300))).toHaveLength(200);
    expect(pushDigit('', '1')).toBe('1');
    expect(pushDigit('123', '4')).toBe('234');
    expect(pushDigit('12', 'x')).toBe('12');
    expect(digitOf('n7')).toBe('7');
    expect(digitOf('up')).toBe('');
  });

  test('glyph tints use our hues, never a brand colour; the glow triplet is a valid "r g b"', () => {
    expect(tint(null).rgb).toBe('107 119 136');
    expect(tint(265).a2).toBe('hsl(265 70% 56%)');
    expect(tint(-95).a2).toBe('hsl(265 70% 56%)');
    expect(hslTriplet(0, 100, 50)).toBe('255 0 0');
    expect(tint(215).rgb).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });
});
