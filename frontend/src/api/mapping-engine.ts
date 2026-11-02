/**
 * MAPPING-ASSIST-2330 (owner approval 31.10, round 10 mapping mockup v3 + answers 1A-6A): the mapping assistant's engine. Pure - nothing here
 * draws, fetches or writes. Ported from the mockup's tokenizer / rule engine (private/design-system-2026-10-27/round10/mapping/mapping3.js).
 *
 * The home system names its floors and areas ("א · לובי", "ג-גג", "לובי צפון"). The installation says WHERE the building is marked in a name
 * (MarkSpec: start / end / label / a word inside), with which separators and what kind of token; the engine reads every name into a token,
 * the token table says which of our buildings a token is (answer 1A: remembered for future names), and the result is a building per item:
 *
 *   manual decision (answer: manual beats rules forever)  >  the ordered rules (slice 3 "מתקדם"; without it, one rule = the token table)
 *   >  the area's floor (answer 2A, setting `floor_inherit`)  >  nothing ("לא משויך" / a question in the exceptions step).
 *
 * Conflicts never decide silently: the item carries the recommended answer and is OPEN until the user answers (the exceptions step, slice 2);
 * an open item is left as it is on apply. buildPlan() turns the result into the rows of the existing mapping (SYNOPTIC-HA-2310 layer 1 floor
 * rows and layer 2 area overrides) plus the area -> building rows of the home's site level; the server checks and stores it, versioned.
 */

export type Position = 'start' | 'end' | 'label' | 'word';
export type TokenKind = 'letter' | 'number' | 'word' | 'any';
/** The separator chips (" · ", "-", ":", a space); any other string is a custom separator ("אחר…"). */
export const SEP_CHIPS = ['·', '-', ':', ' '] as const;
export const POSITIONS: readonly Position[] = ['start', 'end', 'label', 'word'];
export const TOKEN_KINDS: readonly TokenKind[] = ['letter', 'number', 'word', 'any'];
/** A token longer than this is not a building mark (a whole phrase before a separator). */
export const TOKEN_MAX = 12;

export interface MarkSpec {
  position: Position;
  /** Separators between the mark and the rest of the name (start / end). */
  seps: string[];
  kind: TokenKind;
  /** position `word`: the word that introduces the mark ("לובי בניין צפון" -> "צפון"). */
  marker: string;
}

export const DEFAULT_SPEC: MarkSpec = { position: 'start', seps: ['·', '-', ':'], kind: 'any', marker: 'בניין' };

/** One floor or area of the home system, as the assistant reads it. */
export interface MapItem {
  id: string;
  kind: 'floor' | 'area';
  name: string;
  /** floors: the platform level (null = none). */
  level?: number | null;
  /** areas: the platform floor id (null = no floor). */
  floorId?: string | null;
  labels?: string[];
}

export const itemKey = (it: Pick<MapItem, 'kind' | 'id'>): string => `${it.kind === 'floor' ? 'f' : 'a'}:${it.id}`;

/** Where something goes: one of our buildings, a building to create on apply, or "לא משויך" on purpose. */
export type Target = { t: 'b'; id: string } | { t: 'new'; name: string } | { t: 'none' };
export const sameTarget = (a: Target | null | undefined, b: Target | null | undefined): boolean =>
  !!a && !!b && a.t === b.t && (a.t === 'b' ? a.id === (b as { id: string }).id : a.t === 'new' ? a.name === (b as { name: string }).name : true);
export const targetKey = (t: Target | null | undefined): string => (!t ? '' : t.t === 'b' ? `b:${t.id}` : t.t === 'new' ? `n:${t.name}` : 'none');

export type RuleKind = 'table' | 'starts' | 'ends' | 'contains' | 'label' | 'regex';
export const RULE_KINDS: readonly RuleKind[] = ['table', 'starts', 'ends', 'contains', 'label', 'regex'];
export interface Rule {
  id: string;
  kind: RuleKind;
  /** The text (starts / ends / contains / label) or the pattern (regex). Unused by `table`. */
  value: string;
  /** The building; null for `table` and for a regex whose first group is looked up in the token table. */
  to: Target | null;
  on: boolean;
}
export const TABLE_RULE: Rule = { id: 'table', kind: 'table', value: '', to: null, on: true };

/** The owner's "changeable" behaviours (answers 2A, 3A, 4A): installation settings, defaults = the recommended answers. */
export interface MappingSettings {
  /** 2A: an area without a mark on a floor of a clear building goes with its floor ("לפי הקומה"). */
  floor_inherit: 'on' | 'off';
  /** 3A: a new name after apply waits for "אשר" (off) or goes in by itself (on). */
  auto_insert: 'off' | 'on';
  /** 4A: a mark with no building - which answer is offered first. */
  new_token: 'new_first' | 'existing_first' | 'unassigned_first';
}
export const MAPPING_SETTINGS_DEFAULT: MappingSettings = { floor_inherit: 'on', auto_insert: 'off', new_token: 'new_first' };
export const MAPPING_SETTING_CHOICES: { [K in keyof MappingSettings]: readonly MappingSettings[K][] } = {
  floor_inherit: ['on', 'off'],
  auto_insert: ['off', 'on'],
  new_token: ['new_first', 'existing_first', 'unassigned_first'],
};

/** What the assistant stores on the server: the mark, the token table, the rules (advanced) and the manual decisions. */
export interface MappingState {
  v: 1;
  spec: MarkSpec;
  /** token -> building (1A: remembered). A token absent here is looked up among our building names, else it is a question. */
  tokens: Record<string, Target>;
  /** Tokens added by hand ("A" -> בניין א) - listed even when no name carries them yet. */
  manual_tokens: string[];
  /** Slice 3: the ordered rules are used when `advanced` is on; else the one rule is the token table. */
  advanced: boolean;
  rules: Rule[];
  /** itemKey -> the user's answer. Beats every rule, forever. */
  decisions: Record<string, Target>;
  /** MAPPING-IMPROVE-2351 "קומות ללא מפלס": platform floor id -> the answer for a floor with no level (none in the home system, none in
   * its name). Without an answer such a floor would land on a new floor of level 0; "skip" keeps exactly that. */
  levels: Record<string, LevelAnswer>;
}
/** A level answer: a level for the new floor, the same as one of our existing floors, or skipped (level 0, the behaviour before). */
export type LevelAnswer = { t: 'level'; level: number } | { t: 'floor'; id: string } | { t: 'skip' };
export const LEVEL_MIN = -50;
export const LEVEL_MAX = 300;
export const emptyState = (spec: MarkSpec = DEFAULT_SPEC): MappingState => ({ v: 1, spec: { ...spec, seps: [...spec.seps] }, tokens: {}, manual_tokens: [], advanced: false, rules: [{ ...TABLE_RULE }], decisions: {}, levels: {} });

