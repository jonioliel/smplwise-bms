/**
 * Pure helpers of the WisKey door Settings cards (CR-033 wave 1, system-doors.ts) - no DOM, unit-tested in Node
 * (tests/unit-door-settings.spec.ts). Hebrew copy lives here so the cards and the spec read the same words.
 */
import type { DoorGrantRole, DoorGrantSubject, DoorMap, DoorMapLock, DoorPathInventory, DoorPathItem } from '../api/doors';

/** The built-in roles' read-only answer in the "תפקידים" section (owner default: no built-in role changes by a switch). */
export function builtinAnswer(role: DoorGrantRole): string {
  if (role.answer === 'never') return 'לעולם לא';
  if (role.answer === 'yes' || role.includes) return 'כן';
  return 'לא - אפשר לתת למשתמשים בנפרד';
}

/**
 * What the door permission also allows (SEC-WXD L3): `access.read` opens the intercom screen with its entry log and people
 * directory. Said in every granting question until the owner decides on a door-only permission. Since 2.4.9 (owner decision
 * 2026-10-13) calls and announcements ride `access.call`, not `access.release`, so the door grant no longer carries them.
 */
export const GRANT_ALSO = 'ההרשאה כוללת גם צפייה ביומן הכניסות ובאנשי הקשר של האינטרקום.';

/** The question each sensitive switch asks before it is sent (one short confirmation). */
export function grantQuestion(name: string, enabled: boolean): string {
  return enabled ? `לתת ל${name} הרשאה לפתוח דלתות? ${GRANT_ALSO}` : `להסיר מ${name} את ההרשאה לפתוח דלתות?`;
}

export function roleQuestion(name: string, enabled: boolean): string {
  return enabled ? `לכלול פתיחת דלתות בתפקיד ${name}? ${GRANT_ALSO}` : `להסיר פתיחת דלתות מהתפקיד ${name}?`;
}

/** The line under a subject: what else lets them open ("שיוך אחר"), by role and scope name - never ids. */
export function otherGrants(s: DoorGrantSubject): string {
  if (!s.other.length) return '';
  return `שיוך אחר: ${s.other.map((o) => `${o.role_name} · ${o.scope_name}`).join(', ')}`;
}

/** Subjects filtered by a free-text search over their names (the card lists every user and group). */
export function filterSubjects(rows: DoorGrantSubject[], q: string): DoorGrantSubject[] {
  const needle = q.trim().toLowerCase();
  return needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows;
}

/** A placement select's value: `building:<id>`, `site:<id>` or '' (the whole installation). */
export function placementValue(p: { site_id: string | null; building_id: string | null } | null): string {
  if (!p) return '';
  if (p.building_id) return `building:${p.building_id}`;
  return p.site_id ? `site:${p.site_id}` : '';
}

export function parsePlacement(value: string): { site_id: string | null; building_id: string | null } {
  if (value.startsWith('building:')) return { site_id: null, building_id: value.slice(9) };
  if (value.startsWith('site:')) return { site_id: value.slice(5), building_id: null };
  return { site_id: null, building_id: null };
}

/** The placement options: the whole installation, every site, every building under its site. */
export function placementOptions(map: DoorMap): { value: string; label: string }[] {
  const out = [{ value: '', label: 'כל ההתקנה (ללא שיוך)' }];
  for (const s of map.sites) {
    out.push({ value: `site:${s.id}`, label: `אתר · ${s.name}` });
    for (const b of map.buildings.filter((x) => x.site_id === s.id)) out.push({ value: `building:${b.id}`, label: `${s.name} · ${b.name}` });
  }
  return out;
}

/** The relays a lock may be mapped to: the relays of its own station when its registry names one, else of every station. */
export function relayOptions(map: DoorMap, lock: DoorMapLock): { value: string; label: string }[] {
  const stations = lock.station_id ? map.stations.filter((s) => s.id === lock.station_id) : map.stations;
  const out: { value: string; label: string }[] = [];
  for (const s of stations) {
    for (const r of s.relays) out.push({ value: `${s.id}#${r.physical_index}`, label: `${s.name} · ${r.name || `ממסר ${r.physical_index}`}` });
  }
  return out;
}

