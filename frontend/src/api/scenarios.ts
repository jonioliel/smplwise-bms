/** XSCENARIO109-295 (docs/changes/CR-SCENARIO109.md section 17): the typed client of cross-module scenarios. The routes answer 409
 * `scenarios_disabled` while the module switch is off (default); `status` never 403. A scenario never operates a door or a device: the
 * action set is closed (notify, create_service_request, set_flag). */
import { del, get, post, put } from './client';

export type Tri = 'TRUE' | 'FALSE' | 'UNKNOWN';
export type SignalKind = 'bool' | 'number' | 'count' | 'enum';
export type SubjectKind = 'none' | 'window' | 'temperature_unit' | 'door_sensor' | 'area' | 'flag';
export type Cmp = 'is_true' | 'is_false' | 'gt' | 'ge' | 'lt' | 'le' | 'eq' | 'ne' | 'between' | 'outside' | 'in_set';
export type ScenarioState = 'off' | 'ok' | 'active' | 'degraded' | 'suppressed';

export interface ScenariosStatus {
  enabled: boolean;
  kill_switch: boolean;
  can: { view: boolean; manage: boolean; admin: boolean };
  can_use: boolean;
  actions: { notify: boolean; create_service_request: boolean; set_flag: boolean };
  tickets_on: boolean;
}

export interface SignalDef {
  id: string;
  module: string;
  module_label: string;
  kind: SignalKind;
  label: string;
  label_en: string;
  unit: string;
  max_age_s: number;
  subject: SubjectKind;
  range: [number, number] | null;
  default_margin: number;
  default_debounce_s: number;
  subjects: { id: string; name: string }[];
}

export interface TimeWindow { days: number[]; from: string; to: string }

export interface Leaf {
  signal: string;
  subject?: string;
  cmp: Cmp;
  value?: number | boolean | string | number[] | string[] | null;
  window?: TimeWindow;
  hold_s?: number;
  debounce_s?: number;
  max_age_s?: number;
  hysteresis?: { clear_margin: number };
}
export interface Group { op: 'and' | 'or'; items: Node[] }
export interface Not { op: 'not'; item: Node }
export interface Redacted { redacted: true; message: string }
export type Node = Leaf | Group | Not | Redacted;

export type Action =
  | { type: 'notify'; to?: { users?: string[]; roles?: string[] }; severity?: 'info' | 'alert' | 'critical' }
  | { type: 'create_service_request'; department_id: string; priority_key?: string; title?: string }
  | { type: 'set_flag'; flag: string; value: boolean };

export interface Options {
  cooldown_s?: number;
  clear_after_s?: number;
  for_s?: number;
  on_unknown?: 'hold' | 'treat_as_false';
  unknown_grace_s?: number;
  max_fires_per_day?: number;
  max_tickets_per_day?: number;
}

export interface Definition { when: Node; actions: Action[]; options?: Options }

export interface Scenario {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: number;
  state: ScenarioState;
  state_reason: string | null;
  state_reason_text: string;
  last_eval_at: string | null;
  last_result: Tri | null;
  last_fire_at: string | null;
  fires_today: number;
  tickets_today: number;
  owner: { id: string; name: string };
  service_identity: string;
  redacted_leaves: string[];
  warnings: { code: string; message: string }[];
  modules: string[];
  action_types: string[];
  definition?: Definition;
  tested_version?: boolean;
}

export interface LeafSnap {
  path: string;
  signal: string;
  subject: string | null;
  value: unknown;
  unit: string;
  reading_state: string;
  reason: string | null;
  cmp: Cmp;
  target: unknown;
  raw: Tri;
  result: Tri;
  hold_s: number;
  hold_progress_s: number | null;
  redacted?: boolean;
}

export interface DryRun {
  result: Tri;
  would_fire: boolean;
  snapshot: LeafSnap[];
  sentence: string;
  actions: { type: string; switch_on: boolean; tickets_on?: boolean }[];
  at: string;
  simulated: boolean;
  run_id?: string;
  version?: number;
}

export interface Run {
  id: string;
  at: string;
  version: number;
  trigger: string;
  outcome: string;
  result: Tri;
  leaves: LeafSnap[];
  reason: string | null;
  reason_text: string;
  actions: { type: string; status: string; reason?: string }[];
  sentence: string | null;
}

export interface SignalsCatalogue {
  signals: SignalDef[];
  limits: { depth: number; leaves: number; actions: number };
  actions: string[];
  tickets_on: boolean;
  option_defaults: Required<Pick<Options, 'cooldown_s' | 'clear_after_s' | 'for_s' | 'on_unknown' | 'unknown_grace_s'>>;
  option_ranges: Record<string, [number, number]>;
}

export const scenariosStatus = () => get<ScenariosStatus>('scenarios/status');
export const scenarioSignals = () => get<SignalsCatalogue>('scenarios/signals');
export const listScenarios = () => get<{ scenarios: Scenario[]; can_manage: boolean }>('scenarios');
export const getScenario = (id: string) => get<Scenario>(`scenarios/${encodeURIComponent(id)}`);
export const createScenario = (name: string, description: string, definition: Definition) => post<Scenario>('scenarios', { name, description, definition });
export const updateScenario = (id: string, version: number, name: string, description: string, definition: Definition) =>
  put<Scenario>(`scenarios/${encodeURIComponent(id)}`, { version, name, description, definition });
