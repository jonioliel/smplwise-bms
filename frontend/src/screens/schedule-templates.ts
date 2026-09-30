/**
 * CR-014 S4: the create flow's data (no DOM, no Lit): the templates, the condition presets that can be laid over any of
 * them, and the three-tap quick create. A template is entity-agnostic: its slots carry an intent ("on", "off", "cover to
 * 30 %") that becomes a real action per device when the devices are chosen (`addEntitiesToSlots`).
 */
import { DAY_LONG, DAY_ORDER, PRESET_LABEL, emptyDraft, presetConditions, type ConditionPreset, type DayId, type DayToken, type ScheduleDraft } from '../api/schedules';
import { actionForIntent, motzashDraft, type EntityMeta, type Intent, type IntentSlot } from './schedule-edit-logic';
import { tokensOf } from './schedule-grid-logic';

export type TemplateId = 'weekly' | 'sunset' | 'season' | 'ac' | 'once' | 'shabbat_climate' | 'motzash' | 'blank';

/** A draft whose slots may still carry intents. */
export type TemplateDraft = Omit<ScheduleDraft, 'slots'> & { slots: IntentSlot[] };

export interface TemplateContext {
  /** The configured "issur melacha" sensor entity id, or null. */
  sensor: string | null;
  defaultRepeat: ScheduleDraft['repeat'];
  now: Date;
}

export interface ScheduleTemplate {
  id: TemplateId;
  name: string;
  description: string;
  icon: 'calendar' | 'clock' | 'light' | 'coverOpen' | 'activity' | 'plus' | 'history';
  /** Needs the holiday sensor (Shabbat presets, §12.5). */
  needsSensor?: boolean;
  build: (ctx: TemplateContext) => TemplateDraft;
}

const SUN_THU: DayToken[] = ['sun', 'mon', 'tue', 'wed', 'thu'];
const slot = (start: string, stop: string | null, intent?: Intent): IntentSlot => ({ start, stop, actions: [], ...(intent ? { intent } : {}) });

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export const TEMPLATES: ScheduleTemplate[] = [
  {
    id: 'weekly',
    name: 'שגרה שבועית',
    description: 'הדלקה בבוקר וכיבוי בערב, ראשון עד חמישי',
    icon: 'calendar',
    build: (c) => ({ ...emptyDraft(c.defaultRepeat), name: 'שגרה שבועית', weekdays: SUN_THU, slots: [slot('07:30:00', '19:00:00', { kind: 'on' }), slot('19:00:00', '00:00:00', { kind: 'off' })] }),
  },
  {
    id: 'sunset',
    name: 'תאורה בשקיעה',
    description: 'נדלקת בשקיעה ונכבית בזריחה, כל יום',
    icon: 'light',
    build: (c) => ({ ...emptyDraft(c.defaultRepeat), name: 'תאורה בשקיעה', slots: [slot('sunrise+00:00:00', 'sunset+00:00:00', { kind: 'off' }), slot('sunset+00:00:00', '00:00:00', { kind: 'on' })] }),
  },
  {
    id: 'season',
    name: 'תריסים לפי עונה',
    description: 'סגירה חלקית ביום, פתיחה בערב. עם תקופת תוקף',
    icon: 'coverOpen',
    build: (c) => ({
      ...emptyDraft(c.defaultRepeat),
      name: 'תריסים לפי עונה',
      weekdays: SUN_THU,
      start_date: isoDate(c.now),
      end_date: isoDate(addDays(c.now, 120)),
      slots: [slot('10:00:00', '18:30:00', { kind: 'cover_pos', pos: 30 }), slot('18:30:00', '00:00:00', { kind: 'cover_pos', pos: 100 })],
    }),
  },
  {
    id: 'ac',
    name: 'מזגן בשעות משרד',
    description: 'קירור 23° בבוקר, כיבוי בסוף היום',
    icon: 'activity',
    build: (c) => ({ ...emptyDraft(c.defaultRepeat), name: 'מזגן בשעות משרד', weekdays: SUN_THU, slots: [slot('07:00:00', '18:00:00', { kind: 'climate', mode: 'cool', temp: 23 }), slot('18:00:00', '00:00:00', { kind: 'off' })] }),
  },
  {
    id: 'once',
    name: 'פעם אחת – מחר',
    description: 'הפעלה חד־פעמית מחר בבוקר; נמחק בסיום',
    icon: 'clock',
    build: (c) => {
      const tomorrow = addDays(c.now, 1);
      return { ...emptyDraft('single'), name: 'פעם אחת – מחר', weekdays: [DAY_ORDER[tomorrow.getDay()]], start_date: isoDate(tomorrow), end_date: isoDate(tomorrow), slots: [slot('08:00:00', '09:00:00', { kind: 'on' }), slot('09:00:00', null, { kind: 'off' })] };
    },
  },
  {
    id: 'shabbat_climate',
    name: 'שבת: קירור / חימום',
    description: 'מזגן בשבת ובחג בלבד: קירור בלילה, כיבוי ביום',
    icon: 'activity',
    needsSensor: true,
    build: (c) => ({
      ...emptyDraft(c.defaultRepeat),
      name: 'שבת – מזגן',
      conditions: c.sensor ? presetConditions('only_holy_days', c.sensor) : emptyDraft().conditions,
      slots: [slot('00:00:00', '07:00:00', { kind: 'climate', mode: 'cool', temp: 25 }), slot('07:00:00', '21:00:00', { kind: 'off' }), slot('21:00:00', '00:00:00', { kind: 'climate', mode: 'cool', temp: 25 })],
    }),
  },
  {
    id: 'motzash',
    name: 'מוצאי שבת',
    description: 'כיבוי או הדלקה בצאת השבת (שקיעה + 40 דקות), רק כשהחג הסתיים',
    icon: 'history',
    needsSensor: true,
    build: (c) => {
      const m = motzashDraft(c.sensor ?? '', 40);
      return { ...emptyDraft(c.defaultRepeat), name: 'מוצאי שבת', weekdays: m.weekdays, conditions: c.sensor ? m.conditions : emptyDraft().conditions, slots: [slot(m.start, null, { kind: 'off' })] };
    },
  },
  {
    id: 'blank',
    name: 'ריק',
    description: 'להתחיל מדף חלק',
    icon: 'plus',
    build: (c) => ({ ...emptyDraft(c.defaultRepeat), name: '', weekdays: SUN_THU, slots: [] }),
  },
];

