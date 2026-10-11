import type { Page } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// CR-029 ST7 UI (Plan Studio 6 editor UI + the plan.view settings): the mocked backend shared by evidence-st7-ui.spec.ts and
// layout-st7-ui.spec.ts. Pure page.route on api/v1 - no live backend, no device: one floor with a published plan, a structure draft
// (walls, a door, a window, objects on the level, a room zone), the real catalog file, the settings answer with plan.view and the
// site location, and the person's own plan-view prefs. Saves (PUT geometry / PATCH settings / PUT plan-view/prefs) are accepted
// and echoed, so the editor's autosave and the settings' save buttons behave as against the server.

export const PERMS = ['video.live', 'video.playback', 'map.read', 'map.edit', 'map.publish', 'entity.state.read', 'devices.read', 'events.read', 'system.configure', 'rbac.assign'];
export const FLOOR = 'f-st7';
export const VERSION = 'pv-st7';
const W = 1200;
const H = 800;

type P = [number, number];
const WALL = (id: string, polyline: P[], kind = 'interior', extra: Record<string, unknown> = {}) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const OPENING = (id: string, wallId: string, t: number, kind: 'door' | 'window') => ({ id, wall_id: wallId, t, kind, width_m: kind === 'door' ? 0.9 : 1.2, height_m: kind === 'door' ? 2.1 : 1.2, sill_m: kind === 'door' ? 0 : 0.9, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} });
const OBJECT = (id: string, item: string, pos: P, size: { w_m: number; d_m: number; h_m: number }, extra: Record<string, unknown> = {}) => ({ id, item_id: item, level_id: 'L0', position: pos, rotation_deg: 0, size, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

/** The structure draft the editor opens: a room of four walls with a door and a window, a sofa, a table, a lamp. */
export function seedDoc(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: '2.0',
    plan_version_id: VERSION,
    floor_id: FLOOR,
    source: { sha256: '0'.repeat(64), file_name: 'plan.png', mime: 'image/png', page: 1 },
    dimensions: { width_px: W, height_px: H, scale_m_per_px: 0.01, calibration: { method: 'manual', status: 'measured', pairs: [], residual_pct: null } },
    transform: { rotation: 0, crop: null },
    levels: [{ id: 'L0', name: 'מפלס ראשי', elevation_m: 0, ceiling_height_m: 2.8, is_default: true }],
    walls: [
      WALL('w-n', [[0.15, 0.2], [0.85, 0.2]], 'exterior'),
      WALL('w-e', [[0.85, 0.2], [0.85, 0.8]], 'exterior'),
      WALL('w-s', [[0.85, 0.8], [0.15, 0.8]], 'exterior'),
      WALL('w-w', [[0.15, 0.8], [0.15, 0.2]], 'exterior'),
      WALL('w-mid', [[0.5, 0.2], [0.5, 0.8]]),
    ],
    openings: [OPENING('o-door', 'w-s', 0.3, 'door'), OPENING('o-win', 'w-n', 0.7, 'window')],
    rooms: [],
    objects: [
      OBJECT('ob-sofa', 'sofa.3', [0.3, 0.45], { w_m: 2.1, d_m: 0.9, h_m: 0.85 }),
      OBJECT('ob-table', 'table.dining', [0.68, 0.5], { w_m: 1.6, d_m: 0.9, h_m: 0.75 }),
      OBJECT('ob-lamp', 'lamp.ceiling', [0.3, 0.3], { w_m: 0.4, d_m: 0.4, h_m: 0.2 }, { z_m: 2.6 }),
    ],
    circuits: [],
    connectors: [],
    labels: [],
    groups: [],
    uncertain_regions: [],
    uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'test', tokens_version: '1', detector_version: null },
    ...extra,
  };
}

export interface St7Mock {
  doc: Record<string, unknown>;
  revision: number;
  /** Every PUT of the draft, in order (the spec asserts the saved fields). */
  puts: Record<string, unknown>[];
  settings: Record<string, unknown>;
  patches: Record<string, unknown>[];
  own: Record<string, unknown>;
  prefPuts: Record<string, unknown>[];
  canEdit: boolean;
}

const SITE_VIEW = { style: 'auto', furniture: 'models', textures: 'files', wall_display: 'live', time_source: 'clock', mouse_mode: 'drag', quality: 'auto', kiosk_idle_s: 30, eye_m: 1.65, dpr_cap: 1.25, section_cut: true, show_temps: false, motion: true, walk_guard: true };
const PERSONAL = ['style', 'default_view', 'time_source', 'mouse_mode', 'quality', 'eye_m', 'dpr_cap', 'section_cut', 'show_temps', 'motion', 'walk_guard'];

export function freshMock(over: Partial<St7Mock> = {}): St7Mock {
  return {
    doc: seedDoc(), revision: 3, puts: [], patches: [], prefPuts: [], own: {}, canEdit: true,
    settings: { 'ui.design': 'a', 'ui.start_route': 'explore', 'time.zone': 'Asia/Jerusalem', 'plan.estimates': 'true', 'plan.levels': 'all', 'map.shared_levels': 'show', 'plan.quality': '2', 'plan.view': { ...SITE_VIEW }, 'site.latitude': null, 'site.longitude': null, 'map.default_view': '2d', 'plan.surfaces': ['devices', 'area'] },
    ...over,
  };
}

const catalog = (() => {
  const raw = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../smplwise_vms/backend/smplwise/catalog/objects.json', import.meta.url)), 'utf8')) as Record<string, unknown>;
  return { ...raw, revision: 'st7-test' };
})();

