import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { keyedDebounce, type DebounceTimers } from '../src/home/keyed-debounce';

// CR-I18N-HOME-2441 (code review 08:F21): the home screen's favourites save. One timer served every list, so a second list changed
// within the 400 ms delay cancelled the first list's save. Node only, with fake timers.

function fakeTimers() {
  let now = 0;
  let seq = 0;
  const due = new Map<number, { at: number; fn: () => void }>();
  const timers: DebounceTimers = {
    set: (fn, ms) => { due.set(++seq, { at: now + ms, fn }); return seq; },
    clear: (id) => { due.delete(id); },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...due].sort((a, b) => a[1].at - b[1].at)) if (t.at <= now && due.delete(id)) t.fn();
  };
  return { timers, advance, waiting: () => due.size };
}

test('two different lists changed within the delay are both saved (the first write was lost)', () => {
  const t = fakeTimers();
  const sent: [string, string[]][] = [];
  const d = keyedDebounce<string[]>((k, v) => sent.push([k, v]), 400, t.timers);
  d.push('home', ['light.a']);
  t.advance(100);
  d.push('living', ['scene.b']);
  expect(d.pending).toBe(2);
  t.advance(299);
  expect(sent).toEqual([]);
  t.advance(1); // 400 ms after the first list
  expect(sent).toEqual([['home', ['light.a']]]);
  t.advance(100); // 400 ms after the second
  expect(sent).toEqual([['home', ['light.a']], ['living', ['scene.b']]]);
  expect(d.pending).toBe(0);
  expect(t.waiting()).toBe(0);
});

test('the same list changed again: one save, the latest value, the delay restarts', () => {
  const t = fakeTimers();
  const sent: [string, number][] = [];
  const d = keyedDebounce<number>((k, v) => sent.push([k, v]), 400, t.timers);
  d.push('home', 1);
  t.advance(300);
  d.push('home', 2);
  t.advance(300);
  expect(sent).toEqual([]);
  t.advance(100);
  expect(sent).toEqual([['home', 2]]);
  expect(t.waiting()).toBe(0);
});

test('flush sends every pending list at once, in the order the lists were first changed, and no timer fires later', () => {
  const t = fakeTimers();
  const sent: [string, number][] = [];
  const d = keyedDebounce<number>((k, v) => sent.push([k, v]), 400, t.timers);
  d.push('a', 1);
  d.push('b', 2);
  d.push('a', 3);
  d.flush();
  expect(sent).toEqual([['a', 3], ['b', 2]]);
  t.advance(1000);
  expect(sent).toHaveLength(2);
  d.flush(); // nothing pending: nothing sent
  expect(sent).toHaveLength(2);
});

test('a save that changes another list while it is being sent is kept for its own delay', () => {
  const t = fakeTimers();
  const sent: string[] = [];
  const d = keyedDebounce<number>((k) => { sent.push(k); if (k === 'a') d.push('c', 9); }, 400, t.timers);
  d.push('a', 1);
  t.advance(400);
  expect(sent).toEqual(['a']);
  expect(d.pending).toBe(1);
  t.advance(400);
  expect(sent).toEqual(['a', 'c']);
});

test('the home element saves its favourites through the per-list debounce and flushes it when it leaves the page', () => {
  const src = readFileSync(new URL('../src/home/sw-home.ts', import.meta.url), 'utf8');
  expect(src).toMatch(/private favSaves = keyedDebounce<Fav\[\]>\(/);
  expect(src).toMatch(/this\.favSaves\.push\(key, list\)/);
  expect(src).toMatch(/disconnectedCallback\(\)[\s\S]{0,1500}this\.flushFavs\(\)/);
  expect(src).not.toMatch(/pendingFavs|saveT\b/);
});
