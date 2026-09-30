import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMock, type MockKind } from './guide-mocks';

// T091 (R181/R182/R183) — infrastructure for the Hebrew user guide's screenshots. This spec is data-driven from
// docs/user-guide/he/screens.json: one entry per screen/area of the product, captured once per (viewport x role)
// combination it lists. It does NOT write any guide text — captions in screens.json are TODO placeholders for a
// separate documentation pass. See docs/user-guide/he/README_HE.md for the full schema and running instructions.
//
// Opt-in only: skipped unless SW_GUIDE=1, so it never runs inside the ordinary fixture/live suites.
//
// Base URL and identity (two capture sources, same script):
//   SW_GUIDE_BASE_URL - the frontend origin to capture from. Defaults to this repo's usual preview
//     (http://127.0.0.1:4173/, matching playwright.config.ts's BASE) — a throwaway demo backend must already be
//     running behind it (see README_HE.md "run against the demo backend": `python -m smplwise` on a temp
//     SW_DATA_DIR, same pattern the evidence-*.spec.ts live specs use, with `npm run preview` proxying /api to it).
//   SW_GUIDE_SESSION - OPTIONAL. For a later pass against the owner's real lab through HA Ingress (decision
//     2026-09-29, option ב): set this to the Ingress session cookie value and it is sent as the `Cookie` header on
//     every request this spec makes. Never set a real lab value here or in any committed file — this header is
//     documented, not hard-coded; nothing in this repo reads secrets/lab.env for it. Lab captures must not contain
//     hosts, IPs, serials or MAC addresses (see README_HE.md's privacy rule); a lab pass should point
//     SW_GUIDE_BASE_URL at the Ingress URL and rely on this cookie instead of the dev `X-SW-Dev-User` seeding below
//     (role captures against the lab use whatever HA identities the owner is actually bound as).
//
// Demo-backend seeding uses only the dev-mode endpoints and ordinary admin REST calls the evidence specs already
// rely on (ha/dev/registry, ha/dev/states, sites/buildings/floors, plan-versions, access/bindings) — nothing here
// is product source; it is idempotent (keyed on a fixed "sw_guide_" marker) so re-running against a long-lived
// throwaway backend does not pile up duplicate seed data.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREENS_JSON = path.resolve(HERE, '..', '..', 'docs', 'user-guide', 'he', 'screens.json');
const IMG_DIR = path.resolve(HERE, '..', '..', 'docs', 'user-guide', 'he', 'img');
const BASE = process.env.SW_GUIDE_BASE_URL || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const SESSION_COOKIE = process.env.SW_GUIDE_SESSION || '';
const PLAN_FIXTURE = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');

type SetupStep = { type: 'click' | 'domClick' | 'waitFor' | 'scrollTo'; selector: string } | { type: 'waitMs'; ms: number };

/** Where a screen's data comes from (screens.json `data`, default "backend"):
 *   backend    - the throwaway demo backend of README_HE.md (seeded, role identities via X-SW-Dev-User);
 *   static     - no backend at all: every api/v1 call is refused, so the app falls back to its built-in demo data (the same
 *                answers the static preview gives; the multimedia screens and the remote are drawn from their in-memory mock);
 *   mock-wall  - an API session with a mocked camera list (the wall arrangement dialog needs an API session);
 *   mock-settings - an administrator's API session for a settings tab (editable controls instead of the demo's read-only ones);
 *   mock-area  - an API session with a mocked area screen + multimedia mock (needs the Vite dev server, see guide-mocks.ts).
 * Screens that are not "backend" need no seeded ids and no backend process. */
type DataMode = 'backend' | 'static' | 'mock-wall' | 'mock-area' | 'mock-settings';

interface ScreenSpec {
  id: string;
  name_he: string;
  section: string;
  route: string; // may contain {floor} / {building} / {site} / {camera} / {area} placeholders
  viewports: ('desktop' | 'phone')[];
  roles: ('viewer' | 'operator' | 'editor' | 'site_admin' | 'system_admin')[];
  setup: SetupStep[];
  caption_he: string;
  data?: DataMode;
}

