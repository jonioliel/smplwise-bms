import {
  filterItems, itemChips, manageRight, saveBlocker, sortItems, visibleKinds,
  type AutomationsStatus, type Item, type ItemChip, type ItemKind, type RunSummary, type SceneMember, type ScriptField,
} from '../api/automations';

/**
 * CR-017 S3: the pure logic of the automations screens (no DOM, no network): the route of `#/devices/automations/...`, the list filters,
 * the card's lines and chips, the scene groups, the banners the status asks for, and the tables of the settings tab. The screens render
 * what this returns; `tests/unit-automations-list.spec.ts` covers it without a browser.
 */

// ------------------------------------------------------------------------------------------------ segments and the route

export type Segment = 'automations' | 'scenes' | 'scripts';
export interface SegmentDef { id: Segment; kind: ItemKind; label: string; newLabel: string; searchLabel: string }
export const SEGMENTS: readonly SegmentDef[] = [
  { id: 'automations', kind: 'automation', label: 'אוטומציות', newLabel: 'חדש', searchLabel: 'חיפוש אוטומציה או מכשיר' },
  { id: 'scenes', kind: 'scene', label: 'סצנות', newLabel: 'סצנה חדשה', searchLabel: 'חיפוש סצנה' },
  { id: 'scripts', kind: 'script', label: 'סקריפטים', newLabel: 'סקריפט חדש', searchLabel: 'חיפוש סקריפט' },
];
export const segmentOf = (id: Segment): SegmentDef => SEGMENTS.find((s) => s.id === id) ?? SEGMENTS[0];
export const segmentOfKind = (kind: ItemKind): SegmentDef => SEGMENTS.find((s) => s.kind === kind) ?? SEGMENTS[0];

export const BASE = '/devices/automations';
const RESERVED = new Set(['scenes', 'scripts', 'trash', 'new']);

export type DrawerView = 'detail' | 'trace' | 'versions' | 'dryrun';
export interface AutomationsRoute {
  segment: Segment;
  /** The item whose drawer is open ('' = none). Opaque: a config id or `entity:<entity_id>`. */
  id: string;
  /** `.../trash`: the trash drawer. */
  trash: boolean;
  view: DrawerView;
  /** `?run=<run id>` of the trace view. */
  run: string;
  /** `.../edit` (the builder's route, not this screen's) */
  edit: boolean;
}

/** `#/devices/automations`, `/scenes[/<id>]`, `/scripts[/<id>]`, `/trash`, `/<automation id>` (also CR-018's deep link), `...?view=trace&run=<id>`. */
export function parseAutomationsRoute(segments: readonly string[], params: URLSearchParams): AutomationsRoute {
  const out: AutomationsRoute = { segment: 'automations', id: '', trash: false, view: 'detail', run: '', edit: false };
  const rest = segments.slice(2).map((s) => decodeURIComponent(s));
  if (rest[rest.length - 1] === 'edit') { out.edit = true; rest.pop(); }
  const head = rest[0] ?? '';
  if (head === 'scenes' || head === 'scripts') { out.segment = head; out.id = rest[1] ?? ''; }
  else if (head === 'trash') out.trash = true;
  else if (head && !RESERVED.has(head)) out.id = head;
  const view = params.get('view');
  out.view = view === 'trace' || view === 'versions' || view === 'dryrun' ? view : 'detail';
  out.run = params.get('run') ?? '';
  return out;
}

const enc = encodeURIComponent;
/** The path of a segment / item (without the query). */
export function itemPath(segment: Segment, id = ''): string {
  const base = segment === 'automations' ? BASE : `${BASE}/${segment}`;
  return id ? `${base}/${enc(id)}` : base;
}
export const trashPath = (): string => `${BASE}/trash`;
/** The builder's route (`<automation-builder>` of S4): an item, or `new` with the kind and an optional template. */
export function editPath(kind: ItemKind, id: string): string {
  const seg = segmentOfKind(kind).id;
  return `${itemPath(seg, id)}/edit`;
}
export function newPath(kind: ItemKind): { path: string; params: Record<string, string> } {
  return { path: `${BASE}/new/edit`, params: { kind } };
}

