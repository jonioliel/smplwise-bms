/**
 * CR-036 S7: the pure logic of the native people screen - no DOM, no fetch, nothing imported at run time but one zone helper -
 * so it is unit-tested in Node (tests/unit-people-logic.spec.ts):
 *   - the screen's filters / search / sort / paging as the query string of GET /access-control/people (stable order, empties
 *     left out, a profile filter as repeated `profile=<field>=<value>`);
 *   - what the caller may FILTER by (the credential and profile filters are sensitive-level: the screen never offers them
 *     otherwise, and the server refuses them with an audited 403);
 *   - merging pages ("load more" appends, a restart replaces, a person already shown is replaced in place, never repeated);
 *   - what a person's page shows per LEVEL (names / sensitive): a sensitive field is rendered only for a sensitive-level person,
 *     even if a value were present - the server is the authority, the screen never second-guesses it upwards;
 *   - the table's columns and which of them a caller is offered (the credentials column is sensitive-level; the employee number
 *     column follows the administrator's setting through `employee_no_visible`);
 *   - the person's state, validity and sync status words, and the small selection helpers of the bulk bar.
 */
import type { AcPeoplePage, AcPeopleSort, AcPerson } from '../api/access-people';
import { offsetAt, UTC_ZONE } from '../screens/wiskey-format';
import type { DisplayZone } from '../api/intercom';

export const PEOPLE_PAGE = 50;
export const PEOPLE_MAX_LIMIT = 200;
export const MAX_QUERY = 160;
export const MAX_PROFILE_FILTERS = 8;

export type PeopleRights = 'assigned' | 'unassigned' | 'disabled';
export type PeopleState = 'active' | 'inactive' | 'expired' | 'upcoming' | 'archived';
export type PeopleCredential = 'pin' | 'no_pin' | 'card' | 'no_card';

export const RIGHTS: readonly PeopleRights[] = ['assigned', 'unassigned', 'disabled'];
export const STATES: readonly PeopleState[] = ['active', 'inactive', 'expired', 'upcoming', 'archived'];
export const CREDENTIALS: readonly PeopleCredential[] = ['pin', 'no_pin', 'card', 'no_card'];
export const SORTS: readonly AcPeopleSort[] = ['name', 'name_desc', 'employee'];

export interface PeopleFilters {
  station?: string;
  group?: string;
  rights?: PeopleRights;
  state?: PeopleState;
  /** Sensitive level only. */
  credential?: PeopleCredential;
  /** Sensitive level only: exact profile field values, `field id -> value`. */
  profile?: Record<string, string>;
  sort?: AcPeopleSort;
}

export interface PeopleRequest {
  query: string;
  filters: PeopleFilters;
  offset: number;
  limit: number;
  /** The previous page's `snapshot` ('' on a fresh start): the reply says `stale` when the directory moved since. */
  snapshot: string;
}

/** What a caller is allowed to filter by. Mirrors the server: `people` for the ordinary filters, `sensitive` for the field ones. */
export interface FilterAccess {
  people: boolean;
  sensitive: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? Math.trunc(n) : lo));

/** The ordered `[name, value]` pairs of a request. Empty values are left out; a profile filter is one pair per field, sorted by field
 * id (so the same filter set always makes the same URL - the cache and the tests rely on it). */
export function peopleParams(req: PeopleRequest): [string, string][] {
  const out: [string, string][] = [];
  const query = req.query.trim().slice(0, MAX_QUERY);
  if (query) out.push(['query', query]);
  const f = req.filters;
  if (f.station) out.push(['station', f.station]);
  if (f.group) out.push(['group', f.group]);
  if (f.rights) out.push(['rights', f.rights]);
  if (f.state) out.push(['state', f.state]);
  if (f.credential) out.push(['credential', f.credential]);
  for (const [field, value] of Object.entries(f.profile ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).slice(0, MAX_PROFILE_FILTERS)) {
    if (field && value) out.push(['profile', `${field}=${value}`]);
  }
  if (f.sort) out.push(['sort', f.sort]);
  out.push(['offset', String(clamp(req.offset, 0, 10_000_000))]);
  out.push(['limit', String(clamp(req.limit, 1, PEOPLE_MAX_LIMIT))]);
  if (req.snapshot) out.push(['snapshot', req.snapshot.slice(0, 64)]);
  return out;
}

export function peopleQueryString(req: PeopleRequest): string {
  const qs = new URLSearchParams();
  for (const [k, v] of peopleParams(req)) qs.append(k, v);
  return qs.toString();
}

