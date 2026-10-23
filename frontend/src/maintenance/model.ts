/**
 * CR-MAINT215 slice 2: the pure part of the maintenance screens - pages, looks, badge texts, the KPI row, the places tree, the list
 * filters, interval and date texts, the task form (draft, validation, body), the round run and the sticker address. No DOM, no
 * fetch: the unit specs call these directly (tests/unit-maintenance.spec.ts).
 */
import type { PlaceRow } from '../screens/wiskey-stations-logic';
import type { Answer, ChecklistItem, DocType, Insurance, Interval, IntervalUnit, Options, RoundView, Task, TaskBody, TaskDetail, TaskKind, VendorRow } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';

export type Page = 'ledger' | 'plans' | 'rounds' | 'log' | 'tags';
/** the pages that list tasks (the reminder log and the tags are their own screens) */
export type ListPage = 'ledger' | 'plans' | 'rounds';
export const PAGES: readonly Page[] = ['ledger', 'plans', 'rounds', 'log', 'tags'];
export const SECTION_HREF = '#/tickets/maintenance';
export const PAGE_LABEL: Record<Page, MtKey> = { ledger: 'pageLedger', plans: 'pagePlans', rounds: 'pageRounds', log: 'pageLog', tags: 'pageTags' };
export const PAGE_KINDS: Record<ListPage, readonly TaskKind[]> = { ledger: ['certificate', 'vendor_document'], plans: ['preventive'], rounds: ['round'] };

export function pageHref(p: Page): string {
  return `${SECTION_HREF}/${p}`;
}

/** The page a route names (`#/tickets/maintenance/<page>[/...]`); the ledger by default. */
export function pageOf(segments: readonly string[]): Page {
  const s = segments[2];
  return (PAGES as readonly string[]).includes(s ?? '') ? (s as Page) : 'ledger';
}

export function pageOfKind(kind: TaskKind): ListPage {
  return kind === 'preventive' ? 'plans' : kind === 'round' ? 'rounds' : 'ledger';
}

/** The pages a viewer is offered: the tags page is for managers only (the server lists tags to maintenance.manage). */
export function pagesFor(can: { manage: boolean }): Page[] {
  return PAGES.filter((p) => p !== 'tags' || can.manage);
}

// ---------------------------------------------------------------- looks and badges

export type Look = 'alarm' | 'warn' | 'ok' | 'unk' | 'acc';
export const WORST: Record<Look, number> = { alarm: 3, warn: 2, acc: 1, ok: 0, unk: -1 };

const isDoc = (k: TaskKind) => k === 'certificate' || k === 'vendor_document';

export function lookOf(t: Pick<Task, 'state' | 'active' | 'kind'> & { open_run?: Task['open_run'] }): Look {
  if (t.kind === 'round' && t.open_run) return 'acc';
  if (!t.active || t.state === 'none') return 'unk';
  return t.state === 'overdue' ? 'alarm' : t.state === 'due_soon' ? 'warn' : 'ok';
}

/** The solid badge of a row: "פג" / "עבר ב־3 ימים" / "עוד 30 ימים" / "היום" / "בתוקף" / "במועד" / "מושהה" / "בביצוע · 2/5". */
export function badgeText(t: Pick<Task, 'state' | 'active' | 'kind' | 'days_left'> & { open_run?: Task['open_run'] }): string {
  if (t.kind === 'round' && t.open_run) return mt('stRunning', { a: t.open_run.answered, b: t.open_run.total });
  if (!t.active) return mt(t.kind === 'preventive' ? 'stPausedF' : 'stPaused');
  if (t.state === 'none') return mt('stNoDate');
  const d = t.days_left ?? 0;
  if (t.state === 'overdue') {
    if (isDoc(t.kind)) return mt('stOverdueDoc');
    const late = Math.max(1, -d);
    return late === 1 ? mt('stOverdue1') : late === 2 ? mt('stOverdue2') : mt('stOverdue', { n: late });
  }
  if (t.state === 'due_soon') return d <= 0 ? mt('stToday') : d === 1 ? mt('stTomorrow') : mt('stInDays', { n: d });
  return mt(isDoc(t.kind) ? 'stValid' : 'stOnTime');
}

