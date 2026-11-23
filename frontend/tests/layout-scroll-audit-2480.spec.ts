import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_ALARM } from '../src/fixtures/alarm-demo';
import { installExternalMock, XNOW } from './access-external-mocks';
import { url } from './access-control-mocks';
import { settlePage } from './pixel-settle';

// SCROLL-AUDIT-2480 (owner rule 2026-10-24: a control screen never scrolls; long lists page): three lists that scrolled inside their
// region on a desktop now use the measured pages (components/page-fit.ts + sw-pager), as the maintenance lists and the reminder log do:
//   - אבטחה › אזעקה: the sensors region (cards and list views), from 1024 px;
//   - בקרת כניסה › גישה חיצונית: the grants list, from 1024x600;
//   - מפה › מי במבנה: the people list, from 1024x560.
// For each, at 1366x768 and 1440x900 with more items than fit: paged (the default) - the region does not overflow, fewer items are
// drawn, the pager shows and its next page draws other items, the document / shell main do not scroll; `?long_lists=scroll` - every
// item is drawn, no pager, the region scrolls inside itself (overflow-y auto), the page still does not.
// The alarm sensors page as one grid (components/grid-fit.ts): the cards take at least four columns and every page but the last reaches
// the region's bottom edge, in both views (the first version paged by area: one column of four cards, two thirds of the width empty).
// SCROLL_SHOTS=<dir> also saves a screenshot of every case (the before / after comparison; run it on the base commit too - the
// assertions are skipped there with SCROLL_SHOTS_ONLY=1).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-scroll-audit-2480.spec.ts --project=desktop

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;
const SHOTS = process.env.SCROLL_SHOTS ?? '';
const SHOTS_ONLY = process.env.SCROLL_SHOTS_ONLY === '1';
const NOW = '2026-10-20T09:00:00Z';

const ME_PERMS = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'system.configure', 'presence.view', 'alarm.view', 'alarm.arm', 'alarm.disarm', 'alarm.bypass'];

