/**
 * CR-014 demo data and in-memory store for the schedules API (docs/architecture/SCHEDULER_API.md). Used when no backend
 * answers (static preview, design review) and by the UI specs. The shapes follow the verified item structure of a live
 * installation (contiguous day slots, "HH:MM:SS" / "sunset+HH:MM:SS" times, schedule-wide conditions on a Shabbat /
 * holiday binary sensor, climate "set temperature" / "off" pairs, a code-free alarm arming, a script called as its own
 * service without an entity - read as a script action since 2026-10-04 - and one action Arx truly cannot model) - with
 * invented Hebrew names only; nothing here comes from a real installation.
 *
 * The rules applied here (classes, allow-list, lowering, permissions) only imitate the server for demo purposes; the
 * server is the authority.
 *
 * Specs steer the demo through localStorage key `sw.demo.schedules` (read on first use and on `resetDemoStore()`):
 * `{"persona": "admin" | "manager" | "viewer" | "none", "availability": "ok" | "component_missing" | "ha_unavailable" |
 * "feature_disabled" | "error", "empty": true}`.
 */
import { ApiError } from './client';
import {
  ALL_CLASSES,
  ALLOW_DISARM_WORD,
  DAY_ORDER,
  SENSITIVE_CLASSES,
  actionLabel,
  approximateUpcoming,
  conditionSummary,
  daysKind,
  detectPreset,
  draftSlotSpan,
  findOverlaps,
  parseTime,
  resolveDays,
  type AckableIssue,
  type Acknowledgement,
  type ArgSpec,
  type Availability,
  type BulkResult,
  type CatalogAction,
  type CatalogEntity,
  type ConditionCandidate,
  type ConditionView,
  type CreateResult,
  type DayId,
  type DayToken,
  type DraftAction,
  type DraftConditions,
  type DraftSlot,
  type Organisation,
  type PersonRef,
  type PreviewResult,
  type Problem,
  type ReadOnlyReason,
  type RepeatType,
  type ReviewItem,
  type RunItem,
  type RunResult,
  type Schedule,
  type ScheduleClass,
  type ScheduleDraft,
  type ScheduleList,
  type ScheduleQuery,
  type ScheduleSettings,
  type ScheduleSlot,
  type ScheduleState,
  type ScheduleStatus,
  type SunTimes,
  type TimeSpec,
  type TrashItem,
} from './schedules';

export const DEMO_CONTROL_KEY = 'sw.demo.schedules';
export type DemoPersona = 'admin' | 'manager' | 'viewer' | 'none';
export const DEMO_SHABBAT_SENSOR = 'binary_sensor.shabbat_mode';
export const DEMO_SUN: SunTimes = { sunrise: 6 * 60 + 33, sunset: 18 * 60 + 12 };

// ------------------------------------------------------------------------------------------------ demo installation

interface DemoEntity {
  entity_id: string;
  name: string;
  domain: string;
  class: ScheduleClass;
  area_id: string;
  area_name: string;
  floor_id: string;
  floor_name: string;
  available?: boolean;
  selectable?: boolean;
  reason?: Problem;
  attributes?: Record<string, unknown>;
  /** A script / scene that drives an alarm / lock / door (the server reads it from the automations mirror). */
  sensitive?: boolean;
  lowering?: boolean;
  /** A script's fields (the server's `vars` argument). */
  fields?: ArgSpec[];
}

const F0 = { floor_id: 'f0', floor_name: 'קומת קרקע' };
const F1 = { floor_id: 'f1', floor_name: 'קומה 1' };

export const DEMO_ENTITIES: DemoEntity[] = [
  { entity_id: 'climate.living_room', name: 'מזגן סלון', domain: 'climate', class: 'climate', area_id: 'living', area_name: 'סלון', ...F0, attributes: { hvac_modes: ['off', 'cool', 'heat', 'fan_only'], min_temp: 16, max_temp: 30 } },
  { entity_id: 'climate.master_bedroom', name: 'מזגן חדר הורים', domain: 'climate', class: 'climate', area_id: 'master', area_name: 'חדר הורים', ...F1, attributes: { hvac_modes: ['off', 'cool', 'heat'], min_temp: 16, max_temp: 30 } },
  { entity_id: 'climate.offices', name: 'מזגן משרדים', domain: 'climate', class: 'climate', area_id: 'offices', area_name: 'משרדים', ...F1, attributes: { hvac_modes: ['off', 'cool', 'heat', 'auto'], min_temp: 16, max_temp: 30 } },
  { entity_id: 'climate.meeting_room', name: 'מזגן חדר ישיבות', domain: 'climate', class: 'climate', area_id: 'meeting', area_name: 'חדר ישיבות', ...F1, attributes: { hvac_modes: ['off', 'cool', 'heat'], min_temp: 16, max_temp: 30 } },
  { entity_id: 'switch.shabbat_lights_living', name: 'תאורת שבת – סלון', domain: 'switch', class: 'switch', area_id: 'living', area_name: 'סלון', ...F0 },
  { entity_id: 'switch.irrigation', name: 'השקיה', domain: 'switch', class: 'switch', area_id: 'yard', area_name: 'חצר', ...F0 },
  {
    entity_id: 'switch.boiler', name: 'דוד', domain: 'switch', class: 'switch', area_id: 'kitchen', area_name: 'מטבח', ...F0,
  },
  { entity_id: 'light.office_ceiling', name: 'תאורת תקרה – משרדים', domain: 'light', class: 'light', area_id: 'offices', area_name: 'משרדים', ...F1 },
  { entity_id: 'light.yard', name: 'תאורת חצר', domain: 'light', class: 'light', area_id: 'yard', area_name: 'חצר', ...F0 },
  { entity_id: 'light.lobby', name: 'תאורת לובי', domain: 'light', class: 'light', area_id: 'lobby', area_name: 'לובי', ...F0 },
  { entity_id: 'cover.gym_shutter', name: 'תריס אולם', domain: 'cover', class: 'cover', area_id: 'gym', area_name: 'אולם ספורט', ...F0, attributes: { current_position: 100 } },
  { entity_id: 'cover.living_shutter', name: 'תריס סלון', domain: 'cover', class: 'cover', area_id: 'living', area_name: 'סלון', ...F0, attributes: { current_position: 0 } },
  { entity_id: 'fan.gym', name: 'מאוורר אולם', domain: 'fan', class: 'fan', area_id: 'gym', area_name: 'אולם ספורט', ...F0 },
  { entity_id: 'cover.parking_gate', name: 'שער חניה', domain: 'cover', class: 'door', area_id: 'parking', area_name: 'חניה', ...F0, attributes: { device_class: 'gate', current_position: 0 } },
  { entity_id: 'lock.main_door', name: 'מנעול דלת ראשית', domain: 'lock', class: 'lock', area_id: 'lobby', area_name: 'לובי', ...F0 },
  { entity_id: 'alarm_control_panel.house', name: 'אזעקה – בית', domain: 'alarm_control_panel', class: 'alarm', area_id: 'lobby', area_name: 'לובי', ...F0, attributes: { code_arm_required: false, arm_modes: ['arm_home', 'arm_away', 'arm_night'] } },
  // 2026-10-04: scripts (an alarm script is an ordinary script), a scene, a helper, a vacuum
  {
    entity_id: 'script.morning_routine', name: 'שגרת בוקר', domain: 'script', class: 'script', area_id: 'living', area_name: 'סלון', ...F0,
    fields: [
      { name: 'minutes', label: 'דקות', type: 'int', min: 1, max: 60, required: true },
      { name: 'room', label: 'חדר', type: 'enum', choices: ['סלון', 'משרדים'], required: false },
      { name: 'loud', label: 'בקול', type: 'bool', required: false },
    ],
  },
  { entity_id: 'script.night_alarm', name: 'סקריפט אזעקת לילה', domain: 'script', class: 'script', area_id: 'lobby', area_name: 'לובי', ...F0, sensitive: true },
  { entity_id: 'scene.evening', name: 'סצנת ערב', domain: 'scene', class: 'scene', area_id: 'living', area_name: 'סלון', ...F0 },
  { entity_id: 'input_boolean.guest_mode', name: 'מצב אורחים', domain: 'input_boolean', class: 'helper', area_id: 'living', area_name: 'סלון', ...F0 },
  { entity_id: 'vacuum.robot', name: 'שואב רובוטי', domain: 'vacuum', class: 'vacuum', area_id: 'living', area_name: 'סלון', ...F0 },
];

