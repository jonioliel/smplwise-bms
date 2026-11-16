import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';

// FE-LEAK-TEXTKEY-2435 (code review 2026-11-13, frontend F01): the home interface gives back what it holds when it leaves the page.
// A recording playing in the home's recordings screen kept its server playback session open and its 1 s clock running after the
// person left the home interface for the full one; the home's own timers and refreshes kept firing on the detached element, and a
// failing family read (GET /home/family) was asked again on every redraw, also after the home had left.
// Mocked backend (tests/home-simple-mocks.ts + the playback routes below); nothing is sent anywhere.

const PERMS = ['alarm.view', 'devices.read', 'devices.control', 'ha.entity.control', 'video.live', 'video.playback', 'events.read', 'map.read', 'energy.view'];
const inHome = (page: Page) => page.locator('sw-home');
const ok = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Sent = { at: number; method: string; path: string }[];

async function routes(page: Page): Promise<Sent> {
  const sent: Sent = [];
  const iso = (h: number, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); };
  page.on('request', (q) => {
    const u = new URL(q.url());
    if (u.pathname.includes('/api/v1/')) sent.push({ at: Date.now(), method: q.method(), path: u.pathname.replace(/^.*api\/v1\//, '') });
  });
  await page.route('**/api/v1/cameras/*/recordings?**', (r) => ok(r, { camera_id: 'cam1', from: '', to: '', track_id: 101, segments: [
    { start_at: iso(0), end_at: iso(23, 50), kind: 'continuous', track_id: 101, start_raw: '', end_raw: '' },
  ], coverage: 'complete', matches: 1, pages: 1, searched_at: '', timezone: 'Asia/Jerusalem', note: '' }));
  await page.route('**/api/v1/cameras/*/events?**', (r) => ok(r, { camera_id: 'cam1', date: '', timezone: 'Asia/Jerusalem', events: [{ id: 'e1', type: 'person', occurred_at: iso(14, 20) }] }));
  await page.route('**/api/v1/playback/sessions', (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    return ok(r, { id: 'pb1', camera_id: 'cam1', generation: 1, state: 'playing', requested_at: '', actual_start_at: (r.request().postDataJSON() as { start_at: string }).start_at, actual_end_at: null,
      media_anchor: null, time_precision: 'unknown', media_handle: null, expires_at: '', capabilities: { seek: true, pause: false, frame_step: false, supported_speeds: [1] }, playback_end_at: '' }, 201);
  });
  await page.route('**/api/v1/playback/sessions/*', (r) => ok(r, { id: 'pb1', state: 'closed' }));
  return sent;
}

/** Every interval the home chunk starts and has not cleared (the build names the lazy chunk `sw-home-<hash>.js`). */
async function trackIntervals(page: Page) {
  await page.addInitScript(() => {
    const live = new Map<number, { ms: number; home: boolean; src: string }>();
    (window as unknown as { __swIntervals: typeof live }).__swIntervals = live;
    const set = window.setInterval.bind(window);
    const clear = window.clearInterval.bind(window);
    window.setInterval = ((fn: TimerHandler, ms?: number, ...a: unknown[]) => {
      const id = set(fn, ms, ...a);
      const stack = (new Error().stack ?? '').split('\n').slice(2).join(' ');
      const src = /assets\/([\w-]+)\.js/.exec(stack)?.[1] ?? '';
      live.set(id, { ms: ms ?? 0, home: /^sw-home-/.test(src), src });
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: number) => { if (id !== undefined) live.delete(id); clear(id); }) as typeof window.clearInterval;
  });
}

const homeIntervals = (page: Page) => page.evaluate(() => [...(window as unknown as { __swIntervals: Map<number, { ms: number; home: boolean; src: string }> }).__swIntervals.values()].filter((v) => v.home).map((v) => `${v.ms}@${v.src}`).sort());

test('leaving the home interface while a recording plays closes the playback session and stops every home timer', async ({ page }) => {
  await trackIntervals(page);
  await mockHome(page, { perms: PERMS });
  const sent = await routes(page);
  await page.goto('/#/home/playback/cam1');
  await inHome(page).waitFor();
  await settle(page);
  // play from the event on the timeline: one session opens, the 1 s playback clock runs
  await inHome(page).locator('.pb-ev').first().click();
  await expect.poll(() => sent.filter((s) => s.method === 'POST' && s.path === 'playback/sessions').length).toBe(1);
  await expect(inHome(page).locator('[data-act="pbPlay"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await homeIntervals(page)).some((v) => v.startsWith('1000@'))).toBe(true);

  // leave the home interface for the full one (the shell removes sw-home)
  await page.evaluate(() => { location.hash = '#/live'; });
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home'))).toBe(false);

  // the server session is released, once
  await expect.poll(() => sent.filter((s) => s.method === 'DELETE' && s.path === 'playback/sessions/pb1').length).toBe(1);
  // no interval of the home chunk is left (playback clock 1 s, wall clock 20 s, media / systems refresh 12 s)
  await expect.poll(() => homeIntervals(page), { message: 'intervals of the home chunk still running' }).toEqual([]);

  // and nothing the home reads is asked for again: no playback call, no home overview refresh, no media / systems poll
  const left = Date.now();
  await page.waitForTimeout(3500);
  const after = sent.filter((s) => s.at > left && /^(playback\/|home\/|multimedia\/|cameras\/[^/]+\/(recordings|events))/.test(s.path));
  expect(after.map((s) => s.path)).toEqual([]);
  expect(sent.filter((s) => s.method === 'DELETE' && s.path === 'playback/sessions/pb1').length).toBe(1);
});

test('leaving the home interface with nothing playing sends no playback request', async ({ page }) => {
  await trackIntervals(page);
  await mockHome(page, { perms: PERMS });
  const sent = await routes(page);
  await page.goto('/#/home/playback/cam1');
  await inHome(page).waitFor();
  await settle(page);
  await expect.poll(async () => (await homeIntervals(page)).some((v) => v.startsWith('20000@'))).toBe(true); // the wall clock of the home
  await page.evaluate(() => { location.hash = '#/live'; });
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home'))).toBe(false);
  await expect.poll(() => homeIntervals(page), { message: 'intervals of the home chunk still running' }).toEqual([]);
  expect(sent.filter((s) => s.path.startsWith('playback/'))).toEqual([]);
  // a home read that keeps failing (the mocks answer 404 for the family features) is not asked for again on a detached home
  const left = Date.now();
  await page.waitForTimeout(3000);
  expect(sent.filter((s) => s.at > left && /^(home\/|multimedia\/)/.test(s.path)).map((s) => s.path)).toEqual([]);
});
