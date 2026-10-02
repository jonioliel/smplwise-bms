/**
 * CR-017 S4: the pure logic of the editors (`<automation-builder>`, `<script-editor>`, `<scene-editor>`): no DOM, no Lit, so a node spec
 * can run it. The data model is the S0 client's (frontend/src/api/automations.ts: blocks, drafts, locked blocks, sentences, validation);
 * what lives here is what the editors add on top:
 *   - the editing environment (names, scope, notify targets) built from the catalogue and the status;
 *   - tree operations on a draft (add / remove / move / duplicate / update, nested lists included), always on a clone;
 *   - the block-type tables of the type chooser and the factories of new blocks (`raw: null`);
 *   - presence, state choices and icons of blocks;
 *   - the code view: a JSON serialiser that marks locked lines, a position-tracking JSON scanner (inline parse errors, locked line
 *     ranges in text of any formatting) and the template-text replacement of a locked block;
 *   - the conflict diff, the validation-box lines, the place chips, the save route and the scene-member fields.
 * Every rule here mirrors the contract (docs/architecture/AUTOMATIONS_API.md, CR-017); the server re-checks all of it.
 */
import {
  CAPS, SENSITIVE_CLASS_LABEL, blockSentence, canonicalJson, changedLockedBlocks, childLists, draftToConfig, draftTargets, emitBlock, fingerprintOf, newUid, walkDraft,
  type ActionBlock, type AnyDraft, type AutomationCatalog, type AutomationDraft, type AutomationsStatus, type Block, type CatalogEntity, type ConditionBlock, type Issue, type ItemDetail,
  type ItemKind, type LockedBlock, type ModelContext, type SceneDraft, type SceneMember, type ScriptDraft, type SensitiveChip, type TriggerBlock, type UserScope, type Weekday,
} from '../api/automations';

export type Section = 'trigger' | 'condition' | 'action';
type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => v !== null && typeof v === 'object' && !Array.isArray(v);
export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

// ------------------------------------------------------------------------------------------------ environment

export const EMPTY_CATALOG: AutomationCatalog = {
  entities: [], actions: {}, notify_targets: [], scenes: [], scripts: [], floors: [], areas: [], shabbat_sensor: null,
};

export interface EditorEnv {
  status: AutomationsStatus;
  catalog: AutomationCatalog;
  ctx: ModelContext;
  scope: UserScope;
  /** The caller sees only part of the house (a scoped household editor): the picker shows the scope chip. */
  scoped: boolean;
  byId: Map<string, CatalogEntity>;
  notifyActions: string[] | null;
  sensitiveChip: SensitiveChip;
  sensitiveWarning: boolean;
}

/** The catalogue is already filtered by the server to what the caller may use (the authority); the client only mirrors it: a catalogue with exactly one
 *  floor and no unplaced controllable entity is a scoped caller (the picker shows the floor chip, the scope helpers re-apply the same floor); anything else
 *  is treated as installation-wide, which never hides what the server returned. The contract has no explicit scope field (reported to the coordinator). */
export function deriveScope(cat: AutomationCatalog): UserScope {
  if (cat.floors.length === 1 && !cat.entities.some((e) => !e.floor && !e.area && e.actions.length)) return { floors: [cat.floors[0].id], areas: cat.areas.map((a) => a.id) };
  return { floors: null, areas: null };
}

export function buildEnv(status: AutomationsStatus, catalog: AutomationCatalog): EditorEnv {
  const byId = new Map(catalog.entities.map((e) => [e.entity_id, e]));
  const scenes = new Map(catalog.scenes.map((s) => [s.entity_id, s.name]));
  const scripts = new Map(catalog.scripts.map((s) => [s.entity_id, s.name]));
  const notify = new Map(catalog.notify_targets.map((n) => [n.action, n.name]));
  const scope = deriveScope(catalog);
  return {
    status, catalog, scope, byId,
    scoped: catalog.entities.length > 0 && scope.floors !== null,
    ctx: {
      names: (id) => byId.get(id)?.name ?? scenes.get(id) ?? scripts.get(id) ?? id,
      notifyName: (a) => notify.get(a) ?? null,
      shabbatSensor: catalog.shabbat_sensor,
      ...(catalog.allowed_actions ? { allowedActions: catalog.allowed_actions } : {}),
    },
    notifyActions: catalog.notify_targets.length ? catalog.notify_targets.map((n) => n.action) : null,
    sensitiveChip: status.ui.sensitive_chip === 'red' ? 'red' : 'amber',
    sensitiveWarning: status.ui.sensitive_warning !== false,
  };
}

/** The Hebrew noun of a sensitive call, for "אין לך הרשאה ל{noun} ב־{name}" (the contract's §3.3 message). */
export function grantNoun(action: string): string {
  if (action === 'alarm_control_panel.alarm_disarm') return 'נטרול';
  if (action.startsWith('alarm_control_panel.')) return 'דריכה';
  if (action === 'lock.unlock') return 'פתיחת מנעול';
  if (action === 'lock.lock') return 'נעילה';
  if (action.startsWith('siren.')) return 'הפעלת צופר';
  if (action.startsWith('cover.')) return /open/.test(action) ? 'פתיחת שער' : 'סגירת שער';
  return 'שליטה';
}
export const grantText = (action: string, name: string): string => `אין לך הרשאה ל${grantNoun(action)} ב־${name}`;

export function sensitiveLabel(cls: string | null): string {
  return cls && cls in SENSITIVE_CLASS_LABEL ? SENSITIVE_CLASS_LABEL[cls as keyof typeof SENSITIVE_CLASS_LABEL] : 'רגיש';
}

// ------------------------------------------------------------------------------------------------ tree operations

export interface ListInfo { owner: string; name: string; blocks: Block[]; section: Section }
export const ROOT = 'root';

