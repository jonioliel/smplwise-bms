import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';

// TKMAPSPEC: the mock layer of the internal map-element specs (evidence-tickets-map-internal / layout-tickets-map). It layers over ANY
// tickets mock (installTicketsMock / installTicketsDeviceMock): routes registered later answer first, everything it does not know goes
// `route.fallback()` to the layer below. It answers the map-element routes of routers/tickets_map.py (GET / PUT / DELETE and the
// vendor picture) and the three reads the picker and the live map need: the site tree, a floor's map bundle and the camera list.
// Fake data only; the plan picture is a tiny PNG, the vendor picture is the server renderer's fixture (tests/tickets-map-fixture.svg).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SVG = fs.readFileSync(path.join(HERE, 'tickets-map-fixture.svg'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBFIjN8B/EBgA5UQjPY8YfnQAAAABJRU5ErkJggg==', 'base64');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export type Call = { method: string; path: string; body: unknown };
export interface MapEl {
  kind: 'anchor' | 'object';
  type: 'camera' | 'ha_entity' | 'object';
  name: string;
  floor_name: string;
  room_name: string | null;
  attached_at: string;
  present: boolean;
  vendor_image: boolean;
  floor_id?: string;
  element_id?: string;
  resource_id?: string | null;
}
export interface MapMockOptions {
  /** the map element each request starts with (by id; absent = none) */
  state?: Record<string, MapEl | null>;
  /** what the caller may do (the server's `can`) */
  can?: { attach: boolean; detach: boolean };
}
export interface MapMock {
  /** every PUT / DELETE of a map element: { method, path, body } */
  writes: Call[];
  /** every GET of the vendor picture */
  previews: string[];
  /** the current element of a request */
  state: Record<string, MapEl | null>;
}

export const T_MAP = '0000000000000a02'; // a request of the base mock (manager / admin may attach)
export const F2 = 'f-two';
export const F1 = 'f-one';
export const F0 = 'f-roof';
export const AC = { anchor: 'an-ac', entity: 'light.office_ac', name: 'מזגן משרד' };
export const CAMERA = { anchor: 'an-cam', camera: 'cam-1', name: 'מצלמת לובי' };
export const LOBBY = { anchor: 'an-lobby', entity: 'light.lobby', name: 'תאורת לובי' };

const ATT = '2026-10-13T09:00:00Z';
export const ATTACHED: MapEl = { kind: 'anchor', type: 'ha_entity', name: AC.name, floor_name: 'קומה 2', room_name: 'משרד 12', attached_at: ATT, present: true, vendor_image: true, floor_id: F2, element_id: AC.anchor, resource_id: AC.entity };
export const GONE: MapEl = { ...ATTACHED, present: false, vendor_image: false };
export const TEXT_ONLY: MapEl = { ...ATTACHED, vendor_image: false };