export const DEMO_CONDITION_ENTITIES: ConditionCandidate[] = [
  { entity_id: DEMO_SHABBAT_SENSOR, name: 'איסור מלאכה', domain: 'binary_sensor', device_class: null, state: 'off', unit: null, numeric: false, suggested_shabbat: true },
  { entity_id: 'binary_sensor.office_occupancy', name: 'נוכחות – משרדים', domain: 'binary_sensor', device_class: 'occupancy', state: 'on', unit: null, numeric: false, suggested_shabbat: false },
  { entity_id: 'sensor.outdoor_temperature', name: 'טמפרטורה בחוץ', domain: 'sensor', device_class: 'temperature', state: '27.4', unit: '°C', numeric: true, suggested_shabbat: false },
  { entity_id: 'sun.sun', name: 'השמש', domain: 'sun', device_class: null, state: 'above_horizon', unit: null, numeric: false, suggested_shabbat: false },
];

const ENTITY = new Map(DEMO_ENTITIES.map((e) => [e.entity_id, e]));
const COND_ENTITY = new Map(DEMO_CONDITION_ENTITIES.map((e) => [e.entity_id, e]));

const int = (name: string, min: number, max: number, required = true): ArgSpec => ({ name, type: 'int', min, max, required });

/** Demo copy of the allow-list of §5.2 (the server's `SCHEDULE_ACTIONS` is the authority). */
const ALLOW: Record<ScheduleClass, Record<string, ArgSpec[]>> = {
  light: { 'light.turn_on': [int('brightness', 0, 255, false), int('brightness_pct', 1, 100, false)], 'light.turn_off': [] },
  switch: { 'switch.turn_on': [], 'switch.turn_off': [] },
  cover: {
    'cover.open_cover': [],
    'cover.close_cover': [],
    'cover.stop_cover': [],
    'cover.set_cover_position': [int('position', 0, 100)],
    'cover.set_cover_tilt_position': [int('tilt_position', 0, 100)],
  },
  script: { 'script.turn_on': [{ name: 'variables', type: 'vars', required: false }] },
  scene: { 'scene.turn_on': [] },
  helper: { 'input_boolean.turn_on': [], 'input_boolean.turn_off': [] },
  humidifier: {},
  vacuum: { 'vacuum.start': [], 'vacuum.return_to_base': [] },
  climate: {
    'climate.set_hvac_mode': [{ name: 'hvac_mode', type: 'enum', choices: [], required: true }],
    'climate.set_temperature': [{ name: 'temperature', type: 'float', min: 16, max: 30, required: true }, { name: 'hvac_mode', type: 'enum', choices: [], required: false }],
    'climate.set_fan_mode': [{ name: 'fan_mode', type: 'str', required: true }],
    'climate.set_preset_mode': [{ name: 'preset_mode', type: 'str', required: true }],
    'climate.turn_off': [],
  },
  fan: { 'fan.turn_on': [int('percentage', 1, 100, false)], 'fan.turn_off': [], 'fan.set_percentage': [int('percentage', 0, 100)] },
  alarm: {
    'alarm_control_panel.alarm_arm_home': [],
    'alarm_control_panel.alarm_arm_away': [],
    'alarm_control_panel.alarm_arm_night': [],
    'alarm_control_panel.alarm_disarm': [],
  },
  lock: { 'lock.lock': [], 'lock.unlock': [] },
  door: { 'cover.open_cover': [], 'cover.close_cover': [], 'cover.stop_cover': [], 'cover.set_cover_position': [int('position', 0, 100)], 'switch.turn_on': [], 'switch.turn_off': [], 'button.press': [] },
};

function isLowering(cls: ScheduleClass | null, service: string, data: Record<string, unknown>, e?: DemoEntity): boolean {
  if (service === 'alarm_control_panel.alarm_disarm' || service === 'lock.unlock') return true;
  if (cls === 'script' || cls === 'scene') return !!e?.lowering;
  if (cls !== 'door') return false;
  if (service === 'cover.set_cover_position') return Number(data.position ?? 0) > 0;
  return ['cover.open_cover', 'switch.turn_on', 'switch.turn_off', 'button.press'].includes(service);
}

// ------------------------------------------------------------------------------------------------ seeds

interface Seed {
  id: string;
  entity_id: string;
  name: string | null;
  enabled: boolean;
  state?: ScheduleState;
  weekdays: DayToken[];
  start_date: string | null;
  end_date: string | null;
  repeat: RepeatType;
  tags: string[];
  conditions: DraftConditions;
  slots: DraftSlot[];
  source: 'arx' | 'external';
  owner: PersonRef | null;
  created_at: string | null;
  updated_at: string | null;
  folder_id: string | null;
  order: number | null;
  pinned: boolean;
}

const JONI: PersonRef = { user_id: 'u_demo_admin', username: 'joni', display_name: 'יוני' };
const DANA: PersonRef = { user_id: 'u_demo_site', username: 'dana', display_name: 'דנה' };
const ONLY_HOLY: DraftConditions = { items: [{ entity_id: DEMO_SHABBAT_SENSOR, attribute: 'state', match_type: 'is', value: 'on' }], type: 'or', track: false };
const NOT_HOLY: DraftConditions = { items: [{ entity_id: DEMO_SHABBAT_SENSOR, attribute: 'state', match_type: 'is', value: 'off' }], type: 'or', track: false };
const NONE: DraftConditions = { items: [], type: null, track: false };

const act = (service: string, entity_id: string | null, data: Record<string, unknown> = {}): DraftAction => ({ service, entity_id, data });
const slot = (start: string, stop: string | null, ...actions: DraftAction[]): DraftSlot => ({ start, stop, actions });
const cool = (e: string, t: number) => act('climate.set_temperature', e, { hvac_mode: 'cool', temperature: t });
const SUN_THU: DayToken[] = ['sun', 'mon', 'tue', 'wed', 'thu'];

