import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome, overview } from './home-simple-mocks';
import { TABLET_L, asDevice, expectWall, wall } from './wall-followups-mocks';
import { holdHaSocket, mockMotionCamera, mockWalls, openMotionConfirm } from './medium-rest-2540-mocks';

// MEDIUM-REST-2540 against mocked backends (nothing is sent anywhere, no device / recorder is contacted). Each case fails on the build
// before the change (see docs/changes/MEDIUM-REST-2540.md, "before / after"):
//   SCR-31  +/- on an air conditioner that is off turns it on with the new target; "room off" really turns the room's lights and A/C off
//   SCR-30  a burst of pushes refreshes the home within the maximum wait; a power meter's pushes do not; a light with a command in
//           flight keeps what the screen shows when an older overview lands
//   SCR-27  the motion-detection confirmation reads old -> new in the reading direction (Hebrew and English)
//   SCR-26  the kiosk and the all-cameras wall pick up a camera that came back online; the kiosk's system tile follows the health summary
//   wall    the wall display shows a quiet "new version" notice when the server runs another release
// Desktop project only: the behaviour does not depend on the size (the pictures are in pixel-medium-rest-2540.spec.ts).

test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one project is enough for the behaviour');
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const home = (page: Page) => page.locator('sw-home');

async function openHome(page: Page, route = 'r/home') {
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await home(page).locator('.hs.v2').waitFor();
  await settle(page);
}

/** Runs a home action handler (`a_<name>`) with the data attributes a button would carry - the same entry the delegated click uses. */
async function act(page: Page, name: string, data: Record<string, string>) {
  await home(page).evaluate((h, [n, d]) => {
    const el = document.createElement('button');
    for (const [k, v] of Object.entries(d as Record<string, string>)) el.dataset[k] = v;
    (h as unknown as Record<string, (e: HTMLElement) => unknown>)[`a_${n as string}`](el);
  }, [name, data] as const);
}

const actionsOf = (calls: { path: string; body: unknown }[], entity: string) =>
  calls.filter((c) => c.path === `ha/entities/${encodeURIComponent(entity)}/actions` || c.path === `ha/entities/${entity}/actions`).map((c) => c.body as { allowed_action_id: string; arguments: Record<string, unknown> });

// ------------------------------------------------------------------------------------------------ SCR-31

