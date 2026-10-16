/**
 * CR-ORG-LOCATIONS (owner request 2026-10-17): the ONLY frontend module that talks to the organisation-location routes of
 * smplwise_vms/backend/smplwise/routers/tickets_admin.py:
 *   GET    tickets/locations                              active locations (name + address) + the organisation / department defaults
 *   GET    tickets/admin/locations                        every location with coordinates, navigation link and reference count
 *   POST   tickets/admin/locations                        create (tickets.configure)
 *   PATCH  tickets/admin/locations/{id}                   edit / deactivate / make default
 *   DELETE tickets/admin/locations/{id}                   only when nothing references it (409 location_in_use otherwise)
 *   PUT    tickets/admin/departments/{id}/location        a department's optional default location
 * Without a backend (static preview, design review) a small demo store answers with the same rules.
 */
import { ApiError, api, get, patch, post, put } from './client';
import { isApi } from './session';

export interface OrgLocation {
  id: string;
  name: string;
  street: string;
  city: string;
  details: string;
  is_default: boolean;
  sort_order: number;
  has_coordinates: boolean;
  /** the short map link from the coordinates ('' without them): the RFQ preview shows it when the navigation link is switched on */
  map_url: string;
}

export interface OrgLocationAdmin extends OrgLocation {
  lat: number | null;
  lng: number | null;
  active: boolean;
  nav_url: string;
  references: number;
  revision: number;
  updated_at: string;
}

export interface LocationsAnswer {
  locations: OrgLocation[];
  default_id: string | null;
  department_defaults: Record<string, string>;
}

export interface LocationsAdminAnswer {
  locations: OrgLocationAdmin[];
  default_id: string | null;
  department_defaults: Record<string, string>;
  max: number;
  id?: string;
}

/** The location of a request as the server presents it (the snapshot taken at creation). */
export interface RequestLocation {
  id: string | null;
  name: string;
  address: string;
  details: string;
  text: string;
  has_coordinates: boolean;
  /** the `{location}` text of a vendor message (name · street, city) and the map link ('' without coordinates) */
  message?: string;
  map_url?: string;
}

export interface LocationInput {
  name?: string;
  street?: string;
  city?: string;
  details?: string;
  lat?: number | null;
  lng?: number | null;
  active?: boolean;
  is_default?: boolean;
  sort_order?: number;
  revision?: number;
}

export interface LocationsBackend {
  list(): Promise<LocationsAnswer>;
  admin(): Promise<LocationsAdminAnswer>;
  create(body: LocationInput): Promise<LocationsAdminAnswer>;
  update(id: string, body: LocationInput): Promise<LocationsAdminAnswer>;
  remove(id: string): Promise<LocationsAdminAnswer>;
  setDepartmentDefault(departmentId: string, locationId: string | null): Promise<LocationsAdminAnswer>;
}

const A = 'tickets/admin/locations';
const enc = encodeURIComponent;

const rest: LocationsBackend = {
  list: () => get<LocationsAnswer>('tickets/locations'),
  admin: () => get<LocationsAdminAnswer>(A),
  create: (body) => post<LocationsAdminAnswer>(A, body),
  update: (id, body) => patch<LocationsAdminAnswer>(`${A}/${enc(id)}`, body),
  remove: (id) => api<LocationsAdminAnswer>(`${A}/${enc(id)}`, { method: 'DELETE' }),
  setDepartmentDefault: (dept, loc) => put<LocationsAdminAnswer>(`tickets/admin/departments/${enc(dept)}/location`, { location_id: loc }),
};

// ---------------------------------------------------------------- the demo store (no backend)

const demo: { items: OrgLocationAdmin[]; depts: Record<string, string>; refs: Record<string, number>; seq: number } = {
  items: [
    { id: 'loc-hq', name: 'מטה ראשי', street: 'הרצל 5', city: 'תל אביב', details: 'בניין B, קומה 3, כניסה מהחניון', is_default: true, sort_order: 0, map_url: 'https://maps.google.com/?q=32.08530,34.78180',
      has_coordinates: true, lat: 32.0853, lng: 34.7818, active: true, nav_url: 'https://maps.google.com/?q=32.08530,34.78180', references: 2, revision: 1,
      updated_at: '2026-10-17T08:00:00Z' },
    { id: 'loc-wh', name: 'מחסן צפון', street: 'האומן 12', city: 'חיפה', details: 'שער 2', is_default: false, sort_order: 1, map_url: '', has_coordinates: false, lat: null,
      lng: null, active: true, nav_url: 'https://www.google.com/maps/search/?api=1&query=%D7%94%D7%90%D7%95%D7%9E%D7%9F%2012%2C%20%D7%97%D7%99%D7%A4%D7%94', references: 0,
      revision: 1, updated_at: '2026-10-17T08:00:00Z' },
  ],
  depts: {},
  refs: { 'loc-hq': 2 },
  seq: 1,
};