// ------------------------------------------------------------------------------------------------ filters

export type StateFilter = 'all' | 'on' | 'off' | 'sensitive' | 'attention';
export const STATE_FILTERS: ReadonlyArray<{ id: StateFilter; label: string }> = [
  { id: 'all', label: 'הכל' }, { id: 'on', label: 'פעילות' }, { id: 'off', label: 'כבויות' }, { id: 'sensitive', label: 'רגישות' }, { id: 'attention', label: 'דורשות תשומת לב' },
];
export interface ListFilters { q: string; floor: string; state: StateFilter }
export const NO_FILTERS: ListFilters = { q: '', floor: '', state: 'all' };

export function filtersFromParams(p: URLSearchParams): ListFilters {
  const s = p.get('state');
  return { q: p.get('q') ?? '', floor: p.get('floor') ?? '', state: STATE_FILTERS.some((f) => f.id === s) ? (s as StateFilter) : 'all' };
}
export function filtersToParams(f: ListFilters, extra: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.floor) p.set('floor', f.floor);
  if (f.state !== 'all') p.set('state', f.state);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p;
}
export const filtersActive = (f: ListFilters): number => (f.q ? 1 : 0) + (f.floor ? 1 : 0) + (f.state !== 'all' ? 1 : 0);

/** What needs a look: an invalid or unavailable automation, a missing device, a last run that failed (the same predicate the status counts). */
export function needsAttention(i: Item): boolean {
  return i.state === 'invalid' || i.state === 'unavailable' || i.warnings.some((w) => w.code === 'missing_entity') || i.targets.some((t) => t.missing) || i.last_run?.result === 'error';
}
const stateMatches = (i: Item, s: StateFilter): boolean =>
  s === 'all' ? true : s === 'on' ? i.state === 'on' || i.state === 'running' : s === 'off' ? i.state === 'off' : s === 'sensitive' ? i.sensitive : needsAttention(i);

export function stateCounts(items: readonly Item[]): Record<StateFilter, number> {
  return { all: items.length, on: items.filter((i) => stateMatches(i, 'on')).length, off: items.filter((i) => stateMatches(i, 'off')).length,
    sensitive: items.filter((i) => i.sensitive).length, attention: items.filter(needsAttention).length };
}

/** One segment's items with the filters applied: search (name, description, sentence, devices), floor, state; most recently run first. */
export function applyFilters(items: readonly Item[], f: ListFilters, kind: ItemKind): Item[] {
  const base = filterItems(items.filter((i) => i.kind === kind), { q: f.q || undefined, floor: f.floor || undefined, sort: kind === 'scene' ? 'name' : 'last_run' });
  return base.filter((i) => stateMatches(i, kind === 'automation' ? f.state : 'all'));
}