function seeds(): Seed[] {
  const base = { start_date: null, end_date: null, folder_id: null, pinned: false, created_at: null, updated_at: '2026-09-28T09:12:00Z' };
  return [
    {
      ...base, id: '3f9a1c', entity_id: 'switch.schedule_slvn_qyrvr_bshbt', name: 'סלון – קירור בשבת', enabled: true, weekdays: ['daily'], repeat: 'repeat', tags: ['שבת-חג'],
      conditions: ONLY_HOLY, source: 'external', owner: null, order: 1,
      slots: [
        slot('00:00:00', '06:00:00', cool('climate.living_room', 25)),
        slot('06:00:00', '12:00:00', act('climate.turn_off', 'climate.living_room')),
        slot('12:00:00', '17:00:00', cool('climate.living_room', 24)),
        slot('17:00:00', '20:00:00', act('climate.turn_off', 'climate.living_room')),
        slot('20:00:00', '00:00:00', cool('climate.living_room', 25)),
      ],
    },
    {
      ...base, id: '8b21d4', entity_id: 'switch.schedule_khdr_hvrym_bshbt', name: 'חדר הורים – קירור בשבת', enabled: false, weekdays: ['daily'], repeat: 'repeat', tags: ['שבת-חג'],
      conditions: ONLY_HOLY, source: 'external', owner: null, order: 2,
      slots: [
        slot('00:00:00', '07:00:00', cool('climate.master_bedroom', 25.5)),
        slot('07:00:00', '21:00:00', act('climate.turn_off', 'climate.master_bedroom')),
        slot('21:00:00', '00:00:00', cool('climate.master_bedroom', 25.5)),
      ],
    },
    {
      ...base, id: 'c07e55', entity_id: 'switch.schedule_tavrt_shbt_slvn', name: 'תאורת שבת – סלון', enabled: true, weekdays: ['daily'], repeat: 'repeat', tags: ['שבת-חג'],
      conditions: ONLY_HOLY, source: 'external', owner: null, order: 3,
      slots: [
        slot('00:00:00', '01:00:00', act('switch.turn_on', 'switch.shabbat_lights_living')),
        slot('01:00:00', '17:00:00', act('switch.turn_off', 'switch.shabbat_lights_living')),
        slot('17:00:00', '23:00:00', act('switch.turn_on', 'switch.shabbat_lights_living')),
        slot('23:00:00', '00:00:00', act('switch.turn_off', 'switch.shabbat_lights_living')),
      ],
    },
    {
      ...base, id: '4d6e0a', entity_id: 'switch.schedule_4d6e0a', name: 'תאורת משרדים – שעות עבודה', enabled: true, weekdays: SUN_THU, repeat: 'repeat', tags: ['משרדים'],
      conditions: NOT_HOLY, source: 'arx', owner: DANA, created_at: '2026-09-20T07:00:00Z', order: 4,
      slots: [slot('07:30:00', '19:00:00', act('light.turn_on', 'light.office_ceiling', { brightness: 204 })), slot('19:00:00', null, act('light.turn_off', 'light.office_ceiling'))],
    },
    {
      ...base, id: '5a13f2', entity_id: 'switch.schedule_5a13f2', name: 'תריס אולם – קיץ', enabled: true, weekdays: ['daily'], repeat: 'repeat', tags: ['חוץ'],
      start_date: '2026-04-15', end_date: '2026-10-15', conditions: NONE, source: 'arx', owner: DANA, created_at: '2026-04-10T10:00:00Z', order: 5,
      slots: [slot('08:00:00', '18:30:00', act('cover.set_cover_position', 'cover.gym_shutter', { position: 10 })), slot('18:30:00', null, act('cover.close_cover', 'cover.gym_shutter'))],
    },
    {
      ...base, id: 'e19b70', entity_id: 'switch.schedule_e19b70', name: 'דריכת אזעקה – לילה', enabled: true, weekdays: ['daily'], repeat: 'repeat', tags: [],
      conditions: NONE, source: 'arx', owner: JONI, created_at: '2026-09-25T20:00:00Z', order: 6,
      slots: [slot('23:30:00', null, act('alarm_control_panel.alarm_arm_home', 'alarm_control_panel.house'))],
    },
    {
      ...base, id: 'a0f4c9', entity_id: 'switch.schedule_a0f4c9', name: '', enabled: true, weekdays: ['daily'], repeat: 'repeat', tags: [],
      conditions: NONE, source: 'external', owner: null, order: 7,
      // the owner's case: a script called as its own service, no entity - a script action since 2026-10-04
      slots: [slot('06:15:00', null, act('script.morning_routine', null, { minutes: 10 }))],
    },
    {
      ...base, id: '71c2b8', entity_id: 'switch.schedule_tavrt_khvts', name: 'תאורת חוץ – שקיעה עד חצות', enabled: true, weekdays: ['daily'], repeat: 'repeat', tags: ['חוץ'],
      start_date: '2026-10-31', end_date: '2027-03-31', conditions: NONE, source: 'external', owner: null, order: 8,
      slots: [slot('sunset+00:30:00', '23:30:00', act('light.turn_on', 'light.yard', { brightness: 153 })), slot('23:30:00', null, act('light.turn_off', 'light.yard'))],
    },
    {
      ...base, id: '0e7d3b', entity_id: 'switch.schedule_0e7d3b', name: 'השקיה – חד פעמית', enabled: false, state: 'completed', weekdays: ['daily'], repeat: 'pause', tags: ['חוץ'],
      conditions: NONE, source: 'arx', owner: DANA, created_at: '2026-09-27T05:00:00Z', order: 9,
      slots: [slot('06:00:00', '06:20:00', act('switch.turn_on', 'switch.irrigation')), slot('06:20:00', null, act('switch.turn_off', 'switch.irrigation'))],
    },
    {
      ...base, id: 'b6a41e', entity_id: 'switch.schedule_kybvy_mzgnym', name: 'כיבוי מזגנים – מוצאי שבת', enabled: true, weekdays: ['sat'], repeat: 'repeat', tags: ['שבת-חג'],
      conditions: NOT_HOLY, source: 'arx', owner: JONI, created_at: '2026-09-18T19:00:00Z', order: 10,
      slots: [
        slot(
          'sunset+00:40:00',
          null,
          act('climate.turn_off', 'climate.living_room'),
          act('climate.turn_off', 'climate.master_bedroom'),
          act('climate.turn_off', 'climate.offices'),
          act('climate.turn_off', 'climate.meeting_room'),
        ),
      ],
    },
    {
      ...base, id: '2c9f61', entity_id: 'switch.schedule_2c9f61', name: 'מאוורר אולם – בימים חמים', enabled: true, weekdays: SUN_THU, repeat: 'repeat', tags: ['אולם'],
      conditions: { items: [{ entity_id: 'sensor.outdoor_temperature', attribute: 'state', match_type: 'above', value: 26 }], type: 'or', track: true },
      source: 'arx', owner: DANA, created_at: '2026-09-01T12:00:00Z', order: 11,
      slots: [slot('16:00:00', '22:00:00', act('fan.turn_on', 'fan.gym', { percentage: 60 })), slot('22:00:00', null, act('fan.turn_off', 'fan.gym'))],
    },
    {
      ...base, id: 'd8e3a7', entity_id: 'switch.schedule_d8e3a7', name: 'שער חניה – פתיחה בבוקר', enabled: false, weekdays: SUN_THU, repeat: 'repeat', tags: [],
      conditions: NOT_HOLY, source: 'arx', owner: JONI, created_at: '2026-09-29T06:00:00Z', order: 12,
      slots: [slot('07:00:00', '08:00:00', act('cover.open_cover', 'cover.parking_gate')), slot('08:00:00', null, act('cover.close_cover', 'cover.parking_gate'))],
    },
    {
      ...base, id: 'f45b02', entity_id: 'switch.schedule_f45b02', name: 'נעילת דלת ראשית – לילה', enabled: true, weekdays: ['daily'], repeat: 'repeat', tags: [],
      conditions: NONE, source: 'arx', owner: JONI, created_at: '2026-09-26T21:00:00Z', order: 13,
      slots: [slot('23:00:00', null, act('lock.lock', 'lock.main_door'))],
    },
    {
      ...base, id: '6e2d90', entity_id: 'switch.schedule_6e2d90', name: 'הודעת בוקר לטלפון', enabled: true, weekdays: SUN_THU, repeat: 'repeat', tags: [],
      conditions: NONE, source: 'external', owner: null, order: 14,
      // content Arx truly cannot model (a notification): shown, never edited here
      slots: [slot('07:00:00', null, act('notify.mobile_app_phone', null, { message: 'בוקר טוב' }))],
    },
  ];
}

const SCRIPT_RESERVED = ['turn_on', 'turn_off', 'toggle', 'reload'];

/** The server's `canonical_action`: a script called as its own service is `script.turn_on` on that script, its data the variables. */
function canonicalAction(a: DraftAction): DraftAction {
  const m = /^script\.([a-z0-9_]+)$/.exec(a.service);
  if (m && !SCRIPT_RESERVED.includes(m[1]) && (a.entity_id === null || a.entity_id === `script.${m[1]}`)) {
    return { service: 'script.turn_on', entity_id: `script.${m[1]}`, data: Object.keys(a.data).length ? { variables: { ...a.data } } : {} };
  }
  return a;
}

function canonicalDraft(d: ScheduleDraft): ScheduleDraft {
  return { ...d, slots: d.slots.map((s) => ({ ...s, actions: s.actions.map(canonicalAction) })) };
}

const sensitiveOf = (e: DemoEntity | undefined): boolean => !!e && (SENSITIVE_CLASSES.includes(e.class) || ((e.class === 'script' || e.class === 'scene') && !!e.sensitive));

// ------------------------------------------------------------------------------------------------ helpers

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function delay(ms = 120): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function hex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** FNV-1a twice (two seeds) → 16 hex: a stable demo "revision" of the content. */
function revisionOf(content: unknown): string {
  const s = JSON.stringify(content);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193 + 2);
  }
  return hex(a) + hex(b);
}

function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(3)), (x) => x.toString(16).padStart(2, '0')).join('');
}

function fail(status: number, code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new ApiError(status, { code, user_message: message, retryable: false, correlation_id: 'demo', details });
}

function readControl(): { persona: DemoPersona; availability: Availability; empty: boolean } {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(localStorage.getItem(DEMO_CONTROL_KEY) ?? '{}') as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const personas: DemoPersona[] = ['admin', 'manager', 'viewer', 'none'];
  const avail: Availability[] = ['ok', 'component_missing', 'ha_unavailable', 'feature_disabled', 'error'];
  return {
    persona: personas.includes(raw.persona as DemoPersona) ? (raw.persona as DemoPersona) : 'admin',
    availability: avail.includes(raw.availability as Availability) ? (raw.availability as Availability) : 'ok',
    empty: raw.empty === true,
  };
}

