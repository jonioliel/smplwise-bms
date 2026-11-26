/**
 * Bulk actions of the devices area (CR-007 slice 3): turn off the lights / close the covers / turn off the climate /
 * turn off the screens / turn everything off for the building, one HA floor or one HA area.
 *
 * The server decides everything that matters (routers/devices.py, services/device_bulk.py): the exact entity set
 * (never a lock, the alarm panel, a siren, a script, a scene, a button or a door), the permission at that scope, the
 * envelope, one HA action record per entity and the honest per-entity outcome. This file only asks for the preview the
 * confirmation dialog shows, sends the request with `confirmed: true` - called ONLY from that dialog's own confirm
 * button - and follows the record to its end.
 */
import { ApiError, get, post } from './client';
import { tr } from '../i18n/msg/api-devices';
import { isoZ } from './day-format';
import type * as Wire from './generated/wire-devices';

export type BulkScope = 'building' | 'floor' | 'area';
/** CR-007 slice 4: covers_open / covers_stop / covers_position are the area's own "כל התריסים" group control
 * (devices-area.ts), never offered in the floor/area/building quick-actions menu (BULK_KINDS below) - the
 * same bulk path (server resolve/record/run), a different trigger. */
export type BulkKind = 'lights_off' | 'covers_close' | 'covers_open' | 'covers_stop' | 'covers_position' | 'climate_off' | 'heating_off' | 'screens_off' | 'all_off' | 'switches_off' | 'switches_on' | 'lights_on' | 'screens_on';
/** "sent" (review MEDIUM 3): a record with nothing observable (cover.stop_cover and the like) is never "confirmed" -
 * accepted, and honestly reported as sent, matching the single-entity route's own "נשלח" (api/device-commands.ts). */
export type BulkOutcome = 'queued' | 'accepted' | 'confirmed' | 'sent' | 'not_confirmed' | 'refused' | 'unknown';

export const BULK_KINDS: BulkKind[] = ['lights_off', 'covers_close', 'climate_off', 'heating_off', 'screens_off', 'all_off'];
/** ALLON (owner 2026-10-10, "like there is turn-all-off there must be turn-all-on"): the floor / area quick-actions menu
 * offers "הדלק תאורה" right after "כבה תאורה". No "turn everything on" - what "on" means for climate, covers and screens is
 * not one thing - so "כבה הכל" has no mirror. */
export const BULK_MENU_KINDS: BulkKind[] = ['lights_off', 'lights_on', 'covers_close', 'climate_off', 'heating_off', 'screens_off', 'all_off'];
/** The kinds that turn something ON (the server's device_bulk.ON_KINDS): they look for devices that are off. */
export const BULK_ON_KINDS: ReadonlySet<BulkKind> = new Set<BulkKind>(['switches_on', 'lights_on', 'screens_on']);

/** The mockup's menu wording (the quick actions of the floor menu, the area popover and the building buttons), plus
 * the cover group control's own four (CR-007 slice 4). */
export const BULK_KIND_LABEL: Record<BulkKind, string> = {
  lights_off: tr('כבה תאורה'),
  covers_close: tr('סגור תריסים'),
  covers_open: tr('פתח תריסים'),
  covers_stop: tr('עצור תריסים'),
  covers_position: tr('מיקום תריסים'),
  climate_off: tr('כבה מיזוג'),
  heating_off: tr('כבה חימום'),
  screens_off: tr('כבה מסכים'),
  all_off: tr('כבה הכל'),
  // owner 2026-09-29: the tiles' panel master control
  switches_off: tr('כבה מתגים'),
  switches_on: tr('הדלק מתגים'),
  lights_on: tr('הדלק תאורה'),
  screens_on: tr('הדלק מסכים'),
};

export const BULK_SCOPE_LABEL: Record<BulkScope, string> = { building: tr('המבנה'), floor: tr('קומה'), area: tr('אזור') };

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/devices.py, generated into
 * ./generated/wire-devices.ts): a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: `scope`, `kind`, `status` and the outcome counts to their closed sets, `skipped` to its known keys. A bulk record's `items` are
 * typed here (the server declares them as documents: a media group operation reports per device, services/media_groups). Kept optional:
 * `server_time_ms` / `position` (an older server). */
export type BulkTarget = Omit<Wire.DeviceBulkTarget, 'args'>;

