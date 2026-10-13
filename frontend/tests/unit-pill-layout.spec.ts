import { test, expect } from '@playwright/test';
import { resolvePillOverlaps, type PillBox } from '../src/map/pill-layout';

// ST7-odd (2.4.10 oddity 3): the entity pills of the 3D view never cover one another - a pill that would overlap an already
// placed pill (the lower, nearer one keeps its place) is raised to sit just above it. Node-only, no browser.

const pill = (id: string, x: number, y: number, w = 100, h = 22): PillBox => ({ id, x, y, w, h });
const rect = (p: PillBox, dy: number) => ({ l: p.x - p.w / 2, r: p.x + p.w / 2, b: p.y + dy, t: p.y + dy - p.h });
const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

test('pills apart stay where they are', () => {
  const dy = resolvePillOverlaps([pill('a', 100, 100), pill('b', 300, 100), pill('c', 100, 200)]);
  expect([...dy.values()]).toEqual([0, 0, 0]);
});

test('the kitchen-door / terrace-shutter case: the lower pill keeps its place, the upper one is raised above it', () => {
  // the phone iso view of the look-dev house: two pills whose anchors project 9 px apart in y and 40 px in x
  const door = pill('door', 200, 120, 140, 24);
  const shutter = pill('shutter', 240, 111, 150, 24);
  const dy = resolvePillOverlaps([door, shutter], 2);
  expect(dy.get('door')).toBe(0);
  expect(dy.get('shutter')).toBe(-(24 + 2 - 9)); // raised so its bottom is 2 px above the door pill's top
  expect(overlap(rect(door, 0), rect(shutter, dy.get('shutter')!))).toBe(false);
});

test('a cloud of pills on the same point becomes a stack, in a deterministic order', () => {
  const pills = ['d', 'b', 'a', 'c'].map((id) => pill(id, 150, 300, 120, 20));
  const dy = resolvePillOverlaps(pills, 2);
  // the same y: ties by id, so `a` stays, `b` above it, `c` above that, `d` on top
  expect(dy.get('a')).toBe(0);
  expect(dy.get('b')).toBe(-22);
  expect(dy.get('c')).toBe(-44);
  expect(dy.get('d')).toBe(-66);
  const again = resolvePillOverlaps(pills.slice().reverse(), 2);
  expect([...again.entries()].sort()).toEqual([...dy.entries()].sort());
});

test('no two pills overlap after the pass, whatever the layout', () => {
  // a deterministic pseudo-random scatter (a phone stage 390 x 844, 60 pills)
  let seed = 7;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const pills: PillBox[] = [];
  for (let i = 0; i < 60; i++) pills.push(pill(`p${i}`, 40 + rnd() * 310, 60 + rnd() * 700, 80 + rnd() * 90, 22));
  const dy = resolvePillOverlaps(pills, 2);
  for (let i = 0; i < pills.length; i++) {
    expect(dy.get(pills[i].id)).toBeLessThanOrEqual(0);
    for (let j = i + 1; j < pills.length; j++) expect(overlap(rect(pills[i], dy.get(pills[i].id)!), rect(pills[j], dy.get(pills[j].id)!)), `${pills[i].id} vs ${pills[j].id}`).toBe(false);
  }
});

test('a pill of unknown size is left alone and blocks nothing', () => {
  const dy = resolvePillOverlaps([pill('a', 100, 100), pill('b', 100, 100, 0, 0), pill('c', 100, 100)]);
  expect(dy.get('b')).toBe(0);
  expect(dy.get('a')).toBe(0);
  expect(dy.get('c')).toBe(-24);
});
