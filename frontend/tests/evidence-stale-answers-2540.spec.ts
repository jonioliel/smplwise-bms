import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { appReady } from './helpers/app-ready';
import { mockHome } from './home-simple-mocks';
import { mockP2 } from './home-v3-p2-mocks';
import { mockP3 } from './home-v3p3-mocks';
import { mockFavs } from './home-favorites-2500-mocks';
import { installCalendarsMock } from './calendars-mocks';
import { url as appUrl } from './generator-mocks';
import { BANNER, GATE_CALL, LOBBY_CALL, installCallsMock, openApp } from './incoming-call-mocks';
import { installMulti } from './multi-nvr-mock';
import { mock as playbackMock, openAndPlay } from './playback-stall-mock';

// STALE-ANSWERS-2540 (review DEEP-REVIEW-2520-FRONTEND-SCREENS SCR-11 / 14 / 19 / 24 / 28 / 32 / 33 / 35 / 39; docs/changes/STALE-ANSWERS-2540.md).
// The real screens against a MOCKED backend (the existing mock layers, plus a route per test that HOLDS one answer until the test lets it
// go): a late answer for something the user already left never overwrites the newer selection, and a double action runs once.
// Nothing is sent anywhere; no device, no recorder, no Home Assistant. Desktop project only (the sizes are set inside the tests).
//   npx playwright test tests/evidence-stale-answers-2540.spec.ts --project=desktop --workers=2

