/**
 * CR-NOTICE106: the pure logic of the notice board screens (no DOM): the KPI counts and filters of ראשי › לוח הודעות, the compose
 * dialog's validation and its local date-time fields, the window and audience wording, and the board list's "last seen" state.
 */
import type { Audience, Board, Notice, NoticeInput, Severity } from '../api/notices';
import { nt, type NtKey } from '../i18n/notices';
import { inPlace, type AreaOpt, type FloorOpt } from './places-model';

export type Kpi = 'all' | 'urgent' | 'scheduled' | 'expired' | 'drafts' | 'unread';
export type Seg = 'all' | 'mine' | 'tv';

export const SEV_KEY: Record<Severity, NtKey> = { info: 'sevInfo', alert: 'sevAlert', critical: 'sevCritical' };
export const SEV_LOOK: Record<Severity, 'acc' | 'warn' | 'alarm'> = { info: 'acc', alert: 'warn', critical: 'alarm' };
export const STATE_KEY: Record<Notice['state'], NtKey> = { active: 'stActive', scheduled: 'stScheduled', expired: 'stExpired', draft: 'stDraft', archived: 'stArchived' };

export function kpiCounts(list: Notice[]): Record<Kpi, number> {
  return {
    all: list.filter((n) => n.state === 'active').length,
    urgent: list.filter((n) => n.state === 'active' && n.severity === 'critical').length,
    scheduled: list.filter((n) => n.state === 'scheduled').length,
    expired: list.filter((n) => n.state === 'expired').length,
    drafts: list.filter((n) => n.state === 'draft').length,
    unread: list.filter((n) => n.state === 'active' && n.read === false).length,
  };
}

/** KPI as filter (the temperature-screen pattern): `all` = the active notices for a reader, every non-archived one for a manager. */
export function matches(n: Notice, kpi: Kpi, seg: Seg, q: string, manager: boolean): boolean {
  if (n.state === 'archived') return false;
  if (kpi === 'all' && !manager && n.state !== 'active') return false;
  if (kpi === 'urgent' && !(n.state === 'active' && n.severity === 'critical')) return false;
  if (kpi === 'scheduled' && n.state !== 'scheduled') return false;
  if (kpi === 'expired' && n.state !== 'expired') return false;
  if (kpi === 'drafts' && n.state !== 'draft') return false;
  if (kpi === 'unread' && !(n.state === 'active' && n.read === false)) return false;
  if (seg === 'tv' && !n.boards.length) return false;
  if (seg === 'mine' && n.audience && !n.audience.everyone && !Object.keys(n.audience).length) return false;
  const s = q.trim().toLowerCase();
  return !s || n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s);
}

export interface ListFilter { kpi: Kpi; seg: Seg; q: string; manager: boolean; place: string; floors: readonly FloorOpt[]; areas: readonly AreaOpt[] }

/** NOTICEDEL-295: the rows of the table - the KPI tile, the segment, the search and the place together. The tile counts ignore the place, the
 * segment and the search, so a count above 0 beside an empty table means one of those three is narrowing the list (the page then says so). */
export function listRows(all: readonly Notice[], f: ListFilter): Notice[] {
  return all.filter((n) => matches(n, f.kpi, f.seg, f.q, f.manager) && inPlace(n, f.place, f.floors, f.areas));
}

const two = (x: number) => ('0' + x).slice(-2);
const dm = (d: Date) => two(d.getDate()) + '.' + two(d.getMonth() + 1);
const hhmm = (d: Date) => two(d.getHours()) + ':' + two(d.getMinutes());

/** "24.10 – 25.10 12:00" (the end's time only when it is not midnight); "24.10 – עד לביטול". */
export function windowText(n: Pick<Notice, 'starts_at' | 'ends_at'>): string {
  const s = new Date(n.starts_at);
  if (!n.ends_at) return dm(s) + ' – ' + nt('untilArchived');
  const e = new Date(n.ends_at);
  const t = e.getHours() || e.getMinutes() ? ' ' + hhmm(e) : '';
  return dm(s) + ' – ' + dm(e) + t;
}

