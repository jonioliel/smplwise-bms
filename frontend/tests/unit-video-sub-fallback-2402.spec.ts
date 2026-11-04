import { test, expect } from '@playwright/test';
import { mainFirst, noteSubDown, planSteps, playerPlan, subDown, subFallbackStep, SUB_DOWN_KEY, SUB_DOWN_TTL_MS, type VideoStep } from '../src/api/video-policy';
import { liveWsUrl } from '../src/api/media';
import type { Me } from '../src/api/types';

// VIDEO-SUB-FALLBACK-2402 (owner round 20, Q3 = a): with the automatic quality a sub stream that gives nothing moves the tile to the main
// stream on the SAME transport; an explicit quality never switches; the fallback is remembered per camera for the tab (10 minutes).
// Node only (pure functions); the player on the wall: evidence-video-sub-fallback-2402.spec.ts.

const remote = (mse: 'true' | 'false' = 'true') => ({ channel: 'remote', remote: { 'remote.default_profile': 'main', 'remote.mse_fallback': mse } }) as unknown as Me;
const enc = (s: VideoStep[]) => s.map((x) => `${x.profile}:${x.transport}`).join(',');

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), raw: m };
}

test.describe('the sub -> main twin on the same transport', () => {
  test('the local chain and the remote plan of an automatic-quality tile hold the main twin; an explicit quality does not', () => {
    expect(enc(planSteps('mse', 'local', 'sub', { autoProfile: true }))).toBe('sub:mse,main:mse');
    expect(enc(planSteps('webrtc', 'local', 'sub', { autoProfile: true }))).toBe('sub:webrtc,main:webrtc');
    expect(enc(planSteps('mse', 'remote', 'sub', { autoProfile: true }))).toBe('sub:mse,main:mse');
    expect(enc(planSteps('auto', 'remote', 'sub', { autoProfile: true, mseFallback: true }))).toBe('sub:webrtc,sub:mse,main:webrtc,main:mse');
    expect(playerPlan('sub', null, 'mse', remote(), true).plan).toBe('sub:mse,main:mse');
    expect(playerPlan('sub', null, 'mse', remote(), false).plan, 'explicit quality: no main step').toBe('sub:mse');
  });

  test('the twin keeps the failing step transport, never the other one', () => {
    const auto = planSteps('auto', 'local', 'sub', { autoProfile: true }); // sub:webrtc, sub:mse, main:mse, main:webrtc
    expect(subFallbackStep(auto, { profile: 'sub', transport: 'mse' })).toEqual({ profile: 'main', transport: 'mse' });
    expect(subFallbackStep(auto, { profile: 'sub', transport: 'webrtc' })).toEqual({ profile: 'main', transport: 'webrtc' });
    expect(subFallbackStep(planSteps('mse', 'local', 'sub', { autoProfile: true }), { profile: 'sub', transport: 'mse' })).toEqual({ profile: 'main', transport: 'mse' });
    expect(subFallbackStep(planSteps('mse', 'local', 'sub'), { profile: 'sub', transport: 'mse' }), 'explicit quality: nothing to switch to').toBeNull();
    expect(subFallbackStep([{ profile: 'sub', transport: 'mse' }, { profile: 'main', transport: 'webrtc' }], { profile: 'sub', transport: 'mse' }), 'only another transport: no').toBeNull();
    expect(subFallbackStep(auto, { profile: 'main', transport: 'mse' }), 'main never falls to anything').toBeNull();
  });

  test('a remembered dead sub stream opens main first, each profile keeping the policy order', () => {
    expect(enc(mainFirst(planSteps('auto', 'local', 'sub', { autoProfile: true })))).toBe('main:mse,main:webrtc,sub:webrtc,sub:mse');
    expect(enc(mainFirst(planSteps('mse', 'remote', 'sub', { autoProfile: true })))).toBe('main:mse,sub:mse');
  });
});

test.describe('the per-tab memory', () => {
  test('remembered for SUB_DOWN_TTL_MS (10 minutes), per camera, then the sub stream is tried again', () => {
    expect(SUB_DOWN_TTL_MS).toBe(10 * 60 * 1000);
    const s = memStore();
    expect(subDown('c8', 0, s)).toBe(false);
    noteSubDown('c8', true, 1000, s);
    expect(subDown('c8', 1000 + SUB_DOWN_TTL_MS, s)).toBe(true);
    expect(subDown('c10', 2000, s)).toBe(false);
    expect(subDown('c8', 1001 + SUB_DOWN_TTL_MS, s)).toBe(false);
    noteSubDown('c8', false, 3000, s);
    expect(s.raw.has(SUB_DOWN_KEY)).toBe(false);
  });

  test('expired entries are dropped when another camera is noted; a broken store never throws', () => {
    const s = memStore();
    noteSubDown('c8', true, 0, s);
    noteSubDown('c10', true, SUB_DOWN_TTL_MS + 5, s);
    expect(Object.keys(JSON.parse(s.raw.get(SUB_DOWN_KEY)!))).toEqual(['c10']);
    s.raw.set(SUB_DOWN_KEY, '{nope');
    expect(subDown('c10', 0, s)).toBe(false);
    expect(subDown('c10', 0, null)).toBe(false);
  });
});

test('the main socket names why (closed values, for the session audit rows)', () => {
  const g = globalThis as unknown as { document?: { baseURI: string } };
  g.document ??= { baseURI: 'http://x/' }; // node: the page address the URL is built against
  const u = new URL(liveWsUrl('c8', 'main', '', 'sub_no_media'), 'http://x/');
  expect(u.searchParams.get('fallback')).toBe('sub_no_media');
  expect(new URL(liveWsUrl('c8', 'sub'), 'http://x/').searchParams.has('fallback')).toBe(false);
});
