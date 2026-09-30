import { test, expect } from '@playwright/test';
import { CardLiveBudget, cardProfile, isCameraSource, liveCapOf, resolveQuery, sameSource, wallProfileOf, type CameraSource } from '../src/api/camera-card';
import { RELEASE_MS, REFUSED_MS } from '../src/api/live-budget';
import type { Me } from '../src/api/types';

// The camera card's pure parts (owner 2026-09-30): the shared live budget of the cards on one screen (timers injected),
// the source helpers, the profile / cap rules of this channel, and the definition the card library imports. Node only -
// the element itself is exercised by tests/evidence-camera-card.spec.ts.

/** A manual clock: `set` queues, `tick(ms)` runs what is due. */
function clock() {
  let now = 0;
  let n = 0;
  const q = new Map<number, { at: number; fn: () => void }>();
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        const id = ++n;
        q.set(id, { at: now + ms, fn });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clear: (t: ReturnType<typeof setTimeout>) => void q.delete(t as unknown as number),
    },
    tick(ms: number) {
      now += ms;
      for (const [id, t] of [...q]) {
        if (t.at <= now) {
          q.delete(id);
          t.fn();
        }
      }
    },
    pending: () => q.size,
  };
}

function budget(cap: number) {
  const c = clock();
  const b = new CardLiveBudget(c.timers);
  b.setCap(cap);
  const live = new Map<string, boolean>();
  const join = (id: string) => b.register(id, (v) => live.set(id, v));
  return { b, c, live, join };
}

test.describe('CardLiveBudget', () => {
  test('cards in view get slots in registration order up to the cap; the rest wait', () => {
    const { b, live, join } = budget(2);
    for (const id of ['a', 'b', 'c']) join(id);
    for (const id of ['a', 'b', 'c']) b.setVisible(id, true);
    expect([...live].filter(([, v]) => v).map(([k]) => k)).toEqual(['a', 'b']);
    expect(live.get('c')).toBe(false);
    expect(b.size).toBe(2);
  });

  test('a card out of view (or a hidden tab) keeps its stream for RELEASE_MS, then the slot goes to the next', () => {
    const { b, c, live, join } = budget(1);
    join('a');
    join('b');
    b.setVisible('a', true);
    b.setVisible('b', true);
    expect(live.get('a')).toBe(true);
    expect(live.get('b')).toBe(false);
    b.setVisible('a', false); // scrolled away / tab hidden
    c.tick(RELEASE_MS - 1);
    expect(live.get('a')).toBe(true); // a quick scroll back keeps it
    c.tick(1);
    expect(live.get('a')).toBe(false);
    expect(live.get('b')).toBe(true);
  });

  test('coming back inside the grace period cancels the release', () => {
    const { b, c, live, join } = budget(1);
    join('a');
    b.setVisible('a', true);
    b.setVisible('a', false);
    c.tick(RELEASE_MS - 100);
    b.setVisible('a', true);
    c.tick(RELEASE_MS);
    expect(live.get('a')).toBe(true);
    expect(c.pending()).toBe(0);
  });

  test('a card that already streams keeps its slot over a newcomer that registered earlier', () => {
    const { b, live, join } = budget(1);
    join('a');
    join('b');
    b.setVisible('b', true);
    expect(live.get('b')).toBe(true);
    b.setVisible('a', true);
    expect(live.get('a')).toBe(false);
    expect(live.get('b')).toBe(true);
  });

  test('drop() releases at once (the card opens its own bigger view)', () => {
    const { b, live, join } = budget(1);
    join('a');
    join('b');
    b.setVisible('a', true);
    b.setVisible('b', true);
    b.drop('a');
    expect(live.get('a')).toBe(false);
    expect(live.get('b')).toBe(true);
  });

  test('a card the relay refused (remote cap) sits out as a snapshot and lowers the working budget, then tries again', () => {
    const { b, c, live, join } = budget(3);
    for (const id of ['a', 'b', 'c']) join(id);
    for (const id of ['a', 'b', 'c']) b.setVisible(id, true);
    expect(b.size).toBe(3);
    b.refuse('c');
    expect(live.get('c')).toBe(false);
    expect(b.size).toBe(2); // what really streams
    b.refuse('c'); // a repeat changes nothing
    c.tick(REFUSED_MS);
    expect(live.get('c')).toBe(true);
    expect(b.size).toBe(3);
  });

  test('a cap raised or lowered reallocates; leaving frees the slot and every timer', () => {
    const { b, c, live, join } = budget(1);
    join('a');
    join('b');
    b.setVisible('a', true);
    b.setVisible('b', true);
    b.setCap(2);
    expect(live.get('b')).toBe(true);
    b.setCap(1);
    expect(live.get('b')).toBe(false);
    b.setVisible('a', false);
    b.unregister('a');
    expect(live.get('b')).toBe(true);
    expect(c.pending()).toBe(0);
  });

  test('an unregistered card never gets a slot back', () => {
    const { b, live, join } = budget(2);
    join('a');
    b.setVisible('a', true);
    b.unregister('a');
    b.setVisible('a', true);
    expect(b.size).toBe(0);
    expect(live.get('a')).toBe(true); // its last notification, before it left
  });
});