function draftOf(s: Seed): ScheduleDraft {
  return { name: s.name, weekdays: s.weekdays, start_date: s.start_date, end_date: s.end_date, repeat: s.repeat, tags: s.tags, conditions: s.conditions, slots: s.slots };
}

function contentOf(s: Seed): unknown {
  return { schedule_id: s.id, name: s.name, weekdays: s.weekdays, start_date: s.start_date, end_date: s.end_date, repeat_type: s.repeat, tags: s.tags, timeslots: timeslotsOf(s) };
}

function timeslotsOf(s: Seed): Record<string, unknown>[] {
  return s.slots.map((sl) => ({
    start: sl.start,
    stop: sl.stop,
    conditions: s.conditions.items.map((c) => ({ entity_id: c.entity_id, attribute: c.attribute, value: c.value, match_type: c.match_type })),
    condition_type: s.conditions.items.length ? s.conditions.type ?? 'or' : null,
    track_conditions: s.conditions.track,
    actions: sl.actions.map((a) => ({ service: a.service, entity_id: a.entity_id, service_data: { ...a.data } })),
  }));
}

// ------------------------------------------------------------------------------------------------ the store

interface DemoRun extends RunItem {}
interface DemoTrash {
  trash_id: string;
  seed: Seed;
  deleted_at: string;
  expires_at: string;
  deleted_by: PersonRef;
}