/** The floors of a segment's items (the chips of the header), with how many items each holds. */
export function floorOptions(items: readonly Item[]): Array<{ id: string; name: string; count: number }> {
  const m = new Map<string, { id: string; name: string; count: number }>();
  for (const i of items) for (const f of i.floors) { const x = m.get(f.id) ?? { id: f.id, name: f.name, count: 0 }; x.count += 1; m.set(f.id, x); }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export const countsOf = (items: readonly Item[]): Record<ItemKind, number> => ({
  automation: items.filter((i) => i.kind === 'automation').length, script: items.filter((i) => i.kind === 'script').length, scene: items.filter((i) => i.kind === 'scene' && !i.hidden).length,
});

// ------------------------------------------------------------------------------------------------ the card

export const ALL_HOUSE = 'כל הבית';
/** "קומה 1" / "קומת קרקע · קומה 1" / "קומת קרקע · קומה 1 +1"; an item with no floor is "כל הבית". */
export function floorLine(i: Pick<Item, 'floors'>): string {
  const n = i.floors.map((f) => f.name);
  if (!n.length) return ALL_HOUSE;
  return n.length <= 2 ? n.join(' · ') : `${n.slice(0, 2).join(' · ')} +${n.length - 2}`;
}
/** The areas of the targets: the first three, the rest as "+n"; '' when none. */
export function areaLine(i: Pick<Item, 'areas'>): string {
  const n = i.areas.map((a) => a.name);
  return n.length <= 3 ? n.join(' · ') : `${n.slice(0, 3).join(' · ')} +${n.length - 3}`;
}

const hhmm = (d: Date, timeZone?: string): string => new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(d);
const dayKey = (d: Date, timeZone?: string): string => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(d);
/** "היום 18:42" / "אתמול 23:50" / "28/09 21:02": a time of a run for a chip or a row. */
export function whenText(iso: string, now: Date, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = dayKey(now, timeZone);
  const yesterday = dayKey(new Date(now.getTime() - 86400000), timeZone);
  const key = dayKey(d, timeZone);
  if (key === today) return `היום ${hhmm(d, timeZone)}`;
  if (key === yesterday) return `אתמול ${hhmm(d, timeZone)}`;
  const parts = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', timeZone }).formatToParts(d);
  const day = parts.find((x) => x.type === 'day')?.value ?? '';
  const month = parts.find((x) => x.type === 'month')?.value ?? '';
  return `${day}/${month} ${hhmm(d, timeZone)}`;
}

export type RunTone = 'ok' | 'bad' | 'run' | 'none';
/** The footer line of a card: "רצה לפני 12 דק׳ · 38 ריצות", "נכשלה היום 05:30 · 19 ריצות", "עוד לא רצה". */
export function runLine(i: Pick<Item, 'last_run' | 'runs_7d' | 'kind'>, now: Date, timeZone?: string): { text: string; tone: RunTone; title: string } {
  const last = i.last_run;
  const verb = i.kind === 'script' ? 'הורץ' : i.kind === 'scene' ? 'הופעלה' : 'רצה';
  if (!last) return { text: i.kind === 'script' ? 'עוד לא הורץ' : i.kind === 'scene' ? 'עוד לא הופעלה' : 'עוד לא רצה', tone: 'none', title: '' };
  const mins = Math.floor((now.getTime() - Date.parse(last.at)) / 60000);
  const failed = last.result === 'error';
  const head = failed ? (i.kind === 'script' ? 'נכשל' : 'נכשלה') : verb;
  let when: string;
  if (last.result === 'running') when = 'עכשיו';
  else if (!Number.isFinite(mins)) when = '';
  else if (mins < 1) when = 'עכשיו';
  else if (mins < 60) when = `לפני ${mins} דק׳`;
  else if (mins < 60 * 6) when = `לפני ${Math.floor(mins / 60)} שע׳`;
  else when = whenText(last.at, now, timeZone);
  const n = i.runs_7d;
  const count = n && n > 0 ? ` · ${n} ${i.kind === 'script' ? 'הרצות' : 'ריצות'}` : '';
  return { text: `${head} ${when}${count}`.replace(/\s+/g, ' ').trim(), tone: last.result === 'running' ? 'run' : failed ? 'bad' : last.result === 'ok' ? 'ok' : 'none', title: n ? 'ב־7 הימים האחרונים' : '' };
}

export interface CardChip extends ItemChip { count?: number }
/** The chips under a card, in order. The padlock chip carries its count ("2 חלקים נעולים"); the "off" state is the toggle, not a chip. */
export function cardChips(i: Item, opts: { sensitiveWarning?: boolean } = {}): CardChip[] {
  return itemChips(i, opts)
    .filter((c) => c.id !== 'off' && c.id !== 'running')
    .map((c) => (c.id === 'locked' ? { ...c, count: i.locked_count, label: i.locked_count > 1 ? `${i.locked_count} חלקים נעולים` : 'חלק נעול' } : c));
}

// ------------------------------------------------------------------------------------------------ scenes and scripts

export interface SceneGroup { id: string; title: string; sub: string; items: Item[] }
const NO_AREA = 'ללא חדר';
/** The scenes panel: "מועדפות" first (a favourite is listed there only), then one section per area; hidden scenes never. */
export function groupScenes(items: readonly Item[]): SceneGroup[] {
  const visible = items.filter((i) => i.kind === 'scene' && !i.hidden);
  const favs = visible.filter((i) => i.favourite);
  const groups: SceneGroup[] = [];
  const count = (n: number) => `${n} ${n === 1 ? 'סצנה' : 'סצנות'}`;
  if (favs.length) groups.push({ id: 'favourites', title: 'מועדפות', sub: '', items: favs });
  const byArea = new Map<string, Item[]>();
  for (const i of visible.filter((x) => !x.favourite)) {
    const key = i.areas[0]?.name ?? NO_AREA;
    byArea.set(key, [...(byArea.get(key) ?? []), i]);
  }
  for (const [name, list] of [...byArea.entries()].sort((a, b) => (a[0] === NO_AREA ? 1 : b[0] === NO_AREA ? -1 : a[0].localeCompare(b[0], 'he')))) {
    groups.push({ id: `area:${name}`, title: name, sub: count(list.length), items: list.sort((a, b) => a.name.localeCompare(b.name, 'he')) });
  }
  return groups;
}
export const hiddenScenes = (items: readonly Item[]): Item[] => items.filter((i) => i.kind === 'scene' && i.hidden);

/** The subtitle of a scene card: "הופעלה אתמול 19:40 · 5 מכשירים", "עוד לא הופעלה". */
export function sceneLine(i: Item, now: Date, timeZone?: string, members?: number): string {
  const when = i.last_run ? `הופעלה ${whenText(i.last_run.at, now, timeZone)}` : 'עוד לא הופעלה';
  return members ? `${when} · ${members} מכשירים` : when;
}
export const isIntegrationScene = (i: Pick<Item, 'source'>): boolean => i.source === 'integration';
export const sortScripts = (items: readonly Item[]): Item[] => sortItems(items, 'name');

// ------------------------------------------------------------------------------------------------ run confirmation

/** The one line of the "להריץ עכשיו?" confirmation: the sensitive targets by name, or the unknown effect. */
export function confirmLine(i: Pick<Item, 'sensitive' | 'unknown_effects' | 'targets'>): string {
  const names = i.targets.filter((t) => t.sensitive).map((t) => t.name);
  if (i.sensitive && names.length) return `כולל ${names.join(', ')} – כמו בשליטה ידנית.`;
  if (i.sensitive) return 'כולל פעולה רגישה – כמו בשליטה ידנית.';
  if (i.unknown_effects) return 'כולל פעולה מתקדמת שהשפעתה אינה ידועה.';
  return '';
}

// ------------------------------------------------------------------------------------------------ banners and screen state

export type ScreenKind = 'loading' | 'error' | 'no_permission' | 'feature_disabled' | 'not_configured' | 'ready';
export interface Banner { id: 'stale' | 'offline' | 'delegation_off' | 'read_only'; tone: 'warn' | 'bad' | 'info'; title: string; text: string; retry: boolean }

/** The state of the whole screen from the status (and whether the list failed). The visible kinds come from `visibleKinds` of the client. */
export function screenKind(status: AutomationsStatus | null, o: { failed: boolean; noPermission: boolean; loading: boolean }): ScreenKind {
  if (o.noPermission) return 'no_permission';
  if (!status) return o.failed ? 'error' : 'loading';
  if (status.available === 'feature_disabled') return 'feature_disabled';
  if (status.available === 'not_configured') return 'not_configured';
  if (!visibleKinds(status).length) return 'no_permission';
  if (o.failed) return 'error';
  return o.loading ? 'loading' : 'ready';
}

/** The strips above the list. Short on purpose (clean operator screens): what is wrong and what still works. */
export function banners(status: AutomationsStatus | null, kind: ItemKind): Banner[] {
  if (!status) return [];
  const out: Banner[] = [];
  if (status.available === 'ha_unavailable') out.push({ id: 'offline', tone: 'bad', title: '', text: 'תשתית המערכת אינה זמינה כרגע. מוצג המידע האחרון שנטען.', retry: true });
  else if (status.stale || status.available === 'error') out.push({ id: 'stale', tone: 'warn', title: '', text: 'המידע אינו עדכני. הרענון האחרון נכשל.', retry: true });
  if (manageRight(kind, status) && status.available === 'ok') {
    const b = saveBlocker(kind, status);
    if (b?.code === 'delegation_off') out.push({ id: 'delegation_off', tone: 'warn', title: 'שמירה דורשת מנהל', text: '', retry: false });
    else if (b) out.push({ id: 'read_only', tone: 'info', title: '', text: b.text, retry: false });
  } else if (status.available === 'config_api_unavailable') out.push({ id: 'read_only', tone: 'info', title: '', text: 'עריכה אינה זמינה כרגע', retry: false });
  return out;
}

/** Whether the "חדש" button is offered, and whether it is usable now (a blocker disables it, with the reason as its title). */
export function newButton(status: AutomationsStatus | null, kind: ItemKind): { shown: boolean; disabled: boolean; reason: string } {
  if (!status || !manageRight(kind, status)) return { shown: false, disabled: false, reason: '' };
  const b = saveBlocker(kind, status);
  return { shown: true, disabled: !!b, reason: b?.text ?? '' };
}

// ------------------------------------------------------------------------------------------------ runs

export interface RunRow { run_id: string; label: string; tone: RunTone; sentence: string; result: RunSummary['result'] }
/** The run chips / rows: the time ("היום 18:42"), a tone by result and the sentence. */
export function runRows(runs: readonly RunSummary[], now: Date, timeZone?: string): RunRow[] {
  return runs.map((r) => ({ run_id: r.run_id, label: whenText(r.at, now, timeZone), tone: r.result === 'ok' ? 'ok' : r.result === 'error' ? 'bad' : r.result === 'running' ? 'run' : 'none', sentence: r.sentence, result: r.result }));
}

// ------------------------------------------------------------------------------------------------ the settings tab

export interface RoleRow { id: string; label: string; scope: string; run: boolean; edit: boolean; codeFixed: boolean | null }
/** The documented defaults (CR §7): who may run (activate scenes, run scripts) / create-edit; owner decision 1b (2026-10-01): there is no view-only column -
 * automations are seen only by whoever may create and edit them. The code column follows `automations.code_view_roles` for the roles that can hold it.
 * Read-only here (the roles themselves are assigned in הגדרות › משתמשים והרשאות). */
export const ROLE_ROWS: readonly RoleRow[] = [
  { id: 'viewer', label: 'צופה', scope: '', run: false, edit: false, codeFixed: false },
  { id: 'operator', label: 'מפעיל', scope: '', run: true, edit: false, codeFixed: false },
  { id: 'household', label: 'מפעיל סקריפטים', scope: 'בקומות שלהם', run: true, edit: false, codeFixed: false },
  { id: 'aut_editor', label: 'עורך אוטומציות', scope: 'בקומות שלהם · שמירה דרך האצלה', run: true, edit: true, codeFixed: null },
  { id: 'site_admin', label: 'מנהל אתר / קומה', scope: '', run: true, edit: true, codeFixed: null },
  { id: 'system_admin', label: 'מנהל מערכת', scope: '', run: true, edit: true, codeFixed: true },
];
/** Roles whose code-view switch is configurable (the system administrator always has it). */
export const CODE_VIEW_ROLES: ReadonlyArray<{ id: string; label: string; locked: boolean }> = [
  { id: 'aut_editor', label: 'עורך אוטומציות', locked: false }, { id: 'site_admin', label: 'מנהל אתר / קומה', locked: false }, { id: 'system_admin', label: 'מנהל מערכת', locked: true },
];
export function toggleCodeRole(current: readonly string[], id: string): string[] {
  const def = CODE_VIEW_ROLES.find((r) => r.id === id);
  if (!def || def.locked) return [...current];
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}

/** The label of the delegation state of the status (settings tab; read-only there). */
export function delegationLabel(s: Pick<AutomationsStatus, 'delegation'>): { state: 'on' | 'off' | 'not_needed'; label: string } {
  if (!s.delegation.needed && !s.delegation.on) return { state: 'off', label: 'כבוי' };
  return s.delegation.on ? { state: 'on', label: 'מופעל' } : { state: 'off', label: 'כבוי' };
}

/** Moves a template id one place in the order (the full list is the current visible order). */
export function moveTemplate(order: readonly string[], id: string, dir: -1 | 1): string[] {
  const list = [...order];
  const i = list.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  return list;
}
/** Hides or shows a template (the hidden list keeps its order and no duplicates). */
export function toggleHidden(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
}

/** Retention text of the trash row: "נותרו 26 ימים לשחזור" with the urgent flag below 4 days. */
export function keepText(expiresAt: string, now: Date): { text: string; urgent: boolean } {
  const days = Math.ceil((Date.parse(expiresAt) - now.getTime()) / 86400000);
  if (!Number.isFinite(days)) return { text: '', urgent: false };
  if (days <= 0) return { text: 'פג תוקפו', urgent: true };
  return { text: days === 1 ? 'נותר יום אחד לשחזור' : `נותרו ${days} ימים לשחזור`, urgent: days <= 3 };
}
export function deletedText(at: string, now: Date): string {
  const days = Math.floor((now.getTime() - Date.parse(at)) / 86400000);
  if (!Number.isFinite(days)) return '';
  return days <= 0 ? 'נמחק היום' : days === 1 ? 'נמחק אתמול' : `נמחק לפני ${days} ימים`;
}

// ------------------------------------------------------------------------------------------------ script fields

export interface FieldChoice { value: string; label: string }

/** The starting values of a form: the stored default of every field (a required field without one stays empty). */
export function fieldDefaults(fields: readonly ScriptField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.selector.kind === 'locked') continue;
    if (f.default !== undefined && f.default !== null) out[f.key] = f.default;
    else if (f.selector.kind === 'boolean') out[f.key] = false;
  }
  return out;
}
/** Which required fields still have no value (a blank text, an unset number or choice). */
export function missingFields(fields: readonly ScriptField[], values: Record<string, unknown>): string[] {
  return fields.filter((f) => {
    if (!f.required || f.selector.kind === 'locked') return false;
    const v = values[f.key];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  }).map((f) => f.key);
}

