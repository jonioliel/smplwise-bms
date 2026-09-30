/**
 * CR-014 S4: the pure rules of the schedule editor (no DOM, no Lit): what a slot's actions look like as groups, how a
 * device joins or leaves the schedule's slots, the client-side validation (a mirror of the server's §5 rules so the
 * person sees the problem before saving; the server stays the authority), the day-split plan (decision 6a), the
 * condition builder's rules and the presets (§12.5), the sensitive / lowering summary and a sun-time estimate.
 */
import {
  SENSITIVE_CLASSES,
  actionLabel,
  detectPreset,
  findOverlaps,
  formatTime,
  parseTime,
  presetConditions,
  resolveDays,
  timeMinutes,
  type ArgSpec,
  type CatalogAction,
  type CatalogEntity,
  type ConditionCandidate,
  type ConditionPreset,
  type ConditionView,
  type DayId,
  type DraftAction,
  type DraftCondition,
  type DraftConditions,
  type DraftSlot,
  type Problem,
  type Schedule,
  type ScheduleClass,
  type ScheduleDraft,
  type SunTimes,
  type UpcomingRun,
} from '../api/schedules';
import { tokensOf } from './schedule-grid-logic';

// ------------------------------------------------------------------------------------------------ entities

/** What the editor knows about a device: from the schedule's own `entities` and, for editors, the catalogue. */
export interface EntityMeta {
  entity_id: string;
  name: string;
  domain: string;
  class: ScheduleClass | null;
  sensitive: boolean;
  area_name: string | null;
  floor_name: string | null;
  attributes: Record<string, unknown>;
  /** The services the server allows for this device (empty when the catalogue is not available). */
  actions: CatalogAction[];
  selectable: boolean;
  reason: Problem | null;
}

export type MetaMap = Map<string, EntityMeta>;

export function metaFromSchedule(s: Schedule | null, into: MetaMap = new Map()): MetaMap {
  for (const e of s?.entities ?? []) {
    if (into.has(e.entity_id)) continue;
    into.set(e.entity_id, {
      entity_id: e.entity_id,
      name: e.name,
      domain: e.domain,
      class: e.class,
      sensitive: e.sensitive,
      area_name: e.area_name,
      floor_name: e.floor_name,
      attributes: {},
      actions: [],
      selectable: true,
      reason: null,
    });
  }
  return into;
}

export function metaFromCatalog(entities: CatalogEntity[], into: MetaMap = new Map()): MetaMap {
  for (const e of entities) {
    into.set(e.entity_id, {
      entity_id: e.entity_id,
      name: e.name,
      domain: e.domain,
      class: e.class,
      sensitive: e.sensitive,
      area_name: e.area_name,
      floor_name: e.floor_name,
      attributes: e.attributes ?? {},
      actions: e.actions,
      selectable: e.selectable,
      reason: e.reason,
    });
  }
  return into;
}

export function classOfEntity(meta: MetaMap, id: string | null): ScheduleClass | null {
  return id ? meta.get(id)?.class ?? null : null;
}

/** Distinct action entities of the slots, in order of first appearance. */
export function entitiesOf(slots: DraftSlot[]): string[] {
  const out: string[] = [];
  for (const s of slots) for (const a of s.actions) if (a.entity_id && !out.includes(a.entity_id)) out.push(a.entity_id);
  return out;
}

// ------------------------------------------------------------------------------------------------ action groups

export interface ActionGroup {
  key: string;
  service: string;
  data: Record<string, unknown>;
  /** Entities of this group, in order (a null entity - a service without a device - is one group of its own). */
  entities: (string | null)[];
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** The actions of one slot as groups: entities that do the very same thing (service and arguments) sit together. */
export function groupActions(actions: DraftAction[]): ActionGroup[] {
  const out: ActionGroup[] = [];
  for (const a of actions) {
    const key = `${a.service}|${stable(a.data)}`;
    const g = a.entity_id ? out.find((x) => x.key === key && x.entities[0] !== null) : undefined;
    if (g) g.entities.push(a.entity_id);
    else out.push({ key, service: a.service, data: { ...a.data }, entities: [a.entity_id] });
  }
  return out;
}

/** Replace what a group does (every one of its entities); the order of the slot's actions is kept. */
export function setGroupAction(actions: DraftAction[], group: ActionGroup, service: string, data: Record<string, unknown>): DraftAction[] {
  return actions.map((a) => (a.service === group.service && stable(a.data) === stable(group.data) && group.entities.includes(a.entity_id) ? { ...a, service, data: { ...data } } : a));
}

/** Remove one entity from a group's action. */
export function removeEntityFromSlot(actions: DraftAction[], entityId: string): DraftAction[] {
  return actions.filter((a) => a.entity_id !== entityId);
}

// ------------------------------------------------------------------------------------------------ intents (templates and mirroring)

export type Intent =
  | { kind: 'on' }
  | { kind: 'off' }
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'level'; pct: number }
  | { kind: 'cover_pos'; pos: number }
  | { kind: 'climate'; mode: 'cool' | 'heat'; temp: number };

const allowed = (e: EntityMeta, service: string) => !e.actions.length || e.actions.some((a) => a.service === service);

