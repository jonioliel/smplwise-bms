import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockHome, overview } from './home-simple-mocks';
import { installGeneratorMock, url } from './generator-mocks';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';

// MULTI-BUILDING-HOME-2500 (owner decisions 22.11, Q64-Q68): the home interface and the lobby board on a multi-building site, against the
// REAL build with the mock layer (an invented site: "מגדל א" holds the ground floor, "מגדל ב" the first floor, the shared "חניון משותף" the
// garden and the parking - no real place, device or person). The overview carries the building level exactly as
// routers/home_interface.build_overview sends it while the multi-building switch is on (services/home_buildings.overview_extra).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-mb-home-2500.spec.ts --project=desktop
// SW_MB_BEFORE=1 runs the same captures against a build of the base (no building level yet): the shots only, no assertion.
// SW_SHOTS: where the captures go (default test-results/mb-home-2500).

const BEFORE = process.env.SW_MB_BEFORE === '1';
const OUT = process.env.SW_SHOTS || 'test-results/mb-home-2500';
const SIZES = [{ id: 'tablet', width: 1280, height: 800 }, { id: 'phone', width: 390, height: 844 }];
const A = 'bA', B = 'bB', P = 'bP';
const BLD_OF: Record<string, string> = { g: A, f1: B, out: P };

function multiOverview(opts: { all?: boolean; entry?: string | null } = {}) {
  const ov = overview('demo') as ReturnType<typeof overview> & Record<string, unknown>;
  for (const r of ov.rooms as { floor_id: string; building_id?: string | null }[]) r.building_id = BLD_OF[r.floor_id] ?? null;
  ov.buildings = [{ id: A, name: 'מגדל א', is_shared: false }, { id: B, name: 'מגדל ב', is_shared: false }, { id: P, name: 'חניון משותף', is_shared: true }];
  // the meters' areas (kitchen, living: tower A) and the parking (the shared building: a meter there serves every building)
  ov.area_buildings = Object.fromEntries((ov.rooms as { id: string; floor_id: string }[]).map((r) => [r.id, BLD_OF[r.floor_id]]));
  ov.building_all = !!opts.all;
  ov.entry_building = opts.entry ?? null;
  return ov;
}

async function openHome(page: Page, route: string, opts: { all?: boolean; entry?: string | null; last?: string } = {}) {
  const mock = await mockHome(page, { ds: 'demo' });
  const ov = multiOverview(opts);
  await page.route('**/api/v1/home/overview', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ov) }));
  // a third meter in the parking (the shared building): it counts in every building, with "גם ב..."
  await page.route('**/api/v1/energy/meters', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [
    meterRow('m1', 'מונה ראשי', 'kitchen', 'מטבח', 4.6), meterRow('m2', 'סלון', 'living', 'סלון', 3.1), meterRow('m3', 'תאורת חניון', 'parking', 'חניה', 2.4), meterRow('m4', 'חדר שינה', 'master', 'חדר שינה הורים', 1.2),
  ] }) }));
  await page.goto('about:blank'); // a fresh load: the same address with another hash would keep the page (and its building)
  if (opts.last !== undefined) await page.addInitScript((v) => { try { localStorage.setItem('home.building', v); } catch { /* */ } }, opts.last);
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  return mock;
}

function meterRow(id: string, name: string, area: string | null, areaName: string | null, today: number) {
  return { id, display_name: name, source_kind: 'ha_entity', unit: 'kWh', area_id: area, area_name: areaName, floor_id: null, floor_name: null, status: 'reporting', status_reason: null,
    today_kwh: today, month_kwh: today * 20, last_reading_at: '2026-11-23T08:00:00Z', max_kw: 100, revision: 1, accounts_count: 0, current_kw: 0.4 };
}

const homeRoot = (page: Page) => page.evaluateHandle(() => document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!);
const text = async (page: Page, sel: string) => page.evaluate((s) => Array.from(document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!.querySelectorAll(s)).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()), sel);