// ------------------------------------------------------------------------------------------------ scene members (the capture table)

type Attr = SceneMember['attributes'][string];
export interface AttrDef { key: string; unit: string; min: number; max: number; step: number; toUi?: (v: number) => number; fromUi?: (v: number) => number }

export const ON_OFF = [{ value: 'on', label: 'דלוק' }, { value: 'off', label: 'כבוי' }];
/** The states a captured member may hold, per domain (Hebrew). */
export const STATE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  light: ON_OFF, switch: ON_OFF, fan: ON_OFF,
  cover: [{ value: 'open', label: 'פתוח' }, { value: 'closed', label: 'סגור' }],
  climate: [{ value: 'off', label: 'כבוי' }, { value: 'cool', label: 'קירור' }, { value: 'heat', label: 'חימום' }, { value: 'heat_cool', label: 'חימום/קירור' }, { value: 'auto', label: 'אוטומטי' }, { value: 'dry', label: 'ייבוש' }, { value: 'fan_only', label: 'מאוורר' }],
  media_player: [{ value: 'on', label: 'דלוק' }, { value: 'off', label: 'כבוי' }, { value: 'playing', label: 'מנגן' }, { value: 'paused', label: 'מושהה' }],
  lock: [{ value: 'locked', label: 'נעול' }, { value: 'unlocked', label: 'פתוח' }],
};
/** The numeric attributes a member of each domain may carry, in UI units (a brightness is shown as a percentage, stored 0-255). */
export const ATTR_DEFS: Record<string, AttrDef[]> = {
  light: [{ key: 'brightness', unit: '%', min: 1, max: 100, step: 1, toUi: (v) => Math.round((v / 255) * 100), fromUi: (v) => Math.round((v / 100) * 255) }, { key: 'color_temp_kelvin', unit: 'K', min: 2000, max: 6500, step: 100 }],
  fan: [{ key: 'percentage', unit: '%', min: 0, max: 100, step: 10 }],
  cover: [{ key: 'current_position', unit: '%', min: 0, max: 100, step: 5 }],
  climate: [{ key: 'temperature', unit: '°', min: 16, max: 30, step: 0.5 }],
  media_player: [{ key: 'volume_level', unit: '%', min: 0, max: 100, step: 5, toUi: (v) => Math.round(v * 100), fromUi: (v) => Math.round(v) / 100 }],
};
export const domainOf = (id: string): string => id.split('.')[0];
export const isOn = (m: SceneMember): boolean => !['off', 'closed', 'unavailable', 'unknown'].includes(m.state);