/** The hvac_mode a climate does for a cool / heat wish: the wanted one when the entity offers it, else the nearest it does
 * offer (a thermostat with only off + heat_cool takes heat_cool for both), else none - never a mode the entity lacks. */
export function climateModeFor(want: 'cool' | 'heat', e: EntityMeta): string | undefined {
  const offered = e.attributes.hvac_modes;
  if (!Array.isArray(offered) || !offered.length) return want;
  return (want === 'cool' ? ['cool', 'heat_cool', 'auto'] : ['heat', 'heat_cool', 'auto']).find((m) => offered.includes(m));
}

const climateData = (mode: string | undefined, temperature: number, e: EntityMeta): Record<string, unknown> => {
  const min = Number(e.attributes.min_temp ?? NaN);
  const max = Number(e.attributes.max_temp ?? NaN);
  const t = Math.min(Number.isFinite(max) ? max : Infinity, Math.max(Number.isFinite(min) ? min : -Infinity, temperature));
  return mode ? { hvac_mode: mode, temperature: t } : { temperature: t };
};

/** The action a device does for an intent, or null when its class has no such thing. */
export function actionForIntent(intent: Intent, e: EntityMeta): DraftAction | null {
  const dom = e.domain;
  const make = (service: string, data: Record<string, unknown> = {}): DraftAction | null => (allowed(e, service) ? { service, entity_id: e.entity_id, data } : null);
  switch (intent.kind) {
    case 'on':
      if (dom === 'light' || dom === 'switch' || dom === 'fan') return make(`${dom}.turn_on`);
      if (dom === 'climate') return make('climate.set_temperature', climateData(climateModeFor('cool', e), 23, e));
      if (dom === 'cover') return make('cover.open_cover');
      return null;
    case 'off':
      if (dom === 'light' || dom === 'switch' || dom === 'fan') return make(`${dom}.turn_off`);
      if (dom === 'climate') return make('climate.turn_off');
      if (dom === 'cover') return make('cover.close_cover');
      return null;
    case 'open':
      return dom === 'cover' ? make('cover.open_cover') : dom === 'light' || dom === 'switch' || dom === 'fan' ? make(`${dom}.turn_on`) : null;
    case 'close':
      return dom === 'cover' ? make('cover.close_cover') : dom === 'light' || dom === 'switch' || dom === 'fan' ? make(`${dom}.turn_off`) : null;
    case 'level':
      if (dom === 'light') return make('light.turn_on', { brightness: Math.round((intent.pct / 100) * 255) });
      if (dom === 'fan') return make('fan.turn_on', { percentage: intent.pct });
      if (dom === 'cover') return make('cover.set_cover_position', { position: intent.pct });
      return actionForIntent({ kind: 'on' }, e);
    case 'cover_pos':
      return dom === 'cover' ? make('cover.set_cover_position', { position: intent.pos }) : actionForIntent({ kind: 'on' }, e);
    case 'climate':
      return dom === 'climate' ? make('climate.set_temperature', climateData(climateModeFor(intent.mode, e), intent.temp, e)) : actionForIntent({ kind: 'on' }, e);
  }
}

/** The intent an existing action stands for (to mirror it onto another device); null for services with no such reading. */
export function intentOfAction(a: DraftAction): Intent | null {
  const d = a.data;
  switch (a.service) {
    case 'light.turn_on':
      return typeof d.brightness === 'number' ? { kind: 'level', pct: Math.round((d.brightness / 255) * 100) } : typeof d.brightness_pct === 'number' ? { kind: 'level', pct: d.brightness_pct } : { kind: 'on' };
    case 'switch.turn_on':
      return { kind: 'on' };
    case 'fan.turn_on':
      return typeof d.percentage === 'number' ? { kind: 'level', pct: d.percentage } : { kind: 'on' };
    case 'light.turn_off':
    case 'switch.turn_off':
    case 'fan.turn_off':
    case 'climate.turn_off':
      return { kind: 'off' };
    case 'cover.open_cover':
      return { kind: 'open' };
    case 'cover.close_cover':
      return { kind: 'close' };
    case 'cover.set_cover_position':
      return typeof d.position === 'number' ? { kind: 'cover_pos', pos: d.position } : null;
    case 'climate.set_temperature':
      return typeof d.temperature === 'number' ? { kind: 'climate', mode: d.hvac_mode === 'heat' ? 'heat' : 'cool', temp: d.temperature } : null;
    default:
      return null;
  }
}

/** The action an existing action becomes for another device (same service and arguments for the same kind of device). */
export function mirrorAction(a: DraftAction, target: EntityMeta): DraftAction | null {
  if (a.service.split('.')[0] === target.domain && allowed(target, a.service)) return { service: a.service, entity_id: target.entity_id, data: { ...a.data } };
  const intent = intentOfAction(a);
  return intent ? actionForIntent(intent, target) : null;
}

export interface IntentSlot extends DraftSlot {
  /** A template slot whose action is decided when the devices are chosen. */
  intent?: Intent;
}

/**
 * Add devices to every slot: a slot with an intent gets that intent's action, a slot with actions gets the mirror of its
 * first action (same service for the same kind of device), an empty slot without an intent stays as it is.
 */
