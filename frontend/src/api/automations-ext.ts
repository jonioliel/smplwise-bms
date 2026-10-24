/**
 * KAV079-295 ("הרחבת הקברניט", mockup r079, owner answers 358-366): the client of the editors' extension and its pure helpers. Additive: the routes
 * live under `/automations-ext/` (routers/automation_ext.py); without a backend every call answers "off / nothing" so the demo build is unchanged.
 *
 *   conflictSummary()             per visible item, how many possible conflicts (the list's "התנגשות אפשרית" filter and chips)
 *   draftConflicts(source, ...)   the conflicts of one draft (an automation or a schedule), with the Hebrew lines of the mockup
 *   wallDevices(), deviceButtons(), detectPress()   the button picker, one switch's buttons, "זיהוי בלחיצה על הכפתור"
 *   deviceTestPlan(), restorePlan()                 the on-device test: the plan, then the actions that put the devices back
 *
 * Pure helpers: which preview warnings belong to the pre-save checks, the save mode (save / save with warnings / blocked), and the three-way merge of
 * the manual "השוואה ומיזוג" (owner answer 366: a part changed on BOTH sides is pre-marked with the other person's version and waits for approval).
 */
import { get, post } from './client';
import { isApi } from './session';
import {
  canonicalJson, emitBlock, EXT_FLAGS_OFF,
  type AnyDraft, type AutomationDraft, type Block, type ExtFlags, type Issue, type ModelContext, type PreviewResult, type PressKind,
} from './automations';

// ------------------------------------------------------------------------------------------------ shapes

export interface ConflictRow {
  other: { kind: 'automation' | 'schedule'; id: string; name: string };
  entity_id: string; mine_at: string; other_at: string; delta_min: number; mine: 'on' | 'off'; theirs: 'on' | 'off';
  path: string; other_path: string; title: string; detail: string; window_min: number;
}
export interface ConflictSummary { enabled: boolean; window_min: number | null; items: Array<{ kind: 'automation' | 'schedule'; id: string; count: number }> }
export interface WallDevice { device_id: string; name: string; area: string | null; floor: string | null }
export interface ButtonPress { press: PressKind; ha_type: string; ha_subtype: string; domain: string; discovery_id?: string; used_by: Array<{ id: string; name: string }> }
export interface WallButton { button: number; presses: ButtonPress[]; used: boolean }
export interface DeviceButtons { device_id: string; buttons: WallButton[]; source: 'platform' | 'stored' }
export interface Detected { detected: boolean; button?: number | null; press?: PressKind | null; ha_type?: string; ha_subtype?: string; domain?: string; listen_s: number }
export interface TestStep { path: string; sentence: string; action: string; data: Record<string, unknown>; entity_ids: string[]; sensitive: boolean; now: Array<{ entity_id: string; state: string | null }> }
export interface Snapshot { entity_id: string; state: string | null; attributes: Record<string, unknown> }
export interface TestPlan { steps: TestStep[]; snapshot: Snapshot[]; triggers: Array<{ path: string; device_id: string; button: number; press: PressKind; sentence: string }>; end: ExtFlags['device_test_end'] }
export interface RestoreAction { entity_id: string; action: string; arguments: Record<string, unknown>; sensitive: boolean }

// ------------------------------------------------------------------------------------------------ calls

const enc = encodeURIComponent;
export const conflictSummary = (): Promise<ConflictSummary> => (isApi() ? get<ConflictSummary>('automations-ext/conflicts') : Promise.resolve({ enabled: false, window_min: null, items: [] }));
export const draftConflicts = (source: 'automation' | 'schedule', id: string | null, draft: unknown): Promise<{ enabled: boolean; conflicts: ConflictRow[]; window_min?: number }> =>
  isApi() ? post('automations-ext/conflicts', { source, id, draft }) : Promise.resolve({ enabled: false, conflicts: [] });
export const wallDevices = (): Promise<{ devices: WallDevice[]; timing: ExtFlags['wall_timing'] }> =>
  isApi() ? get('automations-ext/wall-buttons') : Promise.resolve({ devices: [], timing: EXT_FLAGS_OFF.wall_timing });
export const deviceButtons = (deviceId: string, itemId?: string | null): Promise<DeviceButtons> =>
  isApi() ? get(`automations-ext/wall-buttons/${enc(deviceId)}${itemId ? `?item_id=${enc(itemId)}` : ''}`) : Promise.resolve({ device_id: deviceId, buttons: [], source: 'stored' });