/** Every block list of a draft with its owner (`root` or a container's uid) and name (`triggers`, `then`, `choose.0.sequence` ...). */
export function allLists(draft: AnyDraft): ListInfo[] {
  const out: ListInfo[] = [];
  if ('triggers' in draft) {
    out.push({ owner: ROOT, name: 'triggers', blocks: draft.triggers, section: 'trigger' }, { owner: ROOT, name: 'conditions', blocks: draft.conditions, section: 'condition' }, { owner: ROOT, name: 'actions', blocks: draft.actions, section: 'action' });
  } else if ('sequence' in draft) out.push({ owner: ROOT, name: 'sequence', blocks: draft.sequence, section: 'action' });
  for (const w of walkDraft(draft)) for (const l of childLists(w.block)) out.push({ owner: w.block.uid, name: l.name, blocks: l.blocks, section: l.section });
  return out;
}

/** The list of `owner`/`name`; `else` and `default` are created when absent and `create` is set. */
export function resolveList(draft: AnyDraft, owner: string, name: string, create = false): Block[] | null {
  const found = allLists(draft).find((l) => l.owner === owner && l.name === name);
  if (found) return found.blocks;
  if (!create || owner === ROOT) return null;
  const w = walkDraft(draft).find((x) => x.block.uid === owner);
  if (!w || w.block.kind !== 'typed') return null;
  const b = w.block as { type: string; else?: Block[] | null; default?: Block[] | null };
  if (name === 'else' && b.type === 'if') return (b.else = []);
  if (name === 'default' && b.type === 'choose') return (b.default = []);
  return null;
}

export interface Located { owner: string; name: string; index: number; list: Block[]; section: Section }
export function locate(draft: AnyDraft, uid: string): Located | null {
  for (const l of allLists(draft)) {
    const index = l.blocks.findIndex((b) => b.uid === uid);
    if (index >= 0) return { owner: l.owner, name: l.name, index, list: l.blocks, section: l.section };
  }
  return null;
}

/** The uids of a block and everything inside it. */
export function subtreeUids(b: Block, into: Set<string> = new Set()): Set<string> {
  into.add(b.uid);
  for (const l of childLists(b)) l.blocks.forEach((x) => subtreeUids(x, into));
  if (b.kind === 'typed' && (b as { type?: string }).type === 'condition') subtreeUids((b as Extract<ActionBlock, { type: 'condition' }>).condition, into);
  return into;
}

export function freshUids<T extends Block>(b: T): T {
  b.uid = newUid();
  for (const l of childLists(b)) l.blocks.forEach((x) => freshUids(x));
  if (b.kind === 'typed' && (b as { type?: string }).type === 'condition') freshUids((b as Extract<ActionBlock, { type: 'condition' }>).condition);
  return b;
}
export function freshDraftUids<D extends AnyDraft>(d: D): D {
  for (const l of allLists(d)) if (l.owner === ROOT) l.blocks.forEach((b) => freshUids(b));
  return d;
}

export function addBlock<D extends AnyDraft>(draft: D, owner: string, name: string, block: Block, index?: number): D {
  const d = clone(draft);
  const list = resolveList(d, owner, name, true);
  if (!list) return d;
  list.splice(index === undefined ? list.length : Math.max(0, Math.min(index, list.length)), 0, block);
  return d;
}
export function removeBlock<D extends AnyDraft>(draft: D, uid: string): D {
  const d = clone(draft);
  const at = locate(d, uid);
  if (at) at.list.splice(at.index, 1);
  return d;
}
export function moveBlock<D extends AnyDraft>(draft: D, uid: string, delta: -1 | 1): D {
  const d = clone(draft);
  const at = locate(d, uid);
  if (!at) return d;
  const to = at.index + delta;
  if (to < 0 || to >= at.list.length) return d;
  const [b] = at.list.splice(at.index, 1);
  at.list.splice(to, 0, b);
  return d;
}
export const canMove = (draft: AnyDraft, uid: string, delta: -1 | 1): boolean => {
  const at = locate(draft, uid);
  return !!at && at.index + delta >= 0 && at.index + delta < at.list.length;
};
/** Drag and drop: to `index` of another (or the same) list of the same kind; never into the block's own subtree. */
export function moveBlockTo<D extends AnyDraft>(draft: D, uid: string, toOwner: string, toName: string, toIndex: number): D | null {
  const d = clone(draft);
  const at = locate(d, uid);
  if (!at) return null;
  const target = allLists(d).find((l) => l.owner === toOwner && l.name === toName);
  if (!target || target.section !== at.section) return null;
  const moving = at.list[at.index];
  if (subtreeUids(moving).has(toOwner)) return null;
  at.list.splice(at.index, 1);
  const idx = target.blocks === at.list && toIndex > at.index ? toIndex - 1 : toIndex;
  target.blocks.splice(Math.max(0, Math.min(idx, target.blocks.length)), 0, moving);
  return d;
}
export function duplicateBlock<D extends AnyDraft>(draft: D, uid: string): D {
  const d = clone(draft);
  const at = locate(d, uid);
  if (!at) return d;
  at.list.splice(at.index + 1, 0, freshUids(clone(at.list[at.index])));
  return d;
}
/** Applies `fn` to the block `uid` of a clone of the draft (the walker also finds the inner condition of a condition step). */
export function updateBlock<D extends AnyDraft>(draft: D, uid: string, fn: (b: Block) => void): D {
  const d = clone(draft);
  const w = walkDraft(d).find((x) => x.block.uid === uid);
  if (w) fn(w.block);
  return d;
}

export const stepCount = (d: AnyDraft): number => walkDraft(d).filter((w) => w.section === 'action').length;
export const depthOf = (d: AnyDraft, uid: string): number => walkDraft(d).find((w) => w.block.uid === uid)?.depth ?? 0;

// ------------------------------------------------------------------------------------------------ block types (the type chooser)

export interface BlockTypeDef { id: string; label: string; hint: string; icon: string; sensitive?: boolean; available?: (env: EditorEnv, draft: AnyDraft) => boolean; make: (env: EditorEnv) => Block }
const typed = <T extends object>(b: T): Block => ({ uid: newUid(), kind: 'typed', raw: null, sentence: '', ...b }) as unknown as Block;
const firstOf = <T>(l: readonly T[] | undefined): T | undefined => (l && l.length ? l[0] : undefined);
const hasTriggerIds = (d: AnyDraft) => 'triggers' in d && d.triggers.some((t) => (t.kind === 'typed' ? !!t.id : isObj(t.raw) && typeof t.raw.id === 'string'));