export class ScheduleDemoStore {
  persona: DemoPersona = 'admin';
  availability: Availability = 'ok';
  settings: ScheduleSettings = { enabled: true, classes: [...ALL_CLASSES], snapMinutes: 15, defaultRepeat: 'repeat', runsRetentionDays: 90, shabbatSensor: DEMO_SHABBAT_SENSOR, allowDisarm: false };
  private items: Seed[] = [];
  private trashItems: DemoTrash[] = [];
  private runItems: DemoRun[] = [];
  private folders: Organisation['folders'] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    const c = readControl();
    this.persona = c.persona;
    this.availability = c.availability;
    this.items = c.empty ? [] : seeds();
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 86_400_000).toISOString();
    this.trashItems = c.empty
      ? []
      : [
          {
            trash_id: 't_3b91',
            seed: { ...seeds()[0], id: '9c0d11', entity_id: 'switch.schedule_9c0d11', name: 'תאורת לובי – ישן', tags: [], conditions: NONE, source: 'arx', owner: DANA, slots: [slot('18:00:00', '23:00:00', act('light.turn_on', 'light.lobby')), slot('23:00:00', null, act('light.turn_off', 'light.lobby'))] },
            deleted_at: days(3),
            expires_at: new Date(now + 27 * 86_400_000).toISOString(),
            deleted_by: DANA,
          },
        ];
    const run = (id: string, sid: string, n: number, slotIndex: number, result: RunResult, sensitive = false): DemoRun => ({
      id,
      schedule_id: sid,
      schedule_name: this.items.find((s) => s.id === sid)?.name ?? '',
      slot_index: slotIndex,
      started_at: days(n),
      settled_at: days(n),
      result,
      via: 'component',
      sensitive,
      detail: { entities: [] },
    });
    this.runItems = c.empty
      ? []
      : [
          run('r1', '3f9a1c', 3, 4, 'confirmed'),
          run('r2', '3f9a1c', 3.2, 3, 'confirmed'),
          run('r3', '4d6e0a', 0.4, 0, 'confirmed'),
          run('r4', '4d6e0a', 1.4, 1, 'not_confirmed'),
          run('r5', 'e19b70', 0.9, 0, 'confirmed', true),
          run('r6', 'f45b02', 0.95, 0, 'skipped', true),
        ];
    this.folders = [];
  }

  // -------------------------------------------------------------------------------------------- permissions (demo)

  private get canView(): boolean {
    return this.persona !== 'none';
  }
  private get canManage(): boolean {
    return this.persona === 'admin' || this.persona === 'manager';
  }
  private get canSensitive(): boolean {
    return this.persona === 'admin';
  }
  private get writable(): boolean {
    return this.availability === 'ok' && this.settings.enabled;
  }

  /** The "manager" persona stands for a floor-scoped editor: the outdoor sensor is outside their read scope. */
  private readable(entityId: string): boolean {
    return this.persona === 'admin' || entityId === DEMO_SHABBAT_SENSOR || entityId !== 'sensor.outdoor_temperature';
  }

  // -------------------------------------------------------------------------------------------- building a Schedule

  private build(s: Seed, now: Date = new Date()): Schedule {
    const slots: ScheduleSlot[] = s.slots.map((sl, index) => {
      const start = parseTime(sl.start) ?? ({ kind: 'fixed', time: '00:00', raw: sl.start } as TimeSpec);
      const stop = sl.stop ? parseTime(sl.stop) : null;
      const actions = sl.actions.map(canonicalAction).map((a) => {
        const e = a.entity_id ? ENTITY.get(a.entity_id) : undefined;
        const cls = e ? e.class : null;
        const known = Object.values(ALLOW).some((svcs) => a.service in svcs);
        const gone = !!a.entity_id && !e && known && a.service.split('.')[0] === a.entity_id.split('.')[0];
        const supported = gone || (!!e && !!cls && a.service in ALLOW[cls] && !('code' in a.data));
        const out: Schedule['slots'][number]['actions'][number] = { service: a.service, entity_id: a.entity_id, data: { ...a.data }, supported, class: supported && cls ? cls : null, sensitive: sensitiveOf(e), lowering: isLowering(cls, a.service, a.data, e) };
        if (gone) out.invalid = { code: 'entity_missing', message: 'ההתקן של הפעולה אינו קיים עוד במערכת.' };
        return out;
      });
      const unsupported: Problem<'action_without_entity' | 'action_not_allowed'>[] = actions
        .filter((a) => !a.supported)
        .map((a, i) => (a.entity_id ? { code: 'action_not_allowed', message: 'הפעולה אינה נתמכת בתזמון.', path: `slots[${index}].actions[${i}]` } : { code: 'action_without_entity', message: 'פעולה ללא התקן שהמערכת אינה מציגה.', path: `slots[${index}].actions[${i}]` }));
      return { index, start, stop, actions, supported: unsupported.length === 0, unsupported };
    });
    const understood = slots.every((x) => x.supported);
    const ids = [...new Set(s.slots.flatMap((sl) => sl.actions.map((a) => canonicalAction(a).entity_id)).filter((x): x is string => !!x))];
    const entities = ids.map((id) => {
      const e = ENTITY.get(id);
      return {
        entity_id: id,
        name: e?.name ?? id,
        domain: id.split('.')[0],
        role: 'action' as const,
        area_id: e?.area_id ?? null,
        area_name: e?.area_name ?? null,
        floor_id: e?.floor_id ?? null,
        floor_name: e?.floor_name ?? null,
        class: e?.class ?? null,
        sensitive: sensitiveOf(e),
        available: e?.available ?? true,
      };
    });
    const names = Object.fromEntries(DEMO_CONDITION_ENTITIES.map((c) => [c.entity_id, c.name]));
    const condItems: ConditionView[] = s.conditions.items.map((c) => {
      const ce = COND_ENTITY.get(c.entity_id);
      const readable = this.readable(c.entity_id);
      return { ...c, name: ce?.name ?? c.entity_id, readable, state: readable ? ce?.state ?? null : null, available: readable ? ce?.state !== 'unavailable' : null, locked: !readable };
    });
    const sensor = this.settings.shabbatSensor || null;
    const allActions = slots.flatMap((x) => x.actions);
    const sensitiveClasses = [...new Set(allActions.filter((a) => a.sensitive && a.class).map((a) => a.class as ScheduleClass))];
    const sensitive = sensitiveClasses.length > 0;
    const invalid = allActions.filter((a) => a.invalid);
    const lowering = allActions.some((a) => a.lowering);
    const upcoming = approximateUpcoming(draftOf(s), now, DEMO_SUN).map((u) => ({ ...u, summary: this.slotSummary(s.slots[u.slot_index]) }));
    const state: ScheduleState = s.state ?? (s.enabled ? (upcoming.length ? 'on' : 'unavailable') : 'off');
    const last = this.runItems.filter((r) => r.schedule_id === s.id).sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    const reasons: ReadOnlyReason[] = [];
    if (!this.canManage) reasons.push({ code: 'no_manage_permission', message: 'אין לך הרשאה לנהל תזמונים.' });
    else if (sensitive && !this.canSensitive) reasons.push({ code: 'sensitive_permission_required', message: 'תזמון של אזעקה, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות.' });
    if (!understood) reasons.push({ code: 'unsupported_content', message: 'התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.' });
    if (!this.writable) reasons.push({ code: this.availability === 'ha_unavailable' ? 'ha_unavailable' : 'component_unavailable', message: 'שמירת שינויים אינה זמינה כרגע.' });
    const rights = this.canManage && (!sensitive || this.canSensitive) && this.writable;
    const wide = this.persona === 'admin' && this.writable;
    return {
      id: s.id,
      entity_id: s.entity_id,
      name: s.name,
      display_name: s.name || (entities[0] ? `${entities[0].name} · ${s.slots.length} משבצות` : 'תזמון ללא שם'),
      enabled: s.enabled,
      state,
      days: { tokens: [...s.weekdays], kind: daysKind(s.weekdays), days: resolveDays(s.weekdays) },
      start_date: s.start_date,
      end_date: s.end_date,
      repeat: s.repeat,
      slots,
      conditions: {
        items: condItems,
        type: s.conditions.items.length ? s.conditions.type ?? 'or' : null,
        track: s.conditions.track,
        uniform: true,
        summary: conditionSummary(s.conditions, names, sensor),
        preset: detectPreset(s.conditions, sensor),
      },
      entities,
      tags: [...s.tags],
      folder_id: s.folder_id,
      order: s.order,
      pinned: s.pinned,
      next_run: s.enabled && state !== 'completed' && upcoming[0] ? { ...upcoming[0], source: 'component', conditional: s.conditions.items.length > 0 } : null,
      upcoming: s.enabled ? upcoming : [],
      last_run: last ? { at: last.started_at, slot_index: last.slot_index, result: last.result } : null,
      sensitive,
      sensitive_classes: sensitiveClasses,
      lowering,
      source: s.source,
      owner: s.owner,
      created_at: s.created_at,
      updated_at: s.updated_at,
      revision: revisionOf(contentOf(s)),
      can: {
        edit: rights && understood,
        toggle: understood ? rights : wide && s.enabled,
        run: rights && understood && !invalid.length,
        delete: understood ? rights : wide,
        copy: rights && understood,
      },
      read_only: reasons.length ? { reasons } : null,
      warnings: [...invalid.map((a) => ({ code: a.invalid!.code, message: a.invalid!.message })), ...(s.repeat === 'single' ? [{ code: 'single_deletes', message: 'התזמון יימחק אחרי ההרצה האחרונה.' }] : [])],
      raw: { ...(contentOf(s) as Record<string, unknown>), entity_id: s.entity_id, enabled: s.enabled, timestamps: upcoming.map((u) => u.at), next_entries: upcoming.map((u) => u.slot_index) },
    };
  }

  private slotSummary(sl: DraftSlot | undefined): string {
    if (!sl) return '';
    return sl.actions.map(canonicalAction).map((a) => `${actionLabel(a)} · ${(a.entity_id && ENTITY.get(a.entity_id)?.name) || 'ללא התקן'}`).join(', ');
  }

  private find(id: string): Seed {
    const s = this.items.find((x) => x.id === id);
    if (!s || !this.canView || this.availability === 'component_missing') fail(404, 'schedule_not_found', 'התזמון לא נמצא.');
    return s;
  }

  private requireWrite(s: Seed | null): void {
    if (!this.settings.enabled) fail(409, 'feature_disabled', 'התזמונים כבויים בהגדרות המערכת.');
    if (this.availability === 'ha_unavailable') fail(503, 'ha_unavailable', 'תשתית המערכת אינה זמינה כרגע.');
    if (this.availability !== 'ok') fail(503, 'scheduler_unavailable', 'התזמונים אינם זמינים כרגע.');
    if (!this.canManage) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    if (s && this.build(s).sensitive && !this.canSensitive) fail(403, 'sensitive_permission_required', 'תזמון של אזעקה, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות.');
  }

  // -------------------------------------------------------------------------------------------- API

  async status(): Promise<ScheduleStatus> {
    await delay();
    const visible = this.canView && this.availability !== 'component_missing' ? this.items : [];
    const admin = this.persona === 'admin';
    const sensor = COND_ENTITY.get(this.settings.shabbatSensor);
    return {
      available: this.settings.enabled ? this.availability : 'feature_disabled',
      feature_enabled: this.settings.enabled,
      stale: this.availability === 'ha_unavailable',
      last_sync_at: new Date(Date.now() - 42_000).toISOString(),
      writable: this.writable,
      write_block: !this.settings.enabled ? 'feature_disabled' : this.availability === 'ok' ? null : this.availability === 'ha_unavailable' ? 'ha_unavailable' : 'component_missing',
      capabilities: { tags: false, negative_sun_offset: false },
      can: { view: this.canView, manage: this.canManage, sensitive: this.canSensitive, configure: admin, acknowledge: admin },
      counts: { visible: visible.length, enabled: visible.filter((s) => s.enabled).length, attention: admin ? this.reviewRows().filter((r) => r.issues.length).length : 0, hidden: admin ? 0 : null },
      settings: {
        snap_minutes: this.settings.snapMinutes,
        default_repeat: this.settings.defaultRepeat,
        classes: [...this.settings.classes],
        shabbat_sensor: sensor ? { entity_id: sensor.entity_id, name: sensor.name, state: sensor.state, available: true } : null,
        allow_disarm: this.settings.allowDisarm,
      },
      admin: admin ? { component: this.availability === 'component_missing' ? 'missing' : 'found', component_version: this.availability === 'component_missing' ? null : '3.3.8', bridge_version: '0.6.1', bridge_required: '0.3.0', ha_version: '2026.9.4' } : undefined,
    };
  }

  async list(q: ScheduleQuery): Promise<ScheduleList> {
    await delay();
    const st = { available: this.availability, stale: this.availability === 'ha_unavailable', last_sync_at: new Date(Date.now() - 42_000).toISOString() };
    if (!this.canView) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    if (this.availability === 'component_missing' || this.availability === 'feature_disabled') return { items: [], total: 0, offset: 0, limit: q.limit ?? 200, status: st };
    const now = new Date();
    let rows = this.items.map((s) => this.build(s, now));
    const text = (q.q ?? '').trim().toLowerCase();
    if (text)
      rows = rows.filter((s) =>
        [s.display_name, ...s.entities.map((e) => e.name), ...s.conditions.items.map((c) => c.name), ...s.tags].some((v) => v.toLowerCase().includes(text)),
      );
    if (q.floor) rows = rows.filter((s) => s.entities.some((e) => e.floor_id === q.floor));
    if (q.area) rows = rows.filter((s) => s.entities.some((e) => e.area_id === q.area));
    if (q.entity) rows = rows.filter((s) => s.entities.some((e) => e.entity_id === q.entity));
    if (q.condition) rows = rows.filter((s) => s.conditions.items.some((c) => c.entity_id === q.condition));
    if (q.has_conditions !== undefined) rows = rows.filter((s) => (s.conditions.items.length > 0) === q.has_conditions);
    if (q.preset) rows = rows.filter((s) => s.conditions.preset === q.preset);
    if (q.day) rows = rows.filter((s) => s.days.days?.includes(q.day as DayId) ?? true);
    if (q.state === 'enabled') rows = rows.filter((s) => s.enabled);
    else if (q.state === 'disabled') rows = rows.filter((s) => !s.enabled);
    else if (q.state) rows = rows.filter((s) => s.state === q.state);
    if (q.tag) rows = rows.filter((s) => s.tags.includes(q.tag as string));
    if (q.folder) rows = rows.filter((s) => s.folder_id === q.folder);
    if (q.source) rows = rows.filter((s) => s.source === q.source);
    if (q.sensitive !== undefined) rows = rows.filter((s) => s.sensitive === q.sensitive);
    if (q.editable !== undefined) rows = rows.filter((s) => s.can.edit === q.editable);
    const sort = q.sort ?? 'next_run';
    rows.sort((a, b) => {
      if (sort === 'name') return a.display_name.localeCompare(b.display_name, 'he');
      if (sort === 'order') return (a.order ?? 1e9) - (b.order ?? 1e9);
      if (sort === 'updated') return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      return (a.next_run?.at ?? '9999').localeCompare(b.next_run?.at ?? '9999');
    });
    const offset = q.offset ?? 0;
    const limit = q.limit ?? 200;
    return { items: clone(rows.slice(offset, offset + limit)).map((s) => ({ ...s, raw: undefined })), total: rows.length, offset, limit, status: st };
  }

  async get(id: string): Promise<Schedule> {
    await delay(60);
    return clone(this.build(this.find(id)));
  }

  async catalog(q: { q?: string; floor?: string; area?: string; class?: ScheduleClass }): Promise<{ entities: CatalogEntity[]; truncated: boolean }> {
    await delay(60);
    if (!this.canManage) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    const text = (q.q ?? '').trim().toLowerCase();
    const entities = DEMO_ENTITIES.filter((e) => this.settings.classes.includes(e.class))
      .filter((e) => !text || e.name.toLowerCase().includes(text) || e.entity_id.includes(text))
      .filter((e) => (!q.floor || e.floor_id === q.floor) && (!q.area || e.area_id === q.area) && (!q.class || e.class === q.class))
      .map((e): CatalogEntity => {
        const sensitive = sensitiveOf(e);
        const blocked: Problem | null = e.reason ?? (sensitive && !this.canSensitive ? { code: 'sensitive_permission_required', message: 'דורש הרשאה לתזמון פעולות רגישות.' } : null);
        const services = Object.entries(ALLOW[e.class])
          .filter(([svc]) => svc.split('.')[0] === e.domain)
          .filter(([svc]) => svc !== 'alarm_control_panel.alarm_disarm' || this.settings.allowDisarm); // disarming only when a system administrator allowed it
        const actions: CatalogAction[] = blocked
          ? []
          : services.map(([service, args]) => ({
              service,
              label: actionLabel({ service }),
              lowering: isLowering(e.class, service, service === 'cover.set_cover_position' ? { position: 50 } : {}, e),
              args: args
                .map((a) => (a.type === 'enum' && a.name === 'hvac_mode' ? { ...a, choices: ((e.attributes?.hvac_modes as string[]) ?? []).filter((m) => m !== 'off') } : a))
                .map((a) => (a.type === 'vars' ? { ...a, label: 'משתני הסקריפט', fields: e.fields ?? [] } : a))
                .filter((a) => a.type !== 'vars' || (a.fields ?? []).length > 0),
            }));
        return {
          entity_id: e.entity_id,
          name: e.name,
          domain: e.domain,
          class: e.class,
          sensitive,
          area_id: e.area_id,
          area_name: e.area_name,
          floor_id: e.floor_id,
          floor_name: e.floor_name,
          available: e.available ?? true,
          selectable: !blocked && e.selectable !== false,
          reason: blocked,
          attributes: { ...(e.attributes ?? {}) },
          actions,
        };
      });
    return { entities, truncated: false };
  }

  async conditionCandidates(q: { q?: string; domain?: ConditionCandidate['domain'] }): Promise<{ entities: ConditionCandidate[]; truncated: boolean }> {
    await delay(60);
    const text = (q.q ?? '').trim().toLowerCase();
    const list = DEMO_CONDITION_ENTITIES.filter((c) => this.readable(c.entity_id))
      .filter((c) => (!q.domain || c.domain === q.domain) && (!text || c.name.toLowerCase().includes(text) || c.entity_id.includes(text)))
      .sort((a, b) => Number(b.suggested_shabbat) - Number(a.suggested_shabbat));
    return { entities: clone(list), truncated: false };
  }

  /** The demo's version of the server's draft validation (a subset of §5). */
  private validate(draft: ScheduleDraft, creating: boolean): { errors: Problem[]; warnings: Problem[]; sensitive: boolean; lowering: boolean } {
    const errors: Problem[] = [];
    const warnings: Problem[] = [];
    let sensitive = false;
    let lowering = false;
    if (creating && !(draft.name ?? '').trim()) errors.push({ path: 'name', code: 'required', message: 'נדרש שם לתזמון.' });
    if ((draft.name ?? '').length > 80) errors.push({ path: 'name', code: 'too_long', message: 'השם ארוך מדי (עד 80 תווים).' });
    if (!draft.slots.length) errors.push({ path: 'slots', code: 'required', message: 'נדרשת לפחות משבצת אחת.' });
    if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) errors.push({ path: 'end_date', code: 'order', message: 'תאריך הסיום לפני תאריך ההתחלה.' });
    if (draft.repeat === 'single') warnings.push({ path: 'repeat', code: 'single_deletes', message: 'התזמון יימחק אחרי ההרצה האחרונה.' });
    draft = canonicalDraft(draft);
    draft.slots.forEach((sl, i) => {
      if (!parseTime(sl.start)) errors.push({ path: `slots[${i}].start`, code: 'time', message: 'שעת התחלה לא תקינה.' });
      if (sl.stop && !parseTime(sl.stop)) errors.push({ path: `slots[${i}].stop`, code: 'time', message: 'שעת סיום לא תקינה.' });
      if (!sl.actions.length) errors.push({ path: `slots[${i}].actions`, code: 'required', message: 'לכל משבצת נדרשת פעולה.' });
      const span = draftSlotSpan(sl, DEMO_SUN);
      if (span && sl.stop && span.end <= span.start) errors.push({ path: `slots[${i}].stop`, code: 'order', message: 'שעת הסיום לפני שעת ההתחלה.' });
      sl.actions.forEach((a, j) => {
        const e = a.entity_id ? ENTITY.get(a.entity_id) : undefined;
        if (!e) {
          errors.push({ path: `slots[${i}].actions[${j}]`, code: 'action_not_allowed', message: 'הפעולה אינה מותרת בתזמון.' });
          return;
        }
        if (!(a.service in ALLOW[e.class])) errors.push({ path: `slots[${i}].actions[${j}].service`, code: 'action_not_allowed', message: 'הפעולה אינה מותרת בתזמון.' });
        if (e.selectable === false) errors.push({ path: `slots[${i}].actions[${j}].entity_id`, code: e.reason?.code ?? 'action_not_allowed', message: e.reason?.message ?? 'לא ניתן לתזמן.' });
        if ('code' in a.data) errors.push({ path: `slots[${i}].actions[${j}].data.code`, code: 'code_not_allowed', message: 'אסור לשמור קוד בתוך תזמון.' });
        if (a.service === 'alarm_control_panel.alarm_disarm' && !this.settings.allowDisarm) {
          errors.push({ path: `slots[${i}].actions[${j}].service`, code: 'disarm_not_allowed', message: 'נטרול אזעקה אינו ניתן לתזמון. רק מנהל מערכת יכול לאפשר זאת בהגדרות › תזמונים, עם אישור מוקלד.' });
        }
        if (a.service === 'script.turn_on') {
          const vars = (a.data.variables ?? {}) as Record<string, unknown>;
          for (const f of e.fields ?? []) {
            if (f.required && vars[f.name] === undefined) errors.push({ path: `slots[${i}].actions[${j}].data.variables`, code: 'required', message: `חסר משתנה חובה של הסקריפט: ${f.label ?? f.name}` });
          }
          for (const k of Object.keys(vars)) {
            if (!(e.fields ?? []).some((f) => f.name === k)) errors.push({ path: `slots[${i}].actions[${j}].data.variables`, code: 'argument_not_allowed', message: `לסקריפט אין משתנה בשם ${k}.` });
          }
        }
        const t = a.data.temperature;
        if (typeof t === 'number' && (t < 16 || t > 30)) errors.push({ path: `slots[${i}].actions[${j}].data.temperature`, code: 'out_of_range', message: 'טמפרטורה מחוץ לטווח 16–30.' });
        if (sensitiveOf(e)) sensitive = true;
        if (isLowering(e.class, a.service, a.data, e)) lowering = true;
      });
    });
    for (const [a, b] of findOverlaps(draft.slots, DEMO_SUN)) errors.push({ path: `slots[${b}]`, code: 'slots_overlap', message: `משבצת ${b + 1} חופפת למשבצת ${a + 1}.` });
    draft.conditions.items.forEach((c, i) => {
      const ce = COND_ENTITY.get(c.entity_id);
      if (!ce) errors.push({ path: `conditions.items[${i}]`, code: 'entity_unknown', message: 'החיישן אינו מוכר.' });
      else if (ce.state === 'unavailable') warnings.push({ path: `conditions.items[${i}]`, code: sensitive ? 'sensitive_condition_unavailable' : 'condition_entity_unavailable', message: sensitive ? 'תזמון של פעולה רגישה תלוי בחיישן שאינו זמין כעת.' : 'החיישן אינו זמין כעת.' });
    });
    if (sensitive && !this.canSensitive) errors.push({ path: 'slots', code: 'sensitive_permission_required', message: 'תזמון של אזעקה, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות.' });
    return { errors, warnings, sensitive, lowering };
  }

  async preview(draft: ScheduleDraft, _scheduleId: string | null, count: number): Promise<PreviewResult> {
    await delay(80);
    const v = this.validate(draft, _scheduleId === null);
    const upcoming = approximateUpcoming(draft, new Date(), DEMO_SUN)
      .slice(0, count)
      .map((u) => ({ ...u, summary: this.slotSummary(draft.slots[u.slot_index]) }));
    return {
      valid: v.errors.length === 0,
      errors: v.errors,
      warnings: v.warnings,
      upcoming,
      conditional: draft.conditions.items.length > 0,
      sensitive: v.sensitive,
      lowering: v.lowering,
      requires: { sensitive_permission: v.sensitive, confirm_lowering: v.lowering, alarm_code: false },
    };
  }

  private accept(draft: ScheduleDraft, creating: boolean, confirmLowering: boolean): void {
    const v = this.validate(draft, creating);
    if (v.errors.length) {
      const first = v.errors[0];
      if (first.code === 'sensitive_permission_required') fail(403, first.code, first.message);
      if (first.code === 'slots_overlap') fail(422, 'slots_overlap', 'משבצות חופפות באותו תזמון.', { errors: v.errors });
      if (first.code === 'disarm_not_allowed') fail(422, 'disarm_not_allowed', first.message, { errors: v.errors });
      fail(422, 'validation', `ערך לא תקין — ${first.path}: ${first.message}`, { errors: v.errors });
    }
    if (v.lowering && !confirmLowering) fail(409, 'lowering_confirmation_required', 'תזמון שמנטרל אזעקה, פותח נעילה, דלת או שער דורש אישור מפורש.');
  }

  async create(draft: ScheduleDraft, enabled: boolean, confirmLowering: boolean): Promise<CreateResult> {
    await delay(200);
    this.requireWrite(null);
    this.accept(draft, true, confirmLowering);
    const id = newId();
    const now = new Date().toISOString();
    const seed: Seed = {
      id,
      entity_id: `switch.schedule_${id}`,
      name: (draft.name ?? '').trim(),
      enabled,
      weekdays: [...draft.weekdays],
      start_date: draft.start_date,
      end_date: draft.end_date,
      repeat: draft.repeat,
      tags: [...draft.tags],
      conditions: clone(draft.conditions),
      slots: clone(canonicalDraft(draft).slots),
      source: 'arx',
      owner: JONI,
      created_at: now,
      updated_at: now,
      folder_id: null,
      order: this.items.length + 1,
      pinned: false,
    };
    this.items.push(seed);
    return { schedule: clone(this.build(seed)), op_id: `op_${id}` };
  }

  async update(id: string, draft: ScheduleDraft, baseRevision: string, confirmLowering: boolean): Promise<{ schedule: Schedule; op_id: string }> {
    await delay(200);
    const s = this.find(id);
    this.requireWrite(s);
    const current = this.build(s);
    if (!current.can.edit) fail(422, 'unsupported_content', 'התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.');
    if (current.revision !== baseRevision) fail(409, 'schedule_changed', 'התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.', { current: clone(current), base_revision: baseRevision, current_revision: current.revision });
    const locked = current.conditions.items.filter((c) => c.locked);
    for (const c of locked) {
      const kept = draft.conditions.items.some((d) => d.entity_id === c.entity_id && d.attribute === c.attribute && d.match_type === c.match_type && d.value === c.value);
      if (!kept) fail(403, 'condition_locked', `התנאי "${c.name}" מחוץ להרשאתך ואי אפשר לשנות או להסיר אותו.`, { entity_id: c.entity_id });
    }
    this.accept(draft, false, confirmLowering);
    Object.assign(s, {
      name: draft.name,
      weekdays: [...draft.weekdays],
      start_date: draft.start_date,
      end_date: draft.end_date,
      repeat: draft.repeat,
      tags: [...draft.tags],
      conditions: clone(draft.conditions),
      slots: clone(canonicalDraft(draft).slots),
      updated_at: new Date().toISOString(),
      owner: JONI,
    });
    return { schedule: clone(this.build(s)), op_id: `op_${newId()}` };
  }

  async setEnabled(id: string, enabled: boolean, confirmLowering: boolean): Promise<{ schedule: Schedule; changed: boolean }> {
    await delay(150);
    const s = this.find(id);
    this.requireWrite(s);
    const b = this.build(s);
    if (!b.can.toggle) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    if (enabled && b.lowering && !confirmLowering) fail(409, 'lowering_confirmation_required', 'תזמון שמנטרל אזעקה, פותח נעילה, דלת או שער דורש אישור מפורש.');
    const changed = s.enabled !== enabled;
    s.enabled = enabled;
    s.state = undefined;
    return { schedule: clone(this.build(s)), changed };
  }

  async run(id: string, slotIndex: number | null, confirm: boolean): Promise<{ run_id: string; note: string }> {
    await delay(150);
    const s = this.find(id);
    this.requireWrite(s);
    const b = this.build(s);
    const bad = b.slots.flatMap((x) => x.actions).find((a) => a.invalid);
    if (bad) fail(409, 'action_invalid', bad.invalid!.message);
    if (!b.can.run) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    if (slotIndex === null && s.slots.length > 1) fail(422, 'slot_required', 'בחרו איזו משבצת להריץ.');
    const index = slotIndex ?? 0;
    const physical = b.slots[index]?.actions.some((a) => a.sensitive || a.service.startsWith('cover.')) ?? false;
    if (physical && !confirm) fail(409, 'confirmation_required', 'פעולה זו דורשת אישור מפורש.');
    const runId = `r_${newId()}`;
    const now = new Date().toISOString();
    this.runItems.push({ id: runId, schedule_id: s.id, schedule_name: s.name ?? '', slot_index: index, started_at: now, settled_at: now, result: 'confirmed', via: 'run_now', sensitive: b.sensitive, detail: { entities: [] } });
    return { run_id: runId, note: 'הבקשה נשלחה; התוצאה תופיע בהרצות.' };
  }

  async split(id: string, baseRevision: string, days: DayId[], name: string | null): Promise<{ original: Schedule; created: Schedule }> {
    await delay(250);
    const s = this.find(id);
    this.requireWrite(s);
    const current = this.build(s);
    if (current.revision !== baseRevision) fail(409, 'schedule_changed', 'התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.', { current: clone(current) });
    const all = resolveDays(s.weekdays);
    if (!all) fail(422, 'split_not_possible', 'לא ניתן לפצל תזמון לפי ימי עבודה או סוף שבוע; בחרו ימים מפורשים תחילה.');
    const moving = DAY_ORDER.filter((d) => days.includes(d) && all.includes(d));
    const staying = all.filter((d) => !moving.includes(d));
    if (!moving.length || !staying.length) fail(422, 'validation', 'ערך לא תקין — days: בחרו חלק מהימים בלבד.');
    const nid = newId();
    const label = moving.map((d) => ({ sun: 'א׳', mon: 'ב׳', tue: 'ג׳', wed: 'ד׳', thu: 'ה׳', fri: 'ו׳', sat: 'ש׳' })[d]).join(', ');
    const created: Seed = { ...clone(s), id: nid, entity_id: `switch.schedule_${nid}`, name: name ?? `${s.name ?? 'תזמון'} · ${label}`, weekdays: moving, source: 'arx', owner: JONI, created_at: new Date().toISOString(), order: this.items.length + 1 };
    s.weekdays = staying.length === 7 ? ['daily'] : staying;
    s.updated_at = new Date().toISOString();
    this.items.push(created);
    return { original: clone(this.build(s)), created: clone(this.build(created)) };
  }

  async remove(id: string, baseRevision: string): Promise<{ trash_id: string; expires_at: string }> {
    await delay(150);
    const s = this.find(id);
    this.requireWrite(s);
    const b = this.build(s);
    if (!b.can.delete) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    if (b.revision !== baseRevision) fail(409, 'schedule_changed', 'התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.', { current: clone(b) });
    const trash_id = `t_${newId()}`;
    const expires_at = new Date(Date.now() + 30 * 86_400_000).toISOString();
    this.trashItems.unshift({ trash_id, seed: clone(s), deleted_at: new Date().toISOString(), expires_at, deleted_by: JONI });
    this.items = this.items.filter((x) => x.id !== id);
    return { trash_id, expires_at };
  }

  async copy(id: string, name: string): Promise<{ schedule: Schedule }> {
    await delay(150);
    const s = this.find(id);
    this.requireWrite(s);
    if (!this.build(s).can.copy) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    const nid = newId();
    const now = new Date().toISOString();
    const c: Seed = { ...clone(s), id: nid, entity_id: `switch.schedule_${nid}`, name, source: 'arx', owner: JONI, created_at: now, updated_at: now, order: this.items.length + 1 };
    this.items.push(c);
    return { schedule: clone(this.build(c)) };
  }

  async trash(): Promise<{ items: TrashItem[] }> {
    await delay();
    if (!this.canView) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    return {
      items: this.trashItems.map((t) => {
        const b = this.build(t.seed);
        return { trash_id: t.trash_id, schedule_id: t.seed.id, name: t.seed.name, deleted_at: t.deleted_at, expires_at: t.expires_at, deleted_by: t.deleted_by, entities: b.entities, sensitive: b.sensitive, can_restore: this.canManage && (!b.sensitive || this.canSensitive) && this.writable };
      }),
    };
  }

  async restore(trashId: string): Promise<{ schedule: Schedule }> {
    await delay(200);
    const t = this.trashItems.find((x) => x.trash_id === trashId);
    if (!t) fail(404, 'trash_not_found', 'הפריט אינו בסל המחזור (ייתכן שפג תוקפו).');
    this.requireWrite(t.seed);
    const nid = newId();
    const seed: Seed = { ...clone(t.seed), id: nid, entity_id: `switch.schedule_${nid}`, updated_at: new Date().toISOString() };
    this.items.push(seed);
    this.trashItems = this.trashItems.filter((x) => x !== t);
    return { schedule: clone(this.build(seed)) };
  }

  async purge(trashId: string): Promise<{ ok: true }> {
    await delay(100);
    if (this.persona !== 'admin') fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    this.trashItems = this.trashItems.filter((x) => x.trash_id !== trashId);
    return { ok: true };
  }

  async bulk(op: 'enable' | 'disable', ids: string[]): Promise<BulkResult> {
    await delay(200);
    const results: BulkResult['results'] = [];
    for (const id of ids) {
      try {
        const r = await this.setEnabled(id, op === 'enable', false);
        results.push({ id, ok: true, changed: r.changed });
      } catch (err) {
        results.push({ id, ok: false, code: err instanceof ApiError ? err.code : 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
    return { results };
  }

  async organisation(): Promise<Organisation> {
    await delay(60);
    return { folders: clone(this.folders), items: this.items.map((s) => ({ schedule_id: s.id, folder_id: s.folder_id, order: s.order, pinned: s.pinned })) };
  }

  async setOrganisation(body: Organisation): Promise<Organisation> {
    await delay(100);
    if (!this.canManage) fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    this.folders = clone(body.folders);
    for (const it of body.items) {
      const s = this.items.find((x) => x.id === it.schedule_id);
      if (s) Object.assign(s, { folder_id: it.folder_id, order: it.order, pinned: it.pinned });
    }
    return this.organisation();
  }

  async runs(q: { schedule_id?: string; since?: string; result?: RunResult; limit?: number }): Promise<{ items: RunItem[] }> {
    await delay(60);
    let rows = [...this.runItems];
    if (q.schedule_id) rows = rows.filter((r) => r.schedule_id === q.schedule_id);
    if (q.since) rows = rows.filter((r) => r.started_at >= (q.since as string));
    if (q.result) rows = rows.filter((r) => r.result === q.result);
    rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
    return { items: clone(rows.slice(0, q.limit ?? 50)) };
  }

  /** The administrator's acknowledgements: schedule id -> issue -> the content revision it holds for. */
  private acks = new Map<string, Map<AckableIssue, { revision: string; at: string; by: PersonRef }>>();

  private reviewRows(): ReviewItem[] {
    const out: ReviewItem[] = [];
    for (const s of this.items) {
      const b = this.build(s);
      const issues: ReviewItem['issues'] = [];
      if (b.slots.some((x) => !x.supported)) issues.push('unsupported_content');
      if (b.slots.some((x) => x.actions.some((a) => a.invalid))) issues.push('action_invalid');
      if (b.sensitive && !b.owner) issues.push('no_owner_sensitive');
      if (s.id === 'd8e3a7') issues.push('owner_lost_rights'); // demo: the gate schedule's owner lost the door grant
      if (!issues.length) continue;
      const held = this.acks.get(s.id);
      const acknowledged: Acknowledgement[] = [];
      for (const [issue, rec] of held ?? []) if (rec.revision === b.revision && issues.includes(issue)) acknowledged.push({ issue, by: rec.by, at: rec.at });
      out.push({ schedule: clone(b), issues: issues.filter((i) => !acknowledged.some((a) => a.issue === i)), acknowledged });
    }
    return out;
  }

  async review(): Promise<{ items: ReviewItem[] }> {
    await delay();
    if (this.persona !== 'admin') fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    return { items: this.reviewRows() };
  }

  async acknowledge(id: string, issue: AckableIssue, undo: boolean): Promise<{ schedule_id: string; issue: AckableIssue; acknowledged: boolean; acknowledgement: Acknowledgement | null }> {
    await delay(80);
    if (this.persona !== 'admin') fail(403, 'forbidden', 'רק מנהל מערכת יכול לאשר אזהרה של תזמון.');
    const s = this.find(id);
    const held = this.acks.get(id) ?? new Map();
    if (undo) {
      if (!held.has(issue)) fail(409, 'not_acknowledged', 'האזהרה אינה מאושרת.');
      held.delete(issue);
      this.acks.set(id, held);
      return { schedule_id: id, issue, acknowledged: false, acknowledgement: null };
    }
    const row = this.reviewRows().find((r) => r.schedule.id === id);
    if (!row || !row.issues.includes(issue)) fail(409, 'issue_not_present', 'לתזמון אין כרגע אזהרה כזו.');
    const rec = { revision: this.build(s).revision, at: new Date().toISOString(), by: JONI };
    held.set(issue, rec);
    this.acks.set(id, held);
    return { schedule_id: id, issue, acknowledged: true, acknowledgement: { issue, by: rec.by, at: rec.at } };
  }

  async tags(): Promise<{ tags: { name: string; count: number }[] }> {
    await delay(40);
    const counts = new Map<string, number>();
    for (const s of this.items) for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return { tags: [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) };
  }

  async saveSettings(to: ScheduleSettings, disarmConfirm = ''): Promise<ScheduleSettings> {
    await delay(100);
    if (this.persona !== 'admin') fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    if (to.allowDisarm && !this.settings.allowDisarm && disarmConfirm.trim() !== ALLOW_DISARM_WORD) {
      fail(422, 'confirm_required', `כדי לאפשר נטרול אזעקה בתזמונים יש להקליד "${ALLOW_DISARM_WORD}".`, { field: 'schedules.allow_disarm_confirm' });
    }
    this.settings = clone(to);
    return clone(this.settings);
  }
}

let STORE: ScheduleDemoStore | null = null;

/** The demo store (created on first use, so the module cycle with ./schedules is harmless). */
export function demoStore(): ScheduleDemoStore {
  STORE ??= new ScheduleDemoStore();
  return STORE;
}

/** Re-read `sw.demo.schedules` and restore the seed data (specs call it after changing the control key). */
export function resetDemoStore(): ScheduleDemoStore {
  STORE = new ScheduleDemoStore();
  return STORE;
}

/** The raw component items of the demo seed (the verified shape, §9.3) - for specs that exercise the normaliser's input. */
export function demoComponentItems(): Record<string, unknown>[] {
  return seeds().map((s) => ({ ...(contentOf(s) as Record<string, unknown>), entity_id: s.entity_id, enabled: s.enabled, timestamps: [], next_entries: [] }));
}