export const detectPress = (deviceId: string): Promise<Detected> =>
  isApi() ? post(`automations-ext/wall-buttons/${enc(deviceId)}/detect`, {}) : Promise.resolve({ detected: false, listen_s: 0 });
export const deviceTestPlan = (itemId: string, draft?: AnyDraft | null): Promise<TestPlan> =>
  post(`automations-ext/automation/${enc(itemId)}/device-test`, draft ? { draft } : {});
export const restorePlan = (snapshot: Snapshot[]): Promise<{ actions: RestoreAction[] }> => post('automations-ext/device-test/restore', { snapshot });

// ------------------------------------------------------------------------------------------------ pure helpers

/** The extension switches the status / catalogue echo (all off on an older server). */
export const extFlags = (v: { ext?: ExtFlags } | { extension?: ExtFlags } | null | undefined): ExtFlags => {
  const f = (v && ('ext' in v ? v.ext : 'extension' in v ? v.extension : undefined)) as ExtFlags | undefined;
  return f ? { ...EXT_FLAGS_OFF, ...f, wall_timing: { ...EXT_FLAGS_OFF.wall_timing, ...(f.wall_timing ?? {}) } } : EXT_FLAGS_OFF;
};

/** The warning codes of the pre-save checks (the others - sensitive, suggest_schedule ... - never change the save button). */
export const PRECHECK_CODES = new Set(['conflict', 'button_in_use', 'device_unavailable']);
export const precheckWarnings = (p: Pick<PreviewResult, 'warnings'> | null | undefined): Issue[] => (p?.warnings ?? []).filter((w) => PRECHECK_CODES.has(w.code));

/** What the footer offers: a plain save, "שמירה עם אזהרות" (owner: allowed by default), or blocked by warnings the setting does not let one override. */
export function saveMode(warnings: readonly Issue[], flags: Pick<ExtFlags, 'precheck' | 'save_with_warnings'>): 'save' | 'with_warnings' | 'blocked' {
  if (!flags.precheck || !warnings.length) return 'save';
  return flags.save_with_warnings ? 'with_warnings' : 'blocked';
}

/** "2 אזהרות · אין שגיאות. אפשר לשמור עם אזהרות." */
/** The slot index a schedule conflict row points at (`slots.N`), null for any other path. */
export const conflictSlotIndex = (c: Pick<ConflictRow, 'path'>): number | null => {
  const m = /^slots\.(\d+)$/.exec(c.path);
  return m ? Number(m[1]) : null;
};

/** Where to move the conflicting slot: just outside the window, on the side it already is, and the signed shift in minutes (null when the times do not parse). */
export const conflictMove = (c: Pick<ConflictRow, 'mine_at' | 'other_at' | 'window_min'>): { to: string; delta: number } | null => {
  const at = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const mine = at(c.mine_at), other = at(c.other_at);
  if (mine === null || other === null || !(c.window_min >= 0)) return null;
  const wrap = (n: number) => ((n % 1440) + 1440) % 1440;
  const side = ((mine - other + 1440 + 720) % 1440) - 720 >= 0 ? 1 : -1;  // which side of the other switch this one is on
  const target = wrap(other + side * (c.window_min + 1));
  const delta = ((target - mine + 1440 + 720) % 1440) - 720;
  return { to: `${String(Math.floor(target / 60)).padStart(2, '0')}:${String(target % 60).padStart(2, '0')}`, delta };
};

export const warningsHeading =(n: number): string => (n === 1 ? 'אזהרה אחת' : `${n} אזהרות`);

// ---- the three-way merge (state 5)

export type MergeSide = 'mine' | 'theirs';
export interface MergePart {
  key: string;                 // a stable id of the part: `alias`, `mode`, `triggers.0` ...
  label: string;               // Hebrew: "שם", "טריגר 1", "צעד 2"
  sub: string;                 // the base's sentence (what it was), or ''
  mine: string; theirs: string; // the sentences of each side
  changed: 'mine' | 'theirs' | 'both' | 'none';
  pick: MergeSide;             // the pre-selection (owner 366: `both` -> the other person's version, waiting for approval)
}
export interface MergeInput { base: AutomationDraft; mine: AutomationDraft; theirs: AutomationDraft; ctx: ModelContext }