const floorRow = (id: string, name: string, level: number, hasPlan: boolean, anchors: number) => ({
  id, building_id: 'b1', name, level, sort_order: level, ha_area_id: null, has_plan: hasPlan, published_version_id: hasPlan ? `v-${id}` : null, plan_width_px: 1200, plan_height_px: 800,
  draft_version_id: null, anchor_count: anchors, camera_count: id === F2 ? 1 : 0, updated_at: ATT,
});
const FLOORS = [floorRow(F2, 'קומה 2', 2, true, 2), floorRow(F1, 'קומה 1', 1, true, 1), floorRow(F0, 'גג', 0, false, 0)];
const building = { id: 'b1', site_id: 's1', name: 'מבנה הדגמה', sort_order: 0, updated_at: ATT, floors: FLOORS };
const site = { id: 's1', name: 'אתר הדגמה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: ATT, buildings: [building] };
const camera = { id: 'cam-1', recorder_id: 'r1', channel: 1, name: 'מצלמת לובי', name_source: 'מצלמת לובי', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: 101, sub_track: 102,
  status: 'online', last_seen_at: ATT, can_view_live: true };

const entity = (id: string, name: string) => ({ entity_id: id, domain: 'light', name, state: 'on', available: true, fresh: true, last_changed: ATT, attributes: {}, device_class: null, can_control: true, actions: [] });
const anchor = (id: string, floor: string, x: number, y: number, label: string, ent?: string) => ({
  id, floor_id: floor, plan_version_id: `v-${floor}`, resource_type: ent ? 'ha_entity' : 'camera', resource_id: ent ?? 'cam-1', position: { x, y }, rotation_degrees: 0, field_of_view_degrees: ent ? null : 70,
  layer_id: ent ? 'lights' : 'cameras', label, revision: 1, effective_from: ATT, effective_to: null, updated_at: ATT, ...(ent ? { entity: entity(ent, label) } : { camera }),
});
/** where each pickable element sits on its plan (plan-normalised), so a spec can click it */
export const DOTS: Record<string, { floor: string; x: number; y: number }> = {
  [CAMERA.anchor]: { floor: F2, x: 0.3, y: 0.4 }, [AC.anchor]: { floor: F2, x: 0.65, y: 0.45 }, [LOBBY.anchor]: { floor: F1, x: 0.5, y: 0.5 },
};
const ANCHORS: Record<string, ReturnType<typeof anchor>[]> = {
  [F2]: [anchor(CAMERA.anchor, F2, 0.3, 0.4, CAMERA.name), anchor(AC.anchor, F2, 0.65, 0.45, AC.name, AC.entity)],
  [F1]: [anchor(LOBBY.anchor, F1, 0.5, 0.5, LOBBY.name, LOBBY.entity)],
  [F0]: [],
};
const NAMES: Record<string, { name: string; resource_id: string; type: MapEl['type']; floor: string }> = {
  [AC.anchor]: { name: AC.name, resource_id: AC.entity, type: 'ha_entity', floor: F2 }, [CAMERA.anchor]: { name: CAMERA.name, resource_id: CAMERA.camera, type: 'camera', floor: F2 },
  [LOBBY.anchor]: { name: LOBBY.name, resource_id: LOBBY.entity, type: 'ha_entity', floor: F1 },
  [AC.entity]: { name: AC.name, resource_id: AC.entity, type: 'ha_entity', floor: F2 }, [CAMERA.camera]: { name: CAMERA.name, resource_id: CAMERA.camera, type: 'camera', floor: F2 },
};
const floorName = (id: string) => FLOORS.find((f) => f.id === id)?.name ?? '';

function bundle(id: string) {
  const f = FLOORS.find((x) => x.id === id);
  if (!f) return null;
  return {
    floor: f, building, site,
    plan: f.has_plan ? { id: f.published_version_id, floor_id: id, asset_id: 'a1', status: 'published', width_px: 1200, height_px: 800, rotation: 0, crop: null, notes: '', revision: 1,
      image_url: `api/v1/plan-versions/${f.published_version_id}/image.png`, stylized_url: null, render_mode: 'source', published_at: ATT, archived_at: null, created_at: ATT, scale_m_per_px: 0.01, calibration_json: null } : null,
    geometry: null, catalog_revision: 'r1', levels: [], circuit_states: {}, floor_images: null, anchors: ANCHORS[id] ?? [], zones: [], needs_alignment: false, at: null, history: null, history_from: null, ha_history: null,
    permissions: { edit: false, publish: false, import: false, structure: false }, cameras: id === F2 ? [camera] : [],
  };
}

export async function installMapMock(page: Page, o: MapMockOptions = {}): Promise<MapMock> {
  const can = o.can ?? { attach: true, detach: true };
  const st: MapMock = { writes: [], previews: [], state: { ...(o.state ?? {}) } };
  const answer = (id: string) => ({ ticket_id: id, element: st.state[id] ?? null, can: { attach: can.attach, detach: can.detach && !!st.state[id] } });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const me = /^tickets\/([\w-]+)\/map-element(\/vendor\.svg)?$/.exec(p);
    if (me) {
      const id = me[1];
      if (me[2]) {
        st.previews.push(id);
        return route.fulfill({ status: 200, contentType: 'image/svg+xml; charset=utf-8', body: SVG });
      }
      if (method === 'GET') return json(route, answer(id));
      const body = method === 'PUT' ? (() => { try { return req.postDataJSON() as Record<string, { floor_id?: string; kind?: string; id: string; type?: string }>; } catch { return null; } })() : null;
      st.writes.push({ method, path: p, body });
      if (method === 'DELETE') {
        st.state[id] = null;
        return json(route, answer(id));
      }
      if (method === 'PUT') {
        const pick = body?.element ?? body?.resource;
        const hit = pick ? NAMES[pick.id] : undefined;
        if (!hit) return json(route, { code: 'not_found', user_message: 'הרכיב לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
        st.state[id] = { kind: 'anchor', type: hit.type, name: hit.name, floor_name: floorName(hit.floor), room_name: null, attached_at: ATT, present: true, vendor_image: true,
          floor_id: hit.floor, element_id: pick!.id, resource_id: hit.resource_id };
        return json(route, answer(id));
      }
      return route.fallback();
    }
    if (p === 'sites' && url.searchParams.get('tree') === 'true') return json(route, { sites: [site], can_create_site: false });
    const fm = /^floors\/([\w-]+)\/map$/.exec(p);
    if (fm) {
      const b = bundle(fm[1]);
      return b ? json(route, b) : json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
    }
    if (/^plan-versions\/[\w-]+\/image\.png$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === 'cameras' && method === 'GET') return json(route, { cameras: [camera], recorder: null, can_sync: false });
    return route.fallback();
  });
  return st;
}