export const deleteScenario = (id: string) => del(`scenarios/${encodeURIComponent(id)}`);
export const enableScenario = (id: string, version: number, confirm = false) => post<Scenario>(`scenarios/${encodeURIComponent(id)}/enable`, { version, confirm });
export const disableScenario = (id: string, version: number) => post<Scenario>(`scenarios/${encodeURIComponent(id)}/disable`, { version });
export const testScenario = (id: string, overrides?: Record<string, number | boolean | null>) => post<DryRun>(`scenarios/${encodeURIComponent(id)}/test`, { overrides: overrides ?? null });
export const simulateScenario = (definition: Definition, overrides?: Record<string, number | boolean | null>) => post<DryRun>('scenarios/simulate', { definition, overrides: overrides ?? null });
export const scenarioRuns = (id: string) => get<{ runs: Run[] }>(`scenarios/${encodeURIComponent(id)}/runs`);
export interface Recipients { users: string[]; roles: string[] }
export interface ScenarioChoices { users: { id: string; name: string }[]; roles: { id: string; name: string }[]; departments: { id: string; name: string }[] }
export const scenarioChoices = () => get<ScenarioChoices>('scenarios/choices');
export const getScenarioSettings = () => get<{ settings: Record<string, unknown> }>('scenarios/settings');
export const saveScenarioSettings = (changes: Record<string, unknown>) => put<{ settings: Record<string, unknown>; changed: string[] }>('scenarios/settings', { changes, confirmed: true });

// ------------------------------------------------------------------------------------------------ pure helpers (unit-tested)

export const isGroup = (n: Node): n is Group => 'op' in n && (n.op === 'and' || n.op === 'or');
export const isNot = (n: Node): n is Not => 'op' in n && n.op === 'not';
export const isRedacted = (n: Node): n is Redacted => 'redacted' in n;
export const isLeaf = (n: Node): n is Leaf => 'signal' in n;

/** The leaves of a tree with their server paths (`when.items[0]`, `when.item`...), in order. */
export function leafPaths(n: Node, path = 'when'): { path: string; leaf: Leaf }[] {
  if (isGroup(n)) return n.items.flatMap((it, i) => leafPaths(it, `${path}.items[${i}]`));
  if (isNot(n)) return leafPaths(n.item, `${path}.item`);
  return isLeaf(n) ? [{ path, leaf: n }] : [];
}

export function cmpsFor(kind: SignalKind): Cmp[] {
  if (kind === 'bool') return ['is_true', 'is_false'];
  if (kind === 'enum') return ['eq', 'ne', 'in_set'];
  if (kind === 'count') return ['gt', 'ge', 'lt', 'le', 'eq', 'ne'];
  return ['gt', 'ge', 'lt', 'le', 'between', 'outside'];
}

/** A new leaf for a signal with sensible defaults (the first subject, a threshold inside the range, the signal's debounce). */
export function newLeaf(s: SignalDef): Leaf {
  const leaf: Leaf = { signal: s.id, cmp: cmpsFor(s.kind)[0] };
  if (s.subject === 'window') leaf.window = { days: [0, 1, 2, 3, 4, 5, 6], from: '18:00', to: '07:00' };
  else if (s.subject !== 'none') leaf.subject = s.subjects[0]?.id ?? '';
  if (s.kind === 'number') leaf.value = s.range ? Math.min(Math.max(8, s.range[0]), s.range[1]) : 0;
  if (s.kind === 'count') leaf.value = 1;
  return leaf;
}

/** Client-side checks that mirror the server's bounds, so the editor can say what is wrong before a round trip (the server stays the authority). */
export function draftProblems(d: Definition, limits: { depth: number; leaves: number; actions: number }): string[] {
  const out: string[] = [];
  let depth = 0;
  const walk = (n: Node, lvl: number) => {
    depth = Math.max(depth, lvl);
    if (isGroup(n)) {
      if (!n.items.length) out.push('empty_group');
      n.items.forEach((it) => walk(it, lvl + 1));
    } else if (isNot(n)) walk(n.item, lvl + 1);
  };
  walk(d.when, 0);
  if (depth > limits.depth) out.push('too_deep');
  if (leafPaths(d.when).length > limits.leaves) out.push('too_many_leaves');
  if (!d.actions.length) out.push('no_actions');
  if (d.actions.length > limits.actions) out.push('too_many_actions');
  return out;
}

export const stateTone = (s: ScenarioState): 'ok' | 'warn' | 'bad' | 'off' =>
  s === 'active' ? 'warn' : s === 'degraded' || s === 'suppressed' ? 'bad' : s === 'ok' ? 'ok' : 'off';

/** The selected list after ticking (on) or unticking one id; order kept, no duplicates. */
export function toggledId(list: readonly string[], id: string, on: boolean): string[] {
  return on ? (list.includes(id) ? [...list] : [...list, id]) : list.filter((x) => x !== id);
}

/** The picker's filter: names containing the query (case-insensitive), at most `max` rows. */
export function filterChoices<T extends { id: string; name: string }>(rows: readonly T[], q: string, max = 40): T[] {
  const s = q.trim().toLowerCase();
  return (s ? rows.filter((r) => r.name.toLowerCase().includes(s)) : [...rows]).slice(0, max);
}