const SECTIONS: Array<{ key: 'triggers' | 'conditions' | 'actions'; section: 'trigger' | 'condition' | 'action'; noun: string }> = [
  { key: 'triggers', section: 'trigger', noun: 'טריגר' }, { key: 'conditions', section: 'condition', noun: 'תנאי' }, { key: 'actions', section: 'action', noun: 'צעד' },
];
function formOf(b: Block | undefined, section: 'trigger' | 'condition' | 'action', ctx: ModelContext): string {
  if (!b) return '∅';
  try { return canonicalJson(emitBlock(b, section, ctx)); } catch { return canonicalJson({ ...b, uid: '_', sentence: '' }); }
}
const sentenceOf = (b: Block | undefined): string => (b ? b.sentence || '' : '');
function judge(base: string, mine: string, theirs: string): MergePart['changed'] {
  const m = mine !== base; const t = theirs !== base;
  if (m && t) return mine === theirs ? 'none' : 'both';
  return m ? 'mine' : t ? 'theirs' : 'none';
}
const pickOf = (c: MergePart['changed']): MergeSide => (c === 'mine' ? 'mine' : c === 'none' ? 'mine' : 'theirs');

/** The parts of an automation, position by position (name, mode and every trigger / condition / step), each judged against the base the editor started from. */
export function mergeParts({ base, mine, theirs, ctx }: MergeInput): MergePart[] {
  const out: MergePart[] = [];
  const head: Array<{ key: 'alias' | 'description' | 'mode'; label: string }> = [{ key: 'alias', label: 'שם' }, { key: 'description', label: 'תיאור' }, { key: 'mode', label: 'אפשרויות' }];
  for (const h of head) {
    const b = String(base[h.key] ?? ''); const m = String(mine[h.key] ?? ''); const t = String(theirs[h.key] ?? '');
    const changed = judge(b, m, t);
    out.push({ key: h.key, label: h.label, sub: '', mine: m, theirs: t, changed, pick: pickOf(changed) });
  }
  for (const s of SECTIONS) {
    const n = Math.max(base[s.key].length, mine[s.key].length, theirs[s.key].length);
    for (let i = 0; i < n; i++) {
      const bb = base[s.key][i] as Block | undefined; const mb = mine[s.key][i] as Block | undefined; const tb = theirs[s.key][i] as Block | undefined;
      const changed = judge(formOf(bb, s.section, ctx), formOf(mb, s.section, ctx), formOf(tb, s.section, ctx));
      out.push({ key: `${s.key}.${i}`, label: `${s.noun} ${i + 1}`, sub: sentenceOf(bb), mine: mb ? sentenceOf(mb) : 'ללא', theirs: tb ? sentenceOf(tb) : 'ללא', changed, pick: pickOf(changed) });
    }
  }
  return out;
}

/** The merged draft from the picks (a part missing on the picked side is dropped). The result is saved on top of the other person's revision. */
export function applyMerge({ mine, theirs }: Pick<MergeInput, 'mine' | 'theirs'>, parts: readonly MergePart[]): AutomationDraft {
  const pick = new Map(parts.map((p) => [p.key, p.pick]));
  const side = (k: string) => (pick.get(k) === 'mine' ? mine : theirs);
  const out: AutomationDraft = JSON.parse(JSON.stringify(theirs)) as AutomationDraft;
  out.alias = side('alias').alias; out.description = side('description').description; out.mode = side('mode').mode; out.max = side('mode').max;
  for (const s of SECTIONS) {
    const n = Math.max(mine[s.key].length, theirs[s.key].length);
    const list: Block[] = [];
    for (let i = 0; i < n; i++) {
      const b = side(`${s.key}.${i}`)[s.key][i] as Block | undefined;
      if (b) list.push(JSON.parse(JSON.stringify(b)) as Block);
    }
    (out as unknown as Record<string, Block[]>)[s.key] = list;
  }
  return out;
}

/** "3 חלקים משלי · 2 של דנה" (the footer of the merge dialog; the counts are over the CHANGED parts). */
export function mergeCounts(parts: readonly MergePart[]): { mine: number; theirs: number; pending: number } {
  const changed = parts.filter((p) => p.changed !== 'none');
  return { mine: changed.filter((p) => p.pick === 'mine').length, theirs: changed.filter((p) => p.pick === 'theirs').length, pending: changed.filter((p) => p.changed === 'both').length };
}