export function addEntitiesToSlots<S extends IntentSlot>(slots: S[], adds: EntityMeta[]): S[] {
  return slots.map((s) => {
    const have = new Set(s.actions.map((a) => a.entity_id));
    const extra: DraftAction[] = [];
    for (const e of adds) {
      if (have.has(e.entity_id)) continue;
      let a: DraftAction | null = null;
      // a slot that still has no action does the plain "on" for a device that joins (a template says something else)
      if (s.intent || !s.actions.length) a = actionForIntent(s.intent ?? { kind: 'on' }, e);
      if (!a) {
        const same = s.actions.find((x) => x.entity_id && x.service.split('.')[0] === e.domain);
        a = same ? { service: same.service, entity_id: e.entity_id, data: { ...same.data } } : null;
      }
      if (!a && s.actions[0]) a = mirrorAction(s.actions[0], e);
      if (a) extra.push(a);
    }
    return extra.length ? { ...s, actions: [...s.actions, ...extra] } : s;
  });
}

export function removeEntityFromSlots<S extends DraftSlot>(slots: S[], entityId: string): S[] {
  return slots.map((s) => (s.actions.some((a) => a.entity_id === entityId) ? { ...s, actions: removeEntityFromSlot(s.actions, entityId) } : s));
}

/**
 * The actions of a newly drawn slot: the opposite of the last slot of the day (an "on" slot is followed by an "off" one),
 * for every device of the schedule; nothing when the schedule has no device yet.
 */