/** The filters this caller may use: the field filters need the sensitive level, any filter needs `people`. A filter the caller
 * cannot use is dropped (the screen does not offer it either; the server would answer 403). The sort is always kept. */
export function sanitizeFilters(filters: PeopleFilters, access: FilterAccess): PeopleFilters {
  const out: PeopleFilters = { ...(filters.sort ? { sort: filters.sort } : {}) };
  if (!access.people) return out;
  if (filters.station) out.station = filters.station;
  if (filters.group) out.group = filters.group;
  if (filters.rights && RIGHTS.includes(filters.rights)) out.rights = filters.rights;
  if (filters.state && STATES.includes(filters.state)) out.state = filters.state;
  if (access.sensitive) {
    if (filters.credential && CREDENTIALS.includes(filters.credential)) out.credential = filters.credential;
    const profile = Object.fromEntries(Object.entries(filters.profile ?? {}).filter(([k, v]) => k && v).slice(0, MAX_PROFILE_FILTERS));
    if (Object.keys(profile).length) out.profile = profile;
  }
  return out;
}

/** How many filters are active (the sort is not a filter). */
export function filterCount(query: string, filters: PeopleFilters): number {
  const f = filters;
  return (query.trim() ? 1 : 0) + [f.station, f.group, f.rights, f.state, f.credential].filter(Boolean).length + Object.keys(f.profile ?? {}).length;
}

export const isFiltered = (query: string, filters: PeopleFilters) => filterCount(query, filters) > 0;

/** "Clear filters": every filter and the text go, the sort stays. */
export function clearedFilters(filters: PeopleFilters): PeopleFilters {
  return filters.sort ? { sort: filters.sort } : {};
}

/** Set or clear (empty value) one ordinary filter; a profile field is set with `setProfileFilter`. */
export function withFilter(filters: PeopleFilters, key: 'station' | 'group' | 'rights' | 'state' | 'credential' | 'sort', value: string): PeopleFilters {
  const next: PeopleFilters = { ...filters };
  if (value) (next as Record<string, unknown>)[key] = value;
  else delete next[key];
  return next;
}

export function setProfileFilter(filters: PeopleFilters, field: string, value: string): PeopleFilters {
  const profile = { ...(filters.profile ?? {}) };
  if (field && value) profile[field] = value;
  else delete profile[field];
  const next: PeopleFilters = { ...filters, profile };
  if (!Object.keys(profile).length) delete next.profile;
  return next;
}

// ---------------------------------------------------------------- paging

/** The rows after a page arrives. `replace` (a new query, a restart): the page. `append` ("load more"): the rows already shown,
 * then the page's - a person already shown is replaced by the fresher copy in place, never repeated. */
