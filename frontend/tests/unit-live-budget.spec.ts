import { test, expect } from '@playwright/test';
import { RELEASE_MS, SNAPSHOT_REFRESH_MS, allocateLive, effectiveLiveCap } from '../src/api/live-budget';

// The wall's live-stream budget (hotfix for the remote cap): pure functions, Node only.

const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const set = (...ids: string[]) => new Set(ids);

test.describe('effective cap', () => {
  test('remote: the smaller of the installation cap and the sign-in cap; LAN / Ingress: the installation cap alone', () => {
    expect(effectiveLiveCap(8, 4)).toBe(4);
    expect(effectiveLiveCap(8, 16)).toBe(8);
    expect(effectiveLiveCap(32, 16)).toBe(16);
    expect(effectiveLiveCap(8, null)).toBe(8);
    expect(effectiveLiveCap(0, null)).toBe(8);
  });
  test('the timings the owner asked for', () => {
    expect(RELEASE_MS).toBe(5000);
    expect(SNAPSHOT_REFRESH_MS).toBe(10000);
  });
});

test.describe('allocateLive', () => {
  test('8 tiles in view under a cap of 4: the first four stream, four are snapshots', () => {
    expect([...allocateLive(order, set(...order), set(), 4)]).toEqual(['a', 'b', 'c', 'd']);
  });

  test('only tiles that are wanted (in view or just left) stream: an off-screen tile never holds a slot', () => {
    expect([...allocateLive(order, set('c', 'd', 'e'), set(), 16)]).toEqual(['c', 'd', 'e']);
  });

  test('a streaming tile keeps its slot while wanted; a newcomer waits for a free slot and then takes it', () => {
    const now = set('a', 'b', 'c', 'd');
    // the view moved to e..h but a..d are still inside their 5 s grace: the budget is full, nobody new starts
    expect([...allocateLive(order, set('a', 'b', 'c', 'd', 'e', 'f'), now, 4)]).toEqual(['a', 'b', 'c', 'd']);
    // a and b are released (grace over): e and f take the slots, c and d keep theirs
    const after = allocateLive(order, set('c', 'd', 'e', 'f'), now, 4);
    expect([...after].sort()).toEqual(['c', 'd', 'e', 'f']);
  });

  test('a released tile frees its slot for the budget to be reused while scrolling', () => {
    let live = allocateLive(order, set('a', 'b', 'c', 'd'), set(), 4);
    for (const view of [set('c', 'd', 'e', 'f'), set('e', 'f', 'g', 'h')]) live = allocateLive(order, view, live, 4);
    expect([...live].sort()).toEqual(['e', 'f', 'g', 'h']);
    expect(live.size).toBeLessThanOrEqual(4);
  });

  test('never more than the cap, whatever is wanted', () => {
    for (let cap = 1; cap <= 8; cap++) expect(allocateLive(order, set(...order), set('h', 'g'), cap).size).toBe(cap);
  });
});
