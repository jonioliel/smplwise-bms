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
import { get, post } from './client';

export type BulkScope = 'building' | 'floor' | 'area';
/** CR-007 slice 4: covers_open / covers_stop / covers_position are the area's own "כל התריסים" group control
 * (devices-area.ts), never offered in the floor/area/building quick-actions menu (BULK_KINDS below) - the
 * same bulk path (server resolve/record/run), a different trigger. */
export type BulkKind = 'lights_off' | 'covers_close' | 'covers_open' | 'covers_stop' | 'covers_position' | 'climate_off' | 'heating_off' | 'screens_off' | 'all_off' | 'switches_off' | 'switches_on' | 'lights_on' | 'screens_on';
/** "sent" (review MEDIUM 3): a record with nothing observable (cover.stop_cover and the like) is never "confirmed" -
 * accepted, and honestly reported as sent, matching the single-entity route's own "נשלח" (api/device-commands.ts). */
export type BulkOutcome = 'queued' | 'accepted' | 'confirmed' | 'sent' | 'not_confirmed' | 'refused' | 'unknown';

export const BULK_KINDS: BulkKind[] = ['lights_off', 'covers_close', 'climate_off', 'heating_off', 'screens_off', 'all_off'];
/** The cover group control's own four actions (devices-area.ts): open all / stop all / close all / position all. */
export const COVER_GROUP_KINDS: BulkKind[] = ['covers_open', 'covers_stop', 'covers_close', 'covers_position'];

/** The mockup's menu wording (the quick actions of the floor menu, the area popover and the building buttons), plus
 * the cover group control's own four (CR-007 slice 4). */
export const BULK_KIND_LABEL: Record<BulkKind, string> = {
  lights_off: 'כבה תאורה',
  covers_close: 'סגור תריסים',
  covers_open: 'פתח תריסים',
  covers_stop: 'עצור תריסים',
  covers_position: 'מיקום תריסים',
  climate_off: 'כבה מיזוג',
  heating_off: 'כבה חימום',
  screens_off: 'כבה מסכים',
  all_off: 'כבה הכל',
  // owner 2026-09-29: the tiles' panel master control
  switches_off: 'כבה מתגים',
  switches_on: 'הדלק מתגים',
  lights_on: 'הדלק תאורה',
  screens_on: 'הדלק מסכים',
};

export const BULK_SCOPE_LABEL: Record<BulkScope, string> = { building: 'המבנה', floor: 'קומה', area: 'אזור' };

export interface BulkTarget {
  entity_id: string;
  name: string;
  domain: string;
  action_id: string;
  state: string | null;
  area_id: string | null;
  area_name: string | null;
}

export interface BulkPreview {
  scope: BulkScope;
  id: string;
  name: string;
  floor_name: string | null;
  kind: BulkKind;
  kind_label: string;
  count: number;
  targets: BulkTarget[];
  by_domain: Record<string, number>;
  domain_labels: Record<string, string>;
  skipped: { already: number; unavailable: number };
  excluded: { entity_id: string; name: string; domain: string; reason: string; reason_label: string }[];
  never_included: Record<string, number>;
  digest: string;
  note: string;
  /** The server's clock (epoch ms) when it answered: the request's expiry is computed on the server's time line. */
  server_time_ms?: number;
  /** CR-007 slice 4: the requested position (covers_position only) - echoed back for the confirmation dialog. */
  position?: number | null;
}

export interface BulkItem {
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

export interface BulkRecord {
  id: string;
  scope: BulkScope;
  scope_id: string;
  scope_name: string | null;
  kind: BulkKind;
  kind_label: string;
  status: 'sending' | 'waiting' | 'done';
  done: boolean;
  all_confirmed: boolean;
  counts: Record<BulkOutcome, number> & { total: number };
  items: BulkItem[];
  note: string;
}

export const OUTCOME_LABEL: Record<BulkOutcome, string> = {
  queued: 'ממתין לשליחה',
  accepted: 'נשלח · ממתין לדיווח',
  confirmed: 'אושר',
  sent: 'נשלח',
  not_confirmed: 'לא אושר',
  refused: 'נדחה / לא נשלח',
  unknown: 'תוצאה לא ידועה',
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
export async function previewBulk(scope: BulkScope, id: string, kind: BulkKind, position?: number, only?: string[]) {
  const q = new URLSearchParams({ scope, id, kind });
  if (position !== undefined) q.set('position', String(position));
  if (only) q.set('only', only.join(','));
  const sentAt = Date.now();
  const p = await get<BulkPreview>(`devices/actions/preview?${q.toString()}`);
  const receivedAt = Date.now();
  // the server read its clock somewhere during the round trip: assume the middle (error <= half the round trip)
  if (typeof p.server_time_ms === 'number') serverOffsetMs = p.server_time_ms - (sentAt + receivedAt) / 2;
  return p;
}

/** The physical request. `confirmed: true` is stated here and nowhere else: only the dialog's confirm button calls
 * it. `position` (CR-007 slice 4): covers_position's own argument, the "כל התריסים" group control. */
export function runBulk(scope: BulkScope, id: string, kind: BulkKind, previewDigest: string, position?: number, only?: string[]) {
  return post<BulkRecord>('devices/actions', {
    scope,
    id,
    kind,
    confirmed: true,
    client_request_id: commandId(),
    expires_at: new Date(serverNow() + BULK_TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    preview_digest: previewDigest,
    ...(position !== undefined ? { position } : {}),
    ...(only ? { only } : {}),
  });
}

export const getBulk = (bulkId: string) => get<BulkRecord>(`devices/actions/${encodeURIComponent(bulkId)}`);

/** Follow a bulk record until the server says `done` (every entity confirmed or its window passed), reporting each read. */
export async function followBulk(first: BulkRecord, onUpdate: (r: BulkRecord) => void, signal?: { stopped: boolean }): Promise<BulkRecord> {
  let r = first;
  onUpdate(r);
  const deadline = Date.now() + 120_000;
  while (!r.done && !signal?.stopped && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    r = await getBulk(r.id);
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
  if (!r.done) return { tone: 'running', text: `${c.confirmed} מתוך ${c.total} אושרו` };
  if (c.total > 0 && c.confirmed === c.total) return { tone: 'ok', text: 'בוצע' };
  if (c.total > 0 && c.confirmed + sent === c.total) return { tone: 'ok', text: sent === c.total ? 'נשלח' : 'בוצע (חלק נשלחו ללא אישור)' };
  const missing = c.total - c.confirmed - sent;
  if (c.confirmed + sent === 0) return { tone: 'none', text: `לא בוצע: אף אחד מ־${c.total} ההתקנים לא אישר` };
  return { tone: 'partial', text: `בוצע חלקית: ${missing} לא אושרו` };
}