export function audienceText(a: Audience | undefined, floors: Record<string, string> = {}): string[] {
  if (!a) return [];
  if (a.everyone) return [nt('everyone')];
  const out: string[] = [];
  for (const f of a.floors ?? []) out.push(floors[f] ?? nt('floorsN', { n: 1 }));
  if (a.groups?.length) out.push(nt('groupsN', { n: a.groups.length }));
  if (a.roles?.length) out.push(nt('rolesN', { n: a.roles.length }));
  if (a.areas?.length) out.push(nt('floorsN', { n: a.areas.length }));
  return out.length ? out : [nt('tvOnly')];
}

// ---------------------------------------------------------------- the compose dialog

export interface Draft {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  pinned: boolean;
  from: string; // datetime-local value
  to: string; // datetime-local value ('' = none)
  untilArchived: boolean;
  aud: 'all' | 'place' | 'group' | 'tv';
  floors: string[];
  groups: string[];
  roles: string[];
  boards: string[];
  dwell: string;
  when: string;
  status: 'new' | 'draft' | 'published' | 'archived';
  push: boolean | null; // NOTICEPUSH-295: the push checkbox as the author set it; null = untouched (the suggested value shows)
}

/** A Date as the value of a datetime-local input (the browser's local time). */
export function toLocalInput(d: Date): string {
  return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + 'T' + hhmm(d);
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function newDraft(now: Date, days: number, severity: Severity): Draft {
  const end = new Date(now.getTime() + days * 86_400_000);
  return { id: '', title: '', body: '', severity, pinned: false, from: toLocalInput(now), to: toLocalInput(end), untilArchived: false, aud: 'all', floors: [], groups: [], roles: [], boards: [], dwell: '', when: '', status: 'new', push: null };
}

/** NOTICEADD-295: a new notice written from a board's "הודעות" tab - tagged to that board and, as written there, for the TV boards only
 * (the author may widen the audience in the dialog). */
export function boardDraft(now: Date, days: number, severity: Severity, boardId: string): Draft {
  return { ...newDraft(now, days, severity), aud: 'tv', boards: boardId ? [boardId] : [] };
}

export function draftOf(n: Notice): Draft {
  const a = n.audience ?? {};
  const aud: Draft['aud'] = a.everyone ? 'all' : a.floors?.length || a.areas?.length ? 'place' : a.groups?.length || a.roles?.length ? 'group' : 'tv';
  return {
    id: n.id, title: n.title, body: n.body, severity: n.severity, pinned: n.pinned, from: toLocalInput(new Date(n.starts_at)), to: n.ends_at ? toLocalInput(new Date(n.ends_at)) : '',
    untilArchived: !n.ends_at, aud, floors: a.floors ?? [], groups: a.groups ?? [], roles: a.roles ?? [], boards: n.boards.slice(), dwell: n.dwell_s ? String(n.dwell_s) : '',
    when: n.when_text ?? '', status: n.status === 'published' ? 'published' : n.status === 'archived' ? 'archived' : 'draft', push: n.push_requested ? true : null,
  };
}

/** NOTICEPUSH-295: the value the push checkbox shows before the author touches it - the installation's default ("התראה בפרסום"); under
 * "לפי חומרה" an urgent notice is ticked and an important one suggested (ticked), an ordinary one never. */
export function suggestedPush(mode: 'by_severity' | 'always' | 'never', severity: Severity): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return severity !== 'info';
}

/** The checkbox value of a draft and whether it can be changed at all (TV-only = nobody to send to; a published notice never pushes again). */
export function pushState(d: Draft, mode: 'by_severity' | 'always' | 'never', canPush: boolean): { checked: boolean; disabled: boolean } {
  const checked = d.push ?? suggestedPush(mode, d.severity);
  return { checked: d.aud === 'tv' ? false : checked, disabled: !canPush || d.aud === 'tv' };
}

