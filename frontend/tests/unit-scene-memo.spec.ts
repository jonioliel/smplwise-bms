import { test, expect } from '@playwright/test';
import { sameRefs } from '../src/map/memo';

// The 0.1.89 list, item 3: the history map's and the event page's 3D scene getters answer their memo by the identity of
// what they read before building the anchor list and its JSON key. Runs in node.
test.describe('scene memo keys (unit)', () => {
  test('same objects and values hit, a replaced object or a changed value misses', () => {
    const bundle = { anchors: [{ id: 'a' }] };
    const doc = { walls: [] };
    const refs = [bundle, doc, null, 'L0', 540, 'Asia/Jerusalem'];
    expect(sameRefs(refs, [bundle, doc, null, 'L0', 540, 'Asia/Jerusalem'])).toBe(true);
    // a structurally equal but new bundle is a miss here (the caller's signature then decides whether to rebuild)
    expect(sameRefs(refs, [{ anchors: [{ id: 'a' }] }, doc, null, 'L0', 540, 'Asia/Jerusalem'])).toBe(false);
    expect(sameRefs(refs, [bundle, doc, null, 'L0', 541, 'Asia/Jerusalem'])).toBe(false);
    expect(sameRefs(refs, [bundle, doc, null, 'L1', 540, 'Asia/Jerusalem'])).toBe(false);
  });

  test('no memo, another length or a NaN key never hit', () => {
    expect(sameRefs(null, [])).toBe(false);
    expect(sameRefs(undefined, [1])).toBe(false);
    expect(sameRefs([1, 2], [1])).toBe(false);
    expect(sameRefs([Number.NaN], [Number.NaN])).toBe(false);
    expect(sameRefs([], [])).toBe(true);
  });
});