const VIEWPORT_SIZE: Record<'desktop' | 'phone', { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

// Dev-mode identity per role (T078/CR-007 pattern: `X-SW-Dev-User` binds a role at a scope on first sight).
// system_admin uses no header at all — the dev backend's bootstrap admin (SW_BOOTSTRAP_ADMIN) already holds it,
// exactly like every other evidence-*.spec.ts default capture.
const ROLE_USER: Partial<Record<ScreenSpec['roles'][number], string>> = {
  viewer: 'sw_guide_viewer',
  operator: 'sw_guide_operator',
  editor: 'sw_guide_editor',
  site_admin: 'sw_guide_site_admin',
};

interface SeedIds {
  site: string;
  building: string;
  floor: string;
  camera: string;
  area: string;
}

function readScreens(): ScreenSpec[] {
  return JSON.parse(fs.readFileSync(SCREENS_JSON, 'utf8')) as ScreenSpec[];
}

function fillRoute(route: string, ids: SeedIds): string {
  return route
    .replace('{site}', ids.site)
    .replace('{building}', ids.building)
    .replace('{floor}', ids.floor)
    .replace('{camera}', ids.camera)
    .replace('{area}', encodeURIComponent(ids.area));
}

/** File name rule (documented in README_HE.md): `<id>[-phone]` plus `--<role>` only when the screen entry lists
 * more than one role (so a single-role screen keeps a clean name), `.png`. */
function fileNameFor(screen: ScreenSpec, role: string, viewport: 'desktop' | 'phone'): string {
  const roleSuffix = screen.roles.length > 1 ? `--${role}` : '';
  const viewportSuffix = viewport === 'phone' ? '-phone' : '';
  return `${screen.id}${viewportSuffix}${roleSuffix}.png`;
}

async function findMarkerBuilding(api: APIRequestContext): Promise<SeedIds | null> {
  const tree = await (await api.get('api/v1/sites?tree=true')).json();
  for (const site of tree.sites ?? []) {
    for (const building of site.buildings ?? []) {
      if (building.name === 'מבנה — מדריך שימוש (sw_guide)') {
        const floor = building.floors?.[0];
        if (!floor) continue;
        const cams = await (await api.get('api/v1/cameras')).json();
        const cam = (cams.cameras ?? []).find((c: { alias: string }) => c.alias === 'מצלמה — מדריך שימוש');
        if (!cam) continue;
        return { site: site.id, building: building.id, floor: floor.id, camera: cam.id, area: 'sw_guide_area' };
      }
    }
  }
  return null;
}

const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
const OBJ = (id: string, item_id: string, position: [number, number], extra: Record<string, unknown> = {}) => ({ id, item_id, level_id: 'L0', position, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

/** Creates a small, deterministic demo dataset once: site/building/floor with a published plan + geometry
 * (so map-2d/map-3d/plan-studio-editor have something real to show), one camera (no NVR needed - manual channel
 * registration, per routers/cameras.py CameraIn), and one HA area with a handful of entities via the dev registry
 * (same shape evidence-devices.spec.ts uses for CR-007) so devices-building/devices-area are not empty. Reused
 * on a second run if the marker building already exists.
 */
async function seedDemoData(api: APIRequestContext): Promise<SeedIds> {
  const existing = await findMarkerBuilding(api);
  if (existing) return existing;

  const site = (await (await api.post('api/v1/sites', { data: { name: 'אתר — מדריך שימוש (sw_guide)', address: '' } })).json()).id;
  const building = (await (await api.post(`api/v1/sites/${site}/buildings`, { data: { name: 'מבנה — מדריך שימוש (sw_guide)' } })).json()).id;
  const floor = (await (await api.post(`api/v1/buildings/${building}/floors`, { data: { name: 'קומה — מדריך שימוש', level: 0 } })).json()).id;

  const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(PLAN_FIXTURE) } } })).json();
  const version = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
  expect((await api.post(`api/v1/plan-versions/${version}/publish`)).status(), 'plan version published').toBe(200);
  const g = await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json();
  const doc = {
    ...g.doc,
    walls: [WALL('n', [[0.1, 0.1], [0.9, 0.1]]), WALL('e', [[0.9, 0.1], [0.9, 0.6]]), WALL('s', [[0.9, 0.6], [0.1, 0.6]]), WALL('w', [[0.1, 0.6], [0.1, 0.1]]), WALL('m', [[0.5, 0.1], [0.5, 0.6]])],
    objects: [OBJ('t1', 'chair.basic', [0.3, 0.3]), OBJ('lk', 'light.ceiling', [0.7, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 })],
    circuits: [{ id: 'k', name: 'מעגל — מדריך', switch_entity_id: 'switch.sw_guide_k', member_ids: ['lk'], color_token: 'circuit-1', power_w: 0 }],
  };
  expect((await api.put(`api/v1/plan-versions/${version}/geometry`, { data: { doc, base_revision: g.geometry.revision } })).status(), 'geometry saved').toBe(200);
  expect((await api.post(`api/v1/plan-versions/${version}/geometry/publish`)).status(), 'geometry published').toBe(200);

  const camera = (await (await api.post('api/v1/cameras', { data: { channel: 1, alias: 'מצלמה — מדריך שימוש' } })).json()).id;

  const area = 'sw_guide_area';
  const reg = await api.post('api/v1/ha/dev/registry', {
    data: {
      floors: [{ floor_id: 'sw_guide_floor', name: 'קומה HA — מדריך', level: 0 }],
      areas: [{ area_id: area, name: 'אזור — מדריך שימוש', floor_id: 'sw_guide_floor', icon: 'mdi:desk' }],
      devices: [],
      entities: [
        { entity_id: 'light.sw_guide_light', area_id: area },
        { entity_id: 'cover.sw_guide_cover', area_id: area },
        { entity_id: 'lock.sw_guide_lock', area_id: area },
        { entity_id: 'climate.sw_guide_climate', area_id: area },
        { entity_id: 'sensor.sw_guide_temp', area_id: area },
      ],
    },
  });
  expect(reg.status(), 'dev registry seed (developer identity mode only)').toBe(200);
  const st = await api.post('api/v1/ha/dev/states', {
    data: {
      states: [
        { entity_id: 'light.sw_guide_light', state: 'on', attributes: { friendly_name: 'תאורה — מדריך' } },
        { entity_id: 'cover.sw_guide_cover', state: 'open', attributes: { friendly_name: 'תריס — מדריך', current_position: 60 } },
        { entity_id: 'lock.sw_guide_lock', state: 'locked', attributes: { friendly_name: 'מנעול — מדריך' } },
        { entity_id: 'climate.sw_guide_climate', state: 'cool', attributes: { friendly_name: 'מזגן — מדריך', current_temperature: 24, temperature: 22 } },
        { entity_id: 'sensor.sw_guide_temp', state: '23.0', attributes: { friendly_name: 'חיישן — מדריך', unit_of_measurement: '°C', device_class: 'temperature' } },
      ],
    },
  });
  expect(st.status()).toBe(200);

  return { site, building, floor, camera, area };
}