export const PRESENCE_ZONE = 'zone.home';
export const TRIGGER_TYPES: BlockTypeDef[] = [
  { id: 'state', label: 'מצב מכשיר', hint: 'כשמכשיר נדלק, נכבה, נפתח…', icon: 'sensor', make: () => typed({ type: 'state', entity_ids: [], to: 'on' }) },
  { id: 'time', label: 'שעה קבועה', hint: 'בשעה מסוימת', icon: 'clock', make: () => typed({ type: 'time', at: '07:00' }) },
  { id: 'time_pattern', label: 'כל X זמן', hint: 'מחזורי', icon: 'timer', make: () => typed({ type: 'time_pattern', minutes: '/5', hours: null, seconds: null }) },
  { id: 'sun', label: 'זריחה / שקיעה', hint: 'עם היסט לפני/אחרי', icon: 'sunset', make: () => typed({ type: 'sun', event: 'sunset', offset_min: 0 }) },
  { id: 'numeric', label: 'ערך מעל / מתחת', hint: 'טמפרטורה, לחות…', icon: 'thermo', make: () => typed({ type: 'numeric_state', entity_ids: [], above: null, below: null }) },
  { id: 'presence', label: 'נוכחות', hint: 'כולם יצאו · מישהו חזר', icon: 'users', make: () => typed({ type: 'numeric_state', entity_ids: [PRESENCE_ZONE], below: 1, above: null }) },
  { id: 'start', label: 'הפעלת המערכת', hint: 'אחרי עלייה מחדש', icon: 'power', make: () => typed({ type: 'homeassistant', event: 'start' }) },
];
export const CONDITION_TYPES: BlockTypeDef[] = [
  { id: 'state', label: 'מצב מכשיר', hint: 'מכשיר במצב מסוים', icon: 'sensor', make: () => typed({ type: 'state', entity_ids: [], state: 'on' }) },
  { id: 'numeric', label: 'ערך מעל / מתחת', hint: 'טמפרטורה, לחות…', icon: 'thermo', make: () => typed({ type: 'numeric_state', entity_ids: [], above: null, below: null }) },
  { id: 'time', label: 'שעות וימים', hint: 'אחרי / לפני, ימי השבוע', icon: 'clock', make: () => typed({ type: 'time', after: '17:00' }) },
  { id: 'sun', label: 'שקיעה / זריחה', hint: 'אחרי השקיעה, לפני הזריחה', icon: 'sunset', make: () => typed({ type: 'sun', after: 'sunset' }) },
  { id: 'trigger', label: 'מה הפעיל', hint: 'לפי מזהה הטריגר', icon: 'bolt', available: (_e, d) => hasTriggerIds(d), make: () => typed({ type: 'trigger', ids: [] }) },
  { id: 'shabbat', label: 'שבת וחג', hint: 'רק בשבת, או לא בשבת', icon: 'calendar', available: (e) => !!e.catalog.shabbat_sensor, make: () => typed({ type: 'shabbat', mode: 'not_holy_days' }) },
  { id: 'or', label: 'אחד מאלה', hint: 'מספיק תנאי אחד', icon: 'branch', make: () => typed({ type: 'or', conditions: [] }) },
  { id: 'and', label: 'כל אלה', hint: 'כל התנאים יחד', icon: 'branch', make: () => typed({ type: 'and', conditions: [] }) },
  { id: 'not', label: 'לא אלה', hint: 'כשהתנאים לא מתקיימים', icon: 'slash', make: () => typed({ type: 'not', conditions: [] }) },
];
export const SENSITIVE_START = 'alarm_control_panel.alarm_arm_away';
export const ACTION_TYPES: BlockTypeDef[] = [
  { id: 'device', label: 'שליטה במכשיר', hint: 'הדלקה, כיבוי, טמפרטורה…', icon: 'light', make: () => typed({ type: 'service', action: 'light.turn_on', entity_ids: [], data: {}, role: 'device' }) },
  { id: 'scene', label: 'הפעלת סצנה', hint: 'סצנה קיימת', icon: 'scene', available: (e) => e.catalog.scenes.length > 0, make: (e) => { const s = firstOf(e.catalog.scenes)?.entity_id; return typed({ type: 'service', action: 'scene.turn_on', entity_ids: s ? [s] : [], data: {}, role: 'scene' }); } },
  { id: 'script', label: 'הרצת סקריפט', hint: 'סקריפט קיים', icon: 'script', available: (e) => e.catalog.scripts.length > 0, make: (e) => { const s = firstOf(e.catalog.scripts)?.entity_id; return typed({ type: 'service', action: s ?? 'script.turn_on', entity_ids: s ? [s] : [], data: {}, role: 'script' }); } },
  { id: 'notify', label: 'שליחת התראה', hint: 'לטלפון', icon: 'bell', available: (e) => e.catalog.notify_targets.length > 0, make: (e) => typed({ type: 'service', action: firstOf(e.catalog.notify_targets)?.action ?? 'notify.notify', entity_ids: [], data: { message: '' }, role: 'notify' }) },
  { id: 'delay', label: 'השהיה', hint: 'להמתין לפני הצעד הבא', icon: 'timer', make: () => typed({ type: 'delay', delay: { minutes: 3 } }) },
  { id: 'if', label: 'אם / אחרת', hint: 'צעדים לפי תנאי', icon: 'question', make: () => typed({ type: 'if', conditions: [], then: [], else: null }) },
  { id: 'choose', label: 'בחירה לפי תנאים', hint: 'כמה ענפים', icon: 'branch', make: () => typed({ type: 'choose', options: [{ conditions: [], sequence: [] }], default: null }) },
  { id: 'repeat', label: 'חזרה', hint: 'כמה פעמים', icon: 'repeat', make: () => typed({ type: 'repeat_count', count: 3, sequence: [] }) },
  { id: 'condition', label: 'המשך רק אם', hint: 'עוצר אם התנאי לא מתקיים', icon: 'question', make: () => typed({ type: 'condition', condition: typed({ type: 'state', entity_ids: [], state: 'on' }) }) },
  { id: 'stop', label: 'עצירה', hint: 'מפסיק את הריצה', icon: 'stop', make: () => typed({ type: 'stop', message: '' }) },
  { id: 'sensitive', label: 'פעולה רגישה', hint: 'אזעקה, מנעול, שער, צופר', icon: 'alarm', sensitive: true, make: () => typed({ type: 'service', action: SENSITIVE_START, entity_ids: [], data: {}, role: 'device' }) },
];
export const TYPES_OF: Record<Section, BlockTypeDef[]> = { trigger: TRIGGER_TYPES, condition: CONDITION_TYPES, action: ACTION_TYPES };
export const TYPE_POP_TITLE: Record<Section, string> = { trigger: 'מתי להפעיל?', condition: 'רק אם…', action: 'מה לעשות?' };
export const SECTION_LABEL: Record<Section, string> = { trigger: 'כאשר', condition: 'אם', action: 'אז' };