const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiPath = (r: Route) => new URL(r.request().url()).pathname.replace(/^.*\/api\/v1\//, '');

/** An answer held back until the test opens it. */
function gate() {
  let open!: () => void;
  const held = new Promise<void>((res) => (open = res));
  return { held, open };
}

const home = (page: Page) => page.locator('sw-home');

async function openHome(page: Page, route: string) {
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
}

test.describe('STALE-ANSWERS-2540: the newest selection wins, a double action runs once', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the sizes are set inside the tests');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ---------------------------------------------------------------- SCR-39
  test('SCR-39: a double tap on "send note" sends ONE note, and the button is disabled while it is on its way', async ({ page }) => {
    await mockP2(page);
    let notes = 0;
    const hold = gate();
    await page.route('**/api/v1/home/tickets/*/notes', async (r) => {
      notes += 1;
      await hold.held;
      return r.fallback();
    });
    await openHome(page, 'tickets');
    await home(page).locator('[data-act="p2Ticket"]').first().click();
    await home(page).locator('[data-act="p2TkNote"]').click();
    await home(page).locator('[data-sheet="ticket"] textarea').fill('עדיין מטפטף');
    await home(page).locator('[data-act="p2TkNoteSend"]').dblclick();
    await page.waitForTimeout(500);
    expect(notes).toBe(1);
    await expect(home(page).locator('[data-act="p2TkNoteSend"]')).toBeDisabled();
    hold.open();
    await expect(home(page).locator('[data-act="p2TkNoteSend"]')).toHaveCount(0); // sent: the sheet closed
    expect(notes).toBe(1);
  });

  // ---------------------------------------------------------------- SCR-32
  test('SCR-32: the bill of account B never shows account A\'s money - not while B loads, not after A\'s answer lands last', async ({ page }) => {
    await mockP3(page);
    const today = new Date();
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const period = { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
    const amounts: Record<string, string> = { acc1: '111', acc2: '222', acc3: '333' };
    const hold = gate();
    await page.route('**/api/v1/energy/accounts', (r) => json(r, { items: [{ id: 'acc1', name: 'הבית', status: 'active' }, { id: 'acc2', name: 'המחסן', status: 'active' }, { id: 'acc3', name: 'החניה', status: 'active' }] }));
    await page.route('**/api/v1/energy/accounts/*/status', async (r) => {
      const id = apiPath(r).split('/')[2];
      if (id === 'acc2') await hold.held;
      return json(r, { period, kwh_so_far: 100, meters: [], notes: [], amount_so_far: amounts[id] });
    });
    await openHome(page, 'bills');
    const soFar = home(page).locator('[data-p3-sofar]');
    await expect(soFar).toContainText('111');
    await home(page).locator('sw-segmented button', { hasText: 'המחסן' }).click(); // acc2: its answer is held
    await expect(soFar).toHaveCount(0); // loading: acc1's money is not drawn under acc2
    await home(page).locator('sw-segmented button', { hasText: 'החניה' }).click(); // acc3 answers at once
    await expect(soFar).toContainText('333');
    hold.open(); // acc2's answer lands last
    await page.waitForTimeout(600);
    await expect(soFar).toContainText('333');
    await expect(soFar).not.toContainText('222');
  });

  // ---------------------------------------------------------------- SCR-33
  test('SCR-33: a slow detail of scene A never lands in the sheet opened since for scene B; save writes B', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const m = await mockFavs(page, { sceneManager: true, editable: ['evening', 'night'], policy: { home_only: true, may_switch: false } });
    const hold = gate();
    await page.route('**/api/v1/automations/scene/evening', async (r) => {
      if (r.request().method() === 'GET') await hold.held;
      return r.fallback();
    });
    await openHome(page, 'settings/scenes');
    const sheet = home(page).locator('[data-sheet="sceneEdit"]');
    await home(page).locator('[data-scene-edit="evening"]').click(); // its detail is held
    await expect(sheet).toBeVisible();
    await sheet.locator('button[data-act="close"]').click();
    await home(page).locator('[data-scene-edit="night"]').click();
    await expect(sheet.locator('input.inp')).toHaveValue('לילה');
    hold.open(); // evening's detail lands last
    await page.waitForTimeout(600);
    await expect(sheet.locator('input.inp')).toHaveValue('לילה');
    await sheet.locator('[data-act="scEditSave"]').click();
    await expect.poll(() => m.calls.filter((c) => c.method === 'PUT' && c.path.startsWith('automations/scene/')).map((c) => c.path)).toEqual(['automations/scene/night']);
    expect(m.calls.find((c) => c.path === 'automations/scene/night')!.body).toMatchObject({ draft: { name: 'לילה' } });
  });

  // ---------------------------------------------------------------- SCR-28
  async function recordingsRoutes(page: Page) {
    const st = { creates: 0, seeks: [] as string[], closes: [] as string[], inFlight: 0, maxInFlight: 0 };
    const day = new Date();
    const iso = (h: number, m = 0) => { const d = new Date(day); d.setHours(h, m, 0, 0); return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); };
    const session = (id: string, at: string) => ({ id, camera_id: 'cam1', generation: 1, state: 'playing', requested_at: at, actual_start_at: at, actual_end_at: null, media_anchor: null, time_precision: 'unknown', media_handle: null, expires_at: '', capabilities: { seek: true, pause: false, frame_step: false, supported_speeds: [1] }, playback_end_at: '' });
    await page.route('**/api/v1/cameras/*/recordings?**', (r) => json(r, { camera_id: 'cam1', from: '', to: '', track_id: 101, segments: [{ start_at: iso(0), end_at: iso(23, 50), kind: 'continuous', track_id: 101, start_raw: '', end_raw: '' }], coverage: 'complete', matches: 1, pages: 1, searched_at: '', timezone: 'Asia/Jerusalem', note: '' }));
    await page.route('**/api/v1/cameras/*/events?**', (r) => json(r, { camera_id: 'cam1', date: '', timezone: 'Asia/Jerusalem', events: [] }));
    const holds: (() => void)[] = [];
    const held = async () => {
      st.inFlight += 1;
      st.maxInFlight = Math.max(st.maxInFlight, st.inFlight);
      await new Promise<void>((res) => holds.push(res));
      st.inFlight -= 1;
    };
    await page.route('**/api/v1/playback/sessions', async (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      st.creates += 1;
      const id = `pb${st.creates}`;
      const at = (r.request().postDataJSON() as { start_at: string }).start_at;
      await held();
      return json(r, session(id, at), 201);
    });
    await page.route('**/api/v1/playback/sessions/*/seek', async (r) => {
      const at = (r.request().postDataJSON() as { start_at: string }).start_at;
      st.seeks.push(at);
      await held();
      return json(r, session(apiPath(r).split('/')[2], at));
    });
    await page.route('**/api/v1/playback/sessions/*', (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      st.closes.push(apiPath(r));
      return json(r, { id: 'x', state: 'closed' });
    });
    const release = async () => {
      for (let i = 0; i < 40; i++) {
        while (holds.length) holds.shift()!();
        await page.waitForTimeout(100);
      }
    };
    return { st, holds, release };
  }

  test('SCR-28: a double tap on play opens ONE playback session (the second tap seeks it); nothing is left open', async ({ page }) => {
    await mockHome(page, { perms: ['devices.read', 'video.live', 'video.playback', 'events.read', 'map.read'] });
    const rec = await recordingsRoutes(page);
    await openHome(page, 'playback/cam1');
    await expect(home(page).locator('.tl .tl-seg')).toHaveCount(1);
    await home(page).locator('[data-act="pbPlay"]').dblclick();
    await page.waitForTimeout(500);
    expect(rec.st.creates).toBe(1); // the second tap waits for the first one's session
    await rec.release();
    await expect(home(page).locator('[data-act="pbPlay"]')).toHaveAttribute('aria-pressed', 'true');
    expect(rec.st.creates).toBe(1);
    expect(rec.st.closes).toEqual([]); // no session opened and dropped
    expect(rec.st.maxInFlight).toBe(1);
  });

  test('SCR-28: three quick "+10 s" - never two seeks at once, and the last one sent is the position asked for last', async ({ page }) => {
    await mockHome(page, { perms: ['devices.read', 'video.live', 'video.playback', 'events.read', 'map.read'] });
    const rec = await recordingsRoutes(page);
    await openHome(page, 'playback/cam1');
    await expect(home(page).locator('.tl .tl-seg')).toHaveCount(1);
    await home(page).locator('[data-act="pbPlay"]').click();
    await expect.poll(() => rec.holds.length).toBe(1);
    rec.holds.shift()!();
    await expect(home(page).locator('[data-act="pbPlay"]')).toHaveAttribute('aria-pressed', 'true');
    const ffw = home(page).locator('[data-act="pbSkip"][data-d="10"]');
    await ffw.click();
    await ffw.click();
    await ffw.click();
    await page.waitForTimeout(400);
    expect(rec.st.seeks.length).toBe(1); // the first one is on its way; the others wait behind it
    await rec.release();
    expect(rec.st.seeks.length).toBe(2); // +20 was replaced by +30 while it waited
    expect(rec.st.maxInFlight).toBe(1);
    expect(Date.parse(rec.st.seeks[1]) - Date.parse(rec.st.seeks[0])).toBeGreaterThanOrEqual(19_000);
  });

  // ---------------------------------------------------------------- SCR-35
  test('SCR-35: the resident room list shows the day selected last, even when an earlier day answers last', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime(new Date('2026-10-29T10:40:00+02:00'));
    await installCalendarsMock(page);
    await page.route('**/api/v1/me/calendar**', (r) => json(r, { occurrences: [] }));
    const hold = gate();
    let reads = 0;
    await page.route('**/api/v1/calendar/rooms/day**', async (r) => {
      reads += 1;
      const date = new URL(r.request().url()).searchParams.get('date')!;
      const busy = reads === 2; // the second read (the first tapped day) is the slow one, and that day is booked
      if (busy) await hold.held;
      const at = (h: number) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00+02:00`).toISOString();
      const entries = busy ? [10, 14].map((h, i) => ({ id: `o${i}`, calendar_id: 'a', title: 'תפוס', start: at(h), end: at(h + 2), state: 'confirmed', kind: 'booking', organizer: null, recurring: false, revision: 1 })) : [];
      return json(r, { rooms: [{ calendar_id: 'a', name: 'חדר ישיבות אלון', capacity: 8, open: [{ from: '07:00', to: '23:00' }], equipment: [], entries }] });
    });
    await page.goto('about:blank');
    await page.goto(appUrl('/calendars/cal'));
    await appReady(page);
    const R = 'sw-app calendars-page cal-resident';
    await expect(page.locator(`${R} [data-res-room="a"]`)).toBeVisible();
    await page.locator(`${R} [data-res-day="3"]`).click(); // held, booked
    await page.locator(`${R} [data-res-day="5"]`).click(); // answers at once, free
    await expect(page.locator(`${R} [data-res-room="a"]`)).toBeVisible();
    await expect(page.locator(`${R} [data-res-room="a"] .mini i`)).toHaveCount(0);
    hold.open(); // day 3 lands last
    await page.waitForTimeout(600);
    await expect(page.locator(`${R} [data-res-day="5"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${R} [data-res-room="a"] .mini i`)).toHaveCount(0);
  });

  // ---------------------------------------------------------------- SCR-11
  test('SCR-11: a newer call that rings while one is shown goes behind it; the open door question stays on the call it was asked on', async ({ page }) => {
    const m = await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    const banner = page.locator(BANNER);
    await expect(banner).toHaveAttribute('data-station', 'gate', { timeout: 30_000 });
    await page.locator(`${BANNER} [data-call-door="1"]`).click();
    await expect(page.locator(`${BANNER} [data-call-door-ask="1"]`)).toBeVisible();
    m.active.calls = [{ ...GATE_CALL }, { ...LOBBY_CALL }]; // the lobby rings (newer)
    m.stations.push();
    await expect(page.locator(`${BANNER} [data-call-next]`)).toHaveText('עוד 1', { timeout: 10_000 });
    await expect(banner).toHaveAttribute('data-station', 'gate');
    await expect(page.locator(`${BANNER} [data-call-door-ask="1"]`)).toBeVisible();
    // "next" brings the lobby forward: the gate's question does not follow it, and the lobby's doors are not held
    await page.locator(`${BANNER} [data-call-next]`).click();
    await expect(banner).toHaveAttribute('data-station', 'lobby');
    await expect(page.locator(`${BANNER} [data-call-door-ask]`)).toHaveCount(0);
    await expect(page.locator(`${BANNER} [data-call-door="2"]`)).toBeEnabled();
    expect(m.stations.released).toEqual([]);
  });

  // ---------------------------------------------------------------- SCR-14
  test('SCR-14: the NVR system card shows the recorder selected last, even when the first recorder answers last', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installMulti(page, { count: 2 });
    const hold = gate();
    await page.route('**/api/v1/nvr/system**', async (r) => {
      const rid = new URL(r.request().url()).searchParams.get('recorder_id') ?? 'nvr-1';
      if (rid === 'nvr-1') await hold.held;
      return json(r, { time: { local_time: rid === 'nvr-1' ? '2026-10-04T10:00:00' : '2026-10-04T22:22:22', mode: 'NTP', drift_s: 0, ntp: null }, disks: [], outputs: [], errors: {},
        can: { time: false, storage: false, alarm: false, reboot: false, osd: false, connection: true }, recorder_id: rid });
    });
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/setup');
    await appReady(page);
    const card = page.locator('sw-app system-setup [data-nvr-system]');
    const sel = card.locator('select[data-nvr-system-recorder]');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    await sel.selectOption('nvr-2');
    await expect(card).toContainText('22:22:22');
    hold.open(); // the first recorder's read lands last
    await page.waitForTimeout(600);
    await expect(card).toContainText('22:22:22');
    await expect(card).not.toContainText('2026-10-04T10:00:00');
  });

  // ---------------------------------------------------------------- SCR-24
  test('SCR-24: X playing, pick A (the session close is slow), pick B - the screen stays on B when the close returns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await playbackMock(page, { cameras: [{ name: 'מחסן' }] });
    const hold = gate();
    const recReads: string[] = [];
    await page.route('**/api/v1/playback/sessions/*', async (r) => {
      if (r.request().method() === 'DELETE') await hold.held;
      return r.fallback();
    });
    await page.route('**/api/v1/cameras/*/recordings**', (r) => {
      recReads.push(apiPath(r).split('/')[1]);
      return r.fallback();
    });
    await openAndPlay(page);
    const pick = page.locator('investigate-playback select[aria-label="מצלמה"]');
    await pick.selectOption('c2'); // waits for c1's session to close (held)
    await page.waitForTimeout(200);
    await pick.selectOption('c3');
    await expect.poll(() => recReads.at(-1)).toBe('c3');
    hold.open(); // the close of c1's session returns last
    await page.waitForTimeout(800);
    expect(await page.locator('investigate-playback').evaluate((el) => (el as unknown as { cameraId: string }).cameraId)).toBe('c3');
    expect(recReads.at(-1)).toBe('c3');
    expect(recReads.filter((c) => c === 'c2')).toEqual([]);
  });

  // ---------------------------------------------------------------- SCR-19
  async function bulkRoutes(page: Page) {
    const st = { done: false, runs: 0 };
    const target = (kind: string) => (kind === 'covers_close' ? { entity_id: 'cover.c1', name: 'תריס', domain: 'cover', area_name: 'סלון', action_id: 'cover.close_cover' } : { entity_id: 'light.l1', name: 'אור', domain: 'light', area_name: 'סלון', action_id: 'light.turn_off' });
    await page.route('**/api/v1/devices/actions/preview?**', (r) => {
      const q = new URL(r.request().url()).searchParams;
      const kind = q.get('kind') ?? '';
      const t = target(kind);
      return json(r, { scope: q.get('scope'), id: q.get('id'), name: 'סלון', floor_name: null, kind, kind_label: kind, count: 1, targets: [t], by_domain: { [t.domain]: 1 }, domain_labels: { light: 'תאורה', cover: 'תריסים' }, skipped: { already: 0, unavailable: 0 }, excluded: [], never_included: {}, digest: 'dg-' + kind, note: '', server_time_ms: Date.now() });
    });
    const record = (done: boolean) => {
      const t = target('lights_off');
      const items = [{ ...t, outcome: done ? 'confirmed' : 'accepted', status: done ? 'done' : 'waiting', error: null, observed_state: null, expected_state: null, sent: true }];
      const c = { queued: 0, accepted: done ? 0 : 1, confirmed: done ? 1 : 0, sent: 0, not_confirmed: 0, refused: 0, unknown: 0, total: 1 };
      return { id: 'bk1', scope: 'area', scope_id: 'living', scope_name: 'סלון', kind: 'lights_off', kind_label: 'כיבוי תאורה', status: done ? 'done' : 'waiting', done, all_confirmed: done, counts: c, items, note: '' };
    };
    await page.route('**/api/v1/devices/actions', (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      st.runs += 1;
      return json(r, record(false), 202);
    });
    await page.route('**/api/v1/devices/actions/bk1', (r) => json(r, record(st.done)));
    return st;
  }

  async function bulkDialog(page: Page) {
    await mockHome(page);
    const st = await bulkRoutes(page);
    await openHome(page, '');
    await page.evaluate(() => {
      const el = document.createElement('devices-bulk-dialog') as HTMLElement & { show: (r: unknown) => Promise<void> };
      document.body.append(el);
      (window as unknown as { __bulk: typeof el }).__bulk = el;
      void el.show({ scope: 'area', id: 'living', kind: 'lights_off', name: 'סלון' });
    });
    const dlg = page.locator('body > devices-bulk-dialog');
    await dlg.locator('sw-button[data-bulk-confirm]').click();
    await expect(dlg.locator('[data-bulk-result="running"]')).toBeVisible();
    await dlg.locator('sw-button[data-bulk-cancel]').click(); // "you may close this window"
    await expect(dlg.locator('sw-dialog[data-bulk-dialog="closed"]')).toHaveCount(1);
    return { st, dlg };
  }

  test('SCR-19: closed while running, then opened for another request - the first run ending does not take over the new dialog', async ({ page }) => {
    const { st, dlg } = await bulkDialog(page);
    await page.evaluate(() => void (window as unknown as { __bulk: { show: (r: unknown) => Promise<void> } }).__bulk.show({ scope: 'area', id: 'living', kind: 'covers_close', name: 'סלון' }));
    await expect(dlg.locator('sw-dialog[data-bulk-dialog="confirm"]')).toHaveCount(1);
    st.done = true; // the lights run ends on the server
    await page.waitForTimeout(2000); // two poll rounds (700 ms each)
    await expect(dlg.locator('sw-dialog[data-bulk-dialog="confirm"]')).toHaveCount(1);
    await expect(dlg.locator('sw-button[data-bulk-confirm]')).toBeVisible();
    await expect(dlg.locator('[data-bulk-result]')).toHaveCount(0);
    expect(st.runs).toBe(1);
  });

  test('SCR-19: closed while running with no new request - the run ending does not reopen the dialog', async ({ page }) => {
    const { st, dlg } = await bulkDialog(page);
    st.done = true;
    await page.waitForTimeout(2000);
    await expect(dlg.locator('sw-dialog[data-bulk-dialog="closed"]')).toHaveCount(1);
    await expect(dlg.locator('sw-dialog[open]')).toHaveCount(0);
  });
});