export function newSlotActions(slots: DraftSlot[], meta: MetaMap, startOf: (s: DraftSlot) => number, extraIds: string[] = []): DraftAction[] {
  const ids = [...new Set([...entitiesOf(slots), ...extraIds])];
  if (!ids.length) return [];
  const order = slots.filter((s) => s.actions.length).sort((a, b) => startOf(a) - startOf(b));
  const last = order[order.length - 1];
  const lastIntent = last ? intentOfAction(last.actions[0]) : null;
  const want: Intent = lastIntent && lastIntent.kind !== 'off' && lastIntent.kind !== 'close' ? { kind: 'off' } : { kind: 'on' };
  const out: DraftAction[] = [];
  for (const id of ids) {
    const e = meta.get(id);
    if (!e) continue;
    const a = actionForIntent(want, e);
    if (a) out.push(a);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ "כיבוי בסיום"

export { makeOffSlot, pairedOffSlot } from '../api/schedules';

// ------------------------------------------------------------------------------------------------ lowering / sensitive

const ARM_SERVICES = ['alarm_control_panel.alarm_arm_home', 'alarm_control_panel.alarm_arm_away', 'alarm_control_panel.alarm_arm_night', 'alarm_control_panel.alarm_arm_vacation', 'alarm_control_panel.alarm_arm_custom_bypass'];

/** §5.3: an action that removes protection (the schedule then acts with nobody present). */
export function isLoweringAction(a: DraftAction, cls: ScheduleClass | null, catalog?: CatalogAction[]): boolean {
  const fromCatalog = catalog?.find((x) => x.service === a.service);
  if (fromCatalog && catalog && catalog.length && a.service !== 'cover.set_cover_position') return fromCatalog.lowering;
  if (a.service === 'alarm_control_panel.alarm_disarm' || a.service === 'lock.unlock') return true;
  if (cls !== 'door') return false;
  if (a.service === 'cover.set_cover_position') return Number(a.data.position ?? 0) > 0;
  return ['cover.open_cover', 'switch.turn_on', 'switch.turn_off', 'button.press'].includes(a.service);
}

export function isSensitiveAction(a: DraftAction, cls: ScheduleClass | null): boolean {
  return (!!cls && SENSITIVE_CLASSES.includes(cls)) || a.service.startsWith('alarm_control_panel.') || a.service.startsWith('lock.');
}

export interface LoweringSummary {
  /** Names of the devices whose action lowers protection. */
  entities: string[];
  /** "מנטרל", "פותח" ... one word per kind. */
  kinds: string[];
  /** "07:00, 08:00" - when the schedule acts. */
  times: string;
  /** The schedule has sensitive actions at all. */
  sensitive: boolean;
  lowering: boolean;
}

export function slotTimeLabel(slot: DraftSlot): string {
  const a = formatTime(parseTime(slot.start));
  return a;
}

export function loweringSummary(draft: ScheduleDraft, meta: MetaMap): LoweringSummary {
  const names: string[] = [];
  const kinds: string[] = [];
  const times: string[] = [];
  let sensitive = false;
  for (const s of draft.slots) {
    let slotLowers = false;
    for (const a of s.actions) {
      const m = a.entity_id ? meta.get(a.entity_id) : undefined;
      const cls = m?.class ?? null;
      if (isSensitiveAction(a, cls)) sensitive = true;
      if (isLoweringAction(a, cls, m?.actions)) {
        slotLowers = true;
        const n = m?.name ?? a.entity_id ?? '';
        if (n && !names.includes(n)) names.push(n);
        const kind = a.service === 'alarm_control_panel.alarm_disarm' ? 'מנטרל' : a.service === 'lock.unlock' ? 'פותח נעילה' : 'פותח';
        if (!kinds.includes(kind)) kinds.push(kind);
      }
    }
    if (slotLowers) times.push(slotTimeLabel(s));
  }
  return { entities: names, kinds, times: times.join(', '), sensitive, lowering: names.length > 0 };
}

// ------------------------------------------------------------------------------------------------ validation (§5.4, §5.7, §5.8)

export interface ValidationCtx {
  creating: boolean;
  meta: MetaMap;
  sun: SunTimes | null;
  /** The draft as loaded (to tell an unchanged alarm action from a new one, and locked conditions). */
  original: ScheduleDraft | null;
  /** The loaded schedule's conditions as the caller sees them (locked ones must be kept). */
  lockedConditions: ConditionView[];
  /** An action that no longer belongs to the editor's scope (e.g. read-only content) is not checked. */
  maxSlots?: number;
}

function argLabel(name: string): string {
  return ({ brightness: 'בהירות', brightness_pct: 'בהירות', position: 'מיקום', tilt_position: 'הטיה', temperature: 'טמפרטורה', hvac_mode: 'מצב פעולה', percentage: 'עוצמה', fan_mode: 'מצב מאוורר', preset_mode: 'מצב מוגדר' } as Record<string, string>)[name] ?? name;
}

function sameAction(a: DraftAction, b: DraftAction): boolean {
  return a.service === b.service && a.entity_id === b.entity_id && stable(a.data) === stable(b.data);
}

/** The client-side checks of a draft. Messages are the server's, in Hebrew, so a refusal reads the same either way. */
export function validateDraft(draft: ScheduleDraft, ctx: ValidationCtx): { errors: Problem[]; warnings: Problem[] } {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const err = (path: string, code: string, message: string) => errors.push({ path, code, message });
  const warn = (path: string, code: string, message: string) => warnings.push({ path, code, message });

  const name = (draft.name ?? '').trim();
  if (ctx.creating && !name) err('name', 'required', 'נדרש שם לתזמון.');
  if (name.length > 80) err('name', 'too_long', 'השם ארוך מדי (עד 80 תווים).');
  if (!draft.weekdays.length) err('weekdays', 'required', 'נדרש יום אחד לפחות.');
  if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) err('end_date', 'order', 'תאריך הסיום לפני תאריך ההתחלה.');
  if (!draft.slots.length) err('slots', 'required', 'נדרשת לפחות משבצת אחת.');
  if (draft.slots.length > (ctx.maxSlots ?? 48)) err('slots', 'too_many', 'יותר מדי משבצות בתזמון אחד.');
  if (draft.repeat === 'single') warn('repeat', 'single_deletes', 'התזמון יימחק אחרי ההרצה האחרונה.');

  draft.slots.forEach((sl, i) => {
    const start = parseTime(sl.start);
    const stop = sl.stop ? parseTime(sl.stop) : null;
    if (!start) err(`slots[${i}].start`, 'time', 'שעת התחלה לא תקינה.');
    if (sl.stop && !stop) err(`slots[${i}].stop`, 'time', 'שעת סיום לא תקינה.');
    if (start && stop && sl.stop !== '00:00:00' && timeMinutes(stop, ctx.sun) <= timeMinutes(start, ctx.sun)) err(`slots[${i}].stop`, 'order', 'שעת הסיום לפני שעת ההתחלה.');
    if (!sl.actions.length) err(`slots[${i}].actions`, 'required', 'לכל משבצת נדרשת פעולה.');
    if (sl.actions.length > 20) err(`slots[${i}].actions`, 'too_many', 'יותר מדי פעולות במשבצת אחת.');
    sl.actions.forEach((a, j) => {
      const path = `slots[${i}].actions[${j}]`;
      if (!a.entity_id) {
        err(path, 'action_without_entity', 'הפעולה אינה מותרת בתזמון.');
        return;
      }
      const m = ctx.meta.get(a.entity_id);
      if (!m) return; // not in the catalogue and not on the schedule: the server decides
      if (!m.selectable && m.reason) {
        const unchanged = ctx.original?.slots.some((o) => o.actions.some((x) => sameAction(x, a)));
        if (!unchanged) err(`${path}.entity_id`, m.reason.code, m.reason.message);
      }
      const svc = m.actions.find((x) => x.service === a.service);
      if (m.actions.length && !svc) err(`${path}.service`, 'action_not_allowed', 'הפעולה אינה מותרת בתזמון.');
      if ('code' in a.data) err(`${path}.data.code`, 'code_not_allowed', 'אסור לשמור קוד בתוך תזמון.');
      for (const spec of svc?.args ?? []) {
        const v = a.data[spec.name];
        const label = argLabel(spec.name);
        if (v === undefined || v === null || v === '') {
          // brightness / brightness_pct are alternatives; hvac_mode is optional for set_temperature
          if (spec.required) err(`${path}.data.${spec.name}`, 'required', `נדרש ערך: ${label}.`);
          continue;
        }
        if ((spec.type === 'int' || spec.type === 'float') && (typeof v !== 'number' || Number.isNaN(v))) {
          err(`${path}.data.${spec.name}`, 'type', `${label}: נדרש מספר.`);
        } else if (typeof v === 'number' && ((spec.min !== undefined && v < spec.min) || (spec.max !== undefined && v > spec.max))) {
          err(`${path}.data.${spec.name}`, 'out_of_range', `${label} מחוץ לטווח ${spec.min ?? ''}–${spec.max ?? ''}.`);
        } else if (spec.choices && spec.choices.length && typeof v === 'string' && !spec.choices.includes(v) && !(spec.name === 'hvac_mode' && v === 'off')) {
          err(`${path}.data.${spec.name}`, 'choice', `${label}: ערך לא זמין להתקן.`);
        }
      }
      const t = a.data.temperature;
      const min = Number(m.attributes.min_temp ?? NaN);
      const max = Number(m.attributes.max_temp ?? NaN);
      if (typeof t === 'number' && Number.isFinite(min) && t < min) err(`${path}.data.temperature`, 'out_of_range', `טמפרטורה מחוץ לטווח ${min}–${Number.isFinite(max) ? max : ''}.`);
      // §5.6: a code is never stored in a schedule: a panel or lock that needs one cannot be scheduled for that action
      const wasThere = ctx.original?.slots.some((o) => o.actions.some((x) => sameAction(x, a)));
      const armNeedsCode = ARM_SERVICES.includes(a.service) && m.attributes.code_arm_required === true;
      const disarmNeedsCode = a.service === 'alarm_control_panel.alarm_disarm' && !!m.attributes.code_format;
      if (armNeedsCode || disarmNeedsCode) {
        if (wasThere) warn(path, 'alarm_may_need_code', 'לוח האזעקה עשוי לדרוש קוד, ותזמון אינו שומר קודים.');
        else err(path, 'alarm_code_needed', 'לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה.');
      }
      if ((a.service === 'lock.lock' || a.service === 'lock.unlock') && m.attributes.code_format) {
        if (!wasThere) err(path, 'lock_code_needed', 'המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו.');
      }
    });
  });

  for (const [a, b] of findOverlaps(draft.slots, ctx.sun)) err(`slots[${b}]`, 'slots_overlap', `משבצת ${b + 1} חופפת למשבצת ${a + 1}.`);

  const c = draft.conditions;
  if (c.items.length > 10) err('conditions.items', 'too_many', 'יותר מדי תנאים.');
  c.items.forEach((it, i) => {
    if (!it.entity_id) err(`conditions.items[${i}]`, 'required', 'נדרש חיישן לתנאי.');
    if ((it.match_type === 'above' || it.match_type === 'below') && (typeof it.value !== 'number' || Number.isNaN(it.value))) err(`conditions.items[${i}].value`, 'type', 'בהשוואה מספרית נדרש מספר.');
    if ((it.match_type === 'is' || it.match_type === 'not') && (String(it.value).length < 1 || String(it.value).length > 100)) err(`conditions.items[${i}].value`, 'required', 'נדרש ערך לתנאי.');
  });
  for (const lc of ctx.lockedConditions.filter((x) => x.locked)) {
    const kept = c.items.some((d) => d.entity_id === lc.entity_id && d.attribute === lc.attribute && d.match_type === lc.match_type && d.value === lc.value);
    if (!kept) err('conditions.items', 'condition_locked', `התנאי "${lc.name}" מחוץ להרשאתך ואי אפשר לשנות או להסיר אותו.`);
  }
  if (c.track && draft.slots.some((s) => !s.stop)) warn('conditions.track', 'track_needs_window', 'בדיקה מתמשכת דורשת משבצת עם שעת סיום.');
  return { errors, warnings };
}

/** The slot a validation path points at (`slots[2].actions[0]` → 2), or -1. */
export function slotOfPath(path: string | undefined): number {
  const m = /^slots\[(\d+)\]/.exec(path ?? '');
  return m ? Number(m[1]) : -1;
}

// ------------------------------------------------------------------------------------------------ change detection

/** Structural equality of two drafts (dirty checks, "unchanged content"). */
export function sameDraft(a: ScheduleDraft, b: ScheduleDraft): boolean {
  return stable(normalDraft(a)) === stable(normalDraft(b));
}

function normalDraft(d: ScheduleDraft) {
  return { ...d, name: (d.name ?? '').trim(), tags: [...d.tags], slots: d.slots.map((s) => ({ start: s.start, stop: s.stop, actions: s.actions })) };
}

// ------------------------------------------------------------------------------------------------ the day split (decision 6a)

export interface SplitOverride {
  /** The days that differ from the rest (a strict subset of the schedule's days). */
  days: DayId[];
  slots: DraftSlot[];
}

export type SplitPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Days that leave the original schedule and form the new one. */
      days: DayId[];
      remaining: DayId[];
      /** What the original schedule holds after the split step (the loaded content, the remaining days). */
      afterSplit: ScheduleDraft;
      /** The original's content after the person's other edits, or null when they are already what the split leaves. */
      originalUpdate: ScheduleDraft | null;
      /** The new schedule's content. */
      created: ScheduleDraft;
    };