/** A new block of the chosen type (an id of `TYPES_OF[section]`), sentence filled. */
export function makeBlock(section: Section, id: string, env: EditorEnv): Block | null {
  const def = TYPES_OF[section].find((t) => t.id === id);
  if (!def) return null;
  const b = def.make(env);
  b.sentence = blockSentence(b, section, env.ctx);
  const inner = (b as { condition?: Block }).condition;
  if (inner) inner.sentence = blockSentence(inner, 'condition', env.ctx);
  return b;
}

// ------------------------------------------------------------------------------------------------ presence, state choices

export type Presence = 'all_left' | 'someone_home';
export function presenceOf(b: Block): Presence | null {
  if (b.kind !== 'typed') return null;
  const t = b as TriggerBlock;
  if (t.type === 'numeric_state' && t.entity_ids.length === 1 && t.entity_ids[0] === PRESENCE_ZONE && t.below === 1 && t.above == null) return 'all_left';
  if (t.type === 'state' && t.entity_ids.length > 0 && t.entity_ids.every((e) => e.startsWith('person.')) && t.to === 'home') return 'someone_home';
  return null;
}
/** The persons of the house for "מישהו חזר": every person the catalogue lists. */
export const personIds = (env: EditorEnv): string[] => env.catalog.entities.filter((e) => e.domain === 'person').map((e) => e.entity_id);

export interface Choice { value: string; label: string }
const ONOFF: Choice[] = [{ value: 'on', label: 'דלוק / פעיל' }, { value: 'off', label: 'כבוי' }];
/** The states one can pick for an entity of this id, by its domain (and the device class a sensor id suggests). */
export function stateChoices(entityId: string | undefined): Choice[] {
  const id = entityId ?? '';
  const dom = id.split('.')[0];
  if (dom === 'binary_sensor') {
    if (/motion|occupancy|presence/.test(id)) return [{ value: 'on', label: 'זוהתה תנועה' }, { value: 'off', label: 'אין תנועה' }];
    if (/door|window|gate/.test(id)) return [{ value: 'on', label: 'פתוח' }, { value: 'off', label: 'סגור' }];
    if (/leak|water|flood/.test(id)) return [{ value: 'on', label: 'יש מים' }, { value: 'off', label: 'יבש' }];
    return [{ value: 'on', label: 'מופעל' }, { value: 'off', label: 'כבוי' }];
  }
  if (dom === 'person' || dom === 'device_tracker') return [{ value: 'home', label: 'בבית' }, { value: 'not_home', label: 'לא בבית' }];
  if (dom === 'climate') return [{ value: 'off', label: 'כבוי' }, { value: 'cool', label: 'קירור' }, { value: 'heat', label: 'חימום' }, { value: 'auto', label: 'אוטומטי' }, { value: 'fan_only', label: 'מאוורר' }, { value: 'dry', label: 'ייבוש' }, { value: 'heat_cool', label: 'חימום/קירור' }];
  if (dom === 'cover') return [{ value: 'open', label: 'פתוח' }, { value: 'closed', label: 'סגור' }, { value: 'opening', label: 'נפתח' }, { value: 'closing', label: 'נסגר' }];
  if (dom === 'lock') return [{ value: 'locked', label: 'נעול' }, { value: 'unlocked', label: 'פתוח' }];
  if (dom === 'alarm_control_panel') return [{ value: 'disarmed', label: 'מנוטרלת' }, { value: 'armed_home', label: 'דרוכה (בית)' }, { value: 'armed_away', label: 'דרוכה (מלא)' }, { value: 'armed_night', label: 'דרוכה (לילה)' }, { value: 'triggered', label: 'מופעלת' }];
  if (dom === 'media_player') return [{ value: 'off', label: 'כבוי' }, { value: 'on', label: 'דלוק' }, { value: 'playing', label: 'מנגן' }, { value: 'paused', label: 'מושהה' }, { value: 'idle', label: 'לא מנגן' }];
  return ONOFF;
}
export const hasStateChoices = (entityId: string | undefined): boolean => !!entityId && /^(binary_sensor|person|device_tracker|climate|cover|lock|alarm_control_panel|media_player|light|switch|fan|input_boolean|siren|automation)\./.test(entityId);

export const WEEKDAY_LABEL: Record<Weekday, string> = { sun: 'א׳', mon: 'ב׳', tue: 'ג׳', wed: 'ד׳', thu: 'ה׳', fri: 'ו׳', sat: 'ש׳' };
export const MODE_LABEL: Record<string, string> = { single: 'התעלם', restart: 'התחל מחדש', queued: 'המתן בתור', parallel: 'הרץ במקביל' };
export const MODE_SUMMARY: Record<string, string> = { single: 'אם מופעלת שוב בזמן ריצה – התעלם', restart: 'אם מופעלת שוב – התחל מחדש', queued: 'אם מופעלת שוב – המתן בתור', parallel: 'ריצות במקביל' };

// ------------------------------------------------------------------------------------------------ icons, locked reasons