export function kindText(k: TaskKind): string {
  return mt(k === 'certificate' ? 'kindCertificate' : k === 'preventive' ? 'kindPreventive' : k === 'round' ? 'kindRound' : 'kindVendorDocument');
}

export function categoryText(c: string): string {
  const key = `cat_${c}` as MtKey;
  return mt(key) === key ? mt('cat_other') : mt(key);
}

export function docTypeText(d: DocType | string | null | undefined): string {
  const key = `doc_${d ?? 'other'}` as MtKey;
  return mt(key) === key ? mt('doc_other') : mt(key);
}

export function intervalText(iv: Interval | null | undefined): string {
  if (!iv) return '';
  const fixed = `every_${iv.unit}_${iv.count}` as MtKey;
  if (mt(fixed) !== fixed) return mt(fixed);
  return mt(`everyN_${iv.unit}` as MtKey, { n: iv.count });
}

/** 'YYYY-MM-DD' -> 'DD.MM.YYYY' (an installation-local calendar date: never through a Date, never shifted by a zone). */
export function fmtDate(d: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

export function fmtShort(d: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '');
  return m ? `${m[3]}.${m[2]}` : '';
}

/** An instant (UTC ISO) as the viewer's local 'DD.MM.YYYY HH:MM'. */
export function fmtInstant(iso: string | null | undefined, withDate = true): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(t.getHours())}:${p(t.getMinutes())}`;
  return withDate ? `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()} ${time}` : time;
}

/** The second line of a row's name (the electricity table's `.t2`). */
export function subLine(t: Task): string {
  if (t.kind === 'round' && t.open_run) return mt('runBy', { who: t.open_run.started_by_name || '-', t: fmtInstant(t.open_run.started_at, false) });
  if (t.kind === 'vendor_document') return docTypeText(t.doc_type);
  const link = t.elevator_name || t.generator_name || t.entity_name;
  if (link) return link;
  if (t.checklist_count && t.kind !== 'round') return mt('checklistN', { n: t.checklist_count });
  return '';
}

export function lastRunText(t: Task): string {
  const r = t.last_run;
  if (!r) return '';
  const d = fmtShort(r.performed_on);
  return r.issues ? (r.issues === 1 ? mt('lastRunIssue1', { d }) : mt('lastRunIssues', { d, n: r.issues })) : mt('lastRunOk', { d });
}

// ---------------------------------------------------------------- KPI row

export type KpiKey = 'all' | Look;
export const PAGE_KPIS: Record<ListPage, { key: KpiKey; label: MtKey }[]> = {
  ledger: [{ key: 'all', label: 'kpiItems' }, { key: 'alarm', label: 'kpiExpired' }, { key: 'warn', label: 'kpiNear' }, { key: 'ok', label: 'kpiValid' }, { key: 'unk', label: 'kpiPaused' }],
  plans: [{ key: 'all', label: 'kpiPlans' }, { key: 'alarm', label: 'kpiLate' }, { key: 'warn', label: 'kpiThisWeek' }, { key: 'ok', label: 'kpiOnTime' }, { key: 'unk', label: 'kpiPausedF' }],
  rounds: [{ key: 'all', label: 'kpiRounds' }, { key: 'alarm', label: 'kpiLate' }, { key: 'warn', label: 'kpiToday' }, { key: 'ok', label: 'kpiOnTime' }, { key: 'acc', label: 'kpiRunning' }],
};

export function kpiCounts(list: readonly Task[]): Record<KpiKey, number> {
  const n: Record<KpiKey, number> = { all: 0, alarm: 0, warn: 0, ok: 0, unk: 0, acc: 0 };
  for (const t of list) {
    n.all++;
    n[lookOf(t)]++;
  }
  return n;
}

// ---------------------------------------------------------------- the places tree

/** A row of the tree with a state dot (the worst look under it). */
export type TreeRow = Omit<PlaceRow, 'dot'> & { dot: PlaceRow['dot'] };

/** The node of a task: its floor (`f:`), else its building (`b:`), else its site (`s:`); a placeless supplier document sits under
 * "ספקים", any other placeless task under "ללא מקום". */
export function nodeOf(t: Pick<Task, 'place_path' | 'kind'>): string {
  const p = t.place_path ?? [];
  const f = p.find((x) => x.kind === 'floor');
  if (f) return `f:${f.id}`;
  const b = p.find((x) => x.kind === 'building');
  if (b) return `b:${b.id}`;
  const s = p.find((x) => x.kind === 'site');
  if (s) return `s:${s.id}`;
  return t.kind === 'vendor_document' ? 'vendors' : 'none';
}

function parentOf(t: Pick<Task, 'place_path'>): string | null {
  const b = (t.place_path ?? []).find((x) => x.kind === 'building');
  return b ? `b:${b.id}` : null;
}

export function inPlace(t: Pick<Task, 'place_path' | 'kind'>, sel: string): boolean {
  if (sel === 'all') return true;
  return nodeOf(t) === sel || parentOf(t) === sel;
}

const DOT: Record<Look, PlaceRow['dot']> = { alarm: 'alarm', warn: 'warn', ok: 'ok', acc: 'ok', unk: 'mixed' };

/** "all", then buildings / sites (collapsible when they hold floors) with their floors, then "ספקים" and "ללא מקום". Counts are the
 * rows themselves (one source); a place with nothing of the viewer's is not listed. */
export function treeRows(list: readonly Task[], collapsed: ReadonlySet<string> = new Set()): TreeRow[] {
  const worst = (ts: readonly Task[]): PlaceRow['dot'] => {
    let w: Look | null = null;
    for (const t of ts) {
      const l = lookOf(t);
      if (w === null || WORST[l] > WORST[w]) w = l;
    }
    return w === null ? null : DOT[w];
  };
  const rows: TreeRow[] = [{ id: 'all', kind: 'all', name: mt('allPlaces'), depth: 0, count: list.length, dot: null }];
  const tops = new Map<string, { name: string; floors: Map<string, string> }>();
  for (const t of list) {
    const p = t.place_path ?? [];
    const b = p.find((x) => x.kind === 'building') ?? (p.length && !p.some((x) => x.kind === 'floor') ? p.find((x) => x.kind === 'site') : undefined);
    const f = p.find((x) => x.kind === 'floor');
    if (!b && !f) continue;
    const topId = b ? `${b.kind === 'site' ? 's' : 'b'}:${b.id}` : `f:${f!.id}`;
    const top = tops.get(topId) ?? { name: b?.name || f?.name || '', floors: new Map<string, string>() };
    if (b && f) top.floors.set(`f:${f.id}`, f.name);
    tops.set(topId, top);
  }
  for (const [id, top] of [...tops.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'he'))) {
    const under = list.filter((t) => inPlace(t, id));
    const hasFloors = top.floors.size > 0;
    const open = !collapsed.has(id);
    rows.push({ id, kind: hasFloors ? 'floor' : 'area', name: top.name, depth: 0, count: under.length, dot: worst(under), open });
    if (hasFloors && open) {
      for (const [fid, fname] of [...top.floors.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))) {
        const mine = list.filter((t) => nodeOf(t) === fid);
        rows.push({ id: fid, kind: 'area', name: fname, depth: 1, count: mine.length, dot: worst(mine) });
      }
    }
  }
  for (const [id, label] of [['vendors', mt('vendorsNode')], ['none', mt('noPlace')]] as const) {
    const mine = list.filter((t) => nodeOf(t) === id);
    if (mine.length) rows.push({ id, kind: 'none', name: label, depth: 0, count: mine.length, dot: worst(mine) });
  }
  return rows;
}

// ---------------------------------------------------------------- list filters

export type Seg = 'all' | 'cert' | 'vendor' | 'auto' | 'manual' | 'daily' | 'weekly';
export function segsOf(page: ListPage, ticketsOn: boolean): { key: Seg; label: MtKey }[] {
  if (page === 'ledger') return [{ key: 'all', label: 'all' }, { key: 'cert', label: 'kindCerts' }, { key: 'vendor', label: 'kindVendorDocs' }];
  if (page === 'plans') return ticketsOn ? [{ key: 'all', label: 'all' }, { key: 'auto', label: 'autoRequest' }, { key: 'manual', label: 'manual' }] : [];
  return [{ key: 'all', label: 'all' }, { key: 'daily', label: 'daily' }, { key: 'weekly', label: 'weekly' }];
}

export function matchesSeg(t: Task, seg: Seg): boolean {
  switch (seg) {
    case 'cert': return t.kind === 'certificate';
    case 'vendor': return t.kind === 'vendor_document';
    case 'auto': return t.auto_ticket;
    case 'manual': return !t.auto_ticket;
    case 'daily': return t.interval?.unit === 'day';
    case 'weekly': return t.interval?.unit === 'week';
    default: return true;
  }
}

export interface ListFilter { kpi: KpiKey; place: string; seg: Seg; q: string }

export function matchesText(t: Task, q: string): boolean {
  const n = q.trim().toLocaleLowerCase();
  if (!n) return true;
  return [t.title, t.vendor_name, t.elevator_name, t.generator_name, t.entity_name, t.place?.name].some((x) => (x ?? '').toLocaleLowerCase().includes(n));
}

/** The rows shown; the KPI numbers follow the place, the segment and the search (not the KPI itself), like the temperature screen. */
export function applyFilter(list: readonly Task[], f: ListFilter): { shown: Task[]; base: Task[] } {
  const base = list.filter((t) => inPlace(t, f.place) && matchesSeg(t, f.seg) && matchesText(t, f.q));
  return { base, shown: base.filter((t) => f.kpi === 'all' || lookOf(t) === f.kpi) };
}

// ---------------------------------------------------------------- suppliers

/** The supplier picker's mark (owner answer 24.10 q17): red with the expired document, amber with an expiring one, green when valid. */
export function vendorMark(v: Pick<VendorRow, 'state' | 'expired' | 'expiring'> | null | undefined): { look: Look; text: string } | null {
  if (!v || v.state === 'none') return null;
  if (v.state === 'expired') {
    const d = v.expired[0];
    return { look: 'alarm', text: d?.doc_type === 'insurance' ? mt('insuranceExpired', { d: fmtShort(d.valid_until) }) : mt('docExpired', { doc: docTypeText(d?.doc_type), d: fmtShort(d?.valid_until) }) };
  }
  if (v.state === 'expiring') {
    const d = v.expiring[0];
    return { look: 'warn', text: mt('docUntil', { doc: docTypeText(d?.doc_type), d: fmtShort(d?.valid_until) }) };
  }
  return { look: 'ok', text: mt('vendorOk') };
}

// ---------------------------------------------------------------- the round run

/** A number checkpoint against its range (the server judges again; a person may still mark an in-range value as a problem). */
export function outOfRange(item: Pick<ChecklistItem, 'kind' | 'min' | 'max'>, value: number | null | undefined): boolean {
  if (item.kind !== 'number' || value === null || value === undefined || Number.isNaN(value)) return false;
  return (item.min !== null && item.min !== undefined && value < item.min) || (item.max !== null && item.max !== undefined && value > item.max);
}

export function rangeText(item: Pick<ChecklistItem, 'min' | 'max'>): string {
  const lo = item.min ?? null;
  const hi = item.max ?? null;
  if (lo !== null && hi !== null) return `${lo}–${hi}`;
  if (lo !== null) return `≥ ${lo}`;
  if (hi !== null) return `≤ ${hi}`;
  return '';
}

/** Is a checkpoint marked (what `finish` needs for a required one)? */
export function answered(item: ChecklistItem, a: Answer | undefined): boolean {
  if (!a) return false;
  const kind = item.kind ?? 'check';
  if (kind === 'check') return a.ok === true || a.ok === false;
  if (kind === 'number') return typeof a.value === 'number';
  return typeof a.value === 'string' && a.value.trim() !== '';
}

export function missingRequired(items: readonly ChecklistItem[], answers: Record<string, Answer>): string[] {
  return items.filter((i) => i.required !== false && !answered(i, answers[i.key])).map((i) => i.key);
}

export function issueKeys(items: readonly ChecklistItem[], answers: Record<string, Answer>): string[] {
  return items.filter((i) => answers[i.key]?.ok === false).map((i) => i.key);
}

/** The first checkpoint not yet marked (a run reopened on another phone continues where it stopped). */
export function resumeIndex(items: readonly ChecklistItem[], answers: Record<string, Answer>): number {
  const i = items.findIndex((x) => !answered(x, answers[x.key]));
  return i < 0 ? items.length : i;
}

export type RunDraft = { ok?: boolean | null; value?: number | string | null; note?: string };

/** What the server accepts for one checkpoint: ok / value / note only (never a position; the server stamps the time). */
export function answerBody(item: ChecklistItem, d: RunDraft): Answer | null {
  const kind = item.kind ?? 'check';
  const note = (d.note ?? '').trim();
  if (kind === 'check') return d.ok === true || d.ok === false ? { ok: d.ok, ...(note ? { note } : {}) } : null;
  if (kind === 'number') {
    if (typeof d.value !== 'number' || Number.isNaN(d.value)) return null;
    return { value: d.value, ...(d.ok === false ? { ok: false } : {}), ...(note ? { note } : {}) };
  }
  const v = typeof d.value === 'string' ? d.value.trim() : '';
  return v ? { value: v, ...(note ? { note } : {}) } : null;
}

// ---------------------------------------------------------------- stickers

/** The address printed on a sticker (owner answer 24.10 q16): the configured base (Settings; default the remote address), else this
 * page's own origin and path - always a sign-in-required in-app route `#/m/<token>`. */
