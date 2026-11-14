/**
 * Pure helpers of the WisKey door Settings cards (CR-033 wave 1, system-doors.ts) - no DOM, unit-tested in Node
 * (tests/unit-door-settings.spec.ts). Hebrew copy lives here so the cards and the spec read the same words.
 */
import type {
  DoorConversionAction, DoorConversionItem, DoorConversionList, DoorConversionRecord, DoorGrantRole, DoorGrantSubject, DoorMap, DoorMapLock, DoorPathInventory, DoorPathItem,
} from '../api/doors';
import { tr } from '../i18n/msg/system-a';

/** The built-in roles' read-only answer in the "תפקידים" section (owner default: no built-in role changes by a switch). */
export function builtinAnswer(role: DoorGrantRole): string {
  if (role.answer === 'never') return tr('לעולם לא');
  if (role.answer === 'yes' || role.includes) return tr('כן');
  return tr('לא - אפשר לתת למשתמשים בנפרד');
}

/**
 * What the door grant also allows (SEC-WXD L3): the card's grant is the built-in `door_opener` role, which bundles `access.read`
 * with the door permission, and `access.read` opens the intercom screen (in the embedded panel, WisKey's own entry log and
 * people directory). Since 2.4.9 (owner decision 2026-10-13) calls and announcements ride `access.call`, so the door grant no
 * longer carries them. WXPERM (owner decision 2026-10-13): the door permission itself is the door-only `access.doors.open`
 * (legacy name `access.release`); a custom role holding it alone opens doors and sees nothing else.
 */
export const GRANT_ALSO = tr('ההרשאה כוללת גם צפייה ביומן הכניסות ובאנשי הקשר של האינטרקום.');

/** The question each sensitive switch asks before it is sent (one short confirmation). */
export function grantQuestion(name: string, enabled: boolean): string {
  return enabled ? `${tr('לתת ל{name} הרשאה לפתוח דלתות?', { name })} ${GRANT_ALSO}` : tr('להסיר מ{name} את ההרשאה לפתוח דלתות?', { name });
}

export function roleQuestion(name: string, enabled: boolean): string {
  return enabled ? `${tr('לכלול פתיחת דלתות בתפקיד {name}?', { name })} ${GRANT_ALSO}` : tr('להסיר פתיחת דלתות מהתפקיד {name}?', { name });
}

/** The line under a subject: what else lets them open ("שיוך אחר"), by role and scope name - never ids. */
export function otherGrants(s: DoorGrantSubject): string {
  if (!s.other.length) return '';
  return `${tr('שיוך אחר:')} ${s.other.map((o) => `${o.role_name} · ${o.scope_name}`).join(', ')}`;
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
  const out = [{ value: '', label: tr('כל ההתקנה (ללא שיוך)') }];
  for (const s of map.sites) {
    out.push({ value: `site:${s.id}`, label: `${tr('אתר')} · ${s.name}` });
    for (const b of map.buildings.filter((x) => x.site_id === s.id)) out.push({ value: `building:${b.id}`, label: `${s.name} · ${b.name}` });
  }
  return out;
}