/** A minimal backend: the session, the settings and the one screen's data (anything else answers 404). */
async function installApi(page: Page, answer: (p: string) => unknown | undefined) {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'מנהל', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ME_PERMS, permissions_any: ME_PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: NOW, version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    const body = answer(p);
    if (body !== undefined) return json(body);
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

/** The demo panel with 42 sensors in six areas (the demo's six, then copies). */
function manySensors() {
  const p = structuredClone(DEMO_ALARM.panels[0]);
  const areas = ['כניסה', 'מטבח', 'סלון', 'חדר שינה', 'מרתף', 'גג'];
  const base = p.zones;
  p.zones = Array.from({ length: 42 }, (_, i) => {
    const z = structuredClone(base[i % base.length]);
    const area = areas[Math.floor(i / 7)];
    return { ...z, entity_id: `binary_sensor.many_${i + 1}`, name: `${z.name} ${i + 1}`, zone_number: i + 1, area_id: area, area_name: area,
      bypass: z.bypass ? { ...z.bypass, entity_id: `switch.many_${i + 1}_bypassed` } : z.bypass };
  });
  return { ...DEMO_ALARM, panels: [p], counts: { ...DEMO_ALARM.counts, zones: p.zones.length } };
}

function manyPeople() {
  const floors = [{ id: 'f-2', name: 'קומה 2' }, { id: 'f-3', name: 'קומה 3' }];
  const people = Array.from({ length: 40 }, (_, i) => {
    const f = i % 5 === 4 ? null : floors[i % 2];
    return { user_id: `u${i + 1}`, name: `דייר ${i + 1}`, source: (['beacon', 'wifi', 'geofence'] as const)[i % 3], at: NOW, site_id: 'site_main', site_name: 'המשרד',
      floor_id: f?.id ?? null, floor_name: f?.name ?? '', zone_id: null, zone_name: '' };
  });
  return {
    enabled: true, generated_at: NOW, configured: { sites: 1, beacons: 2, wifi_sites: 1 },
    settings: { show_names: true, refresh_seconds: 30, stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near' },
    people,
    floors: floors.map((f, k) => ({ floor_id: f.id, name: f.name, level: k + 2, building: 'מבנה א', count: people.filter((x) => x.floor_id === f.id).length, zones: [] })),
    sites: [{ site_id: 'site_main', name: 'המשרד', count: people.filter((x) => !x.floor_id).length }],
    totals: { inside: people.length, named: people.length, hidden: 0, on_floors: people.filter((x) => x.floor_id).length, site_only: people.filter((x) => !x.floor_id).length },
  };
}

interface Case {
  id: string;
  hash: string;
  /** the screen element inside sw-app */
  host: string;
  /** the region that pages (inside the host's shadow root) */
  region: string;
  /** one item of the region */
  item: string;
  pager: string;
  total: number;
  install: (page: Page) => Promise<unknown>;
}

const CASES: Case[] = [
  {
    id: 'alarm-cards', hash: '/security/alarm', host: 'security-alarm', region: '.areas', item: '[data-zone]', pager: 'sw-pager[data-alarm-pager]', total: 42,
    install: (page) => installApi(page, (p) => (p === 'alarm/panels' ? manySensors() : undefined)),
  },
  {
    id: 'alarm-list', hash: '/security/alarm', host: 'security-alarm', region: '.areas', item: '[data-zone]', pager: 'sw-pager[data-alarm-pager]', total: 42,
    install: async (page) => {
      await page.addInitScript(() => { try { localStorage.setItem('sw.alarm.zones.view', 'list'); } catch { /* none */ } });
      return installApi(page, (p) => (p === 'alarm/panels' ? manySensors() : undefined));
    },
  },
  {
    id: 'external', hash: '/wiskey/external', host: 'access-external-screen', region: '.gl-body[role="list"]', item: '.gl-r', pager: 'sw-pager[data-grants-pager]', total: -1,
    install: (page) => installExternalMock(page, { more: 24 }),
  },
  {
    id: 'presence', hash: '/explore/presence', host: 'explore-presence', region: 'ul[data-presence-people]', item: '[data-presence-person]', pager: 'sw-pager[data-presence-pager]', total: 40,
    install: (page) => installApi(page, (p) => (p === 'presence/people' ? manyPeople() : p === 'presence/people/me' ? { opted_out: false, enabled: true } : undefined)),
  },
];

async function open(page: Page, c: Case, query: string) {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await c.install(page);
  await page.goto('about:blank');
  const u = url(c.hash);
  await page.goto(query ? u.replace('#', `&${query}#`) : u);
  await page.locator(`sw-app ${c.host}`).first().waitFor({ timeout: 60_000 });
  await page.locator(`sw-app ${c.host} ${c.item}`).first().waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await settlePage(page, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(400); // the measured pages settle after the first draw (ResizeObserver + one frame)
}

const measure = (page: Page, c: Case) =>
  page.evaluate(({ host, region, item, pager }) => {
    const app = document.querySelector('sw-app')?.shadowRoot;
    const main = app?.querySelector('main');
    // the screen may sit inside a section wrapper's shadow root: search the shadow roots under the shell
    const find = (r: ParentNode | null | undefined): Element | null => {
      if (!r) return null;
      const hit = r.querySelector(host);
      if (hit) return hit;
      for (const el of r.querySelectorAll('*')) {
        const f = el.shadowRoot ? find(el.shadowRoot) : null;
        if (f) return f;
      }
      return null;
    };
    const root = (find(app) as HTMLElement | null)?.shadowRoot;
    const r = root?.querySelector<HTMLElement>(region) ?? null;
    const drawn = [...(root?.querySelectorAll<HTMLElement>(item) ?? [])].map((el) => el.getBoundingClientRect());
    const rb = r?.getBoundingClientRect();
    const padEnd = r ? parseFloat(getComputedStyle(r).paddingBottom) || 0 : 0;
    return {
      // the columns of the first row, and the room left between the lowest item and the region's content bottom
      cols: drawn.filter((b) => Math.abs(b.top - (drawn[0]?.top ?? 0)) <= 2).length,
      gapBelow: rb && drawn.length ? Math.round(rb.bottom - padEnd - Math.max(...drawn.map((b) => b.bottom))) : -1,
      items: root?.querySelectorAll(item).length ?? 0,
      ids: [...(root?.querySelectorAll<HTMLElement>(item) ?? [])].map((el) => el.dataset.zone ?? el.dataset.grant ?? el.dataset.presencePerson ?? '').join(','),
      pager: !!root?.querySelector(pager),
      overflowY: r ? getComputedStyle(r).overflowY : '',
      regionOver: r ? r.scrollHeight - r.clientHeight : -1,
      doc: (document.scrollingElement?.scrollHeight ?? 0) - (document.scrollingElement?.clientHeight ?? 0),
      main: main ? main.scrollHeight - main.clientHeight : 0,
    };
  }, { host: c.host, region: c.region, item: c.item, pager: c.pager });

/** sw-app may hold the screen inside a section wrapper: find the host anywhere under the shell's shadow root. */
async function hostLocator(page: Page, c: Case) {
  return page.locator(`sw-app ${c.host}`).first();
}

test.describe('SCROLL-AUDIT-2480: the alarm sensors, the external grants and the people list page on a desktop', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  for (const vp of VIEWPORTS) {
    for (const c of CASES) {
      test(`${c.id} at ${vp.name}: paged by default, scrolls inside with long_lists=scroll`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'the viewports are set by the test itself');
        test.setTimeout(180_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install({ time: new Date(c.id === 'external' ? XNOW : NOW) });
        await page.setViewportSize({ width: vp.width, height: vp.height });

        await open(page, c, '');
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: path.join(SHOTS, `${c.id}-${vp.name}-paged.png`) });
        }
        const paged = await measure(page, c);
        info.annotations.push({ type: 'paged', description: JSON.stringify(paged) });

        await open(page, c, 'long_lists=scroll');
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${c.id}-${vp.name}-scroll.png`) });
        const scroll = await measure(page, c);
        info.annotations.push({ type: 'scroll', description: JSON.stringify(scroll) });
        if (SHOTS_ONLY) return;

        // the page never scrolls, in both modes
        for (const m of [paged, scroll]) {
          expect(m.doc, 'document scroll').toBeLessThanOrEqual(1);
          expect(m.main, 'shell main scroll').toBeLessThanOrEqual(1);
        }
        // scroll: every item drawn, no pager, the region scrolls inside itself
        if (c.total > 0) expect(scroll.items).toBe(c.total);
        expect(scroll.pager).toBe(false);
        expect(scroll.overflowY).toBe('auto');
        expect(scroll.regionOver, 'the data has more than fits (the case is meaningful)').toBeGreaterThan(8);
        // paged: fewer items, the region does not overflow, the pager is there
        expect(paged.items).toBeLessThan(scroll.items);
        expect(paged.items).toBeGreaterThan(0);
        expect(paged.overflowY).toBe('hidden');
        expect(paged.regionOver, 'the drawn page fits its region').toBeLessThanOrEqual(1);
        expect(paged.pager).toBe(true);
        // the alarm sensors (owner, first comparison: "page 1 shows four sensors in one column, two thirds of the width empty"): a page
        // is the grid that fits - the cards take the columns of the region's width, and the page reaches the region's bottom edge
        // (the rows stretch; the list's card border is the only room left)
        if (c.id === 'alarm-cards') expect(paged.cols, 'card columns on a page').toBeGreaterThanOrEqual(4);
        if (c.id.startsWith('alarm-')) {
          expect(paged.gapBelow, 'room left below the page').toBeGreaterThanOrEqual(-1);
          expect(paged.gapBelow, 'room left below the page').toBeLessThanOrEqual(3);
        }

        // the next page draws other items and still fits
        await open(page, c, '');
        const host = await hostLocator(page, c);
        await host.locator(`${c.pager} [data-pager-next]`).click();
        await page.waitForTimeout(400);
        const next = await measure(page, c);
        expect(next.ids).not.toBe(paged.ids);
        expect(next.items).toBeGreaterThan(0);
        expect(next.regionOver).toBeLessThanOrEqual(1);
      });
    }
  }
});
