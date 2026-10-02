/**
 * CR-019 S3: the pure logic of הגדרות › חשמל והתקנים › "מתגים מוגנים" - row status, filters, sorting, the Shift range, the
 * counts line, what each action may send and the result sentence. No DOM: tests/unit-protected-switches.spec.ts covers it.
 */

export interface ProtectedSwitchRow {
  entity_id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  state: string | null;
  available: boolean;
  protected: boolean;
  source: 'manual' | 'auto' | null;
  category: string | null;
  category_label: string | null;
  rule: string | null;
  reviewed: boolean | null;
  included: boolean;
  reason: string;
  reason_label: string | null;
  alarm_managed: boolean;
  doors_layer: boolean;
  media_managed?: boolean;
  marked_by: string | null;
  marked_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface ProtectedSummary {
  switches: number;
  protected: number;
  auto_unreviewed: number;
  unprotected: number;
  gone_protected?: number;
}

export interface ProtectedCategory {
  id: string;
  label: string;
}

export type ProtectAction = 'protect' | 'unprotect' | 'approve';
export type StatusFilter = '' | 'protected' | 'pending' | 'unprotected';
export type RowStatus = 'alarm' | 'doors' | 'media' | 'pending' | 'protected' | 'unprotected' | 'unclassified';

/** Rows the server never lets a group action reach whatever the mark: protect / unprotect would be refused, so they are not selectable. */
export const readOnly = (r: ProtectedSwitchRow): boolean => r.alarm_managed || r.doors_layer || !!r.media_managed;

export const isPending = (r: ProtectedSwitchRow): boolean => r.protected && r.source === 'auto' && !r.reviewed;

export function statusOf(r: ProtectedSwitchRow): RowStatus {
  if (r.alarm_managed) return 'alarm';
  if (r.doors_layer) return 'doors';
  if (r.media_managed) return 'media';
  if (isPending(r)) return 'pending';
  if (!r.protected && r.reason === 'unclassified') return 'unclassified'; // a new switch the classifier has not judged yet: left out of group actions until it is
  return r.protected ? 'protected' : 'unprotected';
}

export const STATUS_TEXT: Record<RowStatus, string> = {
  alarm: 'נשלט ממסך האזעקה',
  doors: 'בשכבת הדלתות',
  media: 'נשלט ממסך המולטימדיה',
  pending: 'מוגן · ממתין לבדיקה',
  protected: 'מוגן',
  unprotected: 'לא מוגן',
  unclassified: 'טרם נבדק',
};

export interface Filters {
  q: string;
  status: StatusFilter;
  category: string;
  floor: string;
  area: string;
  sort: 'name' | 'area';
}

export const NO_FILTERS: Filters = { q: '', status: '', category: '', floor: '', area: '', sort: 'name' };

export function applyFilters(rows: readonly ProtectedSwitchRow[], f: Filters): ProtectedSwitchRow[] {
  const q = f.q.trim().toLowerCase();
  const out = rows.filter((r) => {
    if (q && !`${r.name} ${r.area_name ?? ''} ${r.floor_name ?? ''} ${r.entity_id}`.toLowerCase().includes(q)) return false;
    if (f.status === 'protected' && !r.protected) return false;
    if (f.status === 'pending' && !isPending(r)) return false;
    if (f.status === 'unprotected' && r.protected) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.floor && r.floor_id !== f.floor) return false;
    if (f.area && r.area_id !== f.area) return false;
    return true;
  });
  const key = (r: ProtectedSwitchRow) => (f.sort === 'area' ? `${r.floor_name ?? '￿'} ${r.area_name ?? '￿'} ${r.name}` : r.name);
  return out.sort((a, b) => key(a).localeCompare(key(b), 'he'));
}

export const filtersActive = (f: Filters): boolean => !!(f.q.trim() || f.status || f.category || f.floor || f.area);

/** The counts line: "M מתוך T מתגים · P מוגנים · U ממתינים לבדיקה" (the last part only while something waits). */
export function countsLine(shown: number, rows: readonly ProtectedSwitchRow[], summary: ProtectedSummary | null): string {
  const protectedN = summary?.protected ?? rows.filter((r) => r.protected).length;
  const pendingN = summary?.auto_unreviewed ?? rows.filter(isPending).length;
  return `${shown} מתוך ${summary?.switches ?? rows.length} מתגים · ${protectedN} מוגנים${pendingN ? ` · ${pendingN} ממתינים לבדיקה` : ''}`;
}

/** Shift+click: the ids of the selectable rows between the last row clicked and this one, in the list's current order. */
export function rangeIds(list: readonly ProtectedSwitchRow[], last: string | null, id: string): string[] {
  const a = last ? list.findIndex((r) => r.entity_id === last) : -1;
  const b = list.findIndex((r) => r.entity_id === id);
  if (a < 0 || b < 0) return [id];
  return list.slice(Math.min(a, b), Math.max(a, b) + 1).filter((r) => !readOnly(r)).map((r) => r.entity_id);
}

/** The ids an action would really send for a selection: protect / unprotect only rows it can change, approve only rows waiting for review.
 * The server re-checks everything; this keeps the confirmation's number honest. */
export function actionIds(action: ProtectAction, rows: readonly ProtectedSwitchRow[], selected: ReadonlySet<string>): string[] {
  return rows
    .filter((r) => selected.has(r.entity_id))
    .filter((r) => (action === 'approve' ? isPending(r) : !readOnly(r) && (action === 'protect' ? !r.protected : r.protected)))
    .map((r) => r.entity_id);
}

/** Every row waiting for review (the strip's "אשר את כולם"). */
export const pendingIds = (rows: readonly ProtectedSwitchRow[]): string[] => rows.filter(isPending).map((r) => r.entity_id);

/** The server accepts 1..500 ids per call. */
export const CHUNK = 500;
export function chunks<T>(ids: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function resultLine(action: ProtectAction, changed: number, refused: number): string {
  const done = action === 'protect' ? `הוגנו ${changed} מתגים` : action === 'unprotect' ? `הוסרה ההגנה מ־${changed} מתגים` : `אושרו ${changed} מתגים`;
  return `${done}${refused ? ` · ${refused} לא שונו (נשלטים ממסך אחר, בשכבת הדלתות או שאינם מתגים)` : ''}`;
}

export const CONFIRM: Record<ProtectAction, { heading: string; button: string; danger: boolean }> = {
  protect: { heading: 'הגנה על מתגים', button: 'הגן', danger: false },
  unprotect: { heading: 'הסרת הגנה', button: 'הסר הגנה', danger: true },
  approve: { heading: 'אישור הגנה', button: 'אשר', danger: false },
};

export function confirmQuestion(action: ProtectAction, n: number): string {
  if (action === 'unprotect') return `${n} מתגים ייכללו ב'כבה הכל' ובפעולות קבוצתיות. להמשיך?`;
  if (action === 'protect') return `להגן על ${n} מתגים? הם לא ייכללו ב'כבה הכל' ובפעולות קבוצתיות.`;
  return `לאשר את ההגנה על ${n} מתגים?`;
}