/**
 * Plan "edit only these days": the server splits first (`split`, same content for the chosen days), then the edits are
 * written to the two halves. `draft` holds the person's edits to the linked days (its `weekdays` still the whole
 * schedule), `original` is the draft as loaded, `override` the different arrangement of the chosen days.
 */
export function planSplit(draft: ScheduleDraft, original: ScheduleDraft, override: SplitOverride): SplitPlan {
  const all = resolveDays(original.weekdays);
  if (!all) return { ok: false, error: 'לא ניתן לפצל תזמון לפי ימי עבודה או סוף שבוע; בחרו ימים מפורשים תחילה.' };
  const days = all.filter((d) => override.days.includes(d));
  const remaining = all.filter((d) => !days.includes(d));
  if (!days.length || !remaining.length) return { ok: false, error: 'בחרו חלק מהימים בלבד (לא את כולם ולא אף יום).' };
  const afterSplit: ScheduleDraft = { ...original, weekdays: tokensOf(remaining) };
  const linked: ScheduleDraft = { ...draft, weekdays: tokensOf(remaining) };
  const created: ScheduleDraft = { ...draft, weekdays: tokensOf(days), slots: override.slots };
  return { ok: true, days, remaining, afterSplit, originalUpdate: sameDraft(linked, afterSplit) ? null : linked, created };
}