export function templateById(id: string | null | undefined): ScheduleTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Lay a condition preset over a template's draft (a template that has its own condition keeps it). */
export function withPreset(draft: TemplateDraft, preset: ConditionPreset | null, sensor: string | null): TemplateDraft {
  if (!preset || !sensor || draft.conditions.items.length) return draft;
  return { ...draft, conditions: presetConditions(preset, sensor) };
}

export const PRESET_CHOICES: { id: ConditionPreset | null; label: string }[] = [
  { id: null, label: 'ללא תנאי' },
  { id: 'only_holy_days', label: PRESET_LABEL.only_holy_days },
  { id: 'not_holy_days', label: PRESET_LABEL.not_holy_days },
];

/** A template draft with its intents resolved for the chosen devices (a slot that has no device stays empty). */
export function resolveDraft(t: TemplateDraft, entities: EntityMeta[]): ScheduleDraft {
  return {
    ...t,
    slots: t.slots.map((s) => {
      const actions = entities.map((e) => (s.intent ? actionForIntent(s.intent, e) : null)).filter((a): a is NonNullable<typeof a> => !!a);
      return { start: s.start, stop: s.stop, actions: actions.length ? actions : s.actions };
    }),
  };
}

// ------------------------------------------------------------------------------------------------ quick create (3 taps)

export interface QuickAction {
  id: string;
  label: string;
  intent: Intent;
}

export interface QuickTime {
  id: string;
  label: string;
  raw: string;
  sun: boolean;
}

export interface QuickDays {
  id: string;
  label: string;
  days: DayToken[] | 'tomorrow';
  once?: boolean;
}

export const QUICK_TIMES: QuickTime[] = [
  { id: 'sunset', label: 'שקיעה', raw: 'sunset+00:00:00', sun: true },
  { id: 'sunrise', label: 'זריחה', raw: 'sunrise+00:00:00', sun: true },
  { id: '0700', label: '07:00', raw: '07:00:00', sun: false },
  { id: '1800', label: '18:00', raw: '18:00:00', sun: false },
  { id: '2200', label: '22:00', raw: '22:00:00', sun: false },
];