export interface BulkPreview extends Omit<Wire.DeviceBulkPreview, 'scope' | 'kind' | 'targets' | 'skipped' | 'server_time_ms' | 'position'> {
  scope: BulkScope;
  kind: BulkKind;
  targets: BulkTarget[];
  /** sensitive_type (SEC246 L2): typed valves / water heaters left out of "הדלק הכל" (also listed in `excluded`). */
  skipped: { already: number; unavailable: number; not_confirmed?: number; sensitive_type?: number };
  /** The server's clock (epoch ms) when it answered: the request's expiry is computed on the server's time line. */
  server_time_ms?: number;
  /** CR-007 slice 4: the requested position (covers_position only) - echoed back for the confirmation dialog. */
  position?: number | null;
}

interface BulkItem {
  entity_id: string;
  name: string;
  domain: string;
  area_name: string | null;
  action_id: string;
  outcome: BulkOutcome;
  status: string;
  error: string | null;
  observed_state: string | null;
  expected_state: string | null;
  sent: boolean;
}

export interface BulkRecord extends Omit<Wire.DeviceBulkRun, 'scope' | 'kind' | 'status' | 'counts' | 'items'> {
  scope: BulkScope;
  kind: BulkKind;
  status: 'sending' | 'waiting' | 'done';
  counts: Record<BulkOutcome, number> & { total: number };
  items: BulkItem[];
}

export const OUTCOME_LABEL: Record<BulkOutcome, string> = {
  queued: tr('ממתין לשליחה'),
  accepted: tr('נשלח · ממתין לדיווח'),
  confirmed: tr('אושר'),
  sent: tr('נשלח'),
  not_confirmed: tr('לא אושר'),
  refused: tr('נדחה / לא נשלח'),
  unknown: tr('תוצאה לא ידועה'),
};

/** Server clock minus this device's clock (ms), learned from each preview (the CR-005 mechanism, api/intercom.ts): the
 * request's expiry is computed on the SERVER's time line, so a tablet whose clock is off can still act - and still
 * cannot act late (review round 1: a device 2 s fast used to get 422 on every bulk). */
let serverOffsetMs = 0;

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

/** How long a bulk request stays valid on the server's clock (the CR-005 physical commands' own lifetime). */
const BULK_TTL_MS = 15_000;

