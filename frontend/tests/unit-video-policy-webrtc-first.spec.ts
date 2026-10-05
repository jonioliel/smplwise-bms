import { test, expect } from '@playwright/test';
import { lanLadder, mseFirst, noteWebrtcUnreachable, webrtcUnreachable, WEBRTC_DOWN_KEY, WEBRTC_DOWN_TTL_MS } from '../src/api/video-policy';
import { effectiveTransport, TRANSPORT_DEFAULT, transportLabel } from '../src/api/prefs';
import type { ProductSettings } from '../src/api/media';

// Owner decision 2026-10-05: WebRTC first, MSE only when WebRTC cannot be used - the installation default is `auto`, and
// an `auto` player that could not connect WebRTC remembers that per tab for a while. Node only (pure functions); the
// screens and the player: evidence-webrtc-first.spec.ts.

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

test.describe('the transport default', () => {
  test('is automatic: no settings, an empty settings object and a read without the key all give `auto`', () => {
    expect(TRANSPORT_DEFAULT).toBe('auto');
    expect(effectiveTransport(null)).toBe('auto');
    expect(effectiveTransport({} as ProductSettings)).toBe('auto');
    expect(effectiveTransport({ 'media.max_live_sessions': 16 } as ProductSettings)).toBe('auto');
  });

  test('a stored choice wins over the default (a stored "mse" is kept by the migration)', () => {
    expect(effectiveTransport({ 'media.transport_default': 'mse' } as ProductSettings)).toBe('mse');
    expect(effectiveTransport({ 'media.transport_default': 'webrtc' } as ProductSettings)).toBe('webrtc');
  });

  test('the Hebrew names make "MSE בלבד" a deliberate choice', () => {
    expect(transportLabel('auto')).toContain('אוטומטי');
    expect(transportLabel('auto')).toContain('WebRTC');
    expect(transportLabel('webrtc')).toBe('WebRTC בלבד');
    expect(transportLabel('mse')).toBe('MSE בלבד');
    expect(transportLabel(undefined)).toBe(transportLabel('auto'));
  });
});

test.describe('the auto ladder', () => {
  test('tries WebRTC first and keeps MSE as the next step of the same profile', () => {
    expect(lanLadder('main', 'auto', false)).toEqual([{ profile: 'main', transport: 'webrtc' }, { profile: 'main', transport: 'mse' }]);
    expect(lanLadder('sub', 'auto', false)).toEqual([{ profile: 'sub', transport: 'webrtc' }, { profile: 'sub', transport: 'mse' }]);
  });

  test('with WebRTC known unreachable the first MSE step moves to the front; a WebRTC-only chain stays as it is', () => {
    expect(mseFirst(lanLadder('main', 'auto', false))).toEqual([{ profile: 'main', transport: 'mse' }, { profile: 'main', transport: 'webrtc' }]);
    expect(mseFirst(lanLadder('sub', 'auto', true))).toEqual([
      { profile: 'sub', transport: 'mse' },
      { profile: 'sub', transport: 'webrtc' },
      { profile: 'main', transport: 'mse' },
      { profile: 'main', transport: 'webrtc' },
    ]);
    expect(mseFirst(lanLadder('main', 'webrtc', true))).toEqual(lanLadder('main', 'webrtc', true));
    expect(mseFirst([])).toEqual([]);
  });
});

test.describe('the per-tab memory of an unreachable WebRTC', () => {
  test('is empty by default, set by a connect failure, expires after the TTL and can be forgotten', () => {
    const store = new MemStore();
    const t0 = 1_700_000_000_000;
    expect(webrtcUnreachable(t0, store)).toBe(false);
    noteWebrtcUnreachable(true, t0, store);
    expect(store.getItem(WEBRTC_DOWN_KEY)).toBe(String(t0));
    expect(webrtcUnreachable(t0 + 1000, store)).toBe(true);
    expect(webrtcUnreachable(t0 + WEBRTC_DOWN_TTL_MS, store)).toBe(true);
    expect(webrtcUnreachable(t0 + WEBRTC_DOWN_TTL_MS + 1, store)).toBe(false);
    noteWebrtcUnreachable(false, t0 + 2000, store);
    expect(webrtcUnreachable(t0 + 2000, store)).toBe(false);
    expect(store.getItem(WEBRTC_DOWN_KEY)).toBeNull();
  });

  test('a corrupt or missing store never throws and reads as reachable', () => {
    const store = new MemStore();
    store.setItem(WEBRTC_DOWN_KEY, 'not-a-number');
    expect(webrtcUnreachable(Date.now(), store)).toBe(false);
    expect(webrtcUnreachable(Date.now(), null)).toBe(false);
    expect(() => noteWebrtcUnreachable(true, Date.now(), null)).not.toThrow();
    const broken = { getItem: () => { throw new Error('private mode'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    expect(webrtcUnreachable(Date.now(), broken)).toBe(false);
    expect(() => noteWebrtcUnreachable(true, Date.now(), broken)).not.toThrow();
  });

  test('the TTL is minutes, not a day: WebRTC is probed again within the hour', () => {
    expect(WEBRTC_DOWN_TTL_MS).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(WEBRTC_DOWN_TTL_MS).toBeGreaterThanOrEqual(60 * 1000);
  });
});