export function audienceOf(d: Draft): Audience {
  if (d.aud === 'all') return { everyone: true };
  if (d.aud === 'place') return { floors: d.floors };
  if (d.aud === 'group') return { groups: d.groups, roles: d.roles };
  return {};
}

/** The first problem of a draft (an i18n key), or null. */
export function validate(d: Draft): NtKey | null {
  if (!d.title.trim()) return 'fTitle';
  if (d.title.trim().length > 120) return 'fTitle';
  if (d.body.length > 2000) return 'fBody';
  const end = d.untilArchived ? null : fromLocalInput(d.to);
  if (d.severity === 'critical' && !end) return 'criticalNeedsEnd';
  const start = fromLocalInput(d.from);
  if (start && end && Date.parse(end) <= Date.parse(start)) return 'fTo';
  if (d.aud === 'place' && !d.floors.length) return 'audPlace';
  if (d.aud === 'group' && !d.groups.length && !d.roles.length) return 'audGroup';
  if (d.dwell && !(Number(d.dwell) >= 3 && Number(d.dwell) <= 600)) return 'fDwell';
  return null;
}

/** `push` is added by the dialog only when the writer holds notices.push and the notice can still push (see compose-dialog). */
export function inputOf(d: Draft): NoticeInput {
  const end = d.untilArchived ? null : fromLocalInput(d.to);
  return {
    title: d.title.trim(), body: d.body, severity: d.severity, pinned: d.pinned, starts_at: fromLocalInput(d.from), ends_at: end, until_archived: d.untilArchived || !end,
    audience: audienceOf(d), boards: d.boards, dwell_s: d.dwell ? Number(d.dwell) : null, when_text: d.when.trim(),
  };
}

// ---------------------------------------------------------------- boards

export function seenState(b: Board, now: number): 'online' | 'idle' | 'never' | 'off' {
  if (!b.enabled) return 'off';
  if (!b.last_seen_at) return 'never';
  return now - Date.parse(b.last_seen_at) < 3 * 60_000 ? 'online' : 'idle';
}

export function agoText(iso: string | null | undefined, now: number): string {
  if (!iso) return nt('bNever');
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return nt('agoSec', { n: s });
  if (s < 3600) return nt('agoMin', { n: Math.round(s / 60) });
  if (s < 86_400) return nt('agoHour', { n: Math.round(s / 3600) });
  const d = new Date(iso);
  return dm(d) + '.' + d.getFullYear();
}

export function slugOk(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s);
}

/** A default slug from a Latin-ish name, else `board-N`. */
export function suggestSlug(name: string, taken: string[]): string {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  if (!slugOk(base)) base = 'board';
  let s = base;
  let i = 2;
  while (taken.includes(s)) s = `${base}-${i++}`;
  return s;
}

/** NOTICEPOLISH-295: the history retention is a choice of two (a year / half a year), stored as the day count the server already keeps
 * (30-3650). An older stored value that is neither stays selectable, so opening the page never rewrites it. */
export const RETENTION_YEAR = 365;
export const RETENTION_HALF = 180;

export function retentionOptions(days: number): { value: number; label: string }[] {
  const base = [{ value: RETENTION_YEAR, label: nt('retYear') }, { value: RETENTION_HALF, label: nt('retHalf') }];
  return base.some((o) => o.value === days) ? base : [{ value: days, label: nt('retDays', { n: days }) }, ...base];
}

/** The place choices of a board: "floor · building" for each floor the installation has. */
export function placePresets(floors: { name: string; building: string }[]): string[] {
  return [...new Set(floors.filter((f) => f.name.trim()).map((f) => (f.building ? `${f.name} · ${f.building}` : f.name)))];
}
