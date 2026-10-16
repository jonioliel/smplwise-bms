/**
 * CR-ORG-LOCATIONS: the pure rules of the location picker and of the Settings editor (no DOM, unit-tested in
 * tests/unit-tickets-org-locations.spec.ts). They mirror services/tickets/org_locations.py; the server checks everything again.
 */
import type { LocationInput, LocationsAnswer, OrgLocation, OrgLocationAdmin } from '../api/tickets-locations';

export const NAME_MAX = 40;
export const STREET_MAX = 60;
export const CITY_MAX = 30;
export const DETAILS_MAX = 200;
export const OTHER_MAX = 200;
/** The picker's "other (free text)" value; '' is "no location"; anything else is a location id. */
export const OTHER = '__other';

const SEP = ' · ';
// a URL that is not allowed in a location's text (services/tickets/message_templates.py `_URL`): a scheme, www., punycode, or a
// bare domain followed by a path
const URL_RE = /\b(?:https?:\/\/|www\.|xn--)|\b[\w-]+(?:\.[\w-]+)*\.[^\W\d_]{2,}\//iu;

const len = (s: string) => [...s].length;

export function addressLine(l: Pick<OrgLocation, 'street' | 'city'>): string {
  return [l.street, l.city].filter(Boolean).join(', ');
}

/** The full text (the request's pages): name · street, city · details. */
export function fullText(l: Pick<OrgLocation, 'name' | 'street' | 'city' | 'details'>): string {
  return [l.name, addressLine(l), l.details].filter(Boolean).join(SEP);
}

/** The `{location}` value of a vendor message (the server's message_text): name · street, city (+ · the map link when switched on). */
export function messageText(l: Pick<OrgLocation, 'name' | 'street' | 'city'> & { lat?: number | null; lng?: number | null }, nav = false): string {
  const parts = [l.name, addressLine(l)];
  if (nav && l.lat != null && l.lng != null) parts.push(navUrl(l.lat, l.lng));
  return parts.filter(Boolean).join(SEP);
}

export function navUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** The picker's choice for a new form: the department's default, else the organisation's, else "no location" - and "other" when
 * the organisation has no locations at all (the old free-text field, nothing regresses). A default that is not active is skipped. */
export function defaultPick(ans: LocationsAnswer | null, departmentId: string): string {
  if (!ans || !ans.locations.length) return OTHER;
  const ids = new Set(ans.locations.map((l) => l.id));
  const dept = ans.department_defaults[departmentId];
  if (dept && ids.has(dept)) return dept;
  if (ans.default_id && ids.has(ans.default_id)) return ans.default_id;
  return '';
}

/** The active locations in the picker's order (sort order, then name). */
export function pickerOptions(ans: LocationsAnswer | null): OrgLocation[] {
  return [...(ans?.locations ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** The creation body's part for a pick: a location reference, or the free text of "other", or nothing. */
export function locationBody(pick: string, other: string): { location_id?: string; place_text?: string } {
  if (pick === OTHER) {
    const text = other.trim();
    return text ? { place_text: text } : {};
  }
  return pick ? { location_id: pick } : {};
}

export function otherTooLong(pick: string, other: string): boolean {
  return pick === OTHER && len(other.trim()) > OTHER_MAX;
}

/** The text a preview shows for a pick (an RFQ invitation's place line). */
export function pickPreview(ans: LocationsAnswer | null, pick: string, other: string, nav = false): string {
  if (pick === OTHER) return other.trim();
  const l = ans?.locations.find((x) => x.id === pick);
  if (!l) return '';
  const base = messageText(l);
  return nav && l.map_url ? `${base}${SEP}${l.map_url}` : base;
}

/** Whether the navigation-link switch can be offered for a pick (a location with coordinates). */
export function navAvailable(ans: LocationsAnswer | null, pick: string): boolean {
  return !!ans?.locations.find((x) => x.id === pick)?.map_url;
}

// ---------------------------------------------------------------- the Settings editor

export interface LocationDraft {
  name: string;
  street: string;
  city: string;
  details: string;
  lat: string;
  lng: string;
  sort_order: string;
  active: boolean;
  is_default: boolean;
}

export type LocationField = 'name' | 'street' | 'city' | 'details' | 'coords' | 'default';
export type LocationProblem = 'required' | 'too_long' | 'duplicate' | 'address' | 'url' | 'coords' | 'inactive_default';

export function blankDraft(order = 0): LocationDraft {
  return { name: '', street: '', city: '', details: '', lat: '', lng: '', sort_order: String(order), active: true, is_default: false };
}

export function draftOf(l: OrgLocationAdmin): LocationDraft {
  return { name: l.name, street: l.street, city: l.city, details: l.details, lat: l.lat == null ? '' : String(l.lat), lng: l.lng == null ? '' : String(l.lng),
    sort_order: String(l.sort_order), active: l.active, is_default: l.is_default };
}

function coord(v: string, limit: number): number | null | undefined {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

export function locationProblems(d: LocationDraft, others: readonly Pick<OrgLocationAdmin, 'id' | 'name'>[], editingId: string | null): Partial<Record<LocationField, LocationProblem>> {
  const out: Partial<Record<LocationField, LocationProblem>> = {};
  const name = d.name.trim();
  if (!name) out.name = 'required';
  else if (len(name) > NAME_MAX) out.name = 'too_long';
  else if (URL_RE.test(name)) out.name = 'url';
  else if (others.some((o) => o.id !== editingId && o.name.trim().toLowerCase() === name.toLowerCase())) out.name = 'duplicate';
  for (const [k, max] of [['street', STREET_MAX], ['city', CITY_MAX], ['details', DETAILS_MAX]] as const) {
    const v = d[k].trim();
    if (len(v) > max) out[k] = 'too_long';
    else if (URL_RE.test(v)) out[k] = 'url';
  }
  if (!out.street && !out.city && !d.street.trim() && !d.city.trim()) out.street = 'address';
  const lat = coord(d.lat, 90);
  const lng = coord(d.lng, 180);
  if (lat === undefined || lng === undefined || (lat === null) !== (lng === null)) out.coords = 'coords';
  if (d.is_default && !d.active) out.default = 'inactive_default';
  return out;
}

/** The request body of a valid draft (create: every field; edit: the same fields - the server keeps what is unchanged). */
export function draftBody(d: LocationDraft, revision?: number): LocationInput {
  const lat = coord(d.lat, 90);
  const lng = coord(d.lng, 180);
  const order = Number.parseInt(d.sort_order, 10);
  return { name: d.name.trim(), street: d.street.trim(), city: d.city.trim(), details: d.details.trim(), lat: lat ?? null, lng: lng ?? null,
    sort_order: Number.isFinite(order) && order >= 0 ? Math.min(order, 9999) : 0, active: d.active, is_default: d.is_default && d.active,
    ...(revision ? { revision } : {}) };
}

/** A server field code (422 details.fields[].code / 409 code) in the editor's vocabulary. */
export function serverProblem(code: string): LocationProblem | null {
  switch (code) {
    case 'required': return 'required';
    case 'too_long': return 'too_long';
    case 'duplicate': case 'location_name_taken': return 'duplicate';
    case 'url_not_allowed': return 'url';
    case 'range': case 'pair': return 'coords';
    case 'inactive': return 'inactive_default';
    default: return null;
  }
}
