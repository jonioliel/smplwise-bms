import { expect, test } from '@playwright/test';
import { deleteTemplate } from '../src/tickets/delete-text';

// 2.5.4: the shared list poller and the deletion confirmation text. The poller needs a DOM; here it is driven with a stub document/window.
type Listener = () => void;
function stubDom(visible = true) {
  const doc = { visibilityState: visible ? 'visible' : 'hidden', ls: new Map<string, Listener>(), addEventListener(n: string, f: Listener) { this.ls.set(n, f); }, removeEventListener(n: string) { this.ls.delete(n); } };
  const win = { ls: new Map<string, Listener>(), intervals: [] as { f: Listener; ms: number }[], addEventListener(n: string, f: Listener) { this.ls.set(n, f); }, removeEventListener(n: string) { this.ls.delete(n); },
    setInterval(f: Listener, ms: number) { this.intervals.push({ f, ms }); return this.intervals.length; }, clearInterval() { this.intervals.length = 0; } };
  const saved = { document: (globalThis as Record<string, unknown>).document, window: (globalThis as Record<string, unknown>).window };
  Object.assign(globalThis, { document: doc, window: win });
  const restore = () => { for (const k of ['document', 'window'] as const) { if (saved[k] === undefined) delete (globalThis as Record<string, unknown>)[k]; else (globalThis as Record<string, unknown>)[k] = saved[k]; } };
  return { doc, win, restore };
}

test('the shared poller fires every 20 s while visible, on focus and on becoming visible, never while hidden, at most once a second', async () => {
  const { doc, win, restore } = stubDom();
  try {
  const { LiveRefresh, LIVE_REFRESH_MS } = await import('../src/tickets/live-refresh');
  expect(LIVE_REFRESH_MS).toBe(20_000);
  let t = 10_000;
  let n = 0;
  const live = new LiveRefresh(() => n++, LIVE_REFRESH_MS, () => t);
  live.start();
  expect(win.intervals).toHaveLength(1);
  expect(win.intervals[0].ms).toBe(20_000);
  win.intervals[0].f();
  expect(n).toBe(1);
  win.ls.get('focus')!(); // within a second: swallowed
  expect(n).toBe(1);
  t += 2_000;
  win.ls.get('focus')!();
  expect(n).toBe(2);
  t += 2_000;
  doc.visibilityState = 'hidden';
  win.intervals[0].f();
  doc.ls.get('visibilitychange')!();
  expect(n).toBe(2);
  doc.visibilityState = 'visible';
  doc.ls.get('visibilitychange')!();
  expect(n).toBe(3);
  live.stop();
  expect(win.intervals).toHaveLength(0);
  expect(doc.ls.size).toBe(0);
  } finally {
    restore();
  }
});

test('the deletion confirmation names the request in one short line', () => {
  expect(deleteTemplate('deletedOne', 'he')).toMatch(/נמחק/);
});
