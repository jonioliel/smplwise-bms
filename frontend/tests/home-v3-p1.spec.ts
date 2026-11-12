import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';

// HOME-V3-P1-2430: the home interface mockup v3, phase 1 (security and intercom) - the "עוד" hub, recordings, the home diary, the
// intercom (calls, guests, who can come in), the alarm screen with the personal code, and the administrator's guest mark and room
// wallpaper for everyone. Mocked backend (tests/home-simple-mocks.ts + the routes below); nothing is sent anywhere.

const ALL = ['alarm.view', 'alarm.arm', 'alarm.disarm', 'devices.read', 'devices.control', 'ha.entity.control', 'devices.control_bulk', 'video.live', 'video.playback', 'events.read',
  'map.read', 'energy.view', 'access.read', 'access.call', 'access.doors.open', 'access.people.read', 'access.visitor.invite'];
const FORBIDDEN = ['Home Assistant', 'go2rtc', 'NVR', 'WebRTC', 'entity', 'ישות', 'RTSP', 'stream', 'relay', 'WisKey'];
const SIZES = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'tablet', width: 1024, height: 768 }, { id: 'phone', width: 390, height: 844 }];
const SHOTS = 'test-results/home-v3-p1';

const inHome = (page: Page) => page.locator('sw-home');
const ok = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Sent = { method: string; path: string; body: unknown }[];