test.describe('SCR-31: the home climate and "room off"', () => {
  test('+ on the office A/C (off) turns it on in cool, then sets 25', async ({ page }) => {
    const mock = await mockHome(page);
    await openHome(page);
    await act(page, 'temp', { zone: 'climate.office', d: '1' });
    await expect.poll(() => actionsOf(mock.calls, 'climate.office').length).toBe(2);
    const sent = actionsOf(mock.calls, 'climate.office');
    expect(sent[0]).toMatchObject({ allowed_action_id: 'climate.set_hvac_mode', arguments: { hvac_mode: 'cool' } });
    expect(sent[1]).toMatchObject({ allowed_action_id: 'climate.set_temperature', arguments: { temperature: 25 } });
  });

  test('"room off" without the bulk route turns off each light that was on, and the A/C', async ({ page }) => {
    const mock = await mockHome(page);
    const ov = overview('demo');
    const living = ov.rooms.find((r) => r.id === 'living')!;
    living.can_bulk = false;
    await page.route('**/api/v1/home/overview', (r) => json(r, { ...ov, can_bulk: false }));
    await openHome(page);
    await act(page, 'roomOffId', { room: 'living' });
    await expect.poll(() => actionsOf(mock.calls, 'climate.living').map((b) => b.allowed_action_id)).toEqual(['climate.turn_off']);
    for (const l of ['light.l_main', 'light.l_read', 'light.l_corner']) {
      await expect.poll(() => actionsOf(mock.calls, l).map((b) => b.allowed_action_id), l).toEqual(['light.turn_off']);
    }
    expect(actionsOf(mock.calls, 'switch.l_shelf'), 'a light that was off is not sent').toEqual([]);
    expect(actionsOf(mock.calls, 'switch.l_heater'), 'a load (not a light) is never part of "room off"').toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------ SCR-30

test.describe('SCR-30: the home push refresh', () => {
  async function counted(page: Page) {
    const reads = { n: 0 };
    page.on('request', (r) => {
      if (/\/api\/v1\/home\/overview$/.test(new URL(r.url()).pathname)) reads.n += 1;
    });
    return reads;
  }

  test('a light pushed every 300 ms for 4.5 s: the overview is read during the burst (it was not, until the pushes stopped)', async ({ page }) => {
    const ws = await holdHaSocket(page);
    await mockHome(page);
    const reads = await counted(page);
    await openHome(page);
    await expect.poll(() => ws.open()).toBe(true);
    await page.waitForTimeout(800);
    const before = reads.n;
    for (let i = 0; i < 15; i++) {
      ws.push({ entity_id: 'light.l_read', state: i % 2 ? 'on' : 'off' });
      await page.waitForTimeout(300);
    }
    expect(reads.n - before, 'reads while the pushes kept coming').toBeGreaterThanOrEqual(2);
  });

  test('a power meter pushed every 300 ms: no overview read at all (the home does not draw it)', async ({ page }) => {
    const ws = await holdHaSocket(page);
    await mockHome(page);
    const reads = await counted(page);
    await openHome(page);
    await expect.poll(() => ws.open()).toBe(true);
    await page.waitForTimeout(800);
    const before = reads.n;
    for (let i = 0; i < 8; i++) {
      ws.push({ entity_id: 'sensor.house_power', state: String(1000 + i), device_class: 'power' });
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1500);
    expect(reads.n - before).toBe(0);
  });

  test('a light turned off whose command is still in flight stays off when an older overview lands', async ({ page }) => {
    const ws = await holdHaSocket(page);
    const mock = await mockHome(page);
    // the recorder of commands answers slowly: the command is in flight for 4 s
    await page.route('**/api/v1/ha/entities/*/actions', async (r) => {
      mock.calls.push({ method: 'POST', path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON() });
      await new Promise((res) => setTimeout(res, 4000));
      await json(r, { id: 'slow', status: 'confirmed', confirmation: 'state' }, 202).catch(() => undefined);
    });
    await openHome(page, 'r/living');
    await expect.poll(() => ws.open()).toBe(true);
    const lightOn = () => home(page).evaluate((h) => (h as unknown as { data: { rooms: { id: string; lights: { id: string; on: boolean }[] }[] } }).data.rooms.find((r) => r.id === 'living')!.lights.find((l) => l.id === 'light.l_main')!.on);
    expect(await lightOn()).toBe(true);
    await act(page, 'light', { l: 'light.l_main' });
    expect(await lightOn()).toBe(false);
    // another light's push: the overview (which still says "on" - the command has not landed) is read 600 ms later
    const read = page.waitForResponse((r) => /\/api\/v1\/home\/overview$/.test(new URL(r.url()).pathname));
    ws.push({ entity_id: 'light.l_read', state: 'on' });
    await read;
    await page.waitForTimeout(300);
    expect(await lightOn(), 'the screen keeps the tap while the command is in flight').toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------ SCR-27

/** The arrow of a before -> after line points, on screen, from the old value to the new one. */
async function arrowPointsToNew(line: Locator, from: string, to: string) {
  return line.evaluate((el, [a, b]) => {
    const text = el.firstChild && el.childNodes.length === 1 ? el.firstChild : null;
    const node = text ?? [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').includes(a as string)) ?? null;
    if (!node) return { ok: false, why: 'no text node' };
    const s = node.textContent ?? '';
    const box = (i: number, len: number) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + len); return r.getBoundingClientRect(); };
    const iArrow = [...s].findIndex((c) => c === '←' || c === '→');
    if (iArrow < 0) return { ok: false, why: `no arrow in ${JSON.stringify(s)}` };
    const arrow = s[iArrow];
    const old = box(s.indexOf(a as string), (a as string).length);
    const neu = box(s.indexOf(b as string), (b as string).length);
    const mid = box(iArrow, 1);
    const ok = arrow === '←' ? neu.right <= mid.left + 1 && mid.right <= old.left + 1 : old.right <= mid.left + 1 && mid.right <= neu.left + 1;
    return { ok, why: `${arrow} old@${Math.round(old.left)} new@${Math.round(neu.left)} arrow@${Math.round(mid.left)} text=${JSON.stringify(s)}` };
  }, [from, to] as const);
}

test.describe('SCR-27: the motion-detection confirmation shows the change the right way round', () => {
  test('Hebrew: sensitivity 40 -> 60 and detection on -> off read old -> new from the right', async ({ page }) => {
    await mockMotionCamera(page, 40);
    const dlg = await openMotionConfirm(page, 60);
    const sens = dlg.locator('[data-motion-change="sensitivity"]');
    await expect(sens).toBeVisible();
    const r = await arrowPointsToNew(sens, '40', '60');
    expect(r.ok, r.why).toBe(true);
    await expect(sens).toContainText('←');
  });

  test('English: the arrow points right and the values read old -> new from the left', async ({ page }) => {
    await mockMotionCamera(page, 40, 'en');
    const dlg = await openMotionConfirm(page, 60);
    const sens = dlg.locator('[data-motion-change="sensitivity"]');
    await expect(sens).toBeVisible();
    const r = await arrowPointsToNew(sens, '40', '60');
    expect(r.ok, r.why).toBe(true);
    await expect(sens).toContainText('→');
  });
});

// ------------------------------------------------------------------------------------------------ SCR-26

test.describe('SCR-26: the camera walls read their cameras again', () => {
  test('kiosk: a camera offline at opening gets its player a minute later; the system tile says what the health summary says', async ({ page }) => {
    await page.clock.install();
    const st = await mockWalls(page, {}, 'error');
    st.offline.add('cam-2');
    await page.goto('/?design=a#/kiosk/all?cols=2&rows=2');
    const kiosk = page.locator('kiosk-wall');
    const tile = kiosk.locator('sw-camera-tile[data-kiosk-tile][cameraid="cam-2"]');
    await expect(tile).toHaveAttribute('state', 'offline');
    await expect(kiosk.locator('.stat [data-word]').last()).toHaveText('שגיאה');
    await expect(kiosk.locator('.stats')).not.toContainText('go2rtc');
    const reads = st.reads;
    st.offline.clear();
    await page.clock.fastForward(61_000);
    await expect.poll(() => st.reads).toBeGreaterThan(reads);
    await expect(tile).toHaveAttribute('state', 'live');
  });

  test('all-cameras wall: the same camera comes back without a reload', async ({ page }) => {
    await page.clock.install();
    const st = await mockWalls(page);
    st.offline.add('cam-2');
    await page.goto('/?design=a#/live/wall');
    const tile = page.locator('live-wall sw-camera-tile[data-cam="cam-2"]');
    await expect(tile).toHaveAttribute('state', 'offline');
    const reads = st.reads;
    st.offline.clear();
    await page.clock.fastForward(61_000);
    await expect.poll(() => st.reads).toBeGreaterThan(reads);
    await expect(tile).toHaveAttribute('state', 'live');
  });
});

// ------------------------------------------------------------------------------------------------ the wall display

test.describe('wall display: the add-on was updated under it', () => {
  test('another release on the server: a quiet "new version" notice; nothing reloads by itself', async ({ page }) => {
    await mockWalls(page, { admin: false, wall: true, cams: 4 }, 'ok', '99.0.0');
    await asDevice(page, TABLET_L); // the wall runs on its own device (a computer shows the application unless the profile says so)
    await page.goto('/?design=a#/');
    await expectWall(page);
    const note = wall(page).locator('[data-wall-new-build]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('גרסה חדשה של Arx זמינה');
    const loads: string[] = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) loads.push(f.url()); });
    await page.waitForTimeout(1500);
    expect(loads, 'no reload by itself').toEqual([]);
  });

  test('the same release (or a test backend) shows nothing', async ({ page }) => {
    await mockWalls(page, { admin: false, wall: true, cams: 4 }, 'ok', 'test');
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expectWall(page);
    await expect(wall(page).locator('[data-wall-health]').first()).toHaveText('המערכת תקינה');
    await expect(wall(page).locator('[data-wall-new-build]')).toHaveCount(0);
  });
});