async function noScroll(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push(`document ${doc.scrollHeight}>${doc.clientHeight}`);
    if (doc.scrollWidth - doc.clientWidth > 1) out.push(`document-x ${doc.scrollWidth}>${doc.clientWidth}`);
    for (const sel of ['#main', '.hs']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
      if (el && el.scrollWidth - el.clientWidth > 1) out.push(`${sel}-x ${el.scrollWidth}>${el.clientWidth}`);
    }
    return out;
  });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.describe('MULTI-BUILDING-HOME-2500 home interface', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`the building level - ${size.id}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      const problems: string[] = [];
      for (const [route, name] of [['r/home', 'home'], ['rooms', 'rooms'], ['lights', 'lights'], ['active', 'active'], ['energy', 'energy']] as const) {
        await openHome(page, route);
        if (!BEFORE) problems.push(...(await noScroll(page)).map((x) => `${route}: ${x}`));
        await shot(page, `${size.id}-${name}`);
      }
      if (BEFORE) return;
      // Q65: nothing set and no device choice -> the first building; the chip names it
      await openHome(page, 'r/home');
      expect(await text(page, '.tb-bld')).toEqual(['מגדל א']);
      // Q66: the house-wide off names the building
      expect((await text(page, '.nowbar .nb-off')).join(' ')).toContain('כבה הכל במגדל א');
      // the building sheet (Q64: "כל הבניינים" hidden by default)
      await (await homeRoot(page)).asElement()!.$('.tb-bld').then((b) => b!.click());
      await settle(page);
      const rows = await text(page, '.sheet .mrow .clamp1');
      expect(rows).toEqual(['מגדל א', 'מגדל ב', 'חניון משותף']);
      expect(rows.join(' ')).not.toContain('כל הבניינים');
      await shot(page, `${size.id}-sheet`);
      // choosing tower B: its rooms only, its name on the button, the choice remembered on the device (Q65)
      await page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!.querySelectorAll('.sheet .mrow')[1] as HTMLElement).click());
      await settle(page);
      expect(await text(page, '.tb-bld')).toEqual(['מגדל ב']);
      expect(await page.evaluate(() => localStorage.getItem('home.building'))).toBe(B);
      await shot(page, `${size.id}-home-b`);
      expect(problems).toEqual([]);
    });
  }

  test('Q66: "כבה הכל" of a building sends that building only', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    test.skip(BEFORE, 'after only');
    const mock = await openHome(page, 'active', { last: B });
    await page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!.querySelector('[data-act="houseOff"]') as HTMLElement).click());
    await expect.poll(() => mock.calls.some((c) => c.path === 'devices/actions')).toBe(true);
    const pre = mock.calls.find((c) => c.path.startsWith('devices/actions/preview'))!.path;
    expect(pre).toContain('scope=building');
    expect(pre).toContain(`building=${B}`);
    const run = mock.calls.find((c) => c.path === 'devices/actions')!.body as { scope: string; id: string; building?: string };
    expect([run.scope, run.id, run.building]).toEqual(['building', '*', B]);
  });

  test('Q64 / Q65: "כל הבניינים" only where offered; the administrator building first', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    test.skip(BEFORE, 'after only');
    await openHome(page, 'rooms', { all: true, entry: B, last: A });
    expect(await text(page, '.tb-bld')).toEqual(['מגדל ב']);
    await openHome(page, 'rooms', { all: true, last: '*' });
    expect(await text(page, '.tb-bld')).toEqual(['כל הבניינים']);
    // no whole-site off under "כל הבניינים"
    expect(await text(page, '.nowbar .nb-off')).toEqual([]);
    const heads = await text(page, '.fcol .fch h2');
    expect(heads).toEqual(['מגדל א · קומת קרקע', 'מגדל ב · קומה ראשונה', 'חניון משותף · חוץ וגינה']);
    await shot(page, 'tablet-rooms-all');
    expect(await noScroll(page)).toEqual([]);
  });

  test('Q67: a meter of the shared building counts in each building with "גם ב..."', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    test.skip(BEFORE, 'after only');
    await openHome(page, 'energy', { last: A });
    await expect.poll(async () => (await text(page, '.byroom .hb .hl')).some((r) => r.includes('חניה') && r.includes('גם במגדל ב ובחניון משותף')), { timeout: 15_000 }).toBe(true);
    const rows = await text(page, '.byroom .hb .hl');
    expect(rows.some((r) => r.includes('חדר שינה הורים'))).toBe(false); // tower B's meter is not in tower A
  });
});

// ---------------------------------------------------------------- Q68: the lobby board's building

const NOW = '2026-11-23T06:12:00Z';
const BOARD = { id: 'b1', name: 'לוח הלובי מגדל ב', slug: 'lobby', enabled: true, display: lobbyFeed().board.display, has_token: true, has_stored_link: true, token_rotated_at: '2026-11-15T08:00:00Z',
  last_seen_at: '2026-11-23T06:11:40Z', item_count: 2, created_at: '2026-11-02T08:00:00Z', updated_at: NOW };
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };
const SETTINGS = { enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, boards_remote: false, boards_max: 10,
  weather_entity: 'weather.home', weather_fallback: false, news_custom: true, building_name: '', boards_origin: 'http://192.0.2.10:18094', news_sources: [] };

test.describe('MULTI-BUILDING-HOME-2500 lobby board', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'desktop sizes only'));

  test('Q68: the board editor names the building, the TV greets with it', async ({ page }) => {
    test.setTimeout(120_000);
    const saved: unknown[] = [];
    await installGeneratorMock(page, { perms: ['devices.read', 'notices.view', 'notices.manage', 'notices.push', 'notices.boards', 'system.configure'], count: 0, modules: { tickets: false, notices: true } as { tickets: boolean } });
    let board: Record<string, unknown> = { ...BOARD, building_id: B };
    await page.route('**/api/v1/notices**', async (route) => {
      const req = route.request();
      const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
      const j = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (p === 'notices/module') return j({ enabled: true, can: CAN });
      if (p === 'notices/settings') return j({ settings: SETTINGS, can: CAN, weather_entities: [], company_logo: false, listener: true, building_fallback: 'פארק המגדלים' });
      if (p === 'notices' && req.method() === 'GET') return j({ notices: [], can: CAN, now: NOW, defaults: { default_days: 7, default_severity: 'info' } });
      if (p === 'notices/boards') return j({ boards: [board], full: true, max: 10, remote: false, buildings: [{ id: A, name: 'מגדל א', is_shared: false }, { id: B, name: 'מגדל ב', is_shared: false }, { id: P, name: 'חניון משותף', is_shared: true }] });
      if (p === 'notices/boards/b1' && req.method() === 'GET') return j({ board, notices: [] });
      if (p === 'notices/boards/b1' && req.method() === 'PATCH') { const b = req.postDataJSON(); saved.push(b); board = { ...board, building_id: b.building_id || undefined }; return j({ board }); }
      if (p === 'notices/audience/options') return j({ floors: [], groups: [], roles: [] });
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found"}' });
    });
    for (const size of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'phone', width: 390, height: 844 }]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('about:blank');
      await page.goto(url('/system/notices/b1'));
      await page.waitForTimeout(1200);
      await shot(page, `board-editor-${size.id}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (!BEFORE) expect(overflow).toBeLessThanOrEqual(1);
    }
    // the TV: the greeting is the board's building (the server's answer - services/home_buildings.board_building - is the feed's
    // `board.building`; before this row it was the installation's name for every board)
    for (const [name, greeting] of [['lobby-tv', BEFORE ? 'פארק המגדלים' : 'מגדל ב']] as const) {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const feed = lobbyFeed({}, undefined, {});
      feed.board.building = greeting;
      await serveFeed(page, feed);
      await page.goto(tvUrl());
      await page.waitForSelector('#nbk[data-ready="1"], #cv[data-tpl]', { state: 'attached' });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.waitForTimeout(800);
      await shot(page, name);
      if (!BEFORE) expect(await page.evaluate(() => document.body.textContent ?? '')).toContain('מגדל ב');
    }
  });
});