const ZONES = [{ id: 'z-living', floor_id: FLOOR, plan_version_id: VERSION, name: 'סלון', kind: 'room', polygon: [{ x: 0.16, y: 0.21 }, { x: 0.49, y: 0.21 }, { x: 0.49, y: 0.79 }, { x: 0.16, y: 0.79 }], color: '#60a5fa', source: 'manual', searchable: true, level_id: 'L0', tags: [], revision: 1, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }];

export async function mockSt7Backend(page: Page, mock: St7Mock) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const planVersion = { id: VERSION, floor_id: FLOOR, asset_id: 'a1', page: 1, rotation: 0, crop: null, width_px: W, height_px: H, scale_m_per_px: 0.01, status: 'published', revision: 1, notes: '', image_url: `plan-versions/${VERSION}/image`, published_at: '2026-10-01T00:00:00Z', archived_at: null, render_mode: 'source', stylized_url: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
    const geometryRow = () => ({ id: 'g1', plan_version_id: VERSION, floor_id: FLOOR, status: 'draft', revision: mock.revision, doc_hash: `h${mock.revision}`, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', published_at: null, published_by: null });
    const geometryAnswer = () => ({ geometry: geometryRow(), doc: mock.doc, issues: [], published_hash: 'h1', copy_candidates: [] });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['explore', 'devices', 'security'] }, stored: [], updated_at: null });
    if (p === 'settings' && req.method() === 'GET') return json({ settings: mock.settings, can_edit: mock.canEdit });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      mock.patches.push(body);
      for (const [k, v] of Object.entries(body)) {
        if (k === 'plan.view') mock.settings['plan.view'] = { ...(mock.settings['plan.view'] as Record<string, unknown>), ...(v as Record<string, unknown>) };
        else if (k === 'site.latitude' || k === 'site.longitude') mock.settings[k] = v === '' || v === null ? null : Number(v);
        else mock.settings[k] = v;
      }
      return json({ settings: mock.settings, can_edit: mock.canEdit });
    }
    if (p === 'plan-view/prefs') {
      if (req.method() === 'PUT') {
        const body = (req.postDataJSON() as { prefs: Record<string, unknown> }).prefs;
        mock.prefPuts.push(body);
        for (const [k, v] of Object.entries(body)) {
          if (v === null) delete mock.own[k];
          else mock.own[k] = v;
        }
      }
      const site = mock.settings['plan.view'] as Record<string, unknown>;
      return json({ site, own: mock.own, effective: { ...site, default_view: 'schematic', ...mock.own }, personal_dials: PERSONAL, can_edit_site: mock.canEdit });
    }
    if (p === 'health' || p === 'health/summary') return json({ status: 'ok', items: [], checks: [], checked_at: '2026-10-04T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [{ id: 's1', name: 'אתר הדגמה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '', buildings: [{ id: 'b1', site_id: 's1', name: 'בניין א', sort_order: 0, updated_at: '', floors: [{ id: FLOOR, building_id: 'b1', name: 'קומת קרקע', level: 0, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: VERSION, plan_width_px: W, plan_height_px: H, draft_version_id: null, anchor_count: 0, camera_count: 0 }] }] }], can_create_site: true });
    if (p === `floors/${FLOOR}/map`) {
      return json({
        floor: { id: FLOOR, building_id: 'b1', name: 'קומת קרקע', level: 0, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: VERSION, plan_width_px: W, plan_height_px: H, draft_version_id: null, anchor_count: 0, camera_count: 0 },
        building: { id: 'b1', site_id: 's1', name: 'בניין א', sort_order: 0, updated_at: '' },
        site: { id: 's1', name: 'אתר הדגמה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '' },
        plan: planVersion, geometry: { id: 'g1', doc_hash: `h${mock.revision}`, status: 'draft', revision: mock.revision, published_at: null }, catalog_revision: 'st7-test',
        levels: (mock.doc.levels as unknown[]), circuit_states: {}, floor_images: null, anchors: [], zones: ZONES, needs_alignment: false, permissions: { edit: true, publish: true, import: true, structure: true }, cameras: [],
      });
    }
    if (p === `plan-versions/${VERSION}/image`) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f8fafc"/></svg>` });
    if (p === `plan-versions/${VERSION}/geometry` && req.method() === 'GET') return json(geometryAnswer());
    if (p === `plan-versions/${VERSION}/geometry` && req.method() === 'PUT') {
      const body = req.postDataJSON() as { doc: Record<string, unknown>; base_revision: number };
      mock.puts.push(body.doc);
      mock.doc = body.doc;
      mock.revision += 1;
      return json(geometryAnswer());
    }
    if (p === `plan-versions/${VERSION}/geometry/versions`) return json({ versions: [] });
    if (p === `floors/${FLOOR}/plan-versions`) return json({ versions: [planVersion] });
    if (p === `floors/${FLOOR}/plan-assets`) return json({ assets: [] });
    if (p === `floors/${FLOOR}/zones`) return json({ zones: ZONES });
    if (p === 'catalog/objects') return json(catalog);
    if (p.startsWith('plan/areas')) return json({ areas: [] });
    if (p.startsWith('plan/area-links')) return json({ rows: [], areas: [], counts: { linked: 0, suggested: 0, none: 0, dangling: 0 } });
    if (p.startsWith('ha/entities')) return json({ entities: [], total: 0 });
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    return json({ error: { code: 'not_found', message: 'לא נמצא (בדיקה)' } }, 404);
  });
}

/** Open a route of the shell with the mocked backend (the skin / scheme query of the design foundation). */
export async function openSt7(page: Page, hash: string, query = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.evaluate(() => document.fonts.ready);
}

/** The editor is up when its canvas drew the seeded walls. */
export async function waitEditor(page: Page) {
  await page.locator('explore-plan-editor sw-plan-canvas [data-wall]').first().waitFor({ state: 'attached', timeout: 20_000 });
  await page.waitForTimeout(300);
}

export const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
