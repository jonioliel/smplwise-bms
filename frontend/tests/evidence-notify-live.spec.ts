import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

/**
 * CR-018 (S5) live evidence for notifications, against a THROWAWAY backend started by tests/fixtures/notify_live_fake.py: the real
 * backend with the real notification pipeline, whose only fakes are the outside world (a fake Home Assistant + WisKey, a fake push
 * service that decrypts what a phone would receive, a fake SMTP server). No lab, no real Home Assistant, no secrets.
 *
 * Scenarios (serial; each says what it proves):
 *   1  leak sensor      critical row + push + escalation to the administrators after the (shortened) timer, stopped by an acknowledge
 *   2  doorbell ring    a row with the door deep link; "פתח דלת" opens ONLY the in-app confirmation; the release route + audit origin
 *   3  door left open   an alert after its hold, resolved when the door closes
 *   4  camera offline   folded five times into one row (count 5)
 *   5  quiet hours      the matrix: a critical row passes, an info row waits (held, in the center)
 *   6  backup failure   an e-mail to the fake SMTP server; the delivery log shows the masked address only
 *   7  no scope         a user without reach gets no row, no push, and 404 on the row
 *   8  no notify.manage a user without it sees only device registration in the settings tab (and 403 on /notify/*)
 *   9  the screens      the administrator's tab with its eight sections, live (screenshots)
 *
 * Run (see the fixture's docstring): SW_LIVE=1 SW_NOTIFY_FIXTURE=1 SW_API_PORT=4771 SW_BASE_URL=http://127.0.0.1:4776/ \
 *   npx playwright test tests/evidence-notify-live.spec.ts --project=desktop --workers=1        (control server = SW_API_PORT + 1)
 * Screenshots: docs/design/evidence/CR-018/s5-live/ (override with SW_SHOTS).
 */
const API = '/api/v1';
const API_PORT = Number(process.env.SW_API_PORT ?? '4771');
const CONTROL = `http://127.0.0.1:${process.env.SW_NOTIFY_CONTROL_PORT ?? String(API_PORT + 1)}`;
const WISKEY = `http://127.0.0.1:${process.env.SW_WISKEY_CONTROL_PORT ?? String(API_PORT + 2)}`;
const SHOTS = process.env.SW_SHOTS || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-018/s5-live');
const ALL_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row { id: string; source: string; category: string; severity: string; title: string; body: string; place_name: string | null; state: string; count: number; link: string; subject: { kind: string; id: string | null }; door: { id: string; name: string; can_open: boolean } | null; me: { read_at: string | null; snoozed_until: string | null }; can_ack: boolean; timeline: { kind: string; step?: number; count?: number }[]; acked_by_display: string | null }
interface PushEntry { n: number; user: string | null; urgency: string | null; ttl: string | null; status: number; payload: Record<string, any> | null } // eslint-disable-line @typescript-eslint/no-explicit-any
interface Mail { n: number; from: string; to: string[]; subject: string; text: string; tls: boolean }

// ------------------------------------------------------------------------------------------------ the world

const OPS = { admin: 'joni', admin2: 'dana', floor2: 'ops2', floor3: 'ops3' } as const;
const W = {
  floor2: '', floor3: '', camera: '', cameraName: 'מצלמת חניה',
  leak: 'binary_sensor.nl_leak_kitchen', leak2: 'binary_sensor.nl_leak_laundry', door: 'binary_sensor.nl_door_garage', battery: 'sensor.nl_battery_hall',
  leakId: '', mailTo: 'ops@example.test',
};
const users: Record<string, APIRequestContext> = {};
let control: APIRequestContext;
let wiskey: APIRequestContext;

/** A 480x300 synthetic plan (flat colour), built here so the spec needs no binary fixture. */
function planPng(): Buffer {
  const w = 480, h = 300;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0xee);
  for (let y = 0; y < h; y += 1) raw[y * (w * 3 + 1)] = 0;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function ok<T = Record<string, any>>(p: Promise<{ ok(): boolean; status(): number; text(): Promise<string>; json(): Promise<unknown> }>, what: string): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await p;
  if (!r.ok()) throw new Error(`${what}: ${r.status()} ${await r.text()}`);
  return (await r.json().catch(() => ({}))) as T;
}
async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, timeoutMs = 20_000, everyMs = 400): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v as T; } catch (e) { last = e; }
    await sleep(everyMs);
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${String(last)}` : ''}`);
}

const inbox = async (user: keyof typeof users, q = '') => ((await ok<{ notifications: Row[] }>(users[user].get(`${API}/notifications?limit=200${q}`), `inbox of ${user}`)).notifications);
const rowsOf = async (user: keyof typeof users, source: string) => (await inbox(user)).filter((r) => r.source === source);
const row = (user: keyof typeof users, id: string) => ok<Row>(users[user].get(`${API}/notifications/${id}`), `row ${id}`);
async function pushLog(since = 0) { return (await ok<{ entries: PushEntry[]; next: number }>(control.get(`${CONTROL}/push/log?since=${since}`), 'push log')); }
const mails = async () => (await ok<{ messages: Mail[] }>(control.get(`${CONTROL}/smtp/messages`), 'smtp')).messages;
const clock = () => ok<{ local_hhmm: string; weekday: string; now: string }>(control.get(`${CONTROL}/clock`), 'clock');
const haState = (entity_id: string, state: string, attributes: Record<string, unknown>) => ok(control.post(`${CONTROL}/ha-state`, { data: { entity_id, state, attributes } }), `ha-state ${entity_id}`);
const advance = (seconds: number) => ok(control.post(`${CONTROL}/clock/advance`, { data: { seconds } }), 'clock advance');
const wiskeySent = async () => (await (await wiskey.get(`${WISKEY}/sent`)).json()) as { type: string; station_id?: string }[];
const releases = async () => (await wiskeySent()).filter((m) => m.type === 'hikvision_intercom/stations/test_unlock');