// ------------------------------------------------------------------------------------------------ conditions (§2.4, §12.5)

export function normalizeConditions(c: DraftConditions): DraftConditions {
  if (!c.items.length) return { items: [], type: null, track: false };
  return { items: c.items.map((i) => ({ ...i })), type: c.items.length === 1 ? 'or' : c.type ?? 'and', track: c.track };
}

/** The condition a picked device starts with: on/off devices "is on", numeric ones "above" their current value. */
export function newCondition(c: ConditionCandidate): DraftCondition {
  if (c.numeric) return { entity_id: c.entity_id, attribute: 'state', match_type: 'above', value: Number.isFinite(Number(c.state)) ? Math.round(Number(c.state)) : 0 };
  if (c.domain === 'sun') return { entity_id: c.entity_id, attribute: 'state', match_type: 'is', value: 'above_horizon' };
  return { entity_id: c.entity_id, attribute: 'state', match_type: 'is', value: 'on' };
}

export function addCondition(block: DraftConditions, c: DraftCondition): DraftConditions {
  // one condition is always written "or" (as the card does); the second one makes the choice real, "all of them" by default
  const type = block.items.length >= 2 ? block.type ?? 'and' : block.items.length === 1 ? 'and' : 'or';
  return normalizeConditions({ ...block, items: [...block.items, c], type });
}

export function removeCondition(block: DraftConditions, index: number): DraftConditions {
  return normalizeConditions({ ...block, items: block.items.filter((_, i) => i !== index) });
}