/** Our building, as the engine needs it. */
export interface BuildingRef {
  id: string;
  name: string;
  shared?: boolean;
}

// ------------------------------------------------------------------------------------------------------------------------------- tokenizer

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The regex of one separator: surrounding spaces are part of it (" · " = "·" = "· "); a space chip = any run of spaces. */
function sepRe(sep: string): RegExp {
  if (sep === ' ') return /\s+/gu;
  const core = sep.trim();
  return new RegExp(`\\s*${escapeRe(core || sep)}\\s*`, 'gu');
}

/** Every place a separator occurs in the name: [start, end) of the match. A "-" that is a minus sign ("חניון -1": a space before, a digit
 * after) is not a separator. */
function sepMatches(name: string, sep: string): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  const re = sepRe(sep);
  for (let m = re.exec(name); m; m = re.exec(name)) {
    if (m[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    const i = m.index;
    const j = i + m[0].length;
    if (sep.trim() === '-' && /^\s/.test(m[0]) && !/\s$/.test(m[0]) && /\d/.test(name[j] ?? '')) continue;
    out.push({ i, j });
  }
  return out;
}

/** Whether a token is of the asked kind. */
export function kindOk(token: string, kind: TokenKind): boolean {
  if (!token || token.length > TOKEN_MAX) return false;
  switch (kind) {
    case 'letter':
      return /^\p{L}$/u.test(token);
    case 'number':
      return /^\p{Nd}{1,4}$/u.test(token);
    case 'word':
      return /^[\p{L}\p{N}][\p{L}\p{N}'"׳״_.]*$/u.test(token);
    default:
      return (token.match(/\s+/g)?.length ?? 0) <= 1;
  }
}

export interface Tok {
  token: string;
  /** The separator chip that matched (start / end); '' for label and word. */
  sep: string;
  /** The name without the mark ("א · לובי" -> "לובי"). */
  rest: string;
}

/** Reads the building mark of one name. Null = the name carries no mark of this kind. */
export function tokenize(it: Pick<MapItem, 'name' | 'labels'>, spec: MarkSpec): Tok | null {
  const name = (it.name ?? '').trim();
  if (spec.position === 'label') {
    for (const l of it.labels ?? []) {
      const t = l.trim();
      if (kindOk(t, spec.kind === 'any' ? 'any' : spec.kind) || (spec.kind === 'any' && t.length <= 40 && t)) return { token: t, sep: '', rest: name };
    }
    return null;
  }
  if (!name) return null;
  if (spec.position === 'word') {
    const marker = spec.marker.trim();
    if (!marker) return null;
    const m = new RegExp(`(?:^|\\s)${escapeRe(marker)}\\s+(\\S+)`, 'u').exec(name);
    if (!m) return null;
    const token = m[1];
    if (!kindOk(token, spec.kind === 'any' ? 'word' : spec.kind)) return null;
    const rest = (name.slice(0, m.index) + name.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
    return { token, sep: '', rest: rest || name };
  }
  // start / end: every separator's occurrences, the nearest to the edge first; the first that leaves a valid token wins
  const cands: { sep: string; i: number; j: number }[] = [];
  for (const sep of spec.seps) for (const m of sepMatches(name, sep)) cands.push({ sep, ...m });
  if (spec.position === 'start') cands.sort((a, b) => a.i - b.i || b.j - a.j);
  else cands.sort((a, b) => b.j - a.j || a.i - b.i);
  for (const c of cands) {
    const token = (spec.position === 'start' ? name.slice(0, c.i) : name.slice(c.j)).trim();
    const rest = (spec.position === 'start' ? name.slice(c.j) : name.slice(0, c.i)).trim();
    if (!rest || !kindOk(token, spec.kind)) continue;
    return { token, sep: c.sep, rest };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------------------------------------- detection

export interface TokenStat {
  token: string;
  floors: number;
  areas: number;
  /** Up to six names that carry it (the table's samples). */
  samples: string[];
  /** separator chip -> how many names used it with this token. */
  seps: Record<string, number>;
}

export interface Detection {
  total: number;
  marked: number;
  /** Whole percent of the names the spec explains. */
  pct: number;
  /** separator chip -> uses (the chips' small counters). */
  sepUse: Record<string, number>;
  tokens: TokenStat[];
  /** The names without a mark. */
  unmarked: MapItem[];
}

/** How a spec reads all the names: the live preview, the per-token counts of the table and the "%" of the first question. */
export function detect(items: MapItem[], spec: MarkSpec): Detection {
  const stats = new Map<string, TokenStat>();
  const sepUse: Record<string, number> = {};
  const unmarked: MapItem[] = [];
  let marked = 0;
  for (const it of items) {
    const t = tokenize(it, spec);
    if (!t) {
      unmarked.push(it);
      continue;
    }
    marked += 1;
    if (t.sep) sepUse[t.sep] = (sepUse[t.sep] ?? 0) + 1;
    let s = stats.get(t.token);
    if (!s) stats.set(t.token, (s = { token: t.token, floors: 0, areas: 0, samples: [], seps: {} }));
    if (it.kind === 'floor') s.floors += 1;
    else s.areas += 1;
    if (s.samples.length < 6) s.samples.push(it.name);
    if (t.sep) s.seps[t.sep] = (s.seps[t.sep] ?? 0) + 1;
  }
  const tokens = [...stats.values()].sort((a, b) => b.floors + b.areas - (a.floors + a.areas) || a.token.localeCompare(b.token, 'he'));
  return { total: items.length, marked, pct: items.length ? Math.round((100 * marked) / items.length) : 0, sepUse, tokens, unmarked };
}

/** The first question's pre-selected answer: the position (with the separators actually used) that explains the most names. Ties keep the
 * order start > end > label > word. `alternatives` = the "%" of every position card. */
export function suggestSpec(items: MapItem[]): { spec: MarkSpec; pct: number; alternatives: Record<Position, number> } {
  const seps = ['·', '-', ':'];
  const tries: MarkSpec[] = [
    { position: 'start', seps, kind: 'any', marker: DEFAULT_SPEC.marker },
    { position: 'end', seps, kind: 'any', marker: DEFAULT_SPEC.marker },
    { position: 'label', seps, kind: 'any', marker: DEFAULT_SPEC.marker },
    { position: 'word', seps, kind: 'any', marker: DEFAULT_SPEC.marker },
  ];
  const alternatives = {} as Record<Position, number>;
  let best = tries[0];
  let bestPct = -1;
  let bestKey: [number, number, number] = [-1, 0, 0];
  // the most names explained; on a tie the reading with fewer distinct marks, then the shorter marks (a building mark repeats and is short:
  // "לובי · א" read from the end gives "א", from the start "לובי")
  const better = (a: [number, number, number], b: [number, number, number]) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
  for (const s of tries) {
    const d = detect(items, s);
    alternatives[s.position] = d.pct;
    const len = d.tokens.length ? d.tokens.reduce((n, t) => n + t.token.length, 0) / d.tokens.length : 0;
    const key: [number, number, number] = [d.pct, d.tokens.length, len];
    if (better(key, bestKey)) {
      best = s;
      bestPct = d.pct;
      bestKey = key;
    }
  }
  if (best.position === 'start' || best.position === 'end') {
    const used = detect(items, best).sepUse;
    const keep = seps.filter((x) => used[x]);
    best = { ...best, seps: keep.length ? keep : ['·'] };
  }
  return { spec: best, pct: Math.max(0, bestPct), alternatives };
}

// ------------------------------------------------------------------------------------------------------------------------------- the table

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** An existing building a token names: "א" -> "בניין א", "משותף" -> "משותף", "צפון" -> "בניין צפון" / "צפון". */
export function buildingForToken(token: string, buildings: BuildingRef[]): BuildingRef | null {
  const t = norm(token);
  if (!t) return null;
  const strip = (n: string) => norm(n).replace(/^(בניין|מבנה|מגדל|building|tower)\s+/u, '');
  return buildings.find((b) => norm(b.name) === t) ?? buildings.find((b) => strip(b.name) === t) ?? null;
}

/** A token's building: the table, else an existing building of that name, else undefined (a question). */
export function tableTarget(token: string, state: Pick<MappingState, 'tokens'>, buildings: BuildingRef[]): Target | undefined {
  const own = state.tokens[token];
  if (own) return own;
  const b = buildingForToken(token, buildings);
  return b ? { t: 'b', id: b.id } : undefined;
}

/** The name a "בניין חדש" for a token gets: "ה" -> "בניין ה"; a token that already reads as a building keeps its words. */
export const newBuildingName = (token: string): string => (/^(בניין|מבנה|מגדל)\s/u.test(token) || token === 'משותף' ? token : `בניין ${token}`);

export interface TableRow {
  token: string;
  stat: TokenStat;
  target: Target | undefined;
  /** The table says so (vs a suggestion from a building's name). */
  own: boolean;
  /** Another token above goes to the same building ("מאוחד", answer 5C). */
  merged: boolean;
  manual: boolean;
}

/** The token table of step 1: every detected token and the hand-added ones, in detection order; merged = a second token of one building. */
export function tableRows(det: Detection, state: MappingState, buildings: BuildingRef[]): TableRow[] {
  const rows: TableRow[] = [];
  const seen = new Set<string>();
  const add = (token: string, stat: TokenStat, manual: boolean) => {
    if (seen.has(token)) return;
    seen.add(token);
    const target = tableTarget(token, state, buildings);
    const merged = !!target && target.t !== 'none' && rows.some((r) => sameTarget(r.target, target));
    rows.push({ token, stat, target, own: !!state.tokens[token], merged, manual });
  };
  for (const s of det.tokens) add(s.token, s, state.manual_tokens.includes(s.token));
  for (const t of state.manual_tokens) add(t, { token: t, floors: 0, areas: 0, samples: [], seps: {} }, true);
  return rows;
}

/** Merge by drag (answer 5C): the dragged token takes the drop row's building. */
export function mergeTokens(state: MappingState, dragged: string, onto: string, buildings: BuildingRef[]): MappingState {
  const to = tableTarget(onto, state, buildings);
  if (!to || dragged === onto) return state;
  return { ...state, tokens: { ...state.tokens, [dragged]: to } };
}

// ------------------------------------------------------------------------------------------------------------------------------- rules

export interface Hit {
  rule: Rule;
  to: Target | undefined;
  token: string | null;
  sep: string;
}

function safeRe(p: string): RegExp | null {
  try {
    return p ? new RegExp(p, 'u') : null;
  } catch {
    return null;
  }
}

/** Every rule that matches the item, in order. A table / capture hit whose token has no building carries `to: undefined`. */
export function hitsOf(it: MapItem, state: MappingState, buildings: BuildingRef[]): Hit[] {
  const rules = state.advanced ? state.rules : [TABLE_RULE];
  const hits: Hit[] = [];
  const name = it.name.trim();
  for (const r of rules) {
    if (!r.on) continue;
    const v = r.value.trim();
    switch (r.kind) {
      case 'table': {
        const t = tokenize(it, state.spec);
        if (t) hits.push({ rule: r, to: tableTarget(t.token, state, buildings), token: t.token, sep: t.sep });
        break;
      }
      case 'starts':
        if (v && name.startsWith(v)) hits.push({ rule: r, to: r.to ?? undefined, token: null, sep: '' });
        break;
      case 'ends':
        if (v && name.endsWith(v)) hits.push({ rule: r, to: r.to ?? undefined, token: null, sep: '' });
        break;
      case 'contains':
        if (v && name.includes(v)) hits.push({ rule: r, to: r.to ?? undefined, token: null, sep: '' });
        break;
      case 'label':
        if (v && (it.labels ?? []).some((l) => l.trim() === v)) hits.push({ rule: r, to: r.to ?? undefined, token: null, sep: '' });
        break;
      case 'regex': {
        const m = safeRe(r.value)?.exec(name);
        if (!m) break;
        if (r.to) hits.push({ rule: r, to: r.to, token: null, sep: '' });
        else if (m[1]) hits.push({ rule: r, to: tableTarget(m[1], state, buildings), token: m[1], sep: '' });
        break;
      }
    }
  }
  return hits;
}

/** How many floors / areas each rule decides (the first hit with a building), for the advanced list's counters. */
export function ruleCounts(items: MapItem[], state: MappingState, buildings: BuildingRef[]): Record<string, { floors: number; areas: number }> {
  const out: Record<string, { floors: number; areas: number }> = {};
  for (const r of state.rules) out[r.id] = { floors: 0, areas: 0 };
  for (const it of items) {
    const h = hitsOf(it, state, buildings).find((x) => x.to);
    if (!h) continue;
    const c = (out[h.rule.id] ??= { floors: 0, areas: 0 });
    if (it.kind === 'floor') c.floors += 1;
    else c.areas += 1;
  }
  return out;
}

/** Moves a rule (drag = priority). */
export function moveRule(rules: Rule[], from: number, to: number): Rule[] {
  if (from === to || from < 0 || to < 0 || from >= rules.length || to >= rules.length) return rules;
  const out = [...rules];
  const [r] = out.splice(from, 1);
  out.splice(to, 0, r);
  return out;
}

// ------------------------------------------------------------------------------------------------------------------------------- resolution

export type Source = 'manual' | 'rule' | 'floor' | 'none';
export type ConflictKind = 'floor' | 'label' | 'rules' | 'unknown_token' | 'no_mark';

export interface Conflict {
  kind: ConflictKind;
  /** The recommended answer first (the highlighted button), then the others. */
  options: Target[];
  /** floor: the floor's building; label: the label's; rules: the second rule's. */
  alt?: Target;
  token?: string;
}

export interface Res {
  to: Target | null;
  src: Source;
  rule?: string;
  token?: string | null;
  sep?: string;
  /** Needs the user (the exceptions step). An open item is left as it is on apply. */
  open: boolean;
  conflict?: Conflict;
}

export interface ResolveCtx {
  buildings: BuildingRef[];
  settings: MappingSettings;
}

/** The answers offered for a mark with no building, in the order of the setting (answer 4A). */
export function newTokenOptions(token: string, s: MappingSettings): Target[] {
  const nw: Target = { t: 'new', name: newBuildingName(token) };
  const none: Target = { t: 'none' };
  // "existing" is a building picker in the UI - not a fixed target - so it is represented by its position only (see exceptionOrder)
  return s.new_token === 'unassigned_first' ? [none, nw] : [nw, none];
}

/** The order of the three answers to a mark without a building (answer 4A): new / existing / unassigned. */
export function exceptionOrder(s: MappingSettings): ('new' | 'existing' | 'none')[] {
  if (s.new_token === 'existing_first') return ['existing', 'new', 'none'];
  if (s.new_token === 'unassigned_first') return ['none', 'new', 'existing'];
  return ['new', 'existing', 'none'];
}

function labelTarget(it: MapItem, state: MappingState, buildings: BuildingRef[]): Target | undefined {
  for (const l of it.labels ?? []) {
    const t = state.tokens[l.trim()] ?? (() => {
      const b = buildingForToken(l, buildings);
      return b ? ({ t: 'b', id: b.id } as Target) : undefined;
    })();
    if (t && t.t !== 'none') return t;
  }
  return undefined;
}

/** The rule result of one item, ignoring the manual decisions (the floor inheritance needs the floor's result first). */
function byRules(it: MapItem, state: MappingState, ctx: ResolveCtx): Res {
  const hits = hitsOf(it, state, ctx.buildings);
  const first = hits.find((h) => h.to);
  if (!first) {
    const unknown = hits.find((h) => h.token && !h.to);
    if (unknown) return { to: null, src: 'none', token: unknown.token, sep: unknown.sep, open: true, conflict: { kind: 'unknown_token', options: newTokenOptions(unknown.token!, ctx.settings), token: unknown.token! } };
    const lt = labelTarget(it, state, ctx.buildings);
    return { to: null, src: 'none', token: null, open: true, conflict: { kind: 'no_mark', options: lt ? [lt, { t: 'none' }] : [{ t: 'none' }] } };
  }
  const res: Res = { to: first.to!, src: 'rule', rule: first.rule.id, token: first.token, sep: first.sep, open: false };
  const other = hits.find((h) => h !== first && h.to && !sameTarget(h.to, first.to));
  if (other) {
    res.open = true;
    res.conflict = { kind: 'rules', options: [first.to!, other.to!], alt: other.to };
  } else if (first.rule.kind !== 'label') {
    const lt = labelTarget(it, state, ctx.buildings);
    if (lt && !sameTarget(lt, first.to)) {
      res.open = true;
      res.conflict = { kind: 'label', options: [first.to!, lt], alt: lt };
    }
  }
  return res;
}

/** Every item -> its building, source and conflict. Floors first (the areas inherit from them). */
export function resolve(items: MapItem[], state: MappingState, ctx: ResolveCtx): Map<string, Res> {
  const out = new Map<string, Res>();
  const manual = (k: string): Res | null => {
    const d = state.decisions[k];
    return d ? { to: d, src: 'manual', open: false } : null;
  };
  for (const it of items) {
    if (it.kind !== 'floor') continue;
    const k = itemKey(it);
    out.set(k, manual(k) ?? byRules(it, state, ctx));
  }
  for (const it of items) {
    if (it.kind !== 'area') continue;
    const k = itemKey(it);
    const m = manual(k);
    if (m) {
      out.set(k, m);
      continue;
    }
    const r = byRules(it, state, ctx);
    const fr = it.floorId ? out.get(`f:${it.floorId}`) : undefined;
    const floorTo = fr && !fr.open && fr.to && fr.to.t !== 'none' ? fr.to : null;
    if (r.src === 'rule' && floorTo && !sameTarget(r.to, floorTo) && !r.conflict) {
      // the name says one building, the floor it sits on another: recommended = the floor (where it physically is)
      r.open = true;
      r.conflict = { kind: 'floor', options: [floorTo, r.to!], alt: floorTo };
    } else if (r.src === 'none' && floorTo && ctx.settings.floor_inherit === 'on' && r.conflict?.kind === 'no_mark') {
      out.set(k, { to: floorTo, src: 'floor', token: null, open: false });
      continue;
    }
    if (r.conflict?.kind === 'no_mark' && floorTo) r.conflict.options = [floorTo, ...r.conflict.options.filter((o) => !sameTarget(o, floorTo))];
    out.set(k, r);
  }
  return out;
}

/** The recommended answer of an open item (the highlighted button); what a "pick the recommended for all" would set. */
export const recommended = (r: Res): Target | null => r.conflict?.options[0] ?? r.to;

// ------------------------------------------------------------------------------------------------------------------------------- exceptions

export interface Question {
  /** itemKey, or `t:<token>` for a mark without a building (one answer sets the table for every name with it). */
  key: string;
  kind: ConflictKind;
  item: MapItem | null;
  token?: string;
  /** How many names wait on it (a token question). */
  count: number;
  conflict: Conflict;
  res: Res | null;
}

/** Slice 2: only the exceptions, as questions - one per token without a building, one per other open item. */
export function questions(items: MapItem[], res: Map<string, Res>): Question[] {
  const byToken = new Map<string, Question>();
  const out: Question[] = [];
  for (const it of items) {
    const r = res.get(itemKey(it));
    if (!r || !r.open || !r.conflict) continue;
    if (r.conflict.kind === 'unknown_token' && r.conflict.token) {
      const q = byToken.get(r.conflict.token);
      if (q) q.count += 1;
      else {
        const nq: Question = { key: `t:${r.conflict.token}`, kind: 'unknown_token', item: it, token: r.conflict.token, count: 1, conflict: r.conflict, res: r };
        byToken.set(r.conflict.token, nq);
        out.push(nq);
      }
      continue;
    }
    out.push({ key: itemKey(it), kind: r.conflict.kind, item: it, count: 1, conflict: r.conflict, res: r });
  }
  // floors before areas, then by name (a floor answer can close its areas' questions)
  return out.sort((a, b) => (a.item?.kind === 'floor' ? 0 : 1) - (b.item?.kind === 'floor' ? 0 : 1) || (a.item?.name ?? '').localeCompare(b.item?.name ?? '', 'he'));
}

/** Answers one question: a token question sets the table (1A: remembered), any other a manual decision (beats rules forever). */
export function answer(state: MappingState, q: Pick<Question, 'key' | 'token'>, to: Target): MappingState {
  if (q.key.startsWith('t:') && q.token) return { ...state, tokens: { ...state.tokens, [q.token]: to } };
  return { ...state, decisions: { ...state.decisions, [q.key]: to } };
}

/** "השאר את כולם לא משויך לעכשיו": every open question answered "לא משויך". */
export function leaveAllUnassigned(state: MappingState, qs: Question[]): MappingState {
  let s = state;
  for (const q of qs) s = answer(s, q, { t: 'none' });
  return s;
}

/** A rule / table change: how many manual decisions the new rules would have changed (they stay - manual wins - but the user is told). */
export function manualImpact(items: MapItem[], before: MappingState, after: MappingState, ctx: ResolveCtx): number {
  const keys = Object.keys(after.decisions);
  if (!keys.length) return 0;
  const strip = (s: MappingState): MappingState => ({ ...s, decisions: {} });
  const a = resolve(items, strip(before), ctx);
  const b = resolve(items, strip(after), ctx);
  let n = 0;
  for (const k of keys) {
    const ra = a.get(k);
    const rb = b.get(k);
    if (!rb) continue;
    const was = ra ? recommended(ra) : null;
    const now = recommended(rb);
    if (!sameTarget(was, now) && !sameTarget(now, after.decisions[k])) n += 1;
  }
  return n;
}

// ------------------------------------------------------------------------------------------------------------------------------- summary

export interface BuildingSummary {
  key: string;
  target: Target;
  floors: number;
  areas: number;
  manual: number;
  byFloor: number;
  tokens: string[];
}

export interface Summary {
  buildings: BuildingSummary[];
  unassigned: { floors: number; areas: number };
  open: number;
  manual: number;
  byFloor: number;
  total: number;
}

/** Step 3's sentence per building and the counters of the settings page. Existing buildings in their order, then the new ones. */
export function summarize(items: MapItem[], res: Map<string, Res>, buildings: BuildingRef[], rows: TableRow[] = []): Summary {
  const by = new Map<string, BuildingSummary>();
  const ensure = (t: Target) => {
    const k = targetKey(t);
    let s = by.get(k);
    if (!s) by.set(k, (s = { key: k, target: t, floors: 0, areas: 0, manual: 0, byFloor: 0, tokens: [] }));
    return s;
  };
  for (const b of buildings) ensure({ t: 'b', id: b.id });
  const un = { floors: 0, areas: 0 };
  let open = 0;
  let manual = 0;
  let byFloor = 0;
  for (const it of items) {
    const r = res.get(itemKey(it));
    if (!r) continue;
    if (r.open) open += 1;
    if (r.src === 'manual') manual += 1;
    if (r.src === 'floor') byFloor += 1;
    if (r.open || !r.to || r.to.t === 'none') {
      if (it.kind === 'floor') un.floors += 1;
      else un.areas += 1;
      continue;
    }
    const s = ensure(r.to);
    if (it.kind === 'floor') s.floors += 1;
    else s.areas += 1;
    if (r.src === 'manual') s.manual += 1;
    if (r.src === 'floor') s.byFloor += 1;
  }
  for (const row of rows) if (row.target && row.target.t !== 'none') ensure(row.target).tokens.push(row.token);
  return { buildings: [...by.values()], unassigned: un, open, manual, byFloor, total: items.length };
}

// ------------------------------------------------------------------------------------------------------------------------------- the plan

/** A reference the server resolves: an existing id, or `new:<key>` of a building / floor created by the same apply. */
export type Ref = string;

export interface PlanFloor {
  key: string;
  building: Ref;
  name: string;
  level: number;
}

export interface Plan {
  new_buildings: { key: string; name: string }[];
  new_floors: PlanFloor[];
  /** Layer 1: platform floor -> our floor (null = take the row away: "לא משויך" on purpose). */
  floors: { ha_floor_id: string; floor: Ref | null }[];
  /** Layer 2 + the site level: per area - floor: a floor ref / null (taken off every floor) / 'keep' (leave the row) / 'auto' (delete
   * the row: the area follows its platform floor); building: the building of an area without one of our floors (null = delete). */
  areas: { area_id: string; floor: Ref | null | 'keep' | 'auto'; building: Ref | null }[];
  /** Every item key the plan saw (the health card's "new since the last apply"). */
  items: string[];
}

export interface OurFloor {
  id: string;
  building_id: string;
  name: string;
  level: number;
}

export interface CurrentLinks {
  floors: { ha_floor_id: string; floor_id: string }[];
  areas: { area_id: string; floor_id: string | null }[];
  buildings?: { area_id: string; building_id: string }[];
}

/** "קומה 2" -> 2, "קרקע" -> 0, "חניון -1" -> -1; null when the name says no level. */
export function levelFromName(s: string): number | null {
  if (/קרקע|lobby|ground/iu.test(s)) return 0;
  const m = /(-?\d{1,3})/.exec(s.replace(/‎/g, ''));
  return m ? Number(m[1]) : null;
}

/** A floor of "קומות ללא מפלס" (MAPPING-IMPROVE-2351): a platform floor with no level of its own nor in its name that would otherwise land on
 * a NEW floor of level 0 in `building` (an id, or `new:<key>` of a building the same apply creates). */
export interface LevelQuestion {
  id: string;
  /** The building reference of the plan. */
  building: Ref;
  /** The floor's name without the building mark ("א · גלריה" -> "גלריה"). */
  rest: string;
  answer: LevelAnswer | undefined;
}

/** The rows of an apply: our floor of every platform floor resolved to a building (the existing row when it is already in the building, else
 * the building's floor of the same level, else of the same name, else a new floor), and per area the override / site-level row when it does
 * not simply follow its platform floor. Open items and unresolved items are left as they are. A floor with no level anywhere follows its
 * answer in `levels` ("קומות ללא מפלס"); without one it gets a new floor of level 0. `asked` (optional) collects those floors. */
export function buildPlan(items: MapItem[], res: Map<string, Res>, buildings: BuildingRef[], ourFloors: OurFloor[], links: CurrentLinks, levels: Record<string, LevelAnswer> = {}, asked?: LevelQuestion[]): Plan {
  const plan: Plan = { new_buildings: [], new_floors: [], floors: [], areas: [], items: items.map(itemKey) };
  const newB = new Map<string, string>();
  const ref = (t: Target): Ref | null => {
    if (t.t === 'b') return buildings.some((b) => b.id === t.id) ? t.id : null;
    if (t.t === 'new') {
      // a "new" building that exists by now (an older state, a restored version) is not created twice
      const same = buildings.find((b) => norm(b.name) === norm(t.name));
      if (same) return same.id;
      let k = newB.get(t.name);
      if (!k) {
        k = `b${newB.size + 1}`;
        newB.set(t.name, k);
        plan.new_buildings.push({ key: k, name: t.name });
      }
      return `new:${k}`;
    }
    return null;
  };
  const floorsOf = (b: Ref) => ourFloors.filter((f) => f.building_id === b);
  const floorBuilding = new Map(ourFloors.map((f) => [f.id, f.building_id]));
  const rowOf = new Map(links.floors.map((r) => [r.ha_floor_id, r.floor_id]));
  const areaRow = new Map(links.areas.map((r) => [r.area_id, r.floor_id]));
  const areaB = new Map((links.buildings ?? []).map((r) => [r.area_id, r.building_id]));
  const newFloorFor = (b: Ref, name: string, level: number): Ref => {
    let f = plan.new_floors.find((x) => x.building === b && norm(x.name) === norm(name) && x.level === level);
    if (!f) plan.new_floors.push((f = { key: `f${plan.new_floors.length + 1}`, building: b, name, level }));
    return `new:${f.key}`;
  };
  const refBuildingOf = (floorRef: Ref): Ref | undefined => (floorRef.startsWith('new:') ? plan.new_floors.find((f) => `new:${f.key}` === floorRef)?.building : floorBuilding.get(floorRef));
  // platform floor -> (our floor ref, building ref); missing = unresolved / open (it keeps its row, if any)
  const floorOut = new Map<string, { floor: Ref | null; building: Ref | null }>();
  const pickFloor = (b: Ref, hid: string, name: string, level: number | null | undefined): Ref => {
    const cur = rowOf.get(hid);
    if (cur && floorBuilding.get(cur) === b) return cur;
    const mine = b.startsWith('new:') ? [] : floorsOf(b);
    const rest = tokenRest(name, res.get(`f:${hid}`));
    let lv = level ?? levelFromName(rest);
    if (lv === null) {
      const a = levels[hid];
      const sameName = mine.filter((f) => norm(f.name) === norm(rest));
      if (!a && sameName.length === 1) return sameName[0].id; // the building already has this floor by name: nothing to ask
      asked?.push({ id: hid, building: b, rest: rest || name, answer: a });
      if (a?.t === 'floor' && floorBuilding.get(a.id) === b) return a.id;
      if (a?.t === 'level') lv = a.level;
    }
    const sameLevel = lv === null ? [] : mine.filter((f) => f.level === lv);
    if (sameLevel.length === 1) return sameLevel[0].id;
    const sameName = mine.filter((f) => norm(f.name) === norm(rest));
    if (sameName.length === 1) return sameName[0].id;
    return newFloorFor(b, rest || name, lv ?? 0);
  };
  for (const it of items) {
    if (it.kind !== 'floor') continue;
    const r = res.get(itemKey(it));
    if (!r || r.open || !r.to) continue;
    if (r.to.t === 'none') {
      if (rowOf.has(it.id)) plan.floors.push({ ha_floor_id: it.id, floor: null });
      floorOut.set(it.id, { floor: null, building: null });
      continue;
    }
    const b = ref(r.to);
    if (!b) continue;
    const f = pickFloor(b, it.id, it.name, it.level);
    plan.floors.push({ ha_floor_id: it.id, floor: f });
    floorOut.set(it.id, { floor: f, building: b });
  }
  const levelOf = new Map(items.filter((x) => x.kind === 'floor').map((x) => [x.id, x.level ?? null]));
  for (const it of items) {
    if (it.kind !== 'area') continue;
    const r = res.get(itemKey(it));
    if (!r || r.open || !r.to) continue;
    // the building the area reaches through its platform floor (this plan, else today's row)
    const viaPlan = it.floorId ? floorOut.get(it.floorId) : undefined;
    const curRow = it.floorId ? rowOf.get(it.floorId) : undefined;
    const viaFloor: Ref | null = viaPlan ? viaPlan.building : curRow ? floorBuilding.get(curRow) ?? null : null;
    const hadRow = areaRow.has(it.id);
    const hadB = areaB.has(it.id);
    if (r.to.t === 'none') {
      if (r.src === 'manual' || r.src === 'rule') plan.areas.push({ area_id: it.id, floor: null, building: null });
      continue;
    }
    const b = ref(r.to);
    if (!b) continue;
    if (viaFloor === b) {
      // follows its floor: a row that sends it elsewhere goes away; a row inside the building (the floor dialog) stays
      const rowFloor = areaRow.get(it.id);
      const rowInB = rowFloor ? refBuildingOf(rowFloor) === b : false;
      if ((hadRow && !rowInB) || hadB) plan.areas.push({ area_id: it.id, floor: hadRow && !rowInB ? 'auto' : 'keep', building: null });
      continue;
    }
    // another building than its floor's (or no floor): our floor of the same level in that building, else the building only
    const lv = it.floorId ? levelOf.get(it.floorId) ?? null : null;
    const mine = b.startsWith('new:') ? plan.new_floors.filter((f) => f.building === b).map((f) => ({ id: `new:${f.key}`, level: f.level })) : floorsOf(b);
    const same = lv === null ? [] : mine.filter((f) => f.level === lv);
    if (same.length === 1) plan.areas.push({ area_id: it.id, floor: same[0].id, building: null });
    else plan.areas.push({ area_id: it.id, floor: viaFloor || hadRow ? null : 'keep', building: b });
  }
  return plan;
}

function tokenRest(name: string, r: Res | undefined): string {
  if (r?.token && r.sep !== undefined) {
    const t = tokenize({ name }, { position: 'start', seps: r.sep ? [r.sep] : ['·', '-', ':'], kind: 'any', marker: '' });
    if (t && t.token === r.token) return t.rest;
    const e = tokenize({ name }, { position: 'end', seps: r.sep ? [r.sep] : ['·', '-', ':'], kind: 'any', marker: '' });
    if (e && e.token === r.token) return e.rest;
  }
  return name.trim();
}

// ------------------------------------------------------------------------------------------------------------------------------- health

export interface Health {
  /** Items the last apply did not see. */
  fresh: MapItem[];
  /** Of those: resolved by the rules / table / floor - "אשר N". */
  ready: MapItem[];
  /** Of those: need a decision. */
  open: MapItem[];
}

/** Slice 2's health card: what is new in the home system since the last apply (3A: waits for "אשר" unless auto-insert is on). */
export function health(items: MapItem[], res: Map<string, Res>, seen: Iterable<string> | null, waiting: ReadonlySet<string> = new Set()): Health {
  if (!seen) return { fresh: [], ready: [], open: [] };
  const s = new Set(seen);
  const fresh = items.filter((it) => !s.has(itemKey(it)));
  const ready: MapItem[] = [];
  const open: MapItem[] = [];
  for (const it of fresh) {
    const r = res.get(itemKey(it));
    // `waiting`: a floor still without its level ("קומות ללא מפלס") needs the assistant, not "אשר"
    if (r && !r.open && r.to && r.to.t !== 'none' && !waiting.has(itemKey(it))) ready.push(it);
    else open.push(it);
  }
  return { fresh, ready, open };
}

// ------------------------------------------------------------------------------------------------------------------------------- labels

/** HA-LABELS-SYNC-2351: one label of the home system, as the sync mirrored it (read-only). `areas` = how many areas carry it. */
export interface HaLabel {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  areas: number;
}

export interface LabelCoverageRow {
  name: string;
  color: string | null;
  /** Areas that carry this label. */
  areas: number;
  /** Of those: placed BY a label ("התווית היא" rule, or the token table read from labels). */
  byLabel: number;
  /** Of those: placed by something else (name / floor / manual) and the label points to the same building. */
  agrees: number;
  /** Of those: the label points to another building (a "label" conflict, or a manual answer that differs). */
  differs: number;
  /** The building the label points to (table / building name), if any. */
  to: Target | null;
}

export interface LabelCoverage {
  /** The label registry was listed at least once (false = an old core, or not synced yet - not "no labels"). */
  synced: boolean;
  /** Areas of the home system. */
  areas: number;
  /** Areas with at least one label. */
  labelled: number;
  /** Areas whose building comes from a label. */
  byLabel: number;
  /** Labelled areas where the label and the name / floor / manual answer disagree. */
  differs: number;
  /** Per label, in the registry's order (labels no area carries last). */
  rows: LabelCoverageRow[];
}

/** The building a label points to on its own: the token table, else one of our buildings with that name. */
export function labelPointsTo(label: string, state: Pick<MappingState, 'tokens'>, buildings: BuildingRef[]): Target | null {
  const t = state.tokens[label.trim()];
  if (t) return t;
  const b = buildingForToken(label, buildings);
  return b ? { t: 'b', id: b.id } : null;
}

function decidedByLabel(r: Res | undefined, state: MappingState): boolean {
  if (!r || r.src !== 'rule' || !r.to) return false;
  const rule = (state.advanced ? state.rules : [TABLE_RULE]).find((x) => x.id === r.rule);
  return !!rule && (rule.kind === 'label' || (rule.kind === 'table' && state.spec.position === 'label'));
}

/** The health card's "coverage by label": how much of the home system the real labels explain, and where they disagree with the names. */
export function labelCoverage(items: MapItem[], res: Map<string, Res>, state: MappingState, buildings: BuildingRef[], labels: HaLabel[] | null | undefined): LabelCoverage {
  const areas = items.filter((it) => it.kind === 'area');
  const rows = new Map<string, LabelCoverageRow>();
  for (const l of labels ?? []) rows.set(l.name.trim(), { name: l.name, color: l.color, areas: 0, byLabel: 0, agrees: 0, differs: 0, to: labelPointsTo(l.name, state, buildings) });
  let labelled = 0;
  let byLabel = 0;
  let differs = 0;
  for (const it of areas) {
    const names = [...new Set((it.labels ?? []).map((l) => l.trim()).filter(Boolean))];
    if (!names.length) continue;
    labelled += 1;
    const r = res.get(itemKey(it));
    const viaLabel = decidedByLabel(r, state);
    if (viaLabel) byLabel += 1;
    let any = false;
    for (const n of names) {
      let row = rows.get(n);
      if (!row) rows.set(n, (row = { name: n, color: null, areas: 0, byLabel: 0, agrees: 0, differs: 0, to: labelPointsTo(n, state, buildings) }));
      row.areas += 1;
      if (viaLabel) row.byLabel += 1;
      else if (row.to && row.to.t !== 'none' && r?.to && r.to.t !== 'none') {
        if (sameTarget(row.to, r.to)) row.agrees += 1;
        else {
          row.differs += 1;
          any = true;
        }
      }
    }
    if (any || r?.conflict?.kind === 'label') differs += 1;
  }
  const ordered = [...rows.values()].sort((a, b) => (b.areas > 0 ? 1 : 0) - (a.areas > 0 ? 1 : 0));
  return { synced: labels != null, areas: areas.length, labelled, byLabel, differs, rows: ordered };
}

/** One plain sentence about the labels (the health card's last line). */
export function labelCoverageText(c: LabelCoverage): string {
  if (!c.synced) return 'תוויות: עדיין לא נקראו ממערכת הבית, ולכן כללי "בתווית" לא נבדקים כאן.';
  const known = c.rows.length;
  if (!c.labelled) return known ? `תוויות: יש ${known} ${known === 1 ? 'תווית' : 'תוויות'} במערכת הבית, אבל אף אזור לא מסומן באחת מהן.` : 'תוויות: אין תוויות במערכת הבית.';
  const top = c.rows.filter((r) => r.areas > 0).slice(0, 3).map((r) => `${r.name} (${r.areas})`).join(', ');
  const parts = [`תוויות: ${c.labelled} מתוך ${c.areas} אזורים מסומנים בתווית - ${top}${c.rows.filter((r) => r.areas > 0).length > 3 ? ' ועוד' : ''}`];
  parts.push(c.byLabel ? `${c.byLabel} משויכים לפי התווית` : 'אף אזור לא משויך לפי התווית');
  if (c.differs) parts.push(`ב-${c.differs} התווית מצביעה על בניין אחר מהשם`);
  return `${parts.join('; ')}.`;
}

/** The items of the health card's "אשר": only those, so the apply touches nothing else - and only the new buildings / floors their rows
 * still name (MAPPING-IMPROVE-2351: before, every new building / floor of the whole plan went along). */
export function subsetPlan(plan: Plan, keys: Set<string>): Plan {
  const floors = plan.floors.filter((f) => keys.has(`f:${f.ha_floor_id}`));
  const areas = plan.areas.filter((a) => keys.has(`a:${a.area_id}`));
  const usedF = new Set<string>([...floors.map((f) => f.floor), ...areas.map((a) => a.floor)].filter((x): x is string => typeof x === 'string'));
  const new_floors = plan.new_floors.filter((f) => usedF.has(`new:${f.key}`));
  const usedB = new Set<string>([...new_floors.map((f) => f.building), ...areas.map((a) => a.building).filter((x): x is string => !!x)]);
  const new_buildings = plan.new_buildings.filter((b) => usedB.has(`new:${b.key}`));
  return { ...plan, floors, areas, new_floors, new_buildings };
}

/** "קומות ללא מפלס" (MAPPING-IMPROVE-2351): every floor the plan would place with no level to go by, with its current answer. */
export function levelQuestions(items: MapItem[], res: Map<string, Res>, buildings: BuildingRef[], ourFloors: OurFloor[], links: CurrentLinks, levels: Record<string, LevelAnswer>): LevelQuestion[] {
  const asked: LevelQuestion[] = [];
  buildPlan(items, res, buildings, ourFloors, links, levels, asked);
  return asked;
}

/** The floor keys (`f:<id>`) still waiting for their level: the health card sends them to the assistant instead of "אשר". */
export function levelWaiting(items: MapItem[], res: Map<string, Res>, buildings: BuildingRef[], ourFloors: OurFloor[], links: CurrentLinks, levels: Record<string, LevelAnswer>): Set<string> {
  return new Set(levelQuestions(items, res, buildings, ourFloors, links, levels).filter((q) => !q.answer).map((q) => `f:${q.id}`));
}

/** The health card's notice (MAPPING-IMPROVE-2351): what the background auto-insert placed since the last version made by a person - the
 * `auto` versions at the head of the list. */
export function autoAdded(versions: { kind: string; summary: Record<string, unknown> }[]): { areas: number; floors: number } {
  let areas = 0;
  let floors = 0;
  for (const v of versions) {
    if (v.kind !== 'auto') break;
    const n = (k: string) => (typeof v.summary[k] === 'number' ? (v.summary[k] as number) : 0);
    // a client-side auto version (before 2351) carries only `confirmed`
    areas += v.summary.auto_added === undefined ? n('confirmed') : n('auto_areas');
    floors += n('auto_floors');
  }
  return { areas, floors };
}

/** "נוספו אוטומטית N אזורים" - what the background auto-insert placed since the last version made by a person. */
export function autoNoticeText(d: { versions: { kind: string; summary: Record<string, unknown> }[] }): string {
  const a = autoAdded(d.versions);
  if (!a.areas && !a.floors) return '';
  const areas = a.areas === 1 ? 'אזור אחד' : `${a.areas} אזורים`;
  const floors = a.floors === 1 ? 'קומה אחת' : `${a.floors} קומות`;
  const what = a.areas && a.floors ? `${areas} ${a.floors === 1 ? 'וקומה אחת' : `ו-${a.floors} קומות`}` : a.areas ? areas : floors;
  return `${a.areas + a.floors > 1 ? 'נוספו' : a.areas ? 'נוסף' : 'נוספה'} אוטומטית ${what}`;
}

/** A stored level answer read back (null = junk). */
export function levelAnswerOf(x: unknown): LevelAnswer | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.t === 'level' && Number.isInteger(o.level) && (o.level as number) >= LEVEL_MIN && (o.level as number) <= LEVEL_MAX) return { t: 'level', level: o.level as number };
  if (o.t === 'floor' && typeof o.id === 'string' && o.id) return { t: 'floor', id: o.id };
  if (o.t === 'skip') return { t: 'skip' };
  return null;
}

// ------------------------------------------------------------------------------------------------------------------------------- normalize

/** A stored state read back: unknown / broken fields fall back to the defaults (the server keeps the object as sent). */
export function stateOf(raw: unknown): MappingState {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Partial<MappingState>;
  const sp = (o.spec ?? {}) as Partial<MarkSpec>;
  s.spec = {
    position: POSITIONS.includes(sp.position as Position) ? (sp.position as Position) : DEFAULT_SPEC.position,
    seps: Array.isArray(sp.seps) ? sp.seps.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 4).slice(0, 8) : [...DEFAULT_SPEC.seps],
    kind: TOKEN_KINDS.includes(sp.kind as TokenKind) ? (sp.kind as TokenKind) : DEFAULT_SPEC.kind,
    marker: typeof sp.marker === 'string' ? sp.marker.slice(0, 20) : DEFAULT_SPEC.marker,
  };
  const tgt = (x: unknown): Target | null => {
    if (!x || typeof x !== 'object') return null;
    const t = x as Record<string, unknown>;
    if (t.t === 'b' && typeof t.id === 'string') return { t: 'b', id: t.id };
    if (t.t === 'new' && typeof t.name === 'string' && t.name.trim()) return { t: 'new', name: t.name.trim().slice(0, 120) };
    if (t.t === 'none') return { t: 'none' };
    return null;
  };
  for (const [k, v] of Object.entries(o.tokens ?? {})) {
    const t = tgt(v);
    if (t) s.tokens[k] = t;
  }
  for (const [k, v] of Object.entries(o.decisions ?? {})) {
    const t = tgt(v);
    if (t && /^[fa]:/.test(k)) s.decisions[k] = t;
  }
  for (const [k, v] of Object.entries((o as { levels?: Record<string, unknown> }).levels ?? {})) {
    const a = levelAnswerOf(v);
    if (a) s.levels[k] = a;
  }
  s.manual_tokens = Array.isArray(o.manual_tokens) ? o.manual_tokens.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 200) : [];
  s.advanced = o.advanced === true;
  if (Array.isArray(o.rules)) {
    const rules: Rule[] = [];
    for (const r of o.rules as unknown[]) {
      if (!r || typeof r !== 'object') continue;
      const x = r as Partial<Rule>;
      if (!RULE_KINDS.includes(x.kind as RuleKind) || typeof x.id !== 'string') continue;
      rules.push({ id: x.id, kind: x.kind as RuleKind, value: typeof x.value === 'string' ? x.value : '', to: tgt(x.to), on: x.on !== false });
    }
    if (!rules.some((r) => r.kind === 'table')) rules.unshift({ ...TABLE_RULE });
    s.rules = rules;
  }
  return s;
}

export function settingsOf(raw: unknown): MappingSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...MAPPING_SETTINGS_DEFAULT };
  for (const k of Object.keys(MAPPING_SETTING_CHOICES) as (keyof MappingSettings)[]) {
    const v = o[k];
    if ((MAPPING_SETTING_CHOICES[k] as readonly string[]).includes(v as string)) (out as Record<string, string>)[k] = v as string;
  }
  return out;
}
