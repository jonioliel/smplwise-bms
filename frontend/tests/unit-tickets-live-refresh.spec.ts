import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { LiveEnv } from '../src/api/live-refresh';
import { deleteTemplate } from '../src/tickets/delete-text';

// 2.5.4: the shared list poller and the deletion confirmation text. CR-POLL-FEATURES-2439: the poller is now a thin alias of the shared
// engine (api/live-refresh.ts LiveController); it is driven here with that engine's fake clock and fake page events (LiveEnv), node only.
function fakeEnv() {
  let now = 10_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true, online: true };
  let onResume: () => void = () => undefined;
  let registered = 0;
  const env: Partial<LiveEnv> = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => state.visible,
    online: () => state.online,
    onResume: (a) => {
      onResume = a;
      registered++;
      return () => {
        registered--;
        onResume = () => undefined;
      };
    },
  };
  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
      await flush();
    }
    now = end;
    await flush();
  };
  return { env, state, advance, flush, resume: () => onResume(), pending: () => timers.size, listeners: () => registered, tick: (ms: number) => (now += ms) };
}

test('the shared poller fires every 20 s while visible, on focus and on becoming visible, never while hidden, at most once a second', async () => {
  const { LiveRefresh, LIVE_REFRESH_MS } = await import('../src/tickets/live-refresh');
  expect(LIVE_REFRESH_MS).toBe(20_000);
  const f = fakeEnv();
  let n = 0;
  const live = new LiveRefresh(() => n++, LIVE_REFRESH_MS, f.env);
  live.start();
  expect(f.listeners()).toBe(1);
  expect(f.pending()).toBe(1);
  await f.advance(19_999);
  expect(n).toBe(0);
  await f.advance(1); // exactly 20 s: no jitter
  expect(n).toBe(1);
  f.resume(); // a focus within a second: swallowed
  await f.flush();
  expect(n).toBe(1);
  f.tick(2_000);
  f.resume(); // a focus two seconds later: runs
  await f.flush();
  expect(n).toBe(2);
  f.tick(2_000);
  f.state.visible = false;
  await f.advance(60_000); // hidden: nothing, however long
  f.resume();
  await f.flush();
  expect(n).toBe(2);
  f.state.visible = true;
  f.resume(); // visible again: one run
  f.resume(); // the focus + visibilitychange pair is still one
  await f.flush();
  expect(n).toBe(3);
  live.stop();
  expect(f.pending()).toBe(0);
  expect(f.listeners()).toBe(0);
  await f.advance(120_000);
  expect(n).toBe(3);
  live.start(); // attached again (connectedCallback): polls again at the full period
  await f.advance(20_000);
  expect(n).toBe(4);
  live.stop();
});

test('the shared poller keeps its period when the callback throws (reported, no back-off), and a custom period is kept', async () => {
  const { LiveRefresh } = await import('../src/tickets/live-refresh');
  const f = fakeEnv();
  let n = 0;
  const errors: unknown[] = [];
  const saved = console.error;
  console.error = (e: unknown) => void errors.push(e);
  try {
    const live = new LiveRefresh(() => {
      n++;
      throw new Error('boom');
    }, 45_000, f.env);
    live.start();
    await f.advance(45_000);
    await f.advance(45_000);
    await f.advance(45_000);
    expect(n).toBe(3);
    expect(errors).toHaveLength(3);
    live.stop();
  } finally {
    console.error = saved;
  }
});

test('the module poller is the shared engine, not a second hand-written loop', () => {
  const s = readFileSync(new URL('../src/tickets/live-refresh.ts', import.meta.url), 'utf8');
  expect(s).toContain("from '../api/live-refresh'");
  expect(s).not.toMatch(/setInterval\(/);
  expect(s).not.toMatch(/addEventListener\(/);
});

test('the deletion confirmation names the request in one short line', () => {
  expect(deleteTemplate('deletedOne', 'he')).toMatch(/נמחק/);
});