export function parseRelay(value: string): { station_id: string; relay: number } | null {
  const i = value.lastIndexOf('#');
  if (i <= 0) return null;
  const relay = Number(value.slice(i + 1));
  return Number.isInteger(relay) && relay >= 1 ? { station_id: value.slice(0, i), relay } : null;
}

/** A lock's mapping state as the "שיוך דלתות" card says it. */
export function mappingState(lock: DoorMapLock): { tone: 'live' | 'stale' | 'unknown'; text: string } {
  if (lock.mapping && lock.mapping.valid) return { tone: 'live', text: lock.mapping.source === 'manual' ? 'משויך ידנית' : 'משויך' };
  if (lock.mapping) return { tone: 'stale', text: 'השיוך אינו תקף כרגע - יש לשייך מחדש' };
  if (lock.suggestion) return { tone: 'unknown', text: 'הצעה לשיוך מוכנה' };
  return { tone: 'unknown', text: 'לא משויך - הדלת לא תיפתח מ-Arx' };
}

// ---------------------------------------------------------------- the read-only door-path inventory (CR-033 D7)

export type InventoryFilter = 'all' | 'blocked' | 'disable' | 'review';

export const INVENTORY_FILTERS: { id: InventoryFilter; label: string }[] = [
  { id: 'all', label: 'הכול' },
  { id: 'blocked', label: 'הרצה נחסמת' },
  { id: 'disable', label: 'דורש השבתה' },
  { id: 'review', label: 'לבדיקה ידנית' },
];

/** The items a filter chip shows. */
export function filterInventory(items: DoorPathItem[], filter: InventoryFilter): DoorPathItem[] {
  if (filter === 'blocked') return items.filter((i) => i.run_guard !== 'unchanged');
  if (filter === 'disable') return items.filter((i) => i.disable_required);
  if (filter === 'review') return items.filter((i) => i.run_guard === 'refused_unresolvable');
  return items;
}

/** The card's one-line summary. */
export function inventorySummary(inv: DoorPathInventory): string {
  if (!inv.wiskey_present) return 'אין דלתות אינטרקום בהתקנה';
  const c = inv.counts;
  if (!c.items) return 'אין פריטים שפותחים דלתות';
  const parts = [`${c.items} פריטים`, `${c.door_steps} שלבי פתיחה`];
  if (c.unresolvable) parts.push(`${c.unresolvable} לבדיקה ידנית`);
  if (c.disable_required) parts.push(`${c.disable_required} דורשים השבתה`);
  return parts.join(' · ');
}

const STATE_TEXT: Record<DoorPathItem['state'], string> = { enabled: 'פעיל', disabled: 'מושבת', ready: 'זמין', gone: 'נמחק', unknown: 'מצב לא ידוע' };

/** The line under an item's name: its kind, where it came from and its state. */
export function itemMeta(item: DoorPathItem): string {
  return [item.kind_text, item.origin_text, STATE_TEXT[item.state]].join(' · ');
}

/** Who wrote it and who approved the live version. */
export function peopleLine(item: DoorPathItem): string {
  const author = item.author ? `נכתב בידי ${item.author}` : 'כותב לא ידוע';
  const approver = item.approver ? `אושר בידי ${item.approver}${item.approver_status === 'approved' ? '' : ` (${item.approver_text})`}` : item.approver_text;
  return `${author} · ${approver}`;
}

/** The last run, given a formatter for the instant (the screen passes its locale formatter). */
export function lastRunText(item: DoorPathItem, fmt: (iso: string) => string): string {
  return item.last_run ? `הרצה אחרונה: ${fmt(item.last_run.at)}` : 'לא הורץ';
}

/** The doors an item opens, by name (or how many steps when no door is known). */
export function doorsText(item: DoorPathItem): string {
  if (item.doors.length) return item.doors.join(', ');
  if (item.door_steps) return `${item.door_steps} שלבי פתיחה`;
  if (item.lock_steps) return `${item.lock_steps} שלבי נעילה`;
  return 'לא ניתן לזהות';
}

/** The badge tone of an item's run guard. */
export function guardTone(item: DoorPathItem): 'stale' | 'unknown' | 'neutral' {
  if (item.run_guard === 'refused_unresolvable') return 'stale';
  if (item.run_guard === 'refused_not_converted') return 'unknown';
  return 'neutral';
}
