import { test, expect } from '@playwright/test';
import { LIVE_WORKS_KEY, LIVE_WORKS_TTL_MS, encodeLadder, lanLadder, orderLadder, rememberStep, rememberedStep } from '../src/api/video-policy';

// 0.1.148 owner bug ('oliel' wall, two panoramic cameras): on LAN / Ingress the wall asked the sub profile over WebRTC,
// WebRTC connected but the browser decoded nothing, and the tile stayed on that error - while the camera page played
// the MAIN profile over WebRTC. The player now walks a bounded fallback chain (api/video-policy lanLadder) and remembers
// per camera the step that played. Node only (pure functions); the player itself: evidence-wall-pano.spec.ts.

const chain = (...a: Parameters<typeof lanLadder>) => encodeLadder(lanLadder(...a));

function memStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: () => m.get(LIVE_WORKS_KEY),
  };
}

test.describe('LAN fallback chain (lanLadder)', () => {
  test('an explicit transport is never overridden; the profile is kept unless it is the default quality', () => {
    expect(chain('sub', 'webrtc', false)).toBe('sub:webrtc');
    expect(chain('sub', 'mse', false)).toBe('sub:mse');
    expect(chain('sub', 'webrtc', true)).toBe('sub:webrtc,main:webrtc'); // the owner case: main over WebRTC played
    expect(chain('main', 'mse', true)).toBe('main:mse,sub:mse');
  });

  test('auto: WebRTC then MSE on the same profile; the other profile on its lab-proven transport first', () => {
    expect(chain('sub', 'auto', false)).toBe('sub:webrtc,sub:mse');
    // lab facts: main needs MSE, sub decodes over WebRTC
    expect(chain('sub', 'auto', true)).toBe('sub:webrtc,sub:mse,main:mse,main:webrtc');
    expect(chain('main', 'auto', true)).toBe('main:webrtc,main:mse,sub:webrtc,sub:mse');
  });

  test('bounded: no step twice, at most four', () => {
    for (const p of ['main', 'sub'] as const)
      for (const m of ['auto', 'webrtc', 'mse'] as const)
        for (const a of [false, true]) {
          const s = lanLadder(p, m, a).map((x) => `${x.profile}:${x.transport}`);
          expect(new Set(s).size).toBe(s.length);
          expect(s.length).toBeLessThanOrEqual(4);
        }
  });

  test('a remembered step goes first only when the chain allows it (a fixed profile / transport ignores it)', () => {
    const natural = lanLadder('sub', 'webrtc', true);
    expect(encodeLadder(orderLadder(natural, { profile: 'main', transport: 'webrtc' }))).toBe('main:webrtc,sub:webrtc');
    expect(encodeLadder(orderLadder(lanLadder('sub', 'webrtc', false), { profile: 'main', transport: 'webrtc' }))).toBe('sub:webrtc');
    expect(encodeLadder(orderLadder(natural, { profile: 'main', transport: 'mse' }))).toBe('sub:webrtc,main:webrtc');
    expect(encodeLadder(orderLadder(natural, null))).toBe('sub:webrtc,main:webrtc');
  });
});

test.describe('per-camera memory of the working step', () => {
  test('remember, read back per camera / profile / transport, forget', () => {
    const s = memStore();
    rememberStep('street', 'sub', 'webrtc', { profile: 'main', transport: 'webrtc' }, 1000, s);
    expect(rememberedStep('street', 'sub', 'webrtc', 2000, s)).toEqual({ profile: 'main', transport: 'webrtc' });
    expect(rememberedStep('street', 'sub', 'auto', 2000, s)).toBeNull(); // another transport choice: its own entry
    expect(rememberedStep('roof', 'sub', 'webrtc', 2000, s)).toBeNull();
    rememberStep('street', 'sub', 'webrtc', null, 3000, s);
    expect(rememberedStep('street', 'sub', 'webrtc', 3000, s)).toBeNull();
    expect(s.raw()).toBeUndefined(); // the last entry gone: the key is removed
  });

  test('expires after a day; a broken or missing store never throws', () => {
    const s = memStore();
    rememberStep('street', 'sub', 'webrtc', { profile: 'main', transport: 'webrtc' }, 0, s);
    expect(rememberedStep('street', 'sub', 'webrtc', LIVE_WORKS_TTL_MS + 1, s)).toBeNull();
    s.setItem(LIVE_WORKS_KEY, '{not json');
    expect(rememberedStep('street', 'sub', 'webrtc', 0, s)).toBeNull();
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined };
    expect(rememberedStep('street', 'sub', 'webrtc', 0, throwing)).toBeNull();
    expect(() => rememberStep('street', 'sub', 'webrtc', { profile: 'main', transport: 'webrtc' }, 0, throwing)).not.toThrow();
    expect(rememberedStep('street', 'sub', 'webrtc', 0, null)).toBeNull();
  });
});