async function v3Routes(page: Page, opts: { guests?: boolean } = {}): Promise<Sent> {
  const sent: Sent = [];
  const day = new Date();
  const iso = (h: number, m = 0) => { const d = new Date(day); d.setHours(h, m, 0, 0); return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); };
  const log = (r: Route) => { sent.push({ method: r.request().method(), path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON?.() ?? null }); };
  await page.route('**/api/v1/cameras/*/recordings?**', (r) => ok(r, { camera_id: 'cam1', from: '', to: '', track_id: 101, segments: [
    { start_at: iso(0), end_at: iso(9, 30), kind: 'continuous', track_id: 101, start_raw: '', end_raw: '' }, { start_at: iso(11), end_at: iso(16), kind: 'continuous', track_id: 101, start_raw: '', end_raw: '' },
  ], coverage: 'complete', matches: 2, pages: 1, searched_at: '', timezone: 'Asia/Jerusalem', note: '' }));
  await page.route('**/api/v1/cameras/*/events?**', (r) => ok(r, { camera_id: 'cam1', date: '', timezone: 'Asia/Jerusalem', events: [{ id: 'e1', type: 'person', occurred_at: iso(14, 20) }, { id: 'e2', type: 'system', occurred_at: iso(15) }] }));
  await page.route('**/api/v1/playback/sessions', (r) => { if (r.request().method() !== 'POST') return r.fallback(); log(r); return ok(r, { id: 'pb1', camera_id: 'cam1', generation: 1, state: 'playing', requested_at: '', actual_start_at: (r.request().postDataJSON() as { start_at: string }).start_at, actual_end_at: null, media_anchor: null, time_precision: 'unknown', media_handle: null, expires_at: '', capabilities: { seek: true, pause: false, frame_step: false, supported_speeds: [1] }, playback_end_at: '' }, 201); });
  await page.route('**/api/v1/playback/sessions/*', (r) => { log(r); return ok(r, { id: 'pb1', state: 'closed' }); });
  await page.route('**/api/v1/events?**', (r) => ok(r, { events: [
    { id: 'v1', source: 'alertstream', raw_type: '', type: 'person', camera_id: 'cam1', camera_name: 'כניסה לבית', channel: 1, occurred_at: new Date(Date.now() - 30 * 60000).toISOString(), ended_at: null, received_at: '', state: 'none', count: 1, severity: 'info', confidence: 'measured', details: {}, acked_at: null, acked_by_username: null },
    { id: 'v2', source: 'ha', raw_type: '', type: 'door', camera_id: null, camera_name: null, channel: null, occurred_at: new Date(Date.now() - 90 * 60000).toISOString(), ended_at: null, received_at: '', state: 'none', count: 1, severity: 'info', confidence: 'measured', details: {}, acked_at: null, acked_by_username: null },
    { id: 'v3', source: 'system', raw_type: '', type: 'storage', camera_id: null, camera_name: null, channel: null, occurred_at: new Date(Date.now() - 100 * 60000).toISOString(), ended_at: null, received_at: '', state: 'none', count: 1, severity: 'info', confidence: 'measured', details: {}, acked_at: null, acked_by_username: null },
  ], filters: {} }));
  await page.route('**/api/v1/intercom/people?**', (r) => ok(r, { state: 'ready', people: { records: [
    { id: 'p1', employee_no: '1', display_name: 'נועה לביא', active: true, valid_from: null, valid_until: null, revision: 1, group_ids: [], stations: [{ station_id: 's1', enabled: true, doors: [1], sync_state: 'synced' }] },
    { id: 'p2', employee_no: '2', display_name: 'יוסי לביא', active: true, valid_from: null, valid_until: '2026-12-31T00:00:00Z', revision: 1, group_ids: [], stations: [{ station_id: 's1', enabled: true, doors: [1, 2], sync_state: 'synced' }] },
  ], total: 2 } }));
  const visitors: Record<string, unknown>[] = [];
  const visitor = (id: string, name: string, confirmed: boolean) => ({ id, grant_id: 'g' + id, state: 'approved', code_state: null, mode: 'window', approval_kind: 'host_envelope', purpose: 'guest', valid_from: new Date(Date.now() - 60000).toISOString(), valid_until: new Date(Date.now() + 3 * 3600000).toISOString(), doors: [{ station_id: 's1', name: 'דלת הכניסה', relays: [1] }], visitor: { name, number: '••12' }, confirmed, entries: 0, first_entry_at: null, end_reason: null, created_at: '', own: true });
  visitors.push(visitor('i1', 'דנה', true));
  await page.route('**/api/v1/home/guest-doors', (r) => (opts.guests ? ok(r, { doors: [{ station_id: 's1', relay: 1, name: 'דלת הכניסה', station_name: 'כניסה' }, { station_id: 's2', relay: 1, name: 'שער החניה', station_name: 'חניה' }] }) : ok(r, { code: 'not_found' }, 404)));
  await page.route('**/api/v1/access/visitors?**', (r) => (opts.guests ? ok(r, { visitors, settings: {} }) : ok(r, { code: 'not_found' }, 404)));
  await page.route('**/api/v1/access/visitors', (r) => { if (r.request().method() !== 'POST') return r.fallback(); log(r); const v = visitor('i2', (r.request().postDataJSON() as { visitor_name: string }).visitor_name, false); visitors.unshift(v); return ok(r, { visitor: v }); });
  await page.route('**/api/v1/access/visitors/*/verify/send', (r) => { log(r); return ok(r, { sent: true }); });
  await page.route('**/api/v1/access/visitors/*/verify/check', (r) => { log(r); const v = { ...visitors[0], confirmed: true }; visitors[0] = v; return ok(r, { visitor: v }); });
  await page.route('**/api/v1/access/visitors/*', (r) => { log(r); return ok(r, { visitor: { ...visitors[visitors.length - 1], state: 'revoked' } }); });
  await page.route('**/api/v1/alarm/me', (r) => ok(r, { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true, pin_set_at: null, code_mode: 'personal_pin' }));
  await page.route('**/api/v1/alarm/me/pin', (r) => { log(r); return ok(r, { pin_set: true, pin_set_at: '' }); });
  return sent;
}

async function open(page: Page, route: string, extra: Parameters<typeof mockHome>[1] = {}, v3: { guests?: boolean } = {}) {
  await page.goto('about:blank'); // a fresh page each time: a hash-only change would keep the previous app (and its mocks' data)
  const mock = await mockHome(page, { perms: ALL, ...extra });
  const sent = await v3Routes(page, v3);
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  return { mock, sent };
}