function commandId(): string {
  // crypto.randomUUID exists only in secure contexts; HA reached over plain http on the LAN is not one
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** `only` (owner 2026-09-29, the tiles' panel filter / search): narrow the set to these entity ids - the server never
 * adds one. */
/** SWITCH-LIGHT-DIMMER-2331: `switches: 'all'` (lights kinds only) - the set takes every switch.* too (the synoptic floor lights popup). */
export async function previewBulk(scope: BulkScope, id: string, kind: BulkKind, position?: number, only?: string[], switches?: 'typed' | 'all', building?: string) {
  const sentAt = Date.now();
  const query = previewQuery(scope, id, kind, position, only, switches, building);
  const p = previewViaPost(query)
    ? await post<BulkPreview>('devices/actions/preview', previewBody(scope, id, kind, position, only, switches, building))
    : await get<BulkPreview>(`devices/actions/preview?${query}`);
  const receivedAt = Date.now();
  // the server read its clock somewhere during the round trip: assume the middle (error <= half the round trip)
  if (typeof p.server_time_ms === 'number') serverOffsetMs = p.server_time_ms - (sentAt + receivedAt) / 2;
  return p;
}

/** The preview's query. BUILDING-SCOPE-CONTROL-2351: `building` (a multi-building site, inside one building) - the server cuts the scope
 * to that building and refuses a scope / an id of another building (403 `outside_building`); absent or '' = the request exactly as before. */
export function previewQuery(scope: BulkScope, id: string, kind: BulkKind, position?: number, only?: string[], switches?: 'typed' | 'all', building?: string): string {
  const q = new URLSearchParams({ scope, id, kind });
  if (position !== undefined) q.set('position', String(position));
  if (only) q.set('only', only.join(','));
  if (switches === 'all') q.set('switches', 'all');
  if (building) q.set('building', building);
  return q.toString();
}

/** Integration review L8 (T097): HA Ingress caps the request line (about 8 KiB, its own path prefix included), and a narrowed tiles
 * panel's `only` can hold up to 500 entity ids. A preview query longer than this goes as `POST /devices/actions/preview` with the
 * same fields as JSON (the same reply); a shorter one stays the GET it always was. */
export const PREVIEW_GET_MAX = 2000;

export function previewViaPost(query: string): boolean {
  return query.length > PREVIEW_GET_MAX;
}

/** The POST preview's body: the fields of previewQuery, `switches` and `building` only when previewQuery would send them. */
export function previewBody(scope: BulkScope, id: string, kind: BulkKind, position?: number, only?: string[], switches?: 'typed' | 'all', building?: string) {
  return {
    scope,
    id,
    kind,
    ...(position !== undefined ? { position } : {}),
    ...(only ? { only } : {}),
    ...(switches === 'all' ? { switches } : {}),
    ...(building ? { building } : {}),
  };
}

/** The physical request. `confirmed: true` is stated here and nowhere else: only the dialog's confirm button calls
 * it. `position` (CR-007 slice 4): covers_position's own argument, the "כל התריסים" group control. */
export function runBulk(scope: BulkScope, id: string, kind: BulkKind, previewDigest: string, position?: number, only?: string[], switches?: 'typed' | 'all', building?: string) {
  return post<BulkRecord>('devices/actions', bulkBody(scope, id, kind, previewDigest, position, only, switches, building));
}

/** The body of `POST /devices/actions` (`building` as in previewQuery). */
export function bulkBody(scope: BulkScope, id: string, kind: BulkKind, previewDigest: string, position?: number, only?: string[], switches?: 'typed' | 'all', building?: string) {
  return {
    scope,
    id,
    kind,
    confirmed: true,
    client_request_id: commandId(),
    expires_at: isoZ(serverNow() + BULK_TTL_MS),
    preview_digest: previewDigest,
    ...(position !== undefined ? { position } : {}),
    ...(only ? { only } : {}),
    ...(switches === 'all' ? { switches } : {}),
    ...(building ? { building } : {}),
  };
}

export const getBulk = (bulkId: string) => get<BulkRecord>(`devices/actions/${encodeURIComponent(bulkId)}`);

/** STALE-ANSWERS-2540 (review SCR-19, last sentence): a status read that never reached the server or came back from a proxy that
 * could not reach it (no connection, 502 / 503 / 504, or an answer the server marks retryable). The bulk run itself goes on on the server,
 * so such a miss is no reason to call the run failed: the next read is tried as usual. */
function pollMissed(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch: no connection
  return err instanceof ApiError && (err.status === 502 || err.status === 503 || err.status === 504 || err.body.retryable === true);
}

/** The clock and the read followBulk uses (the unit spec drives them by hand). */
interface FollowDeps {
  read: (id: string) => Promise<BulkRecord>;
  wait: (ms: number) => Promise<void>;
  now: () => number;
}
const followDeps: FollowDeps = { read: (id) => getBulk(id), wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now: () => Date.now() };

/** Follow a bulk record until the server says `done` (every entity confirmed or its window passed), reporting each read.
 * STALE-ANSWERS-2540: a missed read (`pollMissed`) keeps the last record - the dialog still says "running" - and polling goes on until
 * the same deadline; any other refusal (403, 404...) ends the follow with that error, as before. */
export async function followBulk(first: BulkRecord, onUpdate: (r: BulkRecord) => void, signal?: { stopped: boolean }, deps: FollowDeps = followDeps): Promise<BulkRecord> {
  let r = first;
  onUpdate(r);
  const deadline = deps.now() + 120_000;
  while (!r.done && !signal?.stopped && deps.now() < deadline) {
    await deps.wait(700);
    try {
      r = await deps.read(r.id);
    } catch (err) {
      if (!pollMissed(err)) throw err;
      continue; // the run goes on on the server: read again at the next round
    }
    onUpdate(r);
  }
  return r;
}

/** What the bulk result says, honestly: "בוצע" only when every entity confirmed, never "everything is off".
 * "sent" entities (nothing observable, e.g. stop) are neither confirmed nor failed: a set that is all confirmed or
 * sent with at least one sent reads "נשלח", and they are never counted as missing. */
export function bulkHeadline(r: BulkRecord): { tone: 'ok' | 'partial' | 'none' | 'running'; text: string } {
  const c = r.counts;
  const sent = c.sent ?? 0;
  if (!r.done) return { tone: 'running', text: tr('{confirmed} מתוך {total} אושרו', { confirmed: c.confirmed, total: c.total }) };
  if (c.total > 0 && c.confirmed === c.total) return { tone: 'ok', text: tr('בוצע') };
  if (c.total > 0 && c.confirmed + sent === c.total) return { tone: 'ok', text: sent === c.total ? tr('נשלח') : tr('בוצע (חלק נשלחו ללא אישור)') };
  const missing = c.total - c.confirmed - sent;
  if (c.confirmed + sent === 0) return { tone: 'none', text: tr('לא בוצע: אף אחד מ־{total} ההתקנים לא אישר', { total: c.total }) };
  return { tone: 'partial', text: tr('בוצע חלקית: {missing} לא אושרו', { missing }) };
}