const DOMAIN_ICON: Record<string, string> = { light: 'light', switch: 'power', climate: 'thermo', cover: 'blind', alarm_control_panel: 'alarm', lock: 'lock', siren: 'siren', media_player: 'tv', fan: 'wind', scene: 'scene', script: 'script', notify: 'bell', automation: 'bolt', input_boolean: 'power', timer: 'timer', select: 'list', number: 'thermo' };
export function entityIcon(entityId: string | undefined): string {
  const id = entityId ?? '';
  const dom = id.split('.')[0];
  if (dom === 'binary_sensor') return /motion|occupancy|presence/.test(id) ? 'motion' : /door|window|gate/.test(id) ? 'door' : /leak|water|flood/.test(id) ? 'drop' : 'sensor';
  if (dom === 'person' || dom === 'zone' || dom === 'device_tracker') return 'users';
  if (dom === 'sensor') return /temp/.test(id) ? 'thermo' : 'sensor';
  if (/gate|garage/.test(id) && dom === 'cover') return 'gate';
  return DOMAIN_ICON[dom] ?? 'sensor';
}
export function blockIcon(b: Block, section: Section): string {
  if (b.kind === 'locked') return b.reason === 'template' ? 'template' : b.reason === 'device' ? 'button' : b.reason === 'custom_service' ? 'script' : 'lock';
  const t = b as Block & { type: string };
  if (section === 'trigger') {
    switch (t.type) {
      case 'state': return entityIcon((b as TriggerBlock & { entity_ids: string[] }).entity_ids?.[0]);
      case 'numeric_state': return presenceOf(b) ? 'users' : entityIcon((b as TriggerBlock & { entity_ids: string[] }).entity_ids?.[0]) === 'sensor' ? 'thermo' : entityIcon((b as TriggerBlock & { entity_ids: string[] }).entity_ids?.[0]);
      case 'time': return 'clock'; case 'time_pattern': return 'timer'; case 'sun': return 'sunset'; default: return 'power';
    }
  }
  if (section === 'condition') {
    switch (t.type) {
      case 'state': case 'numeric_state': return entityIcon((b as ConditionBlock & { entity_ids: string[] }).entity_ids?.[0]);
      case 'time': return 'clock'; case 'sun': return 'sunset'; case 'trigger': return 'bolt'; case 'shabbat': return 'calendar'; case 'not': return 'slash'; default: return 'branch';
    }
  }
  switch (t.type) {
    case 'service': { const s = b as Extract<ActionBlock, { type: 'service' }>; return s.role === 'device' ? entityIcon(s.entity_ids[0] ?? s.action) : DOMAIN_ICON[s.role] ?? 'bolt'; }
    case 'delay': return 'timer'; case 'if': return 'question'; case 'choose': return 'branch'; case 'repeat_count': return 'repeat'; case 'condition': return 'question'; default: return 'stop';
  }
}

/** Why a block is locked, in one short line (the "why locked" chip's text); a typed schema for the reason may arrive later (CR §6.2). */
export const LOCKED_WHY: Record<string, string> = {
  template: 'תבנית – נשמרת כמו שהיא', device: 'כפתור או מכשיר – נשמר כמו שהוא', purpose_trigger: 'טריגר ייעודי – נשמר כמו שהוא', custom_service: 'שירות מיוחד – נשמר כמו שהוא',
  service_not_allowed: 'שירות שאינו מותר בבונה – נשמר כמו שהוא', unsupported_step: 'צעד מתקדם – נשמר כמו שהוא', disabled_step: 'צעד מושבת – נשמר כמו שהוא', secret: 'ערך חסוי – לא מוצג', code: 'קוד חסוי – לא מוצג', unknown: 'חלק לא מוכר – נשמר כמו שהוא',
};
export const lockedWhy = (b: LockedBlock): string => LOCKED_WHY[b.reason] ?? LOCKED_WHY.unknown;

// ------------------------------------------------------------------------------------------------ locked template text (code-view permission)