test.describe('source helpers', () => {
  const nvr: CameraSource = { kind: 'nvr', recorder_id: 'nvr-1', channel: 3 };
  const ha: CameraSource = { kind: 'ha', entity_id: 'camera.garden' };

  test('isCameraSource accepts only what the server accepts', () => {
    expect(isCameraSource(nvr)).toBe(true);
    expect(isCameraSource(ha)).toBe(true);
    for (const bad of [null, undefined, 'x', {}, { kind: 'nvr' }, { kind: 'nvr', recorder_id: '', channel: 1 }, { kind: 'nvr', recorder_id: 'r', channel: 0 }, { kind: 'nvr', recorder_id: 'r', channel: 257 }, { kind: 'nvr', recorder_id: 'r', channel: 1.5 }, { kind: 'ha', entity_id: 'light.lobby' }, { kind: 'ha', entity_id: 'camera.' }, { kind: 'rtsp', url: 'rtsp://x' }]) {
      expect(isCameraSource(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  test('sameSource and the resolve query (encoded, no credentials anywhere)', () => {
    expect(sameSource(nvr, { ...nvr })).toBe(true);
    expect(sameSource(nvr, { ...nvr, channel: 4 })).toBe(false);
    expect(sameSource(nvr, ha)).toBe(false);
    expect(sameSource(null, null)).toBe(true);
    expect(sameSource(nvr, null)).toBe(false);
    expect(resolveQuery(nvr)).toBe('kind=nvr&recorder_id=nvr-1&channel=3');
    expect(resolveQuery(ha)).toBe('kind=ha&entity_id=camera.garden');
    expect(resolveQuery({ kind: 'nvr', recorder_id: 'a b&c', channel: 1 })).toBe('kind=nvr&recorder_id=a%20b%26c&channel=1');
  });
});

test.describe('profile and cap of this channel', () => {
  const remote = { channel: 'remote', remote: {} } as unknown as Me;
  const local = { channel: 'ingress' } as unknown as Me;

  test('a large card plays main; otherwise the wall profile of the channel (remote.wall_profile remotely, media.wall_profile on the LAN)', () => {
    expect(cardProfile('l', 'sub')).toBe('main');
    expect(cardProfile('m', 'sub')).toBe('sub');
    expect(cardProfile('s', 'main')).toBe('main');
    expect(wallProfileOf({ 'media.wall_profile': 'main', 'remote.wall_profile': 'sub' } as never, local)).toBe('main');
    expect(wallProfileOf({ 'media.wall_profile': 'main', 'remote.wall_profile': 'sub' } as never, remote)).toBe('sub');
    expect(wallProfileOf({ 'media.wall_profile': 'sub', 'remote.wall_profile': 'main' } as never, remote)).toBe('main');
    expect(wallProfileOf(null, local)).toBe('sub');
  });

  test('the live cap is the installation cap, and remotely also the sign-in cap (the smaller)', () => {
    const s = { 'media.max_live_sessions': 8, 'remote.max_live_streams': 4 } as never;
    expect(liveCapOf(s, local)).toBe(8);
    expect(liveCapOf(s, remote)).toBe(4);
    expect(liveCapOf(null, local)).toBe(16);
  });
});