export function mergeRows(shown: readonly AcPerson[], incoming: readonly AcPerson[], mode: 'replace' | 'append'): AcPerson[] {
  if (mode === 'replace') return dedupe(incoming);
  const fresh = new Map(incoming.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: AcPerson[] = [];
  for (const p of shown) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(fresh.get(p.id) ?? p);
  }
  for (const p of incoming) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function dedupe(list: readonly AcPerson[]): AcPerson[] {
  const seen = new Set<string>();
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** The offset of the next "load more" request: the server's `next_offset`, or null at the end. A page that did not move the offset
 * forward (a clamped past-the-end request) ends the paging rather than loop. */
export function nextOffset(page: Pick<AcPeoplePage, 'next_offset' | 'offset'>): number | null {
  const next = page.next_offset;
  if (next === null || next === undefined) return null;
  return next > (page.offset ?? 0) ? next : null;
}

export interface CountLine {
  shown: number;
  total: number | null;
  /** `total` is a lower bound (the scan stopped early). */
  minimum: boolean;
  /** The size of the whole directory - only when the caller may know it and a filter is active. */
  of: number | null;
}

export function countLine(shown: number, page: Pick<AcPeoplePage, 'total' | 'total_all' | 'complete'> | null, filtered: boolean): CountLine {
  const total = page?.total ?? null;
  return { shown, total, minimum: !!page && !page.complete, of: filtered && page?.total_all !== null && page?.total_all !== undefined ? page.total_all : null };
}

// ---------------------------------------------------------------- what a person's page shows, per level

export interface PersonSections {
  /** The "sensitive details" section exists at all (absent, not greyed, for a names-level person). */
  sensitive: boolean;
  employeeNo: boolean;
  credentials: boolean;
  phone: boolean;
  photo: boolean;
  profile: boolean;
  responsible: boolean;
  purpose: boolean;
}

/** Which parts of a person's page are rendered. Everything sensitive requires `level === 'sensitive'`; a value that is null on a
 * sensitive-level person is unknown and still has its row (as "unknown"), except the profile (rows only for values present). */
export function personSections(p: AcPerson): PersonSections {
  const s = p.level === 'sensitive';
  return {
    sensitive: s,
    employeeNo: p.employee_no !== null,
    credentials: s,
    phone: s,
    photo: s && p.photo_configured !== null,
    profile: s && !!p.profile && Object.keys(p.profile).length > 0,
    responsible: s && !!p.responsible_person,
    purpose: s && !!p.access_purpose,
  };
}

export type CredentialKind = 'card' | 'pin';

/** The credential kinds a sensitive-level person has (for the icons of a row): null = not shown / unknown. */
export function credentialKinds(p: Pick<AcPerson, 'level' | 'credentials'>): { kinds: CredentialKind[]; cards: number; none: boolean } | null {
  if (p.level !== 'sensitive' || !p.credentials) return null;
  const cards = p.credentials.cards ?? 0;
  const kinds: CredentialKind[] = [];
  if (cards > 0) kinds.push('card');
  if (p.credentials.pin === true) kinds.push('pin');
  const known = p.credentials.cards !== null || p.credentials.pin !== null;
  return { kinds, cards, none: known && kinds.length === 0 && p.credentials.cards === 0 && p.credentials.pin === false };
}

/** A phone number with all but the last two digits hidden - for a caller who may see it but has not asked to. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '•'.repeat(Math.max(3, phone.length));
  return `${'•'.repeat(Math.max(3, digits.length - 2))}${digits.slice(-2)}`;
}

// ---------------------------------------------------------------- state, validity, sync words

/** The person's single state: archived > inactive > expired > upcoming > active. The window states need the clock. */
export function stateOf(p: Pick<AcPerson, 'archived' | 'active' | 'valid_from' | 'valid_until'>, now = Date.now()): PeopleState {
  if (p.archived) return 'archived';
  if (!p.active) return 'inactive';
  const v = validityState(p, now);
  if (v === 'validity_expired') return 'expired';
  if (v === 'validity_future') return 'upcoming';
  return 'active';
}

export type ValidityState = 'permanent' | 'validity_unknown' | 'validity_future' | 'validity_expired' | 'validity_current';

/** WisKey panel.ts `validitySummary(user)`, the state part: no window at all is `permanent`; a half or inverted window is
 * `validity_unknown`; else where `now` falls against it. */
export function validityState(p: Pick<AcPerson, 'valid_from' | 'valid_until'>, now = Date.now()): ValidityState {
  const start = p.valid_from ? Date.parse(p.valid_from) : null;
  const end = p.valid_until ? Date.parse(p.valid_until) : null;
  if (start === null && end === null) return 'permanent';
  if (start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'validity_unknown';
  return now < start ? 'validity_future' : now >= end ? 'validity_expired' : 'validity_current';
}

/** A day (dd.mm.yyyy) of an instant in the display zone - the zone the station's clock is in, never a fixed offset. */
export function formatDay(value: string | null | undefined, zone: DisplayZone = UTC_ZONE): string {
  if (!value || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)) return '';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Date(ms + offsetAt(ms, zone) * 1000).toLocaleDateString('he-IL', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '.');
  } catch {
    return '';
  }
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict' | 'error' | 'delete_pending' | 'offline' | 'unknown' | 'unassigned';

const SYNC_ORDER: SyncStatus[] = ['conflict', 'error', 'syncing', 'pending', 'delete_pending', 'offline'];
const SYNC_KNOWN = new Set<string>(['synced', 'pending', 'syncing', 'conflict', 'error', 'delete_pending', 'offline']);

/** The person's overall sync status over the stations the caller sees: the worst of conflict / error / syncing / pending /
 * delete_pending / offline, else `synced`; `unassigned` without any visible assignment; `unknown` for a state Arx does not know. */
export function personSyncStatus(p: Pick<AcPerson, 'stations'>): SyncStatus {
  const stations = p.stations;
  if (!stations || stations.length === 0) return 'unassigned';
  const values = stations.map((s) => (s.sync_state === null ? 'unknown' : SYNC_KNOWN.has(s.sync_state) ? s.sync_state : 'unknown'));
  const worst = SYNC_ORDER.find((v) => values.includes(v));
  if (worst) return worst;
  return values.includes('unknown') ? 'unknown' : 'synced';
}

/** Enabled assignments - what "N תחנות" counts. */
export const enabledStations = (p: Pick<AcPerson, 'stations'>): number => (p.stations ?? []).filter((s) => s.enabled).length;

// ---------------------------------------------------------------- columns and views

export type ColumnKey = 'name' | 'employee' | 'groups' | 'stations' | 'credentials' | 'validity' | 'state' | 'sync';
export const COLUMN_KEYS: readonly ColumnKey[] = ['name', 'employee', 'groups', 'stations', 'credentials', 'validity', 'state', 'sync'];
export const DEFAULT_COLUMNS: readonly ColumnKey[] = ['name', 'employee', 'groups', 'stations', 'credentials', 'validity', 'state'];
const SENSITIVE_COLUMNS = new Set<ColumnKey>(['credentials']);

/** The columns a caller is offered (the chooser lists exactly these): the credentials column is sensitive-level; the employee
 * number column only while the caller sees every number. */
export function offeredColumns(access: { sensitive: boolean }, employeeNoVisible: boolean): ColumnKey[] {
  return COLUMN_KEYS.filter((k) => (access.sensitive || !SENSITIVE_COLUMNS.has(k)) && (employeeNoVisible || k !== 'employee'));
}

/** The columns to draw: the stored choice (or the default) cut to what is offered, the name first and always. */
export function visibleColumns(chosen: readonly ColumnKey[] | null, access: { sensitive: boolean }, employeeNoVisible: boolean): ColumnKey[] {
  const offered = offeredColumns(access, employeeNoVisible);
  const wanted = (chosen ?? DEFAULT_COLUMNS).filter((k) => offered.includes(k));
  const rest = COLUMN_KEYS.filter((k) => wanted.includes(k));
  return rest.includes('name') ? rest : ['name', ...rest];
}

export function toggleColumn(chosen: readonly ColumnKey[] | null, key: ColumnKey, access: { sensitive: boolean }, employeeNoVisible: boolean): ColumnKey[] {
  const current = visibleColumns(chosen, access, employeeNoVisible);
  if (key === 'name' || !offeredColumns(access, employeeNoVisible).includes(key)) return current; // the name stays; a column not offered cannot be added
  return current.includes(key) ? current.filter((k) => k !== key) : COLUMN_KEYS.filter((k) => k === key || current.includes(k));
}

/** A stored column choice (JSON in the browser's storage): anything unexpected is no choice (the default applies). */
export function parseColumnPrefs(raw: string | null): ColumnKey[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const keys = value.filter((k): k is ColumnKey => typeof k === 'string' && (COLUMN_KEYS as readonly string[]).includes(k));
    return keys.length ? keys : null;
  } catch {
    return null;
  }
}

export type PeopleView = 'cards' | 'list' | 'table';
export const VIEWS: readonly PeopleView[] = ['cards', 'list', 'table'];

export function parseView(raw: string | null): PeopleView | null {
  return raw !== null && (VIEWS as readonly string[]).includes(raw) ? (raw as PeopleView) : null;
}

/** The view actually drawn: the phone has no table (DESIGN_CONTRACT), so a stored "table" falls back to the list there. */
export function effectiveView(view: PeopleView | null, phone: boolean): PeopleView {
  const v = view ?? (phone ? 'list' : 'table');
  return v === 'table' && phone ? 'list' : v;
}

// ---------------------------------------------------------------- selection (the bulk bar)

export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** The ids of `rows` that are all selected / none / some, for the header checkbox. */
export function selectionState(selected: ReadonlySet<string>, rows: readonly AcPerson[]): 'none' | 'some' | 'all' {
  if (!rows.length) return 'none';
  const n = rows.filter((r) => selected.has(r.id)).length;
  return n === 0 ? 'none' : n === rows.length ? 'all' : 'some';
}

export function toggleAll(selected: ReadonlySet<string>, rows: readonly AcPerson[]): Set<string> {
  return selectionState(selected, rows) === 'all' ? new Set([...selected].filter((id) => !rows.some((r) => r.id === id))) : new Set([...selected, ...rows.map((r) => r.id)]);
}

/** After a reload the selection keeps only people still listed. */
export function pruneSelection(selected: ReadonlySet<string>, rows: readonly AcPerson[]): Set<string> {
  const ids = new Set(rows.map((r) => r.id));
  return new Set([...selected].filter((id) => ids.has(id)));
}

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
};
