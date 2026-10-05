import { test, expect } from '@playwright/test';
import { STALL_DEFAULTS, StallWatch, stallOptionsFromSettings, type StallContext, type StallTrack } from '../src/api/playback-stall';

// 2.0.0 playback stall detection and automatic resume (docs/changes/PLAYBACK-STALL-RESUME.md): the pure state machine, Node only,
// driven by a fake clock in 500 ms ticks (the screen's own tick).

const GO: StallContext = { expect: true, canAct: true };

/** A fake clock and one or more tiles whose media time the test moves. */
function rig(opts: { stallMs?: number; maxAttempts?: number; keys?: string[] } = {}) {
  const w = new StallWatch({ stallMs: opts.stallMs ?? 5000, maxAttempts: opts.maxAttempts ?? 3 });
  const keys = opts.keys ?? ['c1'];
  const media: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  const playing: Record<string, boolean> = Object.fromEntries(keys.map((k) => [k, true]));
  const r = {
    w,
    now: 0,
    media,
    playing,
    answers: [] as { at: number; answer: string }[],
    tracks: (): StallTrack[] => keys.map((key) => ({ key, mediaTime: media[key], playing: playing[key] })),
    /** Advance the clock by `ms` in 500 ms ticks; `advance` = media advances with the clock (x1) for these keys. */
    run(ms: number, advance: string[] = [], ctx: StallContext = GO) {
      for (let t = 0; t < ms; t += 500) {
        r.now += 500;
        for (const k of advance) media[k] += 0.5;
        const a = w.step(r.now, r.tracks(), ctx);
        if (a !== 'none') r.answers.push({ at: r.now, answer: a });
      }
    },
  };
  return r;
}