function demoErr(status: number, code: string, message: string): ApiError {
  return new ApiError(status, { code, user_message: message, retryable: false, correlation_id: 'demo', details: {} });
}

function demoAdmin(): LocationsAdminAnswer {
  const items = [...demo.items].sort((a, b) => Number(b.active) - Number(a.active) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return { locations: structuredClone(items), default_id: items.find((x) => x.is_default)?.id ?? null, department_defaults: { ...demo.depts }, max: 200 };
}

function demoCheck(body: LocationInput, id: string | null): void {
  const name = body.name?.trim();
  if (name !== undefined && demo.items.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) {
    throw demoErr(409, 'location_name_taken', 'כבר קיים מיקום בשם הזה.');
  }
}

function demoNav(x: OrgLocationAdmin): string {
  if (x.lat !== null && x.lng !== null) return `https://maps.google.com/?q=${x.lat.toFixed(5)},${x.lng.toFixed(5)}`;
  const q = [x.street, x.city].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}

const mock: LocationsBackend = {
  list: async () => {
    const a = demoAdmin();
    const active = a.locations.filter((x) => x.active);
    return { locations: active.map(({ id, name, street, city, details, is_default, sort_order, has_coordinates, lat, lng }) => ({ id, name, street, city, details, is_default, sort_order, has_coordinates, map_url: lat !== null && lng !== null ? `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}` : '' })),
      default_id: a.default_id, department_defaults: Object.fromEntries(Object.entries(demo.depts).filter(([, l]) => active.some((x) => x.id === l))) };
  },
  admin: async () => demoAdmin(),
  create: async (body) => {
    demoCheck(body, null);
    const id = `loc-demo-${demo.seq++}`;
    if (body.is_default) demo.items.forEach((x) => (x.is_default = false));
    const x: OrgLocationAdmin = { id, name: body.name?.trim() ?? '', street: body.street ?? '', city: body.city ?? '', details: body.details ?? '', is_default: !!body.is_default,
      sort_order: body.sort_order ?? demo.items.length, map_url: '', lat: body.lat ?? null, lng: body.lng ?? null, has_coordinates: body.lat != null, active: body.active ?? true,
      nav_url: '', references: 0, revision: 1, updated_at: new Date().toISOString() };
    x.nav_url = demoNav(x);
    x.map_url = x.has_coordinates ? x.nav_url : '';
    demo.items.push(x);
    return { ...demoAdmin(), id };
  },
  update: async (id, body) => {
    demoCheck(body, id);
    const x = demo.items.find((i) => i.id === id);
    if (!x) throw demoErr(404, 'location_not_found', 'המיקום לא נמצא.');
    if (body.is_default) demo.items.forEach((i) => (i.is_default = false));
    const { revision: _r, ...rest } = body;
    Object.assign(x, rest, { revision: x.revision + 1, updated_at: new Date().toISOString() });
    if (body.name !== undefined) x.name = body.name.trim();
    if (body.active === false) {
      x.is_default = false;
      for (const [d, l] of Object.entries(demo.depts)) if (l === id) delete demo.depts[d];
    }
    x.has_coordinates = x.lat !== null && x.lng !== null;
    x.nav_url = demoNav(x);
    x.map_url = x.has_coordinates ? x.nav_url : '';
    return demoAdmin();
  },
  remove: async (id) => {
    if (demo.refs[id]) throw demoErr(409, 'location_in_use', 'המיקום כבר משמש בקשות קיימות. אפשר להשבית אותו במקום למחוק.');
    demo.items = demo.items.filter((x) => x.id !== id);
    for (const [d, l] of Object.entries(demo.depts)) if (l === id) delete demo.depts[d];
    return demoAdmin();
  },
  setDepartmentDefault: async (dept, loc) => {
    if (loc) demo.depts[dept] = loc;
    else delete demo.depts[dept];
    return demoAdmin();
  },
};

export function ticketsLocationsApi(): LocationsBackend {
  return isApi() ? rest : mock;
}