/** The attribute inputs a row shows: what the member carries, plus the primary one of an "on" device (brightness, temperature, position). */
export function visibleAttrs(m: SceneMember): AttrDef[] {
  const defs = ATTR_DEFS[domainOf(m.entity_id)] ?? [];
  const primary = new Set(['brightness', 'temperature', 'current_position', 'percentage', 'volume_level']);
  return defs.filter((d) => d.key in m.attributes || (isOn(m) && primary.has(d.key) && domainOf(m.entity_id) !== 'media_player' && !(domainOf(m.entity_id) === 'climate' && m.state === 'off')));
}
/** A member with one UI value changed (state or an attribute), or removed when the value is blank. */
export function withValue(m: SceneMember, patch: { state?: string; attr?: { key: string; ui: number | null } }): SceneMember {
  const next: SceneMember = { ...m, attributes: { ...m.attributes } };
  if (patch.state !== undefined) {
    next.state = patch.state;
    if (patch.state === 'off' || patch.state === 'closed') for (const k of Object.keys(next.attributes)) if (k !== 'current_position') delete next.attributes[k];
  }
  if (patch.attr) {
    const def = (ATTR_DEFS[domainOf(m.entity_id)] ?? []).find((d) => d.key === patch.attr!.key);
    if (patch.attr.ui === null || !def) delete next.attributes[patch.attr.key];
    else next.attributes[patch.attr.key] = (def.fromUi ? def.fromUi(patch.attr.ui) : patch.attr.ui) as Attr;
  }
  return next;
}


/** A template as the settings list needs it (id, name, whether it also suggests a schedule). The gallery answer of the server leaves out the templates an
 * administrator hid, so the settings tab remembers the ones it has seen: a hidden template keeps its row (to show it again); an unknown hidden id still gets a row. */
export interface TplRef { id: string; name: string; suggest_schedule: boolean }
export function templateRows(seen: readonly TplRef[], known: readonly TplRef[], hidden: readonly string[]): TplRef[] {
  const merged = new Map<string, TplRef>(known.map((t) => [t.id, t]));
  for (const t of seen) merged.set(t.id, t);
  const out = [...seen];
  for (const id of hidden) if (!seen.some((t) => t.id === id)) out.push(merged.get(id) ?? { id, name: `תבנית ${id}`, suggest_schedule: false });
  return out;
}