test.describe('stall detection', () => {
  test('defaults: 5 s, 3 attempts, 2 s grace, back-off 3 s then 6 s, 20 s per attempt', () => {
    expect(STALL_DEFAULTS.stallS).toBe(5);
    expect(STALL_DEFAULTS.attempts).toBe(3);
    const o = new StallWatch({ stallMs: 5000, maxAttempts: 3 }).options;
    expect([o.graceMs, o.backoffMs, o.attemptTimeoutMs]).toEqual([2000, [3000, 6000], 20000]);
  });

  test('settings are read and clamped to what the server accepts', () => {
    expect(stallOptionsFromSettings({})).toEqual({ stallMs: 5000, maxAttempts: 3 });
    expect(stallOptionsFromSettings({ 'playback.stall_s': 8, 'playback.auto_resume_attempts': 0 })).toEqual({ stallMs: 8000, maxAttempts: 0 });
    expect(stallOptionsFromSettings({ 'playback.stall_s': '1', 'playback.auto_resume_attempts': 99 })).toEqual({ stallMs: 2000, maxAttempts: 5 });
    expect(stallOptionsFromSettings({ 'playback.stall_s': 'x', 'playback.auto_resume_attempts': null })).toEqual({ stallMs: 5000, maxAttempts: 0 });
  });

  test('steady playback never stalls; a slow first start (no progress yet) is not a stall', () => {
    const r = rig();
    r.run(30000); // 30 s of "playing" with no media at all: never armed
    expect(r.w.phase).toBe('ok');
    r.run(60000, ['c1']);
    expect(r.w.phase).toBe('ok');
    expect(r.answers).toEqual([]);
  });

  test('slow motion (0.25x) is progress, not a stall', () => {
    const r = rig();
    r.run(2000, ['c1']);
    for (let i = 0; i < 40; i++) {
      r.now += 500;
      r.media.c1 += 0.125;
      r.w.step(r.now, r.tracks(), GO);
    }
    expect(r.w.phase).toBe('ok');
  });

  test('a frozen picture is a stall after stallMs; the first attempt waits the grace period', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.run(4500);
    expect(r.w.phase).toBe('ok'); // 4.5 s without progress
    r.run(500);
    expect(r.w.phase).toBe('stalled'); // 5 s: "מתחבר מחדש" at once
    expect(r.answers).toEqual([]);
    r.run(1500);
    expect(r.answers).toEqual([]); // still inside the grace period
    r.run(500);
    expect(r.answers).toEqual([{ at: 10000, answer: 'resume' }]);
    expect(r.w.phase).toBe('reconnecting');
    expect(r.w.attempts).toBe(1);
  });

  test('go2rtc recovers by itself during the grace period: no attempt', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.run(5000);
    expect(r.w.phase).toBe('stalled');
    r.run(1000, ['c1']);
    expect(r.w.phase).toBe('ok');
    r.run(10000, ['c1']);
    expect(r.answers).toEqual([]);
  });

  test('a resume that plays again: recovered, counted once', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.run(7000); // stall + grace
    expect(r.answers.length).toBe(1);
    r.run(1000); // the request is in flight: nothing else happens, whatever the clock says
    expect(r.answers.length).toBe(1);
    r.w.attemptSent(r.now);
    r.media.c1 = 0; // new generation from 0
    r.playing.c1 = false; // connecting
    r.run(8000);
    expect(r.w.phase).toBe('reconnecting');
    r.playing.c1 = true;
    r.run(1500, ['c1']);
    expect(r.w.phase).toBe('ok');
    expect(r.w.resumes).toBe(1);
    expect(r.answers.length).toBe(1);
  });

  test('failed attempts back off (3 s, 6 s) and stop at the cap: gave_up, never a fourth', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.run(7000);
    expect(r.answers.map((a) => a.at)).toEqual([10000]);
    r.w.attemptFailed(r.now); // the request failed (server / network)
    r.run(2500);
    expect(r.answers.length).toBe(1);
    r.run(500); // 3 s back-off
    expect(r.answers.map((a) => a.at)).toEqual([10000, 13000]);
    r.w.attemptSent(r.now);
    r.run(19500); // no progress on the new generation
    expect(r.w.phase).toBe('reconnecting');
    r.run(500); // 20 s: the attempt failed
    expect(r.w.phase).toBe('stalled');
    r.run(6000); // 6 s back-off
    expect(r.answers.map((a) => a.at)).toEqual([10000, 13000, 39000]);
    r.w.lost(); // the third generation's socket closed too
    r.w.attemptSent(r.now);
    r.w.lost();
    r.run(500);
    expect(r.w.phase).toBe('gave_up');
    r.run(120000);
    expect(r.answers.length).toBe(3);
    expect(r.w.attempts).toBe(3);
  });

  test('retry after gave_up: a fresh round, the first attempt at once', () => {
    const r = rig({ maxAttempts: 1 });
    r.run(3000, ['c1']);
    r.run(7000);
    r.w.attemptFailed(r.now);
    expect(r.w.phase).toBe('gave_up');
    r.w.retry(r.now);
    r.run(500);
    expect(r.answers.length).toBe(2);
    expect(r.w.attempts).toBe(1);
    expect(r.w.phase).toBe('reconnecting');
  });

  test('a lost connection skips the stall wait, keeps the grace period', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.w.lost();
    r.playing.c1 = false; // the player shows ended / error
    r.run(500);
    expect(r.w.phase).toBe('stalled');
    r.run(2000);
    expect(r.answers.length).toBe(1);
  });

  test('a flapping source ends in gave_up: attempts only reset after 30 s of stable playback', () => {
    const r = rig();
    r.run(3000, ['c1']);
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 40 && r.w.phase !== 'reconnecting' && r.w.phase !== 'gave_up'; k++) r.run(500); // stall + wait
      if (r.w.phase === 'gave_up') break;
      r.w.attemptSent(r.now);
      r.media.c1 = 0;
      r.run(10000, ['c1']); // plays 10 s, then drops again
    }
    expect(r.w.phase).toBe('gave_up');
    expect(r.answers.length).toBe(3);
  });

  test('stable playback after a recovery forgets the earlier attempts', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.run(7000);
    r.w.attemptSent(r.now);
    r.media.c1 = 0;
    r.run(32000, ['c1']);
    expect(r.w.resumes).toBe(1);
    expect(r.w.attempts).toBe(0);
  });

  test('pause: never a stall; pausing during the wait cancels the automatic attempt', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.run(60000, [], { expect: false, canAct: true });
    expect(r.w.phase).toBe('ok');
    r.run(1000, ['c1']);
    r.run(5000);
    expect(r.w.phase).toBe('stalled');
    r.run(5000, [], { expect: false, canAct: true });
    expect(r.w.phase).toBe('ok');
    expect(r.answers).toEqual([]);
  });

  test('a request already in flight (canAct false) delays the attempt, never doubles it', () => {
    const r = rig();
    r.run(3000, ['c1']);
    r.run(15000, [], { expect: true, canAct: false });
    expect(r.answers).toEqual([]);
    expect(r.w.phase).toBe('stalled');
    r.run(500);
    expect(r.answers.length).toBe(1);
  });

  test('reset (the operator seeks) clears everything', () => {
    const r = rig({ maxAttempts: 1 });
    r.run(3000, ['c1']);
    r.run(7000);
    r.w.attemptFailed(r.now);
    expect(r.w.phase).toBe('gave_up');
    r.w.reset(r.now);
    expect([r.w.phase, r.w.attempts, r.w.resumes]).toEqual(['ok', 0, 0]);
  });

  test('group: one stuck tile is a stall of the group (one answer for all), a disarmed tile is not', () => {
    const r = rig({ keys: ['a', 'b', 'c'] });
    r.run(3000, ['a', 'b', 'c']);
    r.w.disarm('c', r.now); // c re-seeked alone for drift
    r.media.c = 0;
    r.run(6000, ['a', 'b']);
    expect(r.w.phase).toBe('ok'); // c never advanced again: not armed, not a stall
    r.run(5000, ['a', 'c']); // b froze
    expect(r.w.phase).toBe('stalled');
    r.run(2000, ['a', 'c']);
    expect(r.answers.length).toBe(1);
  });
});
