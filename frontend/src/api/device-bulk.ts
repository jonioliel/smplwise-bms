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
export type BulkKind = 'lights_off' | 'covers_close' | 'climate_off' | 'screens_off' | 'all_off';
export type BulkOutcome = 'queued' | 'accepted' | 'confirmed' | 'not_confirmed' | 'refused' | 'unknown';

export const BULK_KINDS: BulkKind[] = ['lights_off', 'covers_close', 'climate_off', 'screens_off', 'all_off'];

/** The mockup's menu wording (the quick actions of the floor menu, the area popover and the building buttons). */
export const BULK_KIND_LABEL: Record<BulkKind, string> = {
  lights_off: 'כבה תאורה',
  covers_close: 'סגור תריסים',
  climate_off: 'כבה מיזוג',
  screens_off: 'כבה מסכים',
  all_off: 'כבה הכל',
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
  not_confirmed: 'לא אושר',
  refused: 'נדחה / לא נשלח',
  unknown: 'תוצאה לא ידועה',
};

export function previewBulk(scope: BulkScope, id: string, kind: BulkKind) {
  const q = new URLSearchParams({ scope, id, kind });
  return get<BulkPreview>(`devices/actions/preview?${q.toString()}`);
}

/** The physical request. `confirmed: true` is stated here and nowhere else: only the dialog's confirm button calls it. */
export function runBulk(scope: BulkScope, id: string, kind: BulkKind, previewDigest: string) {
  return post<BulkRecord>('devices/actions', {
    scope,
    id,
    kind,
    confirmed: true,
    client_request_id: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    preview_digest: previewDigest,
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

/** What the bulk result says, honestly: "בוצע" only when every entity confirmed, never "everything is off". */
export function bulkHeadline(r: BulkRecord): { tone: 'ok' | 'partial' | 'none' | 'running'; text: string } {
  const c = r.counts;
  if (!r.done) return { tone: 'running', text: `${c.confirmed} מתוך ${c.total} אושרו` };
  if (c.total > 0 && c.confirmed === c.total) return { tone: 'ok', text: 'בוצע' };
  const missing = c.total - c.confirmed;
  if (c.confirmed === 0) return { tone: 'none', text: `לא בוצע: אף אחד מ־${c.total} ההתקנים לא אישר` };
  return { tone: 'partial', text: `בוצע חלקית: ${missing} לא אושרו` };
}