/** The relays a lock may be mapped to: the relays of its own station when its registry names one, else of every station. */
export function relayOptions(map: DoorMap, lock: DoorMapLock): { value: string; label: string }[] {
  const stations = lock.station_id ? map.stations.filter((s) => s.id === lock.station_id) : map.stations;
  const out: { value: string; label: string }[] = [];
  for (const s of stations) {
    for (const r of s.relays) out.push({ value: `${s.id}#${r.physical_index}`, label: `${s.name} · ${r.name || tr('ממסר {n}', { n: r.physical_index })}` });
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
  if (lock.mapping && lock.mapping.valid) return { tone: 'live', text: lock.mapping.source === 'manual' ? tr('משויך ידנית') : tr('משויך') };
  if (lock.mapping) return { tone: 'stale', text: tr('השיוך אינו תקף כרגע - יש לשייך מחדש') };
  if (lock.suggestion) return { tone: 'unknown', text: tr('הצעה לשיוך מוכנה') };
  return { tone: 'unknown', text: tr('לא משויך - הדלת לא תיפתח מ-Arx') };
}

// ---------------------------------------------------------------- the read-only door-path inventory (CR-033 D7)

export type InventoryFilter = 'all' | 'blocked' | 'disable' | 'review';

export const INVENTORY_FILTERS: { id: InventoryFilter; label: string }[] = [
  { id: 'all', label: tr('הכול') },
  { id: 'blocked', label: tr('הרצה נחסמת') },
  { id: 'disable', label: tr('דורש השבתה') },
  { id: 'review', label: tr('לבדיקה ידנית') },
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
  if (!inv.wiskey_present) return tr('אין דלתות אינטרקום בהתקנה');
  const c = inv.counts;
  if (!c.items) return tr('אין פריטים שפותחים דלתות');
  const parts = [tr('{n} פריטים', { n: c.items }), tr('{n} שלבי פתיחה', { n: c.door_steps })];
  if (c.unresolvable) parts.push(tr('{n} לבדיקה ידנית', { n: c.unresolvable }));
  if (c.disable_required) parts.push(tr('{n} דורשים השבתה', { n: c.disable_required }));
  return parts.join(' · ');
}

const STATE_TEXT: Record<DoorPathItem['state'], string> = { enabled: tr('פעיל'), disabled: tr('מושבת'), ready: tr('זמין'), gone: tr('נמחק'), unknown: tr('מצב לא ידוע') };

/** The line under an item's name: its kind, where it came from and its state. */
export function itemMeta(item: DoorPathItem): string {
  return [item.kind_text, item.origin_text, STATE_TEXT[item.state]].join(' · ');
}

/** Who wrote it and who approved the live version. */
export function peopleLine(item: DoorPathItem): string {
  const author = item.author ? tr('נכתב בידי {name}', { name: item.author }) : tr('כותב לא ידוע');
  const approver = item.approver ? `${tr('אושר בידי {name}', { name: item.approver })}${item.approver_status === 'approved' ? '' : ` (${item.approver_text})`}` : item.approver_text;
  return `${author} · ${approver}`;
}

/** The last run, given a formatter for the instant (the screen passes its locale formatter). */
export function lastRunText(item: DoorPathItem, fmt: (iso: string) => string): string {
  return item.last_run ? tr('הרצה אחרונה: {time}', { time: fmt(item.last_run.at) }) : tr('לא הורץ');
}

/** The doors an item opens, by name (or how many steps when no door is known). */
export function doorsText(item: DoorPathItem): string {
  if (item.doors.length) return item.doors.join(', ');
  if (item.door_steps) return tr('{n} שלבי פתיחה', { n: item.door_steps });
  if (item.lock_steps) return tr('{n} שלבי נעילה', { n: item.lock_steps });
  return tr('לא ניתן לזהות');
}

/** The badge tone of an item's run guard. */
export function guardTone(item: DoorPathItem): 'stale' | 'unknown' | 'neutral' {
  if (item.run_guard === 'refused_unresolvable') return 'stale';
  if (item.run_guard === 'refused_not_converted') return 'unknown';
  return 'neutral';
}

// ---------------------------------------------------------------- disable and list (WXD10A / WXD10B, CR-033 6.4)

export const CONVERSION_ACTION_TEXT: Record<DoorConversionAction, string> = {
  disable: tr('השבתה ורישום'),
  convert_event_job: tr('הסבה למשימת דלת של Arx'),
  hand_over_program: tr('העברה לחלון פתיחה קבוע'),
};

const RECORD_TEXT: Record<DoorConversionRecord['action'], string> = { disabled: tr('הושבת'), converted: tr('הוסב למשימת דלת'), handed_over: tr('הועבר לחלון פתיחה') };

/** The line above the list: the empty cases first (an installation where nothing opens a door is the normal case). */
export function conversionSummary(list: DoorConversionList): string {
  if (list.state !== 'items') return list.state_text || (list.state === 'no_wiskey' ? tr('אין דלתות אינטרקום בהתקנה') : tr('לא נמצאו פריטים שפותחים דלת'));
  const c = list.counts;
  const parts = [tr('{n} פריטים', { n: c.items })];
  if (c.disable) parts.push(tr('{n} ניתנים להשבתה', { n: c.disable }));
  if (c.convert_event_job) parts.push(tr('{n} ניתנים להסבה', { n: c.convert_event_job }));
  if (c.hand_over_program) parts.push(tr('{n} ניתנים להעברה', { n: c.hand_over_program }));
  if (c.handled) parts.push(tr('{n} טופלו', { n: c.handled }));
  if (list.switch === 'off') parts.push(tr('הפעולות כבויות בהגדרות'));
  return parts.join(' · ');
}

/** The one confirmation each action asks before it is sent (the server refuses without `confirmed: true`). */
export function conversionQuestion(item: DoorConversionItem, action: DoorConversionAction): string {
  if (action === 'disable') return tr('להשבית את "{name}"? הפריט יישאר ברשימה ואפשר לבטל את ההשבתה.', { name: item.name });
  if (action === 'convert_event_job') {
    const n = item.actions.convert_event_job.removed_steps ?? 0;
    return tr('להסיר מ"{name}" {steps} וליצור משימת דלת של Arx? המשימה נוצרת כטיוטה ולא תפתח דלת עד שמישהו יפעיל אותה.', { name: item.name, steps: n === 1 ? tr('שלב פתיחה אחד') : tr('{n} שלבי פתיחה', { n }) });
  }
  const p = item.actions.hand_over_program.program;
  const when = p ? `${p.days_text} ${p.periods.map((x) => `${x.start}-${x.end}`).join(', ')}` : '';
  return tr('להשבית את התזמון "{name}" וליצור חלון פתיחה קבוע{when}? החלון נוצר כטיוטה ולא נשלח למערכת האינטרקום עד שיופעל.', { name: item.name, when: when ? ` (${when})` : '' });
}

/** A register row in one line. */
export function recordLine(r: DoorConversionRecord): string {
  const state = r.state === 'undone' ? ' · ' + tr('בוטל') : '';
  return `${r.name} · ${RECORD_TEXT[r.action]} · ${r.done_by}${state}`;
}