export const QUICK_DAYS: QuickDays[] = [
  { id: 'daily', label: 'כל יום', days: ['daily'] },
  { id: 'work', label: 'א׳–ה׳', days: SUN_THU },
  { id: 'weekend', label: 'סוף שבוע', days: ['fri', 'sat'] },
  { id: 'once', label: 'פעם אחת – מחר', days: 'tomorrow', once: true },
];

/** What a device of this kind can be told in three taps (sensitive classes are not offered here). */
export function quickActions(e: EntityMeta | undefined): QuickAction[] {
  if (!e) return [];
  switch (e.domain) {
    case 'light':
      return [
        { id: 'on', label: 'הדלקה', intent: { kind: 'on' } },
        { id: 'off', label: 'כיבוי', intent: { kind: 'off' } },
        { id: 'level50', label: 'בהירות 50%', intent: { kind: 'level', pct: 50 } },
      ];
    case 'switch':
      return [
        { id: 'on', label: 'הדלקה', intent: { kind: 'on' } },
        { id: 'off', label: 'כיבוי', intent: { kind: 'off' } },
      ];
    case 'fan':
      return [
        { id: 'on', label: 'הפעלה', intent: { kind: 'on' } },
        { id: 'off', label: 'כיבוי', intent: { kind: 'off' } },
      ];
    case 'cover':
      return [
        { id: 'open', label: 'פתיחה', intent: { kind: 'open' } },
        { id: 'close', label: 'סגירה', intent: { kind: 'close' } },
        { id: 'pos30', label: 'הנמכה ל־30%', intent: { kind: 'cover_pos', pos: 30 } },
      ];
    case 'climate':
      return [
        { id: 'cool23', label: 'קירור 23°', intent: { kind: 'climate', mode: 'cool', temp: 23 } },
        { id: 'heat22', label: 'חימום 22°', intent: { kind: 'climate', mode: 'heat', temp: 22 } },
        { id: 'off', label: 'כיבוי', intent: { kind: 'off' } },
      ];
    default:
      return [];
  }
}

export interface QuickChoice {
  entities: EntityMeta[];
  action: QuickAction | null;
  time: QuickTime | null;
  days: QuickDays | null;
}

export const quickReady = (q: QuickChoice) => q.entities.length > 0 && !!q.action && !!q.time && !!q.days;

/** "תאורת חצר: הדלקה · שקיעה · כל יום" while choosing, so the person always reads what will be created. */
export function quickSentence(q: QuickChoice): string {
  if (!q.entities.length) return 'בחרו התקנים כדי להתחיל.';
  const names = q.entities.length > 3 ? `${q.entities.slice(0, 3).map((e) => e.name).join(', ')} ועוד ${q.entities.length - 3}` : q.entities.map((e) => e.name).join(' ו');
  return `${names}: ${q.action?.label ?? '…'} · ${q.time?.label ?? '…'} · ${q.days?.label ?? '…'}`;
}

/** The draft of a finished quick choice: one point action at the chosen time, on the chosen days. */
export function quickDraft(q: QuickChoice, defaultRepeat: ScheduleDraft['repeat'], now: Date, preset: ConditionPreset | null = null, sensor: string | null = null): ScheduleDraft | null {
  if (!quickReady(q)) return null;
  const action = q.action!;
  const time = q.time!;
  const dayChoice = q.days!;
  const tomorrow = addDays(now, 1);
  const weekdays: DayToken[] = dayChoice.days === 'tomorrow' ? [DAY_ORDER[tomorrow.getDay()]] : dayChoice.days;
  const actions = q.entities.map((e) => actionForIntent(action.intent, e)).filter((a): a is NonNullable<typeof a> => !!a);
  if (!actions.length) return null;
  const name = `${q.entities.length === 1 ? q.entities[0].name : `${q.entities[0].name} ועוד ${q.entities.length - 1}`}: ${action.label} · ${time.label}`.slice(0, 80);
  const base = emptyDraft(dayChoice.once ? 'single' : defaultRepeat);
  return {
    ...base,
    name,
    weekdays,
    start_date: dayChoice.once ? isoDate(tomorrow) : null,
    end_date: dayChoice.once ? isoDate(tomorrow) : null,
    conditions: preset && sensor ? presetConditions(preset, sensor) : base.conditions,
    slots: [{ start: time.raw, stop: null, actions }],
  };
}

/** "יום ד׳" for a token set of one day (used in labels). */
export function dayName(d: DayId): string {
  return DAY_LONG[d];
}

export { tokensOf };