export function stickerUrl(base: string, token: string, here: { origin: string; pathname: string } = { origin: '', pathname: '/' }): string {
  const b = (base || `${here.origin}${here.pathname}`).replace(/#.*$/, '').replace(/\/+$/, '');
  return `${b}/#/m/${token}`;
}

// ---------------------------------------------------------------- the task form

export interface Draft {
  kind: TaskKind;
  title: string;
  category: string;
  place: string; // '' = no place, else `<kind>:<id>`
  /** MAINT215B: what it is about - '' = nothing, else `elevator:<id>` / `generator:<id>` */
  asset: string;
  vendor_id: string;
  doc_type: DocType | '';
  owner_user_id: string;
  due_date: string;
  anchor_date: string;
  every: string; // '' = no interval
  unit: IntervalUnit;
  lead: string; // '' = the installation default
  notes: string;
  checklist: (ChecklistItem & { _id: number })[];
  auto_ticket: boolean;
  department_id: string;
  active: boolean;
}

let seq = 0;
export function newItem(kind: ChecklistItem['kind'] = 'check'): ChecklistItem & { _id: number } {
  seq += 1;
  return { _id: seq, key: '', label: '', kind, required: true, min: null, max: null };
}

export function newDraft(kind: TaskKind): Draft {
  return {
    kind, title: '', category: kind === 'vendor_document' ? 'other' : 'other', place: '', asset: '', vendor_id: '', doc_type: kind === 'vendor_document' ? 'insurance' : '', owner_user_id: '',
    due_date: '', anchor_date: '', every: kind === 'preventive' ? '1' : kind === 'round' ? '1' : '', unit: kind === 'round' ? 'day' : kind === 'preventive' ? 'month' : 'year', lead: '',
    notes: '', checklist: kind === 'round' ? [newItem()] : [], auto_ticket: false, department_id: '', active: true,
  };
}

export function draftOf(t: TaskDetail): Draft {
  return {
    kind: t.kind, title: t.title, category: t.category || 'other', place: t.place ? `${t.place.kind}:${t.place.id}` : '',
    asset: t.elevator_id ? `elevator:${t.elevator_id}` : t.generator_id ? `generator:${t.generator_id}` : '', vendor_id: t.vendor_id ?? '', doc_type: (t.doc_type ?? '') as Draft['doc_type'],
    owner_user_id: t.owner_user_id ?? '', due_date: t.due_date ?? '', anchor_date: t.anchor_date ?? '', every: t.interval ? String(t.interval.count) : '', unit: t.interval?.unit ?? 'month',
    lead: String(t.lead_days), notes: t.notes ?? '', checklist: (t.checklist ?? []).map((i) => ({ ...newItem(i.kind), ...i })), auto_ticket: t.auto_ticket, department_id: t.department_id ?? '', active: t.active,
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const keyOf = (label: string, i: number, used: Set<string>) => {
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  let k = ascii || `p${i + 1}`;
  while (used.has(k)) k = `${k.slice(0, 28)}_${i + 1}`;
  used.add(k);
  return k;
};

/** Field problems of a draft (the keys are the field names); an empty object = ready to send. The server checks again. */
export function validate(d: Draft): Record<string, MtKey> {
  const e: Record<string, MtKey> = {};
  if (!d.title.trim()) e.title = 'fRequired';
  const plan = d.kind === 'preventive' || d.kind === 'round';
  if (plan) {
    if (!DATE.test(d.anchor_date)) e.anchor_date = d.anchor_date ? 'fBadDate' : 'fRequired';
    if (!/^\d{1,3}$/.test(d.every) || Number(d.every) < 1) e.every = 'fBadNumber';
  } else {
    if (d.kind === 'vendor_document' && !d.due_date) e.due_date = 'fRequired';
    if (d.due_date && !DATE.test(d.due_date)) e.due_date = 'fBadDate';
    if (d.every && (!/^\d{1,3}$/.test(d.every) || Number(d.every) < 1)) e.every = 'fBadNumber';
  }
  if (d.kind === 'vendor_document') {
    if (!d.vendor_id) e.vendor_id = 'fRequired';
    if (!d.doc_type) e.doc_type = 'fRequired';
  }
  if (d.lead && (!/^\d{1,3}$/.test(d.lead) || Number(d.lead) > 365)) e.lead = 'fBadNumber';
  if (d.kind === 'round' && !d.checklist.some((i) => i.label.trim())) e.checklist = 'fNeedItems';
  d.checklist.forEach((i, n) => {
    if (i.kind === 'number' && i.min !== null && i.min !== undefined && i.max !== null && i.max !== undefined && i.min > i.max) e[`item${n}`] = 'fRangeOrder';
  });
  if (d.auto_ticket && !d.department_id) e.department_id = 'fRequired';
  return e;
}

/** The body for POST (a new task: every field) or PATCH (`prev` given: only what changed). */
export function bodyOf(d: Draft, prev?: TaskDetail | null): TaskBody {
  const used = new Set<string>();
  const items = d.checklist.filter((i) => i.label.trim()).map((i, n): ChecklistItem => {
    const out: ChecklistItem = { key: i.key && /^[a-z0-9_]{1,32}$/.test(i.key) && !used.has(i.key) ? (used.add(i.key), i.key) : keyOf(i.label, n, used), label: i.label.trim(), kind: i.kind ?? 'check' };
    if (i.required === false) out.required = false;
    if (out.kind === 'number') {
      if (i.min !== null && i.min !== undefined && !Number.isNaN(i.min)) out.min = i.min;
      if (i.max !== null && i.max !== undefined && !Number.isNaN(i.max)) out.max = i.max;
    }
    return out;
  });
  const [pk, pid] = d.place ? (d.place.split(':') as ['site' | 'building' | 'floor', string]) : [null, null];
  const plan = d.kind === 'preventive' || d.kind === 'round';
  const [ak, aid] = d.asset ? (d.asset.split(':') as ['elevator' | 'generator', string]) : [null, null];
  const full: TaskBody = {
    elevator_id: ak === 'elevator' ? aid : null, generator_id: ak === 'generator' ? aid : null,
    title: d.title.trim(), category: d.category || 'other', notes: d.notes.trim(), place: pk && pid ? { kind: pk, id: pid } : null, vendor_id: d.vendor_id || null,
    owner_user_id: d.owner_user_id || null, interval: d.every ? { unit: d.unit, count: Number(d.every) } : null, lead_days: d.lead === '' ? null : Number(d.lead),
    checklist: items, auto_ticket: d.auto_ticket, department_id: d.auto_ticket ? d.department_id || null : null,
  };
  if (d.kind === 'vendor_document') full.doc_type = (d.doc_type || 'other') as DocType;
  if (plan) full.anchor_date = d.anchor_date;
  else full.due_date = d.due_date || null;
  if (!prev) {
    const out: TaskBody = { kind: d.kind, ...full };
    if (out.lead_days === null) delete out.lead_days; // the installation's default (Settings)
    if (d.kind === 'vendor_document') delete out.place;
    if (!out.elevator_id) delete out.elevator_id; // nothing to link: leave the fields out of a new task
    if (!out.generator_id) delete out.generator_id;
    return out;
  }
  const out: TaskBody = { revision: prev.revision };
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const was: TaskBody = {
    elevator_id: prev.elevator_id, generator_id: prev.generator_id,
    title: prev.title, category: prev.category, notes: prev.notes ?? '', place: prev.place ? { kind: prev.place.kind, id: prev.place.id } : null, vendor_id: prev.vendor_id,
    owner_user_id: prev.owner_user_id, interval: prev.interval, lead_days: prev.lead_days, checklist: prev.checklist ?? [], auto_ticket: prev.auto_ticket,
    department_id: prev.auto_ticket ? prev.department_id : null, doc_type: prev.doc_type, anchor_date: prev.anchor_date, due_date: prev.due_date,
  };
  for (const k of Object.keys(full) as (keyof TaskBody)[]) {
    if (k === 'lead_days' && full.lead_days === null) continue;
    if (k === 'place' && d.kind === 'vendor_document') continue;
    if (!same(full[k], was[k])) (out as Record<string, unknown>)[k] = full[k];
  }
  return out;
}

/** The places the form offers (where the caller may manage), as `<kind>:<id>` options with an indented label. */
export function placeOptions(o: Pick<Options, 'places'>): { value: string; label: string }[] {
  const byParent = new Map<string | null, Options['places']>();
  for (const p of o.places) byParent.set(p.parent_id, [...(byParent.get(p.parent_id) ?? []), p]);
  const out: { value: string; label: string }[] = [];
  const known = new Set(o.places.map((p) => p.id));
  const walk = (p: Options['places'][number], depth: number) => {
    out.push({ value: `${p.kind}:${p.id}`, label: `${depth ? '– '.repeat(depth) : ''}${p.name}` });
    for (const c of byParent.get(p.id) ?? []) walk(c, depth + 1);
  };
  for (const p of o.places) if (!p.parent_id || !known.has(p.parent_id)) walk(p, 0);
  return out;
}

/** A task as a list row (the scan answer and a create return a detail; the lists keep the list shape). */
export function asRow(t: TaskDetail): Task {
  return t;
}


// ---------------------------------------------------------------- MAINT215B: insurance marks, files, the round view, the certificates row


/** The mark of the tickets assignee picker (owner review 24.10, MARKING ONLY): red for an expired or missing insurance, amber while it
 * is about to end; nothing when it is fine or the module is off. */
export function insuranceMark(i: Insurance | null | undefined): { look: 'alarm' | 'warn'; text: string } | null {
  if (!i) return null;
  if (i.state === 'expired') return { look: 'alarm', text: mt('insExpired', { d: i.valid_until ? fmtDate(i.valid_until) : '' }).trim() };
  if (i.state === 'missing') return { look: 'alarm', text: mt('insMissing') };
  if (i.state === 'expiring') return { look: 'warn', text: mt('insExpiring', { d: i.valid_until ? fmtDate(i.valid_until) : '' }).trim() };
  return null;
}

export function fileSizeText(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : mt('fileSize', { n: Math.max(1, Math.round(bytes / 1024)) });
}

export const ROUND_VIEW_KEY = 'sw.maintenance.round_view';

/** The person's own choice of the phone round (a per-browser convenience), else the installation's default from Settings. */
export function roundViewOf(installation: RoundView | undefined): RoundView {
  try {
    const v = localStorage.getItem(ROUND_VIEW_KEY);
    if (v === 'step' || v === 'list') return v;
  } catch {
    /* storage unavailable: the installation default */
  }
  return installation === 'list' ? 'list' : 'step';
}

export function saveRoundView(v: RoundView): void {
  try {
    localStorage.setItem(ROUND_VIEW_KEY, v);
  } catch {
    /* per-browser convenience only */
  }
}

/** The one row of an elevator / generator card: the nearest certificate or inspection (the server sorts by date). */
export function certRowOf(items: readonly Task[]): { task: Task; look: Look; text: string } | null {
  const t = items.find((x) => x.kind === 'certificate' && x.active) ?? items[0];
  if (!t) return null;
  const look = lookOf(t);
  const d = t.due_date ? fmtDate(t.due_date) : '';
  const text = !t.due_date ? mt('stNoDate') : t.state === 'overdue' ? mt('certRowLate', { d }) : t.state === 'due_soon' ? mt('certRowDue', { n: Math.max(0, t.days_left ?? 0), d }) : mt('certRowValid', { d });
  return { task: t, look, text };
}