const TEMPLATE_RE = /\{\{|\{%|\{#/;
/** `raw` with the first template string replaced by `text`. */
export function replaceFirstTemplate(raw: unknown, text: string): unknown {
  let done = false;
  const walk = (v: unknown): unknown => {
    if (done) return v;
    if (typeof v === 'string') { if (TEMPLATE_RE.test(v)) { done = true; return text; } return v; }
    if (Array.isArray(v)) return v.map(walk);
    if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(raw);
}
/** The locked block after its template text was edited: new raw, new fingerprint (so the save needs the code view's permission). */
export function withTemplateText(b: LockedBlock, text: string): LockedBlock {
  const raw = replaceFirstTemplate(b.raw, text);
  return { ...b, raw, template_text: text, fingerprint: fingerprintOf(raw) };
}

// ------------------------------------------------------------------------------------------------ the code view

export interface CodeLine { text: string; locked: boolean }
/** JSON.stringify(value, null, 2), line by line, each line marked when it belongs to a locked block (matched by fingerprint). */
export function codeLines(value: unknown, locked: ReadonlySet<string>): CodeLine[] {
  const out: CodeLine[] = [];
  const emit = (text: string, lk: boolean) => out.push({ text, locked: lk });
  const isLockedEl = (x: unknown) => (isObj(x) || (typeof x === 'string' && TEMPLATE_RE.test(x))) && locked.has(fingerprintOf(x));
  const walk = (v: unknown, indent: string, prefix: string, suffix: string, lk: boolean): void => {
    if (Array.isArray(v)) {
      if (!v.length) { emit(`${indent}${prefix}[]${suffix}`, lk); return; }
      emit(`${indent}${prefix}[`, lk);
      v.forEach((x, i) => walk(x, `${indent}  `, '', i < v.length - 1 ? ',' : '', lk || isLockedEl(x)));
      emit(`${indent}]${suffix}`, lk);
    } else if (isObj(v)) {
      const keys = Object.keys(v).filter((k) => v[k] !== undefined);
      if (!keys.length) { emit(`${indent}${prefix}{}${suffix}`, lk); return; }
      emit(`${indent}${prefix}{`, lk);
      keys.forEach((k, i) => walk(v[k], `${indent}  `, `${JSON.stringify(k)}: `, i < keys.length - 1 ? ',' : '', lk));
      emit(`${indent}}${suffix}`, lk);
    } else emit(`${indent}${prefix}${JSON.stringify(v)}${suffix}`, lk);
  };
  walk(value, '', '', '', false);
  return out;
}

export type JsonScan =
  | { ok: true; value: unknown; ranges: Array<{ from: number; to: number; value: unknown }> }
  | { ok: false; pos: number; line: number; column: number; message: string };

/** A JSON parser that keeps positions: where an error is (line, column; Hebrew message) and the character range of every array element, so the
 *  locked blocks are found in text of any formatting. The value equals JSON.parse's. */
export function scanJson(text: string): JsonScan {
  let i = 0;
  const ranges: Array<{ from: number; to: number; value: unknown }> = [];
  class Fail extends Error { constructor(public pos: number, m: string) { super(m); } }
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const fail = (m: string, at = i): never => { throw new Fail(at, m); };
  const show = (c: string | undefined) => (c === undefined ? 'סוף הקוד' : `"${c}"`);
  const str = (): string => {
    const start = i;
    i++;
    let out = '';
    while (i < text.length) {
      const c = text[i];
      if (c === '"') { i++; return out; }
      if (c === '\n') fail('מחרוזת לא נסגרת', start);
      if (c === '\\') {
        const n = text[i + 1];
        const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' };
        if (n === 'u') { const h = text.slice(i + 2, i + 6); if (!/^[0-9a-fA-F]{4}$/.test(h)) fail('רצף \\u לא תקין'); out += String.fromCharCode(parseInt(h, 16)); i += 6; continue; }
        if (!(n in map)) fail('רצף בריחה לא תקין');
        out += map[n]; i += 2; continue;
      }
      out += c; i++;
    }
    return fail('מחרוזת לא נסגרת', start);
  };
  const value = (inArray: boolean): unknown => {
    ws();
    const from = i;
    const c = text[i];
    let v: unknown;
    if (c === '{') {
      i++; ws();
      const o: Raw = {};
      if (text[i] === '}') i++;
      else for (;;) {
        ws();
        if (text[i] !== '"') fail(`צפוי שם שדה במירכאות, נמצא ${show(text[i])}`);
        const k = str(); ws();
        if (text[i] !== ':') fail(`חסר ":" אחרי "${k}"`);
        i++;
        o[k] = value(false); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; break; }
        fail(`צפוי "," או "}", נמצא ${show(text[i])}`);
      }
      v = o;
    } else if (c === '[') {
      i++; ws();
      const a: unknown[] = [];
      if (text[i] === ']') i++;
      else for (;;) {
        a.push(value(true)); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; break; }
        fail(`צפוי "," או "]", נמצא ${show(text[i])}`);
      }
      v = a;
    } else if (c === '"') v = str();
    else if (text.startsWith('true', i)) { i += 4; v = true; }
    else if (text.startsWith('false', i)) { i += 5; v = false; }
    else if (text.startsWith('null', i)) { i += 4; v = null; }
    else {
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
      if (!m) fail(`תו לא צפוי ${show(c)}`);
      i += m![0].length; v = Number(m![0]);
    }
    if (inArray && (isObj(v) || typeof v === 'string')) ranges.push({ from, to: i, value: v });
    return v;
  };
  try {
    const v = value(false);
    ws();
    if (i < text.length) fail(`תו לא צפוי ${show(text[i])} אחרי סוף האובייקט`);
    return { ok: true, value: v, ranges };
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    const before = text.slice(0, e.pos);
    const line = before.split('\n').length;
    return { ok: false, pos: e.pos, line, column: e.pos - before.lastIndexOf('\n'), message: e.message };
  }
}

/** The line ranges (0-based, inclusive) of the locked blocks in `text`; `[]` when the text does not parse. */
export function lockedLineRanges(text: string, locked: ReadonlySet<string>): Array<{ from: number; to: number }> {
  const s = scanJson(text);
  if (!s.ok || !locked.size) return [];
  const starts = [0];
  for (let k = 0; k < text.length; k++) if (text[k] === '\n') starts.push(k + 1);
  const lineOf = (pos: number) => { let lo = 0; let hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  const out: Array<{ from: number; to: number }> = [];
  for (const r of s.ranges) {
    if (!locked.has(fingerprintOf(r.value))) continue;
    const a = lineOf(r.from); const b = lineOf(Math.max(r.from, r.to - 1));
    if (!out.some((x) => x.from <= a && x.to >= b)) out.push({ from: a, to: b });
  }
  return out;
}

export const lockedFingerprints = (draft: AnyDraft): Set<string> => {
  const s = new Set<string>();
  for (const w of walkDraft(draft)) if (w.block.kind === 'locked') s.add(w.block.fingerprint);
  return s;
};

/** `scanJson`'s failure as one line for the code view ("שורה 7 · חסר ":"…"). */
export const scanErrorText = (s: Extract<JsonScan, { ok: false }>): string => `שורה ${s.line}, עמודה ${s.column} · ${s.message}`;

/** The stored JSON of an item for the code view: `detail.config` when the server sends it (forward compatible), else null. */
export function storedConfigOf(item: ItemDetail | null): unknown | null {
  const c = (item as (ItemDetail & { config?: unknown }) | null)?.config;
  return isObj(c) ? c : null;
}

// ------------------------------------------------------------------------------------------------ dirty, save route, issues

/** The canonical stored form of a draft (what `dirty` compares: untouched blocks are their raw, so a reverted edit is clean). */
export function canonicalOf(kind: ItemKind, draft: AnyDraft, ctx: ModelContext, id: string | null = null): string {
  try {
    return canonicalJson(draftToConfig(kind, draft, null, ctx, { id }));
  } catch {
    return JSON.stringify(draft);
  }
}

export type SaveRoute = 'create' | 'replace' | 'code';
/** Create / replace through the builder routes, or the code route when a locked block changed (CR §4.5: the profile follows the content). */
export function saveRoute(isNew: boolean, draft: AnyDraft, stored: AnyDraft | null): SaveRoute {
  if (isNew) return 'create';
  return changedLockedBlocks(draft, stored).length ? 'code' : 'replace';
}

const ROOT_LABEL: Record<string, string> = { triggers: 'כאשר', conditions: 'אם', actions: 'אז', sequence: 'אז', alias: 'שם', name: 'שם', description: 'תיאור', fields: 'שדות', members: 'מכשירים', mode: 'אפשרויות', max: 'אפשרויות', config: 'קוד' };
export const issueSection = (path: string): string => ROOT_LABEL[path.split(/[./[\]]+/).filter(Boolean)[0] ?? ''] ?? 'שגיאה';
export function issueLine(i: Issue): { where: string; what: string } { return { where: issueSection(i.path), what: i.message }; }
/** Local issues + the server's, one per path and code. */
export function mergeIssues(...lists: ReadonlyArray<readonly Issue[]>): Issue[] {
  const seen = new Set<string>();
  const out: Issue[] = [];
  for (const l of lists) for (const i of l) { const k = `${i.path}|${i.code}`; if (!seen.has(k)) { seen.add(k); out.push(i); } }
  return out;
}

// ------------------------------------------------------------------------------------------------ places (header chips)

export function placeChips(item: Pick<ItemDetail, 'floors' | 'areas'> | null, draft: AnyDraft, env: EditorEnv): { floors: string; areas: string; more: number } {
  const floors = new Map<string, string>(); const areas = new Map<string, string>();
  if (item) { item.floors.forEach((f) => floors.set(f.id, f.name)); item.areas.forEach((a) => areas.set(a.id, a.name)); }
  else for (const id of draftTargets(draft)) {
    const e = env.byId.get(id);
    if (e?.floor) floors.set(e.floor.id, e.floor.name);
    if (e?.area) areas.set(e.area.id, e.area.name);
  }
  const a = [...areas.values()];
  return { floors: [...floors.values()].join(' · '), areas: a.slice(0, 3).join(' · '), more: Math.max(0, a.length - 3) };
}

// ------------------------------------------------------------------------------------------------ conflict diff

export interface DiffRow { group: string; change: 'changed' | 'added' | 'removed'; mine: string; theirs: string }
/** What differs between my draft and the current stored one (the conflict "השווה" view). `added` = only mine; `removed` = only theirs. */
export function diffDrafts(kind: ItemKind, mine: AnyDraft, theirs: AnyDraft, ctx: ModelContext): DiffRow[] {
  const rows: DiffRow[] = [];
  const field = (group: string, a: string, b: string) => { if (a !== b) rows.push({ group, change: 'changed', mine: a || '—', theirs: b || '—' }); };
  const blocks = (group: string, a: Block[], b: Block[], section: Section) => {
    const key = (x: Block) => canonicalJson(emitBlock(x, section, ctx));
    const sent = (x: Block) => blockSentence(x, section, ctx);
    const rest = b.map((x, i) => ({ x, i, k: key(x) }));
    const unmatched: Block[] = [];
    for (const x of a) {
      const k = key(x);
      const at = rest.findIndex((r) => r.k === k);
      if (at >= 0) rest.splice(at, 1); else unmatched.push(x);
    }
    const pairs = Math.min(unmatched.length, rest.length);
    for (let n = 0; n < pairs; n++) rows.push({ group, change: 'changed', mine: sent(unmatched[n]), theirs: sent(rest[n].x) });
    for (const x of unmatched.slice(pairs)) rows.push({ group, change: 'added', mine: sent(x), theirs: '—' });
    for (const r of rest.slice(pairs)) rows.push({ group, change: 'removed', mine: '—', theirs: sent(r.x) });
  };
  if (kind === 'automation') {
    const x = mine as AutomationDraft; const y = theirs as AutomationDraft;
    field('שם', x.alias, y.alias); field('תיאור', x.description, y.description);
    field('אפשרויות', `${MODE_LABEL[x.mode]}${x.max ? ` · ${x.max}` : ''}`, `${MODE_LABEL[y.mode]}${y.max ? ` · ${y.max}` : ''}`);
    blocks('כאשר', x.triggers, y.triggers, 'trigger'); blocks('אם', x.conditions, y.conditions, 'condition'); blocks('אז', x.actions, y.actions, 'action');
  } else if (kind === 'script') {
    const x = mine as ScriptDraft; const y = theirs as ScriptDraft;
    field('שם', x.alias, y.alias); field('תיאור', x.description, y.description);
    field('אפשרויות', MODE_LABEL[x.mode], MODE_LABEL[y.mode]);
    field('שדות', x.fields.map((f) => f.name).join(', '), y.fields.map((f) => f.name).join(', '));
    blocks('אז', x.sequence, y.sequence, 'action');
  } else {
    const x = mine as SceneDraft; const y = theirs as SceneDraft;
    field('שם', x.name, y.name);
    const label = (m: SceneMember) => `${ctx.names?.(m.entity_id) ?? m.entity_id} · ${m.state}${Object.keys(m.attributes).length ? ` ${JSON.stringify(m.attributes)}` : ''}`;
    const ya = new Map(y.members.map((m) => [m.entity_id, m]));
    for (const m of x.members) {
      const o = ya.get(m.entity_id);
      if (!o) rows.push({ group: 'מכשירים', change: 'added', mine: label(m), theirs: '—' });
      else if (canonicalJson(o) !== canonicalJson(m)) rows.push({ group: 'מכשירים', change: 'changed', mine: label(m), theirs: label(o) });
    }
    for (const o of y.members) if (!x.members.some((m) => m.entity_id === o.entity_id)) rows.push({ group: 'מכשירים', change: 'removed', mine: '—', theirs: label(o) });
  }
  return rows;
}

// ------------------------------------------------------------------------------------------------ scenes: the member fields of a table row

export interface MemberField { key: string; label: string; kind: 'select' | 'number'; options?: Choice[]; min?: number; max?: number; step?: number; unit?: string; only?: 'on' }
const LIGHT_STATES: Choice[] = [{ value: 'on', label: 'דלוק' }, { value: 'off', label: 'כבוי' }];
/** The editable fields of a scene member by its domain: the state, then the domain's attributes. Values are stored as HA stores them (`brightness` 0-255 ...). */
export function memberFields(entityId: string): MemberField[] {
  const dom = entityId.split('.')[0];
  switch (dom) {
    case 'light': return [{ key: 'state', label: 'מצב', kind: 'select', options: LIGHT_STATES }, { key: 'brightness', label: 'בהירות', kind: 'number', min: 1, max: 100, step: 1, unit: '%', only: 'on' }, { key: 'color_temp_kelvin', label: 'טמפרטורת צבע', kind: 'number', min: 2000, max: 6500, step: 100, unit: 'K', only: 'on' }];
    case 'switch': return [{ key: 'state', label: 'מצב', kind: 'select', options: LIGHT_STATES }];
    case 'fan': return [{ key: 'state', label: 'מצב', kind: 'select', options: LIGHT_STATES }, { key: 'percentage', label: 'מהירות', kind: 'number', min: 0, max: 100, step: 10, unit: '%', only: 'on' }];
    case 'cover': return [{ key: 'state', label: 'מצב', kind: 'select', options: [{ value: 'open', label: 'פתוח' }, { value: 'closed', label: 'סגור' }] }, { key: 'current_position', label: 'מיקום', kind: 'number', min: 0, max: 100, step: 5, unit: '%' }];
    case 'climate': return [{ key: 'state', label: 'מצב', kind: 'select', options: stateChoices(entityId) }, { key: 'temperature', label: 'טמפרטורה', kind: 'number', min: 16, max: 30, step: 0.5, unit: '°' }];
    case 'media_player': return [{ key: 'state', label: 'מצב', kind: 'select', options: [{ value: 'on', label: 'דלוק' }, { value: 'off', label: 'כבוי' }, { value: 'playing', label: 'מנגן' }, { value: 'paused', label: 'מושהה' }] }, { key: 'volume_level', label: 'עוצמה', kind: 'number', min: 0, max: 100, step: 5, unit: '%' }];
    case 'lock': return [{ key: 'state', label: 'מצב', kind: 'select', options: [{ value: 'locked', label: 'נעול' }, { value: 'unlocked', label: 'פתוח' }] }];
    default: return [{ key: 'state', label: 'מצב', kind: 'select', options: ONOFF }];
  }
}
/** HA's stored value <-> the number a field shows: a 0-255 brightness and a 0-1 volume are shown as percent. */
const toUi = (f: MemberField, v: number): number => (f.key === 'brightness' ? Math.round((v * 100) / 255) : f.key === 'volume_level' ? Math.round(v * 100) : v);
const toStore = (f: MemberField, n: number): number => (f.key === 'brightness' ? Math.round((n * 255) / 100) : f.key === 'volume_level' ? Math.round(n) / 100 : n);
/** The number a field shows for a member (percent for a 0-255 brightness or a 0-1 volume), or null when the member has no such attribute. */
export function memberNumber(m: SceneMember, f: MemberField): number | null {
  const v = m.attributes[f.key];
  return typeof v === 'number' ? toUi(f, v) : null;
}
/** The member with one field changed (state: attributes that need `on` are dropped when the state turns off). */
export function setMemberField(m: SceneMember, f: MemberField, ui: string | number | null): SceneMember {
  const out: SceneMember = { entity_id: m.entity_id, state: m.state, attributes: { ...m.attributes } };
  if (f.key === 'state') {
    out.state = String(ui ?? '');
    if (out.state === 'off' || out.state === 'closed' || out.state === 'locked' || out.state === 'unlocked') for (const k of memberFields(m.entity_id).filter((x) => x.only === 'on').map((x) => x.key)) delete out.attributes[k];
    return out;
  }
  if (ui === null || ui === '' || Number.isNaN(Number(ui))) { delete out.attributes[f.key]; return out; }
  out.attributes[f.key] = toStore(f, Number(ui));
  return out;
}
export const CAPTURE_DOMAIN_LABEL: Record<string, string> = { light: 'תאורה', switch: 'מתג', fan: 'מאוורר', cover: 'תריס', climate: 'מזגן', media_player: 'מדיה', lock: 'מנעול' };

// ------------------------------------------------------------------------------------------------ script fields

export type FieldKind = 'number' | 'boolean' | 'select' | 'text' | 'entity';
/** The Hebrew word of a device domain, for the one-line summary of an entity field. */
const DOMAIN_WORD: Record<string, string> = { light: 'תאורה', switch: 'מתג', cover: 'תריס', climate: 'מזגן', fan: 'מאוורר', media_player: 'מדיה', lock: 'מנעול', sensor: 'חיישן', binary_sensor: 'חיישן', person: 'אדם', scene: 'סצנה', script: 'סקריפט' };
export const FIELD_KIND_LABEL: Record<FieldKind, string> = { number: 'מספר', boolean: 'כן / לא', select: 'בחירה', text: 'טקסט', entity: 'מכשיר' };
export function newField(kind: FieldKind, existing: readonly string[]): ScriptDraft['fields'][number] {
  let n = existing.length + 1;
  while (existing.includes(`field_${n}`)) n++;
  const selector = kind === 'number' ? { kind: 'number' as const, min: 0, max: 100, step: 1 } : kind === 'boolean' ? { kind: 'boolean' as const } : kind === 'select' ? { kind: 'select' as const, options: ['אפשרות 1', 'אפשרות 2'] }
    : kind === 'text' ? { kind: 'text' as const } : { kind: 'entity' as const, domains: [] as string[] };
  return { key: `field_${n}`, name: '', required: false, default: undefined, selector };
}
export function fieldSummary(f: ScriptDraft['fields'][number]): string {
  const s = f.selector;
  switch (s.kind) {
    case 'number': return `מספר ${s.min}–${s.max}${s.unit ?? ''}`;
    case 'boolean': return 'כן / לא';
    case 'select': return `בחירה: ${s.options.join(' · ')}`;
    case 'text': return 'טקסט';
    case 'entity': return s.domains.length ? `מכשיר (${s.domains.map((d) => DOMAIN_WORD[d] ?? d).join(', ')})` : 'מכשיר';
    default: return 'שדה מתקדם · נעול';
  }
}

// ------------------------------------------------------------------------------------------------ caps (add buttons)

export function capReached(draft: AnyDraft, section: Section, listLength: number): boolean {
  if (section === 'trigger') return listLength >= CAPS.triggers_max;
  if (section === 'condition') return listLength >= CAPS.conditions_max;
  return stepCount(draft) >= CAPS.steps_max;
}