export function updateCondition(block: DraftConditions, index: number, patch: Partial<DraftCondition>): DraftConditions {
  return normalizeConditions({ ...block, items: block.items.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
}

/**
 * A preset replaces the editable conditions; every locked one (the caller may not read that entity, §4.4) stays, and the
 * preset then sits beside it ("and" unless the block already says otherwise).
 */
export function applyPreset(block: DraftConditions, preset: ConditionPreset, sensor: string, lockedIds: string[] = []): DraftConditions {
  const p = presetConditions(preset, sensor);
  const keep = block.items.filter((i) => lockedIds.includes(i.entity_id));
  if (!keep.length) return p;
  return normalizeConditions({ items: [...keep, ...p.items], type: block.type ?? 'and', track: block.track });
}

export function clearConditions(block: DraftConditions, lockedIds: string[] = []): DraftConditions {
  return normalizeConditions({ ...block, items: block.items.filter((i) => lockedIds.includes(i.entity_id)) });
}

export function activePreset(block: DraftConditions, sensor: string | null | undefined): ConditionPreset | null {
  return detectPreset(block, sensor);
}

/** "מוצאי שבת" (§12.5): Saturday, one slot at sunset + `offset`, only when the holiday sensor says the day is over. */
export function motzashDraft(sensor: string, offsetMin = 40): Pick<ScheduleDraft, 'weekdays' | 'conditions'> & { start: string } {
  const h = String(Math.floor(offsetMin / 60)).padStart(2, '0');
  const m = String(offsetMin % 60).padStart(2, '0');
  return { weekdays: ['sat'], conditions: presetConditions('not_holy_days', sensor), start: `sunset+${h}:${m}:00` };
}

const STATE_LABEL: Record<string, string> = { on: 'פעיל', off: 'כבוי', above_horizon: 'מעל האופק', below_horizon: 'מתחת לאופק', home: 'בבית', not_home: 'לא בבית', open: 'פתוח', closed: 'סגור' };

/** "איסור מלאכה פעיל", "טמפרטורה בחוץ מעל 26", "נוכחות – משרדים כבוי". */
export function describeCondition(c: DraftCondition, name: string): string {
  if (c.attribute === 'state' && typeof c.value === 'string' && c.value in STATE_LABEL) {
    const positive = c.match_type === 'is';
    if (c.value === 'on' || c.value === 'off') return `${name} ${positive === (c.value === 'on') ? 'פעיל' : 'כבוי'}`;
    return `${name} ${positive ? 'הוא' : 'אינו'} ${STATE_LABEL[c.value]}`;
  }
  const op = { is: 'שווה ל', not: 'שונה מ', above: 'מעל', below: 'מתחת ל' }[c.match_type];
  return `${name} ${op} ${c.value}`;
}

/** The values a device's condition offers (its known states); numeric devices take a number instead. */
export function stateChoices(c: ConditionCandidate | undefined): { value: string; label: string }[] {
  if (!c || c.numeric) return [];
  if (c.domain === 'sun') return [{ value: 'above_horizon', label: STATE_LABEL.above_horizon }, { value: 'below_horizon', label: STATE_LABEL.below_horizon }];
  return [{ value: 'on', label: 'פעיל' }, { value: 'off', label: 'כבוי' }];
}

// ------------------------------------------------------------------------------------------------ sun

/**
 * Today's sunrise / sunset as far as the server's preview tells: a slot anchored to the sun has an upcoming run whose local
 * time minus its offset is the sun's time. Falls back to `base` for what is unknown. The UI still calls them estimates.
 */
export function estimateSun(draft: Pick<ScheduleDraft, 'slots'>, upcoming: UpcomingRun[], base: SunTimes): SunTimes {
  const out = { ...base };
  const seen: Record<string, boolean> = {};
  for (const u of upcoming) {
    const slot = draft.slots[u.slot_index];
    const spec = slot ? parseTime(slot.start) : null;
    if (!spec || spec.kind !== 'sun' || seen[spec.event]) continue;
    const d = new Date(u.at);
    if (Number.isNaN(d.getTime())) continue;
    const local = d.getHours() * 60 + d.getMinutes();
    const est = local - spec.offset_min;
    if (est > 0 && est < 1440) {
      out[spec.event] = est;
      seen[spec.event] = true;
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ arguments of an action

/** The argument specs of `service` for a device (from the catalogue), the ones the UI edits. */
export function argSpecs(meta: EntityMeta | undefined, service: string): ArgSpec[] {
  return meta?.actions.find((a) => a.service === service)?.args ?? [];
}

/** A slot's short summary for lists: "הדלקה · תאורת תקרה", "כיבוי · 3 התקנים". */
export function slotSummary(slot: DraftSlot, meta: MetaMap): string {
  const g = groupActions(slot.actions);
  if (!g.length) return 'בחרו פעולה';
  const first = g[0];
  const names = first.entities.map((e) => (e ? meta.get(e)?.name ?? e : 'ללא התקן'));
  const who = names.length > 1 ? `${names.length} התקנים` : names[0] ?? '';
  return `${actionLabel({ service: first.service, data: first.data })}${who ? ` · ${who}` : ''}${g.length > 1 ? ` (+${g.length - 1})` : ''}`;
}

/**
 * How a service reads in the action selects. The server's label (the bridge's `ACTIONS[...]["label"]`) is the fallback; these
 * are the words of the mockup, so the select reads the same whichever catalogue answered.
 */
const SERVICE_WORDS: Record<string, string> = {
  'light.turn_on': 'הדלקה',
  'light.turn_off': 'כיבוי',
  'switch.turn_on': 'הדלקה',
  'switch.turn_off': 'כיבוי',
  'fan.turn_on': 'הפעלה',
  'fan.turn_off': 'כיבוי',
  'fan.set_percentage': 'עוצמת מאוורר',
  'cover.open_cover': 'פתיחה',
  'cover.close_cover': 'סגירה',
  'cover.stop_cover': 'עצירה',
  'cover.set_cover_position': 'מיקום',
  'cover.set_cover_tilt_position': 'הטיה',
  'climate.set_temperature': 'טמפרטורת יעד',
  'climate.set_hvac_mode': 'מצב פעולה',
  'climate.set_fan_mode': 'מצב מאוורר',
  'climate.set_preset_mode': 'מצב מוגדר מראש',
  'climate.turn_off': 'כיבוי מיזוג',
  'alarm_control_panel.alarm_arm_home': 'דריכה בבית',
  'alarm_control_panel.alarm_arm_away': 'דריכה מלאה',
  'alarm_control_panel.alarm_arm_night': 'דריכת לילה',
  'alarm_control_panel.alarm_arm_vacation': 'דריכת חופשה',
  'alarm_control_panel.alarm_arm_custom_bypass': 'דריכה עם עקיפה',
  'alarm_control_panel.alarm_disarm': 'נטרול',
  'lock.lock': 'נעילה',
  'lock.unlock': 'פתיחת נעילה',
  'button.press': 'לחיצה',
};

export function serviceWord(service: string, catalogLabel?: string): string {
  return SERVICE_WORDS[service] ?? (catalogLabel || service);
}

// ------------------------------------------------------------------------------------------------ the editor's slot and defaults

/** A slot in the editor: the draft slot plus an identity that survives re-sorting (selection, focus). */
export interface EditSlot extends IntentSlot {
  uid: string;
}

let uidSeq = 0;
export const newUid = (): string => `s${Date.now().toString(36)}${(++uidSeq).toString(36)}`;

export const withUid = (s: DraftSlot | IntentSlot): EditSlot => ({ ...s, uid: (s as EditSlot).uid ?? newUid() });

/** A copy with fresh identities (the split override starts from the linked slots). */
export function cloneSlots(slots: EditSlot[]): EditSlot[] {
  return slots.map((s) => ({ ...s, uid: newUid(), actions: s.actions.map((a) => ({ ...a, data: { ...a.data } })) }));
}

/** The plain draft slots: no identity, no intent. */
export function plainSlots(slots: EditSlot[]): DraftSlot[] {
  return slots.map((s) => ({ start: s.start, stop: s.stop, actions: s.actions.map((a) => ({ service: a.service, entity_id: a.entity_id, data: { ...a.data } })) }));
}

/** The arguments a service starts with when chosen (required ones get a sensible value). */
export function defaultDataFor(specs: ArgSpec[], meta: EntityMeta | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of specs) {
    if (!s.required) continue;
    if (s.name === 'temperature') {
      const min = Number(meta?.attributes.min_temp ?? s.min ?? 16);
      const max = Number(meta?.attributes.max_temp ?? s.max ?? 30);
      out.temperature = Math.min(max, Math.max(min, 23));
    } else if (s.choices?.length) out[s.name] = s.name === 'hvac_mode' ? (['cool', 'heat_cool', 'heat', 'auto'].find((m) => s.choices!.includes(m)) ?? s.choices.find((m) => m !== 'off') ?? s.choices[0]) : s.choices[0];
    else if (s.type === 'int' || s.type === 'float') out[s.name] = Math.min(s.max ?? 100, Math.max(s.min ?? 0, 50));
    else if (s.type === 'enum' || s.type === 'str') out[s.name] = '';
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ time parts (the slot panel)

export type TimeKind = 'fixed' | 'sunrise' | 'sunset' | 'end' | 'none';

export interface TimeParts {
  kind: TimeKind;
  /** "HH:MM" for a fixed time. */
  time: string;
  /** Minutes after (positive) or before (negative) the sun. */
  offset: number;
}

/** A stored time as the slot panel's controls read it (a stop of "00:00:00" is "end of day", a null stop is none). */
export function timeParts(raw: string | null, isStop = false): TimeParts {
  if (raw == null) return { kind: 'none', time: '08:00', offset: 0 };
  if (isStop && raw === '00:00:00') return { kind: 'end', time: '00:00', offset: 0 };
  const spec = parseTime(raw);
  if (!spec) return { kind: 'fixed', time: '00:00', offset: 0 };
  if (spec.kind === 'sun') return { kind: spec.event, time: '00:00', offset: spec.offset_min };
  return { kind: 'fixed', time: spec.time, offset: 0 };
}

/** The stored form of the panel's controls: "HH:MM:00", "sunset+HH:MM:00", "00:00:00" (end of day), null (none). */
export function timeFromParts(p: TimeParts): string | null {
  if (p.kind === 'none') return null;
  if (p.kind === 'end') return '00:00:00';
  if (p.kind === 'fixed') {
    const m = /^(\d{1,2}):(\d{2})/.exec(p.time);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}:00` : '00:00:00';
  }
  const a = Math.abs(Math.round(p.offset));
  return `${p.kind}${p.offset < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}:00`;
}

// ------------------------------------------------------------------------------------------------ comparing two versions (the conflict dialog)

export interface DraftDifference {
  label: string;
  mine: string;
  theirs: string;
}

const REPEAT_WORDS = { repeat: 'חוזר', pause: 'פעם אחת, מושהה', single: 'פעם אחת, נמחק' } as const;

/** What differs between the person's draft and the version that arrived (for "השוואה"): a short line per field. */
export function compareDrafts(mine: ScheduleDraft, theirs: ScheduleDraft, names: (id: string | null) => string, daysLabel: (d: ScheduleDraft['weekdays']) => string): DraftDifference[] {
  const out: DraftDifference[] = [];
  const push = (label: string, a: string, b: string) => {
    if (a !== b) out.push({ label, mine: a, theirs: b });
  };
  push('שם', (mine.name ?? '').trim() || 'ללא שם', (theirs.name ?? '').trim() || 'ללא שם');
  push('ימים', daysLabel(mine.weekdays), daysLabel(theirs.weekdays));
  push('תקופה', `${mine.start_date ?? '—'} – ${mine.end_date ?? '—'}`, `${theirs.start_date ?? '—'} – ${theirs.end_date ?? '—'}`);
  push('חזרה', REPEAT_WORDS[mine.repeat], REPEAT_WORDS[theirs.repeat]);
  const cond = (d: ScheduleDraft) => (d.conditions.items.length ? `${d.conditions.items.map((c) => describeCondition(c, names(c.entity_id))).join(d.conditions.type === 'and' ? ' וגם ' : ' או ')}${d.conditions.track ? ' (בדיקה מתמשכת)' : ''}` : 'ללא');
  push('תנאים', cond(mine), cond(theirs));
  const slots = (d: ScheduleDraft) =>
    d.slots.length
      ? d.slots
          .map((s) => `${formatTime(parseTime(s.start))}${s.stop ? `–${formatTime(parseTime(s.stop))}` : ''}: ${s.actions.map((a) => `${actionLabel(a)} · ${names(a.entity_id)}`).join(', ') || '—'}`)
          .join('\n')
      : 'ללא משבצות';
  push('משבצות', slots(mine), slots(theirs));
  return out;
}