/** Overflow of the page / shell / main area, small targets, the shown words and the direction (the 2420 sweep's audit, plus open sheets). */
async function audit(page: Page, min: number) {
  return page.evaluate((m) => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const doc = document.scrollingElement!;
    const out: string[] = [];
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main', '.ovl .sheet']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
    }
    const hs = root.querySelector('.hs') as HTMLElement;
    if (hs.scrollWidth - hs.clientWidth > 1) out.push('hs-x');
    const small: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('#main button, #main a[href], .ovl button'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest('.cover')) continue;
      const after = getComputedStyle(el, '::after');
      const grow = after.content !== 'none' && after.position === 'absolute' ? Math.max(0, -parseFloat(after.top || '0')) + Math.max(0, -parseFloat(after.bottom || '0')) : 0;
      if (Math.min(r.width, r.height + grow) < m - 0.5) small.push(`${el.tagName.toLowerCase()}.${el.className}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const text = (root as unknown as { textContent: string }).textContent + ' ' + Array.from(root.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).join(' ');
    return { out, small, text, dir: getComputedStyle(hs).direction };
  }, min);
}

test.describe('HOME-V3-P1-2430 sizes', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`phase-1 screens and sheets fit without scrolling, RTL, targets, words - ${size.id}`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      const problems: string[] = [];
      const check = async (name: string) => {
        // a sheet scales in: measure it once its entrance animation has finished
        await page.evaluate(() => Promise.all((document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!.getAnimations?.() ?? []).map((x) => x.finished.catch(() => undefined))));
        const a = await audit(page, size.id === 'phone' ? 44 : 56);
        if (a.out.length) problems.push(`${name}: overflow ${a.out.join(', ')}`);
        if (size.id === 'tablet' && a.small.length) problems.push(`${name}: small ${a.small.slice(0, 4).join('; ')}`);
        if (a.dir !== 'rtl') problems.push(`${name}: direction ${a.dir}`);
        for (const w of FORBIDDEN) if (a.text.includes(w)) problems.push(`${name}: says "${w}"`);
        await page.screenshot({ path: `${SHOTS}/${size.id}-${name}.png` });
      };
      for (const s of ['more', 'playback/cam1', 'events', 'intercom/calls', 'intercom/guests', 'intercom/people', 'security', 'r/home', 'cameras']) {
        await open(page, s, { policy: { guests: true } }, { guests: true });
        await check(s.replace(/\//g, '_'));
      }
      // the sheets
      await open(page, 'intercom/guests', { policy: { guests: true } }, { guests: true });
      await inHome(page).locator('[data-act="guestNew"]').click();
      await check('sheet-guest-new');
      await inHome(page).locator('[data-act="close"]').last().click();
      await inHome(page).locator('[data-act="guestShow"]').first().click();
      await check('sheet-guest-show');
      await open(page, 'security');
      await inHome(page).locator('[data-act="almPin"]').click();
      await check('sheet-pin');
      expect(problems).toEqual([]);
    });
  }
});

test.describe('HOME-V3-P1-2430 themes', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one size'));

  test('all 7 themes, dark and light: the hub and the alarm screen take the theme and keep the text readable', async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const bad: string[] = [];
    for (const theme of ['classic', 'ocean', 'sand', 'plum', 'midnight', 'nordic', 'pastel']) {
      for (const scheme of theme === 'midnight' ? ['dark'] : ['dark', 'light']) {
        for (const s of ['more', 'security']) {
          await open(page, s, { layout: { welcomed: true, theme, scheme } });
          await expect(inHome(page)).toHaveAttribute('data-hs-theme', theme);
          await expect(inHome(page).locator(s === 'more' ? '.hubt .hl' : '.alm-w').first()).toBeVisible();
          // the label of the first tile / the state word against its tile: WCAG contrast >= 4.5
          const ratio = await page.evaluate((sel) => {
            const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
            const el = root.querySelector(sel) as HTMLElement;
            const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
            const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
            let bgEl: HTMLElement | null = el;
            let bg = 'rgba(0, 0, 0, 0)';
            while (bgEl && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(bgEl).backgroundColor; bgEl = bgEl.parentElement; }
            const a = lum(rgb(getComputedStyle(el).color)), b = lum(rgb(bg));
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          }, s === 'more' ? '.hubt .hl' : '.alm-w');
          if (ratio < 4.5) bad.push(`${theme}/${scheme}/${s}: ${ratio.toFixed(2)}`);
          await page.screenshot({ path: `${SHOTS}/theme-${theme}-${scheme}-${s}.png` });
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

test.describe('HOME-V3-P1-2430 behaviour', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough for the behaviour');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('the "עוד" hub: sixth nav item, ninth home category, tiles with live lines', async ({ page }) => {
    await open(page, 'r/home');
    await expect(inHome(page).locator('.chips3 [data-cat="more"]')).toHaveCount(1);
    await expect(inHome(page).locator('.chips3 [data-cat="intercom"]')).toHaveAttribute('href', '#/home/intercom');
    await expect(inHome(page).locator('.hs-nav a')).toHaveCount(6);
    await inHome(page).locator('.hs-nav a[href="#/home/more"]').click();
    await settle(page);
    await expect(inHome(page).locator('.hs-nav a[aria-current="page"]')).toHaveAttribute('href', '#/home/more');
    await expect(inHome(page).locator('.hubt')).toHaveCount(4);
    await expect(inHome(page).locator('.hubt[data-mod="intercom"]')).toContainText('שיחה אחת לא נענתה');
    await expect(inHome(page).locator('.hubt[data-mod="alarm"]')).toContainText('מנוטרלת');
    // a child of the hub goes back to the hub
    await inHome(page).locator('.hubt[data-mod="events"]').click();
    await expect(inHome(page).locator('.tb-back')).toHaveAttribute('href', '#/home/more');
    // in a room there is no "עוד" chip
    await page.goto('/#/home/r/living');
    await settle(page);
    await expect(inHome(page).locator('.chips3 [data-cat="more"]')).toHaveCount(0);
  });

  test('a capability whose permission is off disappears: no tile, no recordings button', async ({ page }) => {
    await open(page, 'more', { perms: ['devices.read', 'devices.control', 'video.live', 'alarm.view'] });
    await expect(inHome(page).locator('.hubt')).toHaveCount(1); // only the alarm
    await expect(inHome(page).locator('.hubt[data-mod="rec"], .hubt[data-mod="events"], .hubt[data-mod="intercom"]')).toHaveCount(0);
    await page.goto('/#/home/cameras');
    await settle(page);
    await expect(inHome(page).locator('[data-home-rec]')).toHaveCount(0);
  });

  test('recordings: a left-to-right timeline of the day, play opens a session at that time; the camera view links its recordings', async ({ page }) => {
    const { sent } = await open(page, 'cameras');
    await expect(inHome(page).locator('.hs-head [data-home-rec]')).toHaveCount(1);
    await inHome(page).locator('[data-act="cam"]').first().click();
    await expect(inHome(page).locator('.camfull [data-home-rec]')).toHaveAttribute('href', '#/home/playback/cam1');
    await inHome(page).locator('.camfull [data-home-rec]').click();
    await settle(page);
    const tl = inHome(page).locator('.tl');
    await expect(tl).toHaveAttribute('dir', 'ltr');
    await expect(tl.locator('.tl-seg')).toHaveCount(2);
    await expect(inHome(page).locator('.pb-ev')).toHaveCount(1); // the person event; the system event stays out
    await expect(inHome(page).locator('.tb-back')).toHaveAttribute('href', '#/home/cameras');
    // the video is never mirrored
    expect(await inHome(page).locator('.pb-pic').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
    await inHome(page).locator('.pb-ev').first().click();
    await expect.poll(() => sent.filter((s) => s.path === 'playback/sessions' && s.method === 'POST').length).toBe(1);
    const at = (sent.find((s) => s.path === 'playback/sessions')!.body as { camera_id: string; start_at: string });
    expect(at.camera_id).toBe('cam1');
    expect(new Date(at.start_at).getHours()).toBe(14);
    await expect(inHome(page).locator('[data-act="pbPlay"]')).toHaveAttribute('aria-pressed', 'true');
    // leaving the screen releases the session
    await inHome(page).locator('[data-act="pbLive"]').click();
    await expect.poll(() => sent.some((s) => s.method === 'DELETE' && s.path === 'playback/sessions/pb1')).toBe(true);
  });

  test('recordings: the day stepper goes back beyond the day before yesterday (everything stored)', async ({ page }) => {
    await open(page, 'playback/cam1');
    for (let i = 0; i < 5; i++) await inHome(page).locator('[data-act="pbDay"][data-d="1"]').click();
    await expect(inHome(page).locator('.pb-days .pbd')).not.toHaveText(/היום|אתמול|שלשום/);
    await expect(inHome(page).locator('[data-act="pbDay"][data-d="-1"]')).toBeEnabled();
  });

  test('the home diary: simple words, the technical events left out, filter, watch the recording', async ({ page }) => {
    await open(page, 'events');
    await expect(inHome(page).locator('.evrow')).toHaveCount(4); // person + door + two doorbell calls; the storage event is not shown
    await expect(inHome(page).locator('.evrow').first()).toContainText('מישהו עבר בכניסה לבית');
    await inHome(page).locator('[data-act="evTab"][data-v="door"]').click();
    await expect(inHome(page).locator('.evrow')).toHaveCount(3);
    await inHome(page).locator('[data-act="evTab"][data-v="all"]').click();
    await inHome(page).locator('.evrow [data-act="evWatch"]').first().click();
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/home\/playback\/cam1(%40|@)\d+$/);
  });

  test('intercom: the call history; guests hidden unless the administrator marked the person', async ({ page }) => {
    await open(page, 'intercom');
    await expect(inHome(page).locator('.crow')).toHaveCount(2);
    await expect(inHome(page).locator('.crow').first()).toContainText('הדלת נפתחה · נועה');
    await expect(inHome(page).locator('[data-act="icTab"][data-v="guests"]')).toHaveCount(0);
    await expect(inHome(page).locator('[data-act="icTab"][data-v="people"]')).toHaveCount(1);
  });

  test('guests: invite with a temporary code, confirm the guest\'s number, cancel with a confirmation', async ({ page }) => {
    const { sent } = await open(page, 'intercom/guests', { policy: { guests: true } }, { guests: true });
    await expect(inHome(page).locator('[data-guest]')).toHaveCount(1);
    await inHome(page).locator('[data-act="guestNew"]').click();
    const sheet = inHome(page).locator('[data-home-guest-new]');
    await sheet.locator('input').first().fill('אורי');
    await sheet.locator('input[type="tel"]').fill('050-1234567');
    await sheet.locator('[data-act="guestDoor"]', { hasText: 'שער החניה' }).click();
    await sheet.locator('[data-act="guestSave"]').click();
    await expect.poll(() => sent.filter((s) => s.path === 'access/visitors').length).toBe(1);
    const body = sent.find((s) => s.path === 'access/visitors')!.body as Record<string, unknown>;
    expect(body).toMatchObject({ visitor_name: 'אורי', phone: '0501234567', doors: { s2: [1] }, purpose: 'guest' }); // digits only
    expect(Date.parse(body.valid_until as string)).toBeGreaterThan(Date.parse(body.valid_from as string));
    // the code itself is never shown: the guest's number is confirmed, then the code goes to the guest's phone
    const show = inHome(page).locator('[data-home-guest-show]');
    await expect(show).toContainText('מאמתים את הטלפון של האורח');
    await show.locator('[data-act="guestVerifySend"]').click();
    await show.locator('input').fill('4321');
    await show.locator('[data-act="guestVerifyCheck"]').click();
    await expect.poll(() => sent.map((s) => s.path)).toContain('access/visitors/i2/verify/check');
    await inHome(page).locator('[data-act="guestDelAsk"]').first().click();
    await expect(inHome(page).locator('[role="alertdialog"]')).toContainText('הקוד יפסיק לעבוד מיד');
    await inHome(page).locator('[data-act="askYes"]').click();
    await expect.poll(() => sent.some((s) => s.method === 'DELETE')).toBe(true);
  });

  test('who can come in: names and doors only, view only', async ({ page }) => {
    await open(page, 'intercom/people');
    await expect(inHome(page).locator('.prow')).toHaveCount(2);
    await expect(inHome(page).locator('.prow').nth(1)).toContainText('2 דלתות');
    await expect(inHome(page).locator('.foot-note')).toContainText('בממשק המלא');
    await expect(inHome(page).locator('#main button:not(.rb)')).toHaveCount(2); // the two tabs only: nothing to add or edit
  });

  test('alarm: arm is a tap and one confirmation; disarm asks for the code; the personal code is changed with the current one', async ({ page }) => {
    const { mock, sent } = await open(page, 'security');
    await expect(inHome(page).locator('[data-home-alarm]')).toContainText('מנוטרלת');
    await inHome(page).locator('[data-act="almArm"][data-v="arm_away"]').click();
    await expect(inHome(page).locator('[role="alertdialog"]')).toContainText('לדרוך את האזעקה?');
    await inHome(page).locator('[data-act="askYes"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.path === 'alarm/actions').map((c) => JSON.stringify(c.body))).toContainEqual(expect.stringContaining('"action":"arm_away","confirmed":true'));
    await inHome(page).locator('[data-act="almPin"]').click();
    const pad = async (code: string) => { for (const k of code) await inHome(page).locator(`[data-act="pinKey"][data-k="${k}"]`).click(); await inHome(page).locator('[data-act="pinGo"]').click(); };
    await expect(inHome(page).locator('[data-home-pin="cur"]')).toHaveCount(1);
    await pad('1111');
    await pad('2468');
    await pad('2469'); // a mismatch starts the new code again
    await expect(inHome(page).locator('[data-home-pin="new1"]')).toContainText('הקודים לא זהים');
    await pad('2468');
    await pad('2468');
    await expect.poll(() => sent.filter((s) => s.path === 'alarm/me/pin').map((s) => JSON.stringify(s.body))).toEqual([JSON.stringify({ pin: '2468', current_pin: '1111' })]);
  });

  test('the administrator\'s room wallpaper for everyone: a personal one wins, a wall panel shows the administrator\'s', async ({ page }) => {
    await open(page, 'r/living', { policy: { wallpaper: 'gallery', room_wallpapers: { living: 'g:moss' } }, layout: { welcomed: true } });
    await expect(inHome(page).locator('.hs.v2')).toHaveAttribute('data-wall', 'shared:g:moss');
    await open(page, 'r/living', { policy: { wallpaper: 'gallery', room_wallpapers: { living: 'g:moss' } }, layout: { welcomed: true, wallpapers: { living: 'g:dusk' } } });
    await expect(inHome(page).locator('.hs.v2')).toHaveAttribute('data-wall', 'g:dusk');
    await open(page, 'r/living', { policy: { wallpaper: 'gallery', room_wallpapers: { living: 'g:moss' }, kiosk: true, home_only: true, may_switch: false, kiosk_area_id: 'living' }, layout: { welcomed: true, wallpapers: { living: 'g:dusk' } } });
    await expect(inHome(page).locator('.hs.v2')).toHaveAttribute('data-wall', 'shared:g:moss');
  });
});

test.describe('HOME-V3-P1-2430 administrator page', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough');
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('the guest mark per person and a room wallpaper for everyone are saved', async ({ page }) => {
    await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
    const users = [{ user_id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', source: 'ingress', system_admin: false, default_interface: 'full', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: null, configured: false, admin: false, guests: false, can_invite: false }];
    const sent: Sent = [];
    let walls: Record<string, string> = {};
    await page.route('**/api/v1/home/policies', (r) => ok(r, { users, modules: ['lights'], seed: {}, kiosk_code_set: false }));
    await page.route('**/api/v1/home/policies/*', (r) => { sent.push({ method: 'PUT', path: 'home/policies', body: r.request().postDataJSON() }); return ok(r, { ...users[0], guests: true }); });
    await page.route('**/api/v1/home/settings', (r) => ok(r, { settings: { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'gallery' }, values: {}, gallery: [] }));
    await page.route('**/api/v1/home/room-wallpapers', (r) => ok(r, { walls, mode: 'gallery', gallery: [] }));
    await page.route('**/api/v1/home/room-wallpapers/*', (r) => { const b = r.request().postDataJSON() as { value: string }; sent.push({ method: 'PUT', path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: b }); walls = b.value ? { living: b.value } : {}; return ok(r, { walls }); });
    await page.route('**/api/v1/identity/users**', (r) => ok(r, { users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false }));
    await page.route('**/api/v1/access/roles**', (r) => ok(r, { roles: [] }));
    await page.route('**/api/v1/access/groups**', (r) => ok(r, { groups: [], can_manage: true }));
    await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/#/system/access?tab=home');
    const admin = page.locator('sw-home-admin');
    await expect(admin.locator('[data-home-detail] h3')).toHaveText('נועה לביא', { timeout: 30_000 }); // the access page's chunk loads first
    await expect(admin.locator('[data-home-detail]')).toContainText('הסימון לבדו לא מספיק');
    await admin.locator('sw-toggle[data-home-guests]').click();
    await expect.poll(() => sent.filter((s) => s.path === 'home/policies').map((s) => JSON.stringify(s.body))).toEqual(['{"guests":true}']);
    await admin.locator('[data-home-subtabs] [role="tab"]', { hasText: 'הגדרות התקנה' }).click();
    await admin.locator('[data-home-room-wall="g:dusk"]').click();
    await expect.poll(() => sent.filter((s) => s.path.startsWith('home/room-wallpapers/')).map((s) => `${s.path} ${JSON.stringify(s.body)}`)).toEqual(['home/room-wallpapers/living {"value":"g:dusk"}']);
    await expect(admin.locator('[data-home-room-wall="g:dusk"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
