import { test, expect } from '@playwright/test';
import { BACKOFF_MAX_MS, VIDEO_SERVICE_DOWN_HE, VIDEO_SERVICE_HINT_OTHER, VideoServiceWatch, backoffMs, frameSaysDown, isDownState, type VideoServiceState, type VideoServiceView } from '../src/api/video-service';
import { closedErrorText } from '../src/api/closed-errors';

// HEALTH-GO2RTC-2430 (docs/changes/HEALTH-GO2RTC-2430.md): the tab-wide video-service watch - its backoff, what counts as "down", and
// the transitions that make every waiting tile reconnect on recovery. No browser page.

const view = (state: VideoServiceState): VideoServiceView => ({ state, configured: state !== 'not_configured', since: null, down_for_s: null, last_ok_at: null, last_error_at: null, last_error: null, failures: 0, retry_in_s: null });

test('the backoff doubles from 5 s and stops at 60 s', () => {
  expect([0, 1, 2, 3, 4, 5, 9, 50].map(backoffMs)).toEqual([5000, 10000, 20000, 40000, 60000, 60000, 60000, 60000]);
  expect(backoffMs(100)).toBe(BACKOFF_MAX_MS);
});

test('what counts as the video service being down', () => {
  expect(frameSaysDown({ type: 'error', value: 'media_unavailable' })).toBe(true);
  expect(frameSaysDown({ type: 'error', value: 'media_not_configured' })).toBe(true);
  expect(frameSaysDown({ type: 'error', value: 'upstream_unavailable', media: 'unreachable' })).toBe(true);
  expect(frameSaysDown({ type: 'error', value: 'upstream_unavailable', media: 'reachable' }), 'the service answers: this stream failed, not the service').toBe(false);
  expect(frameSaysDown({ type: 'error', value: 'upstream_unavailable' })).toBe(false);
  expect(frameSaysDown({ type: 'webrtc/answer', value: 'x' })).toBe(false);
  expect(isDownState('unreachable') && isDownState('not_configured') && !isDownState('reachable') && !isDownState('unknown')).toBe(true);
});

test('user-facing words never name the component', () => {
  for (const t of [VIDEO_SERVICE_DOWN_HE, VIDEO_SERVICE_HINT_OTHER, closedErrorText('media_unavailable', 'he') ?? '', closedErrorText('media_not_configured', 'he') ?? '']) {
    expect(t).not.toMatch(/go2rtc/i);
    expect(t.length).toBeGreaterThan(0);
  }
  expect(closedErrorText('media_unavailable', 'he')).toContain(VIDEO_SERVICE_DOWN_HE);
});

test('down, a failed check, then recovery: listeners hear down once and up once', async () => {
  let answer: VideoServiceState | 'throw' = 'unreachable';
  let calls = 0;
  const w = new VideoServiceWatch(async () => {
    calls += 1;
    if (answer === 'throw') throw new Error('network');
    return view(answer);
  });
  const heard: boolean[] = [];
  w.subscribe((d) => heard.push(d));
  try {
    expect(await w.check()).toBe('unreachable');
    expect(w.down).toBe(true);
    // one request in flight per tab, however many tiles ask at once
    const before = calls;
    await Promise.all([w.check(), w.check(), w.check()]);
    expect(calls - before).toBe(1);
    answer = 'throw';
    expect(await w.check(), 'a failed check is unknown, never "up"').toBe('unknown');
    expect(w.down).toBe(true);
    w.markDown();
    answer = 'reachable';
    expect(await w.check()).toBe('reachable');
    expect(w.down).toBe(false);
    expect(heard).toEqual([true, false]);
  } finally {
    w.reset();
  }
});
