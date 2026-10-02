/**
 * CR-019 S3: the pure logic of הגדרות › חשמל והתקנים › "מתגים מוגנים" - row status, filters, sorting, the Shift range, the
 * counts line, what each action may send and the result sentence. No DOM: tests/unit-protected-switches.spec.ts covers it.
 *
 * Owner decision 2026-10-02: a switch is excluded from group actions ONLY when an administrator protected it. The classifier
 * merely SUGGESTS ("מוצע להגנה"): a suggestion is not protected and is still included until the administrator approves it.
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
  /** An administrator's protection (enforced). */
  protected: boolean;
  /** A classifier suggestion nobody approved: shown here, never enforced. */
  suggested: boolean;
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
  suggested: number;
  unprotected: number;
  gone_protected?: number;
}

export interface ProtectedCategory {
  id: string;
  label: string;
}

/** `approve` protects the suggested rows (the strip); `dismiss` rejects a suggestion (the server action is `unprotect`). */
export type ProtectAction = 'protect' | 'unprotect' | 'approve' | 'dismiss';
export type ApiAction = 'protect' | 'unprotect' | 'approve';
export const apiAction = (a: ProtectAction): ApiAction => (a === 'dismiss' ? 'unprotect' : a);

export type StatusFilter = '' | 'protected' | 'suggested' | 'unprotected';
export type RowStatus = 'alarm' | 'doors' | 'media' | 'suggested' | 'protected' | 'unprotected';

/** Rows the server never lets a group action reach whatever the mark: protect / unprotect would be refused, so they are not selectable. */
export const readOnly = (r: ProtectedSwitchRow): boolean => r.alarm_managed || r.doors_layer || !!r.media_managed;

export const isSuggested = (r: ProtectedSwitchRow): boolean => r.suggested && !r.protected;

export function statusOf(r: ProtectedSwitchRow): RowStatus {
  if (r.alarm_managed) return 'alarm';
  if (r.doors_layer) return 'doors';
  if (r.media_managed) return 'media';
  if (r.protected) return 'protected';
  return isSuggested(r) ? 'suggested' : 'unprotected';
}

export const STATUS_TEXT: Record<RowStatus, string> = {
  alarm: 'נשלט ממסך האזעקה',
  doors: 'בשכבת הדלתות',
  media: 'נשלט ממסך המולטימדיה',
  suggested: 'מוצע להגנה',
  protected: 'מוגן',
  unprotected: 'לא מוגן',
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
    if (f.status === 'suggested' && !isSuggested(r)) return false;
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

/** Suggestions the strip can act on (a read-only row is never in a group action, so protecting it would mean nothing). */
export const suggestedIds = (rows: readonly ProtectedSwitchRow[]): string[] => rows.filter((r) => isSuggested(r) && !readOnly(r)).map((r) => r.entity_id);

/** The counts line: "M מתוך T מתגים · P מוגנים · S מוצעים להגנה" (the last part only while something is suggested). */
export function countsLine(shown: number, rows: readonly ProtectedSwitchRow[], summary: ProtectedSummary | null): string {
  const protectedN = summary?.protected ?? rows.filter((r) => r.protected).length;
  const suggestedN = summary?.suggested ?? rows.filter(isSuggested).length;
  return `${shown} מתוך ${summary?.switches ?? rows.length} מתגים · ${protectedN} מוגנים${suggestedN ? ` · ${suggestedN} מוצעים להגנה` : ''}`;
}

/** Shift+click: the ids of the selectable rows between the last row clicked and this one, in the list's current order. */
export function rangeIds(list: readonly ProtectedSwitchRow[], last: string | null, id: string): string[] {
  const a = last ? list.findIndex((r) => r.entity_id === last) : -1;
  const b = list.findIndex((r) => r.entity_id === id);
  if (a < 0 || b < 0) return [id];
  return list.slice(Math.min(a, b), Math.max(a, b) + 1).filter((r) => !readOnly(r)).map((r) => r.entity_id);
}

/** The ids an action would really send for a selection: protect any selectable row that is not protected yet (approving a
 * suggestion included), unprotect only protected rows, dismiss only suggested rows. The server re-checks everything; this keeps
 * the confirmation's number honest. */
export function actionIds(action: ProtectAction, rows: readonly ProtectedSwitchRow[], selected: ReadonlySet<string>): string[] {
  return rows
    .filter((r) => selected.has(r.entity_id) && !readOnly(r))
    .filter((r) => (action === 'protect' ? !r.protected : action === 'unprotect' ? r.protected : isSuggested(r)))
    .map((r) => r.entity_id);
}

/** The server accepts 1..500 ids per call. */
export const CHUNK = 500;
export function chunks<T>(ids: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function resultLine(action: ProtectAction, changed: number, refused: number): string {
  const done = action === 'protect' || action === 'approve' ? `הוגנו ${changed} מתגים` : action === 'unprotect' ? `הוסרה ההגנה מ־${changed} מתגים` : `נדחתה ההצעה ל־${changed} מתגים`;
  return `${done}${refused ? ` · ${refused} לא שונו (נשלטים ממסך אחר, בשכבת הדלתות או שאינם מתגים)` : ''}`;
}

export const CONFIRM: Record<ProtectAction, { heading: string; button: string; danger: boolean }> = {
  protect: { heading: 'הגנה על מתגים', button: 'הגן', danger: false },
  approve: { heading: 'הגנה על המתגים המוצעים', button: 'הגן', danger: false },
  unprotect: { heading: 'הסרת הגנה', button: 'הסר הגנה', danger: true },
  dismiss: { heading: 'דחיית הצעה', button: 'דחה הצעה', danger: false },
};

export function confirmQuestion(action: ProtectAction, n: number): string {
  if (action === 'unprotect') return `${n} מתגים ייכללו ב'כבה הכל' ובפעולות קבוצתיות. להמשיך?`;
  if (action === 'dismiss') return `לדחות את ההצעה להגן על ${n} מתגים? הם ימשיכו להיכלל ב'כבה הכל' ובפעולות קבוצתיות.`;
  return `להגן על ${n} מתגים? הם לא ייכללו ב'כבה הכל' ובפעולות קבוצתיות.`;
}