/** Binds a dev-mode username to a role, at installation scope (site scope for site_admin, matching AGENTS.md's
 * "site_admin holds rbac.assign at the site scope only"). Idempotent: a duplicate binding is a 409, accepted. */
async function ensureRole(api: APIRequestContext, username: string, roleId: string, siteId: string): Promise<void> {
  const me = await (await api.get('api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
  const scope = roleId === 'site_admin' ? { scope_type: 'site', scope_id: siteId } : { scope_type: 'installation', scope_id: '*' };
  const r = await api.post('api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, ...scope } });
  expect([201, 409], `binding ${username} -> ${roleId}`).toContain(r.status());
}

async function runSetup(page: Page, steps: SetupStep[]): Promise<void> {
  for (const step of steps) {
    if (step.type === 'click') await page.locator(step.selector).first().click();
    else if (step.type === 'domClick') await page.locator(step.selector).first().dispatchEvent('click'); // for a control another layer covers (an open drawer) - the same click event, no hit-testing
    else if (step.type === 'waitFor') await page.locator(step.selector).first().waitFor({ state: 'visible', timeout: 30_000 });
    else if (step.type === 'scrollTo') await page.locator(step.selector).first().scrollIntoViewIfNeeded();
    else if (step.type === 'waitMs') await page.waitForTimeout(step.ms);
  }
}

test.describe.serial('user guide screenshots (T091 infrastructure)', () => {
  test.skip(process.env.SW_GUIDE !== '1', 'opt-in: set SW_GUIDE=1 with a throwaway demo backend running (see header comment)');

  let api: APIRequestContext;
  let seeded: Promise<SeedIds> | null = null;
  const NO_IDS: SeedIds = { site: '', building: '', floor: '', camera: '', area: '' };

  test.beforeAll(async ({ playwright }) => {
    fs.mkdirSync(IMG_DIR, { recursive: true });
    api = await playwright.request.newContext({ baseURL: BASE, extraHTTPHeaders: SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {} });
  });

  /** Seeds the demo backend the first time a "backend" screen needs it (screens with another `data` mode never touch it). */
  function backendIds(): Promise<SeedIds> {
    seeded ??= (async () => {
      const ids = await seedDemoData(api);
      for (const [role, username] of Object.entries(ROLE_USER)) {
        await ensureRole(api, username!, role, ids.site);
      }
      return ids;
    })();
    return seeded;
  }

  test.afterAll(async () => {
    await api?.dispose();
  });

  for (const screen of readScreens()) {
    for (const role of screen.roles) {
      for (const viewport of screen.viewports) {
        test(`${screen.id} [${role}/${viewport}]`, async ({ page }) => {
          await page.setViewportSize(VIEWPORT_SIZE[viewport]);
          const mode = screen.data ?? 'backend';
          let ids = NO_IDS;
          let cleanup: (() => Promise<void>) | undefined;
          if (mode === 'backend') {
            ids = await backendIds();
            const headers: Record<string, string> = {};
            if (SESSION_COOKIE) headers.Cookie = SESSION_COOKIE;
            const username = ROLE_USER[role];
            if (username) headers['X-SW-Dev-User'] = username;
            if (Object.keys(headers).length) await page.setExtraHTTPHeaders(headers);
          } else if (mode === 'static') {
            await page.route('**/api/v1/**', (route) => route.abort()); // no backend: the app falls back to its demo data
          } else {
            cleanup = await installMock(page, mode.slice('mock-'.length) as MockKind);
          }

          const hash = fillRoute(screen.route, ids);
          await page.goto(`/?design=a${hash}`);
          await page.waitForSelector('sw-app');
          await page.waitForTimeout(1200);
          await runSetup(page, screen.setup);
          await page.waitForTimeout(300);

          await page.screenshot({ path: path.join(IMG_DIR, fileNameFor(screen, role, viewport)) });
          await cleanup?.();
        });
      }
    }
  }
});