async function settingsPut(body: Record<string, unknown>) { return ok(users.admin.put(`${API}/notify/settings`, { data: body }), 'settings put'); }
async function policyPut(source: string, body: Record<string, unknown>) { return ok(users.admin.put(`${API}/notify/policies/${source}`, { data: body }), `policy ${source}`); }
async function auditRows(action: string) {
  const r = await ok<{ rows: { action: string; actor_username: string; resource_id: string; details: Record<string, any> }[] }>(users.admin.get(`${API}/audit?prefix=${encodeURIComponent(action)}&limit=200`), 'audit'); // eslint-disable-line @typescript-eslint/no-explicit-any
  return r.rows.filter((x) => x.action === action);
}
async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}
const hhmm = (minutes: number) => `${String(Math.floor(((minutes % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String((((minutes % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** A recorded gap, not a failure: the server names the place of a row without an HA area (`place_name`: the station, the camera) but the center's client contract
 * has no such field, so such a row shows its category word instead. Annotated in the report when it happens. */
async function noteGap(heading: ReturnType<Page['locator']>, place: string | null, what: string) {
  const text = (await heading.innerText().catch(() => '')) || '';
  if (place && !text.includes(place)) test.info().annotations.push({ type: 'gap', description: `${what}: the heading "${text.trim()}" does not show the place "${place}" the API sends (place_name is not read by notify-logic.placeText)` });
}

// ------------------------------------------------------------------------------------------------ the UI helpers (the same locators as the mock-mode spec)

const me = (page: Page) => page.locator('sw-app [data-profile-menu]');
const center = (page: Page) => page.locator('sw-app notify-center');
const rowOf = (page: Page, id: string) => page.locator(`sw-app notify-center notify-row [data-notify-row="${id}"]`);
async function openApp(page: Page, hash = '/devices/building') {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}
async function openCenter(page: Page) {
  await me(page).click();
  await page.locator('sw-app sw-user-menu [data-menu-alerts]').click();
  await expect(center(page)).toHaveAttribute('open', '');
  await expect(page.locator('sw-app notify-center [data-center-state="ready"], sw-app notify-center [data-center-state="empty"]').first()).toBeVisible();
  await page.waitForTimeout(350);
}
async function openRowDetail(page: Page, id: string) {
  await rowOf(page, id).locator('[data-row-open]').click();
  await expect(page.locator('sw-app notify-center notify-detail [data-notify-detail]')).toHaveAttribute('data-notify-detail', id);
}

// ------------------------------------------------------------------------------------------------ setup

test.describe('notifications, live against the fixture backend (CR-018 S5)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_NOTIFY_FIXTURE !== '1', 'set SW_LIVE=1 SW_NOTIFY_FIXTURE=1 against tests/fixtures/notify_live_fake.py');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ playwright }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    control = await playwright.request.newContext();
    wiskey = await playwright.request.newContext();
    // explicit precondition: this spec moves the clock, sends mail and pushes - it must be talking to the fixture and nothing else
    const status = await control.get(`${CONTROL}/status`).catch(() => null);
    if (!status || !status.ok() || ((await status.json()) as { version: string }).version !== 'notify-live-fake') throw new Error('not the notify fixture backend (tests/fixtures/notify_live_fake.py): refusing to run');
    for (const [key, name] of Object.entries(OPS)) {
      users[key] =await playwright.request.newContext({ baseURL, extraHTTPHeaders: { 'X-SW-Dev-User': name } });
    }
    const feed = await (await users.admin.get(`${API}/intercom/overview`)).json();
    if (feed.state !== 'ready' || feed.overview?.version !== '4.2.0-fake') throw new Error(`the WisKey fake is not connected (state ${feed.state})`);

    // users: dana a second administrator; ops2 an operator on floor 2, ops3 an operator on floor 3
    const idOf = async (u: string) => ((await ok<{ user: { id: string } }>(users.admin.get(`${API}/me`, { headers: { 'X-SW-Dev-User': u } }), `me ${u}`)).user.id);
    const bind = async (u: string, role: string, scope_type: string, scope_id: string) => ok(users.admin.post(`${API}/access/bindings`, { data: { subject_kind: 'user', subject_id: await idOf(u), role_id: role, scope_type, scope_id } }), `binding ${u}`);
    await bind(OPS.admin2, 'system_admin', 'installation', '*');

    // the building: two floors with a published plan; the HA entities and the camera are anchored on floor 2 (so floor 3's operator has no reach)
    const site = await ok<{ id: string }>(users.admin.post(`${API}/sites`, { data: { name: 'אתר התראות' } }), 'site');
    const bld = await ok<{ id: string }>(users.admin.post(`${API}/sites/${site.id}/buildings`, { data: { name: 'מבנה התראות' } }), 'building');
    for (const [name, level, key] of [['קומה 2', 2, 'floor2'], ['קומה 3', 3, 'floor3']] as const) {
      const f = await ok<{ id: string }>(users.admin.post(`${API}/buildings/${bld.id}/floors`, { data: { name, level } }), name);
      const asset = await ok<{ id: string }>(users.admin.post(`${API}/floors/${f.id}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: planPng() } } }), 'plan asset');
      const v = await ok<{ id: string }>(users.admin.post(`${API}/floors/${f.id}/plan-versions`, { data: { asset_id: asset.id } }), 'plan version');
      await ok(users.admin.post(`${API}/plan-versions/${v.id}/publish`), 'publish plan');
      W[key] = f.id;
    }
    await bind(OPS.floor2, 'operator', 'floor', W.floor2);
    await bind(OPS.floor3, 'operator', 'floor', W.floor3);

    const areas = [
      { area_id: 'nl_kitchen', name: 'מטבח' }, { area_id: 'nl_laundry', name: 'כביסה' }, { area_id: 'nl_garage', name: 'חניה' }, { area_id: 'nl_hall', name: 'מסדרון' },
    ];
    const entities = [
      { entity_id: W.leak, area_id: 'nl_kitchen' }, { entity_id: W.leak2, area_id: 'nl_laundry' }, { entity_id: W.door, area_id: 'nl_garage' }, { entity_id: W.battery, area_id: 'nl_hall' },
    ];
    await ok(users.admin.post(`${API}/ha/dev/registry`, { data: { entities, devices: [], areas, floors: [] } }), 'dev registry');
    const attrs: Record<string, Record<string, unknown>> = {
      [W.leak]: { device_class: 'moisture', friendly_name: 'חיישן הצפה מתחת לכיור' }, [W.leak2]: { device_class: 'moisture', friendly_name: 'חיישן הצפה במכונת הכביסה' },
      [W.door]: { device_class: 'door', friendly_name: 'דלת החניה' }, [W.battery]: { device_class: 'battery', friendly_name: 'חיישן המסדרון', unit_of_measurement: '%' },
    };
    for (const [id, state] of [[W.leak, 'off'], [W.leak2, 'off'], [W.door, 'off'], [W.battery, '80']] as const) await haState(id, state, attrs[id]);
    for (const [i, id] of [W.leak, W.leak2, W.door, W.battery].entries()) {
      await ok(users.admin.post(`${API}/floors/${W.floor2}/anchors`, { data: { resource_type: 'ha_entity', resource_id: id, x: 0.2 + i * 0.15, y: 0.3 } }), `anchor ${id}`);
    }
    const cam = await ok<{ id: string }>(users.admin.post(`${API}/cameras`, { data: { channel: 1, alias: W.cameraName } }), 'camera');
    W.camera = cam.id;
    await ok(users.admin.post(`${API}/floors/${W.floor2}/anchors`, { data: { resource_type: 'camera', resource_id: W.camera, x: 0.7, y: 0.6 } }), 'camera anchor');

    // one browser (push subscription) per person, registered the way the PWA does it
    await ok(users.admin.get(`${API}/push/vapid-key`), 'vapid key');
    for (const [key, name] of Object.entries(OPS)) {
      const body = await ok(control.post(`${CONTROL}/push/browser`, { data: { user: name } }), `browser ${name}`);
      await ok(users[key].post(`${API}/push/subscriptions`, { data: body }), `subscribe ${name}`);
    }
    // the shortened escalation: 1 minute, two steps, to the administrators
    await settingsPut({ escalation: { enabled: true, after_min: 1, steps: 2, to: 'managers' } });
  });

  test.afterAll(async () => {
    for (const c of [...Object.values(users), control, wiskey]) await c?.dispose();
  });

  // ---------------------------------------------------------------------------------------------- 1
  test('1 leak sensor: a critical row, a push to the people who may see it, escalation to the administrators after the timer, stopped by an acknowledge', async ({ page }) => {
    test.setTimeout(180_000);
    const from = (await pushLog()).next;
    await haState(W.leak, 'on', { device_class: 'moisture', friendly_name: 'חיישן הצפה מתחת לכיור' });
    const r = await until('the leak row in the administrator\'s inbox', async () => (await rowsOf('admin', 'sensor.leak'))[0]);
    W.leakId = r.id;
    expect(r).toMatchObject({ category: 'safety', severity: 'critical', title: 'דליפת מים', place_name: 'מטבח', state: 'open', count: 1 });
    expect(r.subject).toMatchObject({ kind: 'entity', id: W.leak });
    expect((await rowsOf('admin', 'sensor.leak')).length, 'one row').toBe(1);

    // the push: the administrators and the floor-2 operator (they may see the kitchen), not the floor-3 operator; critical = urgent; type and place only
    const sent = await until('pushes of the leak', async () => {
      const e = (await pushLog(from)).entries.filter((p) => p.payload?.id === r.id);
      return new Set(e.map((p) => p.user)).size >= 3 ? e : null;
    });
    const users1 = new Set(sent.map((p) => p.user));
    expect([...users1].sort()).toEqual(['dana', 'joni', 'ops2']);
    for (const p of sent) {
      expect(p.status).toBe(201);
      expect(p.urgency).toBe('high');
      expect(p.payload).toMatchObject({ v: 2, severity: 'critical', category: 'safety', title: 'דליפת מים · מטבח', url: `#/notifications/${r.id}` });
      const text = JSON.stringify(p.payload);
      expect(text, 'no person, no camera, no image in the payload').not.toMatch(/joni|dana|ops2|ops3|https?:|image|snapshot|unlock/i);
    }
    const jp = sent.find((p) => p.user === 'joni')!.payload!;
    expect((jp.actions as { a: string; t?: string }[]).map((a) => a.a)).toEqual(['ack', 'snooze']); // the two token actions only: no door, no device command
    expect((jp.actions as { a: string; t?: string }[]).every((a) => typeof a.t === 'string' && a.t.length >= 16)).toBe(true);
    expect(await pushLog(from).then((l) => l.entries.some((p) => p.user === 'ops3'))).toBe(false);

    // the center: the row is pinned (open critical safety), unread; the avatar carries the dot
    await openApp(page);
    await expect(me(page).locator('[data-alert-dot]')).toHaveCount(1);
    await openCenter(page);
    await expect(page.locator('sw-app notify-center [data-group="pinned"]')).toHaveCount(1);
    await expect(rowOf(page, r.id)).toHaveAttribute('data-severity', 'critical');
    await expect(rowOf(page, r.id).locator('[data-unread-dot]')).toHaveCount(1);
    await shot(page, 'live-1-leak-center-1440');
    await openRowDetail(page, r.id);
    await expect(page.locator('sw-app notify-center notify-detail h4')).toHaveText('דליפת מים · מטבח');
    await shot(page, 'live-1-leak-detail-1440');
    await page.keyboard.press('Escape');

    // escalation: nobody acknowledged; one minute later (the clock of the fixture moves, the timer is the real one) the administrators are told again
    await advance(61);
    const step1 = await until('escalation step 1', async () => {
      const t = (await row('admin', r.id)).timeline.filter((e) => e.kind === 'escalated');
      return t.length >= 1 ? t : null;
    }, 40_000);
    expect(step1[0].step).toBe(1);
    const again = await until('the escalation push to both administrators', async () => {
      const e = (await pushLog(from)).entries.filter((p) => p.payload?.id === r.id && p.payload?.renotify === true);
      return new Set(e.map((p) => p.user)).size >= 2 ? e : null;
    });
    expect(new Set(again.map((p) => p.user))).toEqual(new Set(['joni', 'dana'])); // the administrators, not the operator
    for (const p of again) expect(p.urgency).toBe('high');

    // an acknowledge (by the other administrator) stops the escalation: the second step never comes
    const ack = await ok<Row>(users.admin2.post(`${API}/notifications/${r.id}/ack`), 'ack');
    expect(ack.state).toBe('acknowledged');
    await advance(130);
    await sleep(14_000); // more than the notifier's escalation poll (10 s): a second step would have fired by now
    const after = await row('admin', r.id);
    expect(after.timeline.filter((e) => e.kind === 'escalated')).toHaveLength(1);
    expect(after.timeline.map((e) => e.kind)).toEqual(['created', 'escalated', 'acknowledged']);
    expect(after.state).toBe('acknowledged');
    expect(after.acked_by_display).toBeTruthy();
    const audit = await auditRows('notify.escalate');
    expect(audit.filter((a) => a.resource_id === r.id)).toHaveLength(1);

    // the UI shows who acknowledged and the timeline
    await openApp(page);
    await openCenter(page);
    await openRowDetail(page, r.id);
    const det = page.locator('sw-app notify-center notify-detail');
    await expect(det.locator('[data-detail-state="acknowledged"]')).toBeVisible();
    expect(await det.locator('[data-tl]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tl')))).toEqual(['created', 'escalated', 'acknowledged']);
    await shot(page, 'live-1-leak-escalation-acked-1440');

    // the sensor dries: the row resolves (a quiet "resolved" push for a critical source)
    const mark = (await pushLog()).next;
    await haState(W.leak, 'off', { device_class: 'moisture', friendly_name: 'חיישן הצפה מתחת לכיור' });
    await until('the row resolved', async () => (await row('admin', r.id)).state === 'resolved');
    const resolved = await until('the resolved push', async () => { const e = (await pushLog(mark)).entries.filter((p) => p.payload?.id === r.id && p.payload?.resolved === true); return e.length ? e : null; });
    expect(resolved.length).toBeGreaterThanOrEqual(1);
    await settingsPut({ escalation: { enabled: true, after_min: 1, steps: 2, to: 'managers' } });
  });

  // ---------------------------------------------------------------------------------------------- 2
  test('2 doorbell: a row with the door deep link; "פתח דלת" opens only the in-app confirmation; the release route and the audit origin come after confirm', async ({ page }) => {
    test.setTimeout(120_000);
    const from = (await pushLog()).next;
    const releasesBefore = (await releases()).length;
    const auditBefore = (await auditRows('intercom.release')).length;
    await ok(wiskey.post(`${WISKEY}/station`, { data: { id: 'gate', call_state: 'ringing' } }), 'ring');
    const r = await until('the doorbell row', async () => (await rowsOf('admin', 'door.ring'))[0], 30_000);
    expect(r).toMatchObject({ category: 'doors', severity: 'alert', title: 'צלצול בדלת', place_name: 'שער ראשי', state: 'open' });
    expect(r.subject).toMatchObject({ kind: 'door', id: 'gate' });
    expect(r.door).toEqual({ id: 'gate', name: 'שער ראשי', can_open: true }); // the deep-link target; never a token
    expect(JSON.stringify(r)).not.toMatch(/last_access|person_name|Dana|visitor|snapshot_url/i);
    expect((await rowsOf('floor2', 'door.ring')).length, 'a floor-scoped operator has no reach to a door station').toBe(0);

    // the push button is a deep link, not a call
    const p = await until('the doorbell push', async () => (await pushLog(from)).entries.find((e) => e.user === 'joni' && e.payload?.id === r.id));
    const actions = (p.payload!.actions ?? []) as { a: string; url?: string; t?: string }[];
    const open = actions.find((a) => a.a === 'open_door')!;
    expect(open).toEqual({ a: 'open_door', title: 'פתח דלת', url: `#/doors/gate?confirm=${r.id}` });
    expect(open.t, 'no token for the door button').toBeUndefined();
    expect(actions.map((a) => a.a).sort()).toEqual(['ack', 'open_door', 'snooze']);
    expect(await releases()).toHaveLength(releasesBefore);

    // the deep link: Arx opens on the row with the confirmation - nothing is sent
    await openApp(page, `/doors/gate?confirm=${r.id}`);
    const dlg = page.locator('sw-app notify-center [data-door-dialog]');
    await expect(center(page)).toHaveAttribute('open', '');
    await expect(dlg).toHaveAttribute('data-door-dialog', 'confirm');
    await expect(dlg.locator('[data-door-text]')).toContainText('לפתוח');
    await shot(page, 'live-2-door-confirm-1440');
    await noteGap(page.locator('sw-app notify-center notify-detail h4'), r.place_name, 'the doorbell detail');
    await page.waitForTimeout(1500);
    expect(await releases(), 'the dialog alone sent nothing to WisKey').toHaveLength(releasesBefore);
    expect((await auditRows('intercom.release')).length).toBe(auditBefore);
    await dlg.locator('[data-door-cancel]').click();
    await expect(dlg).toHaveCount(0);
    await page.waitForTimeout(800);
    expect(await releases()).toHaveLength(releasesBefore);
    expect((await auditRows('intercom.release')).length).toBe(auditBefore);

    // the row's own button -> the same dialog -> confirm: now the existing release route runs
    await openApp(page);
    await openCenter(page);
    await openRowDetail(page, r.id);
    await page.locator('sw-app notify-center notify-detail [data-detail-act="door"]').click();
    await expect(dlg).toHaveAttribute('data-door-dialog', 'confirm');
    expect(await releases()).toHaveLength(releasesBefore);
    await dlg.locator('[data-door-confirm]').click();
    await expect(dlg).toHaveAttribute('data-door-dialog', /done|step_up/, { timeout: 20_000 });
    await shot(page, 'live-2-door-done-1440');
    const sent = await until('the release command at WisKey', async () => { const x = await releases(); return x.length === releasesBefore + 1 ? x : null; });
    expect(sent[sent.length - 1]).toMatchObject({ station_id: 'gate' });
    const attempt = await until('the audit attempt row', async () => (await auditRows('intercom.release')).find((a) => a.details.phase === 'attempt' && a.details.origin === `notification:${r.id}`));
    expect(attempt.actor_username).toBe('joni');
    expect(attempt.resource_id).toBe('gate');
    await dlg.locator('[data-door-close]').click();

    // the ring ends (answered / given up): the row resolves by itself
    await ok(wiskey.post(`${WISKEY}/station`, { data: { id: 'gate', call_state: 'idle' } }), 'ring ends');
    await until('the doorbell row resolved', async () => (await row('admin', r.id)).state === 'resolved', 30_000);
  });

  // ---------------------------------------------------------------------------------------------- 3
  test('3 door left open: an alert after its hold, resolved when it is closed', async ({ page }) => {
    test.setTimeout(150_000);
    await policyPut('opening.left_open', { after_s: 3 }); // the hold is the administrator's (default 10 minutes); 3 s here
    const from = (await pushLog()).next;
    await haState(W.door, 'on', { device_class: 'door', friendly_name: 'דלת החניה' });
    await sleep(1500);
    expect((await rowsOf('admin', 'opening.left_open')).length, 'nothing before the hold has passed').toBe(0);
    const r = await until('the left-open row (the 30 s monitor pass)', async () => (await rowsOf('admin', 'opening.left_open'))[0], 80_000, 1000);
    expect(r).toMatchObject({ category: 'doors', severity: 'alert', title: 'פתוח זמן רב', place_name: 'חניה', state: 'open' });
    expect(r.subject).toMatchObject({ kind: 'entity', id: W.door });
    const p = await until('its push', async () => (await pushLog(from)).entries.find((e) => e.user === 'joni' && e.payload?.id === r.id));
    expect(p.urgency).toBe('normal');
    expect((await rowsOf('floor3', 'opening.left_open')).length).toBe(0);
    await openApp(page);
    await openCenter(page);
    await expect(rowOf(page, r.id)).toHaveAttribute('data-state', 'open');
    await shot(page, 'live-3-door-open-1440');
    await page.keyboard.press('Escape');

    await haState(W.door, 'off', { device_class: 'door', friendly_name: 'דלת החניה' });
    const done = await until('resolved when closed', async () => { const x = await row('admin', r.id); return x.state === 'resolved' ? x : null; });
    expect(done.state).toBe('resolved');
    await openApp(page);
    await openCenter(page);
    await expect(rowOf(page, r.id).locator('[data-row-tag="res"]')).toBeVisible();
    await shot(page, 'live-3-door-resolved-1440');
    await policyPut('opening.left_open', { after_s: 600 });
  });

  // ---------------------------------------------------------------------------------------------- 4
  test('4 camera offline folded five times: one row, count 5, one push per person', async ({ page }) => {
    const from = (await pushLog()).next;
    await ok(control.post(`${CONTROL}/camera/status`, { data: { camera_id: W.camera, status: 'offline' } }), 'camera offline');
    await ok(control.post(`${CONTROL}/emit/camera-offline`, { data: { camera_id: W.camera, times: 5 } }), 'five signals');
    const r = await until('a row with count 5', async () => { const x = await rowsOf('admin', 'camera.offline'); return x[0]?.count === 5 ? x : null; }, 20_000);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ category: 'device_faults', severity: 'alert', title: 'מצלמה לא זמינה', state: 'open', count: 5 });
    expect(r[0].subject).toMatchObject({ kind: 'camera', id: W.camera });
    const detail = await row('admin', r[0].id);
    expect(detail.timeline.find((e) => e.kind === 'folded')?.count).toBe(5);
    expect(detail.timeline.filter((e) => e.kind === 'folded'), 'a burst is one timeline entry that keeps counting').toHaveLength(1);
    const pushes = (await pushLog(from)).entries.filter((p) => p.payload?.id === r[0].id);
    for (const u of new Set(pushes.map((p) => p.user))) expect(pushes.filter((p) => p.user === u), `one push for ${u}, not five`).toHaveLength(1);
    expect(pushes.some((p) => p.user === 'ops3')).toBe(false);
    await openApp(page);
    await openCenter(page);
    await expect(rowOf(page, r[0].id).locator('[data-fold]')).toHaveText('×5');
    await shot(page, 'live-4-camera-fold-1440');
    await openRowDetail(page, r[0].id);
    await expect(page.locator('sw-app notify-center notify-detail .dhead .tag.n')).toHaveText('×5');
    await noteGap(page.locator('sw-app notify-center notify-detail h4'), r[0].place_name, 'the camera detail');
    await shot(page, 'live-4-camera-fold-detail-1440');
    await ok(control.post(`${CONTROL}/camera/status`, { data: { camera_id: W.camera, status: 'online' } }), 'camera back');
  });

  // ---------------------------------------------------------------------------------------------- 5
  test('5 quiet hours with the matrix: the critical row passes, the info row waits in the center', async ({ page }) => {
    const c = await clock();
    const now = toMin(c.local_hhmm);
    await settingsPut({
      quiet: { enabled: true, from: hhmm(now - 60), to: hhmm(now + 60), days: ALL_DAYS },
      pass_through: { critical: { webpush: true, email: true, ha_mobile: false }, alert: { webpush: false, email: false, ha_mobile: false }, info: { webpush: false, email: false, ha_mobile: false } },
    });
    // an info source with push switched on (the administrator's choice), so that only the quiet-hours matrix can hold it back
    await policyPut('device.battery_low', { channels: { inbox: true, webpush: true, email: false, ha_mobile: false, whatsapp: false } });
    const from = (await pushLog()).next;

    await haState(W.battery, '10', { device_class: 'battery', friendly_name: 'חיישן המסדרון', unit_of_measurement: '%' });
    const info = await until('the info row', async () => (await rowsOf('admin', 'device.battery_low'))[0]);
    expect(info).toMatchObject({ severity: 'info', category: 'device_faults', place_name: 'מסדרון' });
    await haState(W.leak2, 'on', { device_class: 'moisture', friendly_name: 'חיישן הצפה במכונת הכביסה' });
    const crit = await until('the critical row', async () => (await rowsOf('admin', 'sensor.leak')).find((x) => x.subject.id === W.leak2));
    expect(crit).toMatchObject({ severity: 'critical', category: 'safety' });

    const passed = await until('the critical push during quiet hours', async () => { const e = (await pushLog(from)).entries.filter((p) => p.payload?.id === crit.id && p.user === 'joni'); return e.length ? e : null; });
    expect(passed).toHaveLength(1);
    await sleep(2500); // the info row's dispatch has run by now (same notifier thread, same outbox)
    const log = (await pushLog(from)).entries;
    expect(log.filter((p) => p.payload?.id === info.id), 'nothing was sent for the info row').toHaveLength(0);
    const held = (await ok<{ deliveries: { channel: string; status: string; reason: string | null }[] }>(users.admin.get(`${API}/notifications/deliveries?notification_id=${info.id}`), 'deliveries')).deliveries;
    expect(held.find((d) => d.channel === 'webpush')).toMatchObject({ status: 'skipped', reason: 'quiet_hours' });
    const sentRow = (await ok<{ deliveries: { channel: string; status: string }[] }>(users.admin.get(`${API}/notifications/deliveries?notification_id=${crit.id}`), 'deliveries')).deliveries;
    expect(sentRow.find((d) => d.channel === 'webpush')?.status).toBe('sent');

    await openApp(page);
    await openCenter(page);
    await expect(page.locator('sw-app notify-center [data-banner="quiet"]')).toContainText('שעות שקט עד');
    await expect(page.locator('sw-app notify-center [data-banner="quiet"]')).toContainText('נשלח רק קריטי');
    await expect(rowOf(page, info.id)).toBeVisible(); // the held row waits in the center
    await shot(page, 'live-5-quiet-center-1440');
    await openRowDetail(page, info.id);
    await expect(page.locator('sw-app notify-center notify-detail [data-detail-delivery="held"]')).toContainText('שעות שקט');
    await shot(page, 'live-5-quiet-held-detail-1440');

    // quiet hours off again for the rest of the run; the leak dries
    await settingsPut({ quiet: { enabled: false } });
    await haState(W.leak2, 'off', { device_class: 'moisture', friendly_name: 'חיישן הצפה במכונת הכביסה' });
    await policyPut('device.battery_low', { channels: { inbox: true, webpush: false, email: false, ha_mobile: false, whatsapp: false } });
  });

  // ---------------------------------------------------------------------------------------------- 6
  test('6 backup failure: an e-mail reaches the fake SMTP server; the log shows the masked address only', async ({ page }) => {
    const smtpPort = ((await (await control.get(`${CONTROL}/status`)).json()) as { smtp_port: number }).smtp_port;
    await ok(control.post(`${CONTROL}/smtp/reset`), 'smtp reset');
    await ok(users.admin.put(`${API}/notify/email`, { data: { host: '127.0.0.1', port: smtpPort, security: 'none', user: '', from: 'arx@example.test', recipients: [W.mailTo] } }), 'email config');
    const test1 = await ok<{ ok: boolean; detail: string }>(users.admin.post(`${API}/notify/email/test`), 'email test');
    expect(test1.ok).toBe(true);
    await until('the test mail', async () => (await mails()).length === 1);
    await ok(control.post(`${CONTROL}/smtp/reset`), 'smtp reset');

    await ok(control.post(`${CONTROL}/emit/backup-failed`), 'backup failed');
    const row1 = await until('the backup row', async () => (await rowsOf('admin', 'backup.failed'))[0]);
    expect(row1).toMatchObject({ category: 'system', severity: 'alert', title: 'הגיבוי נכשל', state: 'open' });
    const got = await until('the mail', async () => { const m = await mails(); return m.length ? m : null; }, 30_000);
    expect(got).toHaveLength(1);
    expect(got[0].to).toEqual([W.mailTo]);
    expect(got[0].subject).toContain('הגיבוי נכשל');
    expect(got[0].text).toContain('הגיבוי');
    expect(got[0].text, 'no person and no secret in the mail').not.toMatch(/joni|dana|password|token|secret/i);
    // the delivery log (administrators only): the address is masked
    const dl = await ok<{ deliveries: { channel: string; status: string; target: string; notification_id: string }[] }>(users.admin.get(`${API}/notify/deliveries?channel=email`), 'deliveries');
    const mine = dl.deliveries.filter((d) => d.notification_id === row1.id);
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine.every((d) => d.status === 'sent')).toBe(true);
    expect(JSON.stringify(dl)).not.toContain(W.mailTo);
    expect(mine[0].target).toBe('o***@example.test');
    // the backup row is the administrators' alone
    expect((await rowsOf('floor2', 'backup.failed')).length).toBe(0);
    expect((await ok<Record<string, any>>(users.admin.get(`${API}/notify/email`), 'email get')).password_set).toBe(false); // eslint-disable-line @typescript-eslint/no-explicit-any

    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page, '/system/notifications');
    await expect(page.locator('sw-app system-notifications [data-notify-settings]')).toBeVisible();
    await page.locator('sw-app system-notifications [data-set-section="log"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect(page.locator('sw-app system-notifications [data-log-row]').first()).toBeVisible();
    const logText = await page.locator('sw-app system-notifications [data-set-section="log"]').innerText();
    // the screen's log shows the channel and the outcome of the mail, never an address (masked or not): the masked form is in the API's `target`
    await expect(page.locator('sw-app system-notifications [data-log-row]', { hasText: 'הגיבוי נכשל' }).first()).toContainText('נשלח');
    expect(logText).toContain('הגיבוי נכשל');
    expect(logText).not.toContain(W.mailTo);
    expect(logText).not.toContain('example.test');
    await shot(page, 'live-6-mail-log-1440');
  });

  // ---------------------------------------------------------------------------------------------- 7
  test('7 a user without scope gets nothing: no row, no push, 404 on the row and its actions', async ({ browser }) => {
    expect(W.leakId).toBeTruthy();
    expect(await inbox('floor3')).toEqual([]); // floor 3 sees no entity of floor 2, no camera of it, no door station, no system row
    const summary = await ok<{ unread: number; open_critical: number }>(users.floor3.get(`${API}/notifications/summary`), 'summary');
    expect(summary).toMatchObject({ unread: 0, open_critical: 0 });
    expect((await pushLog()).entries.filter((p) => p.user === 'ops3')).toHaveLength(0);
    for (const [verb, url] of [['get', `${API}/notifications/${W.leakId}`], ['post', `${API}/notifications/${W.leakId}/ack`], ['post', `${API}/notifications/${W.leakId}/read`], ['get', `${API}/notifications/${W.leakId}/snapshot`]] as const) {
      const r = await (users.floor3 as unknown as Record<string, (u: string) => Promise<{ status(): number; json(): Promise<{ code?: string }> }>>)[verb](url);
      expect(r.status(), `${verb} ${url}`).toBe(404);
      expect((await r.json()).code).toBe('notification_not_found');
    }
    // the same row is the floor-2 operator's (a recipient): visible to the person who may see the kitchen
    expect((await inbox('floor2')).some((x) => x.id === W.leakId)).toBe(true);
    // the browser: an empty center
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': OPS.floor3 }, viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
    const page = await ctx.newPage();
    try {
      await openApp(page);
      await expect(me(page).locator('[data-alert-dot]')).toHaveCount(0);
      await openCenter(page);
      await expect(page.locator('sw-app notify-center [data-center-state="empty"]')).toBeVisible();
      await expect(page.locator('sw-app notify-center notify-row')).toHaveCount(0);
      await shot(page, 'live-7-no-scope-center-1440');
    } finally {
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- 8
  test('8 a user without notify.manage sees only device registration in the settings tab, and /notify/* answers 403', async ({ browser }) => {
    for (const [verb, url] of [['get', `${API}/notify/settings`], ['get', `${API}/notify/policies`], ['get', `${API}/notify/email`], ['get', `${API}/notify/deliveries`], ['get', `${API}/notify/stats`]] as const) {
      const r = await (users.floor2 as unknown as Record<string, (u: string) => Promise<{ status(): number }>>)[verb](url);
      expect(r.status(), `${verb} ${url}`).toBe(403);
    }
    expect((await users.floor2.put(`${API}/notify/settings`, { data: { retention_days: 7 } })).status()).toBe(403);
    expect((await users.floor2.put(`${API}/notify/email`, { data: { host: 'x.test', port: 25, security: 'none', from: 'a@b.test', recipients: ['a@b.test'] } })).status()).toBe(403);
    expect((await users.floor2.post(`${API}/notify/email/test`)).status()).toBe(403);
    expect(((await (await users.admin.get(`${API}/notify/settings`)).json()) as { retention_days: number }).retention_days, 'nothing was changed by the refused calls').toBe(30);
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': OPS.floor2 }, viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
    const page = await ctx.newPage();
    try {
      await openApp(page, '/system/notifications');
      const sys = page.locator('sw-app system-notifications');
      await expect(sys.locator('[data-set-state="user"]')).toBeVisible();
      await expect(sys.locator('[data-set-section]')).toHaveCount(0);
      await expect(sys.locator('[data-set-nav]')).toHaveCount(0);
      await expect(sys.locator('[data-pol-row]')).toHaveCount(0);
      await expect(sys.locator('arx-notifications-settings')).toHaveCount(1);
      await expect(sys.locator('arx-notifications-settings [data-push-cat]')).toHaveCount(0);
      await expect(sys.locator('arx-notifications-settings [data-push-save]')).toHaveCount(0);
      await shot(page, 'live-8-user-settings-1440');
    } finally {
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------------------- 9
  test('9 the administrator\'s tab, live: the eight sections in order, the matrix of every source', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page, '/system/notifications');
    const sys = page.locator('sw-app system-notifications');
    await expect(sys.locator('[data-set-state="ready"]')).toBeVisible();
    expect(await sys.locator('[data-set-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-set-section')))).toEqual(['sources', 'quiet', 'esc', 'lock', 'keep', 'mail', 'chan', 'log']);
    await expect(sys.locator('[data-pol-row]')).toHaveCount(28);
    // what scenarios 1-6 saved is what the screen shows (read back from the server, not from a mock)
    await expect(sys.locator('[data-set-section="mail"] [data-mail-host]')).toHaveValue('127.0.0.1');
    await expect(sys.locator('[data-set-section="esc"] [data-esc-min]')).toContainText('1');
    for (const id of ['sources', 'quiet', 'esc', 'lock', 'keep', 'mail', 'chan', 'log']) {
      await sys.locator(`[data-set-section="${id}"]`).evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(300);
      await shot(page, `live-9-settings-${id}-1440`);
    }
    const sources = await sys.locator('[data-set-section="sources"]').innerText();
    expect(sources).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });
});
