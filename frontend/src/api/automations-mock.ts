/**
 * CR-017: the MOCK adapter of the automations API (docs/architecture/AUTOMATIONS_API.md; the client is ./automations.ts).
 * The fixture set in miniature, shaped like the 2026-10-01 probe of the owner's systems (all names and ids invented):
 *  - 12 automations: state / time / sun / numeric_state / HA-start triggers, `choose` and `if/then`, trigger ids, a template item, a device-trigger item
 *    (wall-switch buttons = locked blocks), a custom `scheduler.*` service, a `continue_on_error` step, one that references a missing entity, one in the
 *    pre-2024.10 key schema that was changed outside Arx, one alarm item (sensitive), and one view-only because it lives in a configuration file (404);
 *  - 3 scripts (one with fields, one sensitive) and scenes: five integration-provided (activate-only) and one captured (HA-native, editable);
 *  - full traces for two automations, versions for one, two items in the trash;
 *  - three users: an installer (HA admin, everything), a household editor scoped to floor 1 (not an HA admin: saving depends on the delegation knob),
 *    and a runner (runs scripts and activates scenes, floor 1; sees no automation - owner decision 1b, no view-only access).
 * Knobs: `store.setUser(..)`, `store.delegation` (the bridge's switch, default ON like the approved mockup), `store.conflictNext` (the next write finds the
 * item changed elsewhere), `store.failNext(code)`, `store.available`, `store.schedulerPresent`, `store.conditionsPass`, `store.clock`, `store.externalEdit(..)`.
 * The write path follows §3.2 of the contract in order (validate -> grants -> confirm -> revision -> delegation -> write -> version -> audit) and answers with
 * the contract's error codes. Everything applies at once and is kept for the session; no network, no timers. Names and values are invented.
 *
 * Load order: this file imports ./automations (values); ./automations reaches this file only through a dynamic `import()` (no cycle).
 */
import { ApiError } from './client';
import {
  AUTOMATION_ERROR_LABEL, AUTOMATION_SETTINGS_DEFAULT, ACTION_VERBS, CAPS, DEFAULT_ALLOWED_ACTIONS, GRANT_OF_CLASS, SCENE_CAPTURE_DOMAINS, automationSettingsOf,
  blockSentences, canonicalJson, captureMembers, changedLockedBlocks, classifyAction, configToDraft, draftSentence, draftTargets, draftToConfig, emitBlock, entityInScope, extraKeys, filterItems,
  fingerprintOf, hasUnknownEffects, isInstallationWide, itemVisibleTo, lockedBlocks, manageRight, maskSecrets, memberSummary, parseAction, revisionOf, saveProfile, sensitiveClassOf, sensitiveSteps,
  shortRunSentence, suggestSchedule, triggerEntities, validateDraft, walkDraft,
  type ActionBlock, type ActionSpec, type AnyDraft, type AutomationCatalog, type AutomationDraft, type AutomationSettings, type AutomationTemplate, type AutomationsAdapter, type AutomationsStatus,
  type CatalogEntity, type DryRunResult, type Item, type ItemDetail, type ItemKind, type Issue, type ListQuery, type LockedBlock, type MetaPatch, type ModelContext, type PreviewResult,
  type ReviewRow, type RunResult, type RunSummary, type RunTrace, type SceneDraft, type SceneMember, type ScriptDraft, type SensitiveClass, type TrashRow, type UserScope, type VersionRow, type WriteBody,
  type WriteResult,
} from './automations';

type Raw = Record<string, unknown>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ------------------------------------------------------------------------------------------------ the house

export const FLOORS = [{ id: 'g', name: 'קומת קרקע' }, { id: 'f1', name: 'קומה 1' }, { id: 'b', name: 'מרתף' }] as const;
export const AREAS = [
  { id: 'entry', name: 'כניסה', floor: 'g' }, { id: 'salon', name: 'סלון', floor: 'g' }, { id: 'kitchen', name: 'מטבח', floor: 'g' },
  { id: 'hall', name: 'פרוזדור', floor: 'f1' }, { id: 'bed', name: 'חדר שינה', floor: 'f1' }, { id: 'kids', name: 'חדר ילדים', floor: 'f1' }, { id: 'office', name: 'חדר עבודה', floor: 'f1' },
  { id: 'garage', name: 'חניה', floor: 'b' }, { id: 'laundry', name: 'חדר כביסה', floor: 'b' },
] as const;
/** The CR-014 Shabbat sensor of the fixture house. */
export const SHABBAT_SENSOR = 'binary_sensor.shabbat_or_holiday';

interface EntDef { name: string; /** an area id, or a floor id (placed on a floor only), or null (unplaced) */ area: string | null; cls?: SensitiveClass; st?: string; missing?: boolean }
const ENT: Record<string, EntDef> = {
  'light.entry': { name: 'תאורת כניסה', area: 'entry', st: 'כבוי' }, 'light.hall': { name: 'תאורת פרוזדור', area: 'hall', st: 'כבוי' }, 'light.salon': { name: 'תאורת סלון', area: 'salon', st: 'דלוק 60%' },
  'light.salon_spots': { name: 'ספוטים סלון', area: 'salon', st: 'כבוי' }, 'light.kitchen': { name: 'תאורת מטבח', area: 'kitchen', st: 'דלוק' }, 'light.bed': { name: 'תאורת חדר שינה', area: 'bed', st: 'כבוי' },
  'light.kids': { name: 'תאורת חדר ילדים', area: 'kids', st: 'דלוק 30%' }, 'light.garden': { name: 'תאורת גינה', area: 'entry', st: 'כבוי' },
  'switch.boiler': { name: 'דוד שמש', area: 'laundry', st: 'כבוי', missing: true }, 'switch.irrigation': { name: 'השקיה', area: 'entry', st: 'כבוי' }, 'switch.kids_fan': { name: 'מאוורר חדר ילדים', area: 'kids', st: 'כבוי' },
  'climate.bed': { name: 'מזגן חדר שינה', area: 'bed', st: 'כבוי' }, 'climate.salon': { name: 'מזגן סלון', area: 'salon', st: 'קירור 23°' },
  'binary_sensor.hall_motion': { name: 'חיישן תנועה פרוזדור', area: 'hall', st: 'אין תנועה' }, 'binary_sensor.front_door': { name: 'דלת הכניסה', area: 'entry', st: 'סגורה' },
  'binary_sensor.leak': { name: 'חיישן הצפה', area: 'laundry', st: 'יבש' }, 'binary_sensor.kids_window': { name: 'חלון חדר ילדים', area: 'kids', st: 'סגור' },
  [SHABBAT_SENSOR]: { name: 'שבת וחג', area: null, st: 'כבוי' },
  'sensor.bed_temp': { name: 'טמפרטורה חדר שינה', area: 'bed', st: '25.4°' }, 'sensor.lux': { name: 'עוצמת אור', area: null, st: '320' },
  'person.yoni': { name: 'יוני', area: null, st: 'בבית' }, 'person.dana': { name: 'דנה', area: null, st: 'לא בבית' }, 'zone.home': { name: 'הבית', area: null, st: '1' },
  'alarm_control_panel.home': { name: 'אזעקה', area: 'entry', cls: 'alarm', st: 'מנוטרלת' }, 'lock.front': { name: 'מנעול דלת כניסה', area: 'entry', cls: 'lock', st: 'נעול' },
  'cover.gate': { name: 'שער חניה', area: 'garage', cls: 'gate', st: 'סגור' }, 'cover.salon_shutter': { name: 'תריס סלון', area: 'salon', st: 'פתוח 100%' },
  'siren.outdoor': { name: 'צופר חיצוני', area: 'entry', cls: 'siren', st: 'כבוי' }, 'media_player.salon_tv': { name: 'טלוויזיה סלון', area: 'salon', st: 'כבויה' },
  'scene.salon_evening': { name: 'סלון · ערב', area: 'salon' }, 'scene.salon_movie': { name: 'סלון · סרט', area: 'salon' }, 'scene.salon_off': { name: 'סלון · הכל כבוי', area: 'salon' },
  'scene.kitchen_cook': { name: 'מטבח · בישול', area: 'kitchen' }, 'scene.bed_night': { name: 'חדר שינה · לילה', area: 'bed' }, 'scene.arx_welcome': { name: 'ברוכים הבאים', area: 'entry' },
  'script.good_morning': { name: 'בוקר טוב', area: 'bed' }, 'script.vacation': { name: 'מצב חופשה', area: 'entry' }, 'script.shutters': { name: 'תריסים לפי אחוז', area: 'salon' },
};
/** Notify services the administrator approved (CR §4.7). */
export const NOTIFY: Record<string, string> = { 'notify.mobile_app_yoni': 'הטלפון של יוני', 'notify.mobile_app_dana': 'הטלפון של דנה', 'notify.notify': 'כל המכשירים' };
/** HA-shaped states for the scene capture. */
const STATES: Record<string, { state: string; attributes?: Raw }> = {
  'light.entry': { state: 'on', attributes: { brightness: 204, color_mode: 'color_temp', color_temp_kelvin: 3000 } }, 'light.salon': { state: 'on', attributes: { brightness: 128, color_mode: 'color_temp', color_temp_kelvin: 2700 } },
  'light.hall': { state: 'off' }, 'light.kitchen': { state: 'on', attributes: { brightness: 255, color_mode: 'brightness' } }, 'light.bed': { state: 'off' }, 'light.kids': { state: 'on', attributes: { brightness: 77, color_mode: 'brightness' } },
  'cover.salon_shutter': { state: 'open', attributes: { current_position: 100 } }, 'climate.salon': { state: 'cool', attributes: { temperature: 23, fan_mode: 'auto', hvac_modes: ['off', 'cool'] } },
  'climate.bed': { state: 'off', attributes: { temperature: 24 } }, 'media_player.salon_tv': { state: 'off', attributes: { volume_level: 0.3 } }, 'lock.front': { state: 'locked' }, 'switch.irrigation': { state: 'off' },
  'switch.kids_fan': { state: 'off' }, 'alarm_control_panel.home': { state: 'disarmed' },
};
const catalogDomain = (id: string) => id.split('.')[0];
const entFloor = (a: string | null): { id: string; name: string } | null => {
  if (!a) return null;
  const area = AREAS.find((x) => x.id === a);
  const f = FLOORS.find((x) => x.id === (area ? area.floor : a));
  return f ? { id: f.id, name: f.name } : null;
};
const entArea = (a: string | null): { id: string; name: string } | null => {
  const area = AREAS.find((x) => x.id === a);
  return area ? { id: area.id, name: area.name } : null;
};
const placeOf = (id: string): { floor: { id: string; name: string } | null; area: { id: string; name: string } | null } | null => {
  const e = ENT[id];
  return e && e.area ? { floor: entFloor(e.area), area: entArea(e.area) } : null;
};
const nameOf = (id: string): string => ENT[id]?.name ?? id;
const modelCtx = (): ModelContext => ({ names: nameOf, notifyName: (a) => NOTIFY[a] ?? null, shabbatSensor: SHABBAT_SENSOR });

// ------------------------------------------------------------------------------------------------ users

export type MockUserId = 'installer' | 'household' | 'runner';
export interface MockUser {
  id: MockUserId; name: string; ha_admin: boolean; can: AutomationsStatus['can']; scope: UserScope;
  /** The manual-control grants held (`door.unlock`, `alarm.disarm`, `ha.entity.control`). */
  grants: Set<string>;
}
function users(): Record<MockUserId, MockUser> {
  const all = { view: true, manage: true, scene_manage: true, script_run: true, script_manage: true, code_view: true, configure: true, scene_run: true };
  return {
    installer: { id: 'installer', name: 'יוני', ha_admin: true, can: all, scope: { floors: null, areas: null }, grants: new Set(['alarm.disarm', 'door.unlock', 'ha.entity.control']) },
    household: { id: 'household', name: 'דנה', ha_admin: false, can: { ...all, code_view: false, configure: false }, scope: { floors: ['f1'], areas: null }, grants: new Set(['door.unlock']) },
    runner: { id: 'runner', name: 'נועם', ha_admin: false, can: { view: true, manage: false, scene_manage: false, script_run: true, script_manage: false, code_view: false, configure: false, scene_run: true }, scope: { floors: ['f1'], areas: null }, grants: new Set() },
  };
}

// ------------------------------------------------------------------------------------------------ fixtures (stored configs, as HA stores them)

const dur = (h: number, m: number, s: number) => ({ hours: h, minutes: m, seconds: s });
/** The stored config of every fixture automation / script / native scene (new schema unless stated), keyed by config id. */
function fixtureConfigs(): Record<string, { kind: ItemKind; entity: string; config: Raw }> {
  const A = (id: string, entity: string, config: Raw) => [id, { kind: 'automation' as const, entity, config: { id, ...config } }] as const;
  return Object.fromEntries([
    A('1727700000001', 'automation.entry_sunset', { alias: 'תאורת כניסה בשקיעה', description: '',
      triggers: [{ trigger: 'sun', event: 'sunset', offset: '-00:20:00' }, { trigger: 'homeassistant', event: 'start' }], conditions: [],
      actions: [{ action: 'light.turn_on', target: { entity_id: ['light.entry', 'light.garden'] }, data: { brightness_pct: 70 } }], mode: 'single' }),
    A('1727700000002', 'automation.hall_motion', { alias: 'תנועה בפרוזדור', description: 'תאורת לילה בפרוזדור',
      triggers: [{ trigger: 'state', entity_id: ['binary_sensor.hall_motion'], to: 'on', id: 'motion' }], conditions: [{ condition: 'sun', after: 'sunset' }],
      actions: [{ action: 'light.turn_on', target: { entity_id: ['light.hall'] }, data: { brightness_pct: 40 } }, { delay: dur(0, 3, 0) }, { action: 'light.turn_off', target: { entity_id: ['light.hall'] } }],
      mode: 'restart', trace: { stored_traces: 10 } }),
    A('1727700000003', 'automation.all_left', { alias: 'כולם יצאו', description: 'כיבוי וחימוש כשהבית מתרוקן',
      triggers: [{ trigger: 'numeric_state', entity_id: ['zone.home'], below: 1 }], conditions: [],
      actions: [{ action: 'light.turn_off', target: { entity_id: ['light.salon', 'light.kitchen', 'light.kids'] } }, { action: 'climate.turn_off', target: { entity_id: ['climate.salon', 'climate.bed'] } },
        { action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: ['alarm_control_panel.home'] } }], mode: 'single' }),
    A('1727700000004', 'automation.door_open', { alias: 'דלת פתוחה יותר מ־5 דקות', description: '',
      triggers: [{ trigger: 'state', entity_id: ['binary_sensor.front_door'], to: 'on', for: dur(0, 5, 0) }], conditions: [],
      actions: [{ action: 'notify.mobile_app_yoni', data: { message: 'דלת הכניסה פתוחה כבר 5 דקות' } }], mode: 'single' }),
    A('1727700000005', 'automation.bed_ac_clock', { alias: 'מזגן חדר שינה לפי שעה', description: 'הפעלה בלילה וכיבוי בבוקר',
      triggers: [{ trigger: 'time', at: '22:00:00', id: 'night' }, { trigger: 'time', at: '06:30:00', id: 'morning' }], conditions: [],
      actions: [{ choose: [{ conditions: [{ condition: 'trigger', id: ['night'] }], sequence: [{ action: 'climate.set_temperature', target: { entity_id: ['climate.bed'] }, data: { temperature: 24 } }] },
        { conditions: [{ condition: 'trigger', id: ['morning'] }], sequence: [{ action: 'climate.turn_off', target: { entity_id: ['climate.bed'] } }] }] }], mode: 'single' }),
    A('1727700000006', 'automation.salon_buttons', { alias: 'כפתורי מפסק סלון', description: '',
      triggers: [{ trigger: 'device', domain: 'wall_switch', device_id: '2f1c9a07', type: 'button_1_short', id: 'short' }, { trigger: 'device', domain: 'wall_switch', device_id: '2f1c9a07', type: 'button_1_long', id: 'long' }],
      conditions: [], actions: [{ choose: [{ conditions: [{ condition: 'trigger', id: ['short'] }], sequence: [{ action: 'scene.turn_on', target: { entity_id: ['scene.salon_evening'] } }] },
        { conditions: [{ condition: 'trigger', id: ['long'] }], sequence: [{ action: 'scene.turn_on', target: { entity_id: ['scene.salon_off'] } }] }] }], mode: 'parallel' }),
    A('1727700000007', 'automation.light_by_lux', { alias: 'תאורה לפי תבנית', description: 'תבנית בוחרת את החדר לפי החיישן',
      triggers: [{ trigger: 'template', value_template: "{{ states('sensor.lux') | int < 20 }}" }], conditions: [{ condition: 'time', after: '17:00:00', before: '23:30:00' }],
      actions: [{ action: 'light.turn_on', target: { entity_id: '{{ trigger.to_state.attributes.room_light }}' } }], mode: 'queued', max: 10, variables: { room: 'salon' } }),
    A('1727700000008', 'automation.vacation_freeze', { alias: 'הקפאת תזמונים בחופשה', description: '',
      triggers: [{ trigger: 'state', entity_id: ['person.yoni', 'person.dana'], to: 'not_home', for: dur(24, 0, 0) }], conditions: [],
      actions: [{ action: 'scheduler.disable_all' }, { action: 'notify.mobile_app_yoni', data: { message: 'התזמונים הוקפאו' } }], mode: 'single' }),
    A('1727700000009', 'automation.boiler_morning', { alias: 'דוד שמש בבוקר', description: '',
      triggers: [{ trigger: 'time', at: '05:30:00' }], conditions: [{ condition: 'time', weekday: ['sun', 'mon', 'tue', 'wed', 'thu'] }],
      actions: [{ action: 'switch.turn_on', target: { entity_id: ['switch.boiler'] } }, { delay: dur(0, 45, 0) }, { action: 'switch.turn_off', target: { entity_id: ['switch.boiler'] }, continue_on_error: true }], mode: 'single' }),
    // the pre-2024.10 key schema (`trigger` / `platform` / `service`): read in memory, rewritten in the new schema only when someone saves it
    A('1727700000010', 'automation.alarm_morning', { alias: 'נטרול אזעקה בבוקר', description: 'רק כשמישהו בבית',
      trigger: [{ platform: 'time', at: '06:45:00' }], condition: [{ condition: 'state', entity_id: 'person.yoni', state: 'home' }],
      action: [{ service: 'alarm_control_panel.alarm_disarm', target: { entity_id: 'alarm_control_panel.home' } },
        { if: [{ condition: 'numeric_state', entity_id: 'sensor.bed_temp', above: 26 }], then: [{ service: 'cover.open_cover', target: { entity_id: 'cover.salon_shutter' } }], else: [{ service: 'light.turn_on', target: { entity_id: 'light.kitchen' } }] }],
      mode: 'single' }),
    A('1727700000011', 'automation.leak_alert', { alias: 'הצפה בחדר כביסה', description: '',
      triggers: [{ trigger: 'state', entity_id: ['binary_sensor.leak'], to: 'on' }], conditions: [],
      actions: [{ action: 'notify.notify', data: { message: 'זוהתה הצפה בחדר כביסה!' } },
        { repeat: { count: 3, sequence: [{ action: 'siren.turn_on', target: { entity_id: ['siren.outdoor'] } }, { delay: dur(0, 0, 10) }, { action: 'siren.turn_off', target: { entity_id: ['siren.outdoor'] } }] } }], mode: 'single' }),
    ['1727700000100', { kind: 'script' as const, entity: 'script.good_morning', config: { alias: 'בוקר טוב', description: 'תריס, אור ומזגן', icon: 'mdi:weather-sunset-up', mode: 'single',
      sequence: [{ action: 'cover.open_cover', target: { entity_id: ['cover.salon_shutter'] } }, { action: 'light.turn_on', target: { entity_id: ['light.kitchen'] } }, { action: 'climate.set_temperature', target: { entity_id: ['climate.salon'] }, data: { temperature: 23 } }] } }],
    ['1727700000101', { kind: 'script' as const, entity: 'script.vacation', config: { alias: 'מצב חופשה', description: 'חימוש, כיבוי הכל, הודעה', mode: 'single',
      sequence: [{ action: 'light.turn_off', target: { entity_id: ['light.salon', 'light.kitchen', 'light.bed'] } }, { action: 'climate.turn_off', target: { entity_id: ['climate.salon', 'climate.bed'] } },
        { action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: ['alarm_control_panel.home'] } }, { action: 'notify.mobile_app_yoni', data: { message: 'מצב חופשה הופעל' } }] } }],
    ['1727700000102', { kind: 'script' as const, entity: 'script.shutters', config: { alias: 'תריסים לפי אחוז', description: 'עם שדות', mode: 'single',
      fields: { percent: { name: 'אחוז פתיחה', description: 'מ־0 עד 100', required: true, default: 50, selector: { number: { min: 0, max: 100, step: 10, unit_of_measurement: '%', mode: 'slider' } } },
        shutters: { name: 'תריסים', default: ['cover.salon_shutter'], selector: { entity: { domain: 'cover' } } }, slow: { name: 'תנועה איטית', default: false, selector: { boolean: {} } },
        side: { name: 'צד', default: 'שניהם', selector: { select: { options: ['שניהם', 'ימין', 'שמאל'] } } } },
      sequence: [{ action: 'cover.set_cover_position', target: { entity_id: '{{ shutters }}' }, data: { position: '{{ percent }}' } }] } }],
    ['1727700000200', { kind: 'scene' as const, entity: 'scene.arx_welcome', config: { id: '1727700000200', name: 'ברוכים הבאים', icon: 'mdi:home-heart',
      entities: { 'light.entry': { state: 'on', brightness: 204, color_temp_kelvin: 3000 }, 'light.salon': { state: 'on', brightness: 128, color_temp_kelvin: 2700 },
        'cover.salon_shutter': { state: 'open', current_position: 100 }, 'climate.salon': { state: 'cool', temperature: 23 }, 'media_player.salon_tv': { state: 'off' } }, metadata: {} } }],
  ]);
}
/** A configuration-file item (view only: GET by id answers 404, the content comes from the read-only path). */
const YAML_AUTOMATION: Raw = { alias: 'השקיה בשבת', description: '', triggers: [{ trigger: 'time', at: '06:00:00' }],
  conditions: [{ condition: 'state', entity_id: [SHABBAT_SENSOR], state: 'on' }],
  actions: [{ action: 'switch.turn_on', target: { entity_id: ['switch.irrigation'] } }, { delay: dur(0, 20, 0) }, { action: 'switch.turn_off', target: { entity_id: ['switch.irrigation'] } }], mode: 'single' };
const INTEGRATION_SCENES = ['scene.salon_evening', 'scene.salon_movie', 'scene.salon_off', 'scene.kitchen_cook', 'scene.bed_night'];

// ------------------------------------------------------------------------------------------------ store

interface Meta {
  enabled: boolean; running: boolean; invalid: boolean; createdVia: 'arx' | 'external'; owner: string | null; updatedAt: string | null;
  pinned: boolean; favourite: boolean; hidden: boolean; lastRun: Item['last_run']; runs7d: number | null; changedOutside: boolean;
}
interface VersionEntry { version_id: string; revision: string; at: string; via: 'arx' | 'external'; actor: string | null; summary: string; config: Raw }
interface Entry { kind: ItemKind; id: string; entity: string; config: Raw | null; source: Item['source']; meta: Meta; versions: VersionEntry[]; runs: RunTrace[] }
interface TrashEntry { trash_id: string; kind: ItemKind; id: string; name: string; sentence: string; deleted_at: string; expires_at: string; deleted_by: string | null; sensitive: boolean; entities: string[]; config: Raw }
export interface AuditRow { action: string; kind: ItemKind; id: string; user: string; delegated: boolean; at: string }

const DEFAULT_META: Meta = { enabled: true, running: false, invalid: false, createdVia: 'external', owner: null, updatedAt: null, pinned: false, favourite: false, hidden: false, lastRun: null, runs7d: null, changedOutside: false };
const CLOCK0 = '2026-10-01T15:46:00Z';
const ago = (clock: Date, min: number): string => new Date(clock.getTime() - min * 60000).toISOString();

export interface MockOptions { user?: MockUserId; delegation?: boolean; schedulerPresent?: boolean; available?: AutomationsStatus['available']; clock?: Date }

export class AutomationsMockStore implements AutomationsAdapter {
  users = users();
  userId: MockUserId;
  /** The bridge's delegation switch (CR §8.3). Default ON like the approved mockup; the real default is off. */
  delegation: boolean;
  schedulerPresent: boolean;
  available: AutomationsStatus['available'];
  /** The next write (create / replace / code / delete / restore) finds the item changed elsewhere -> 409 `item_changed` with the current item. */
  conflictNext = false;
  /** `run` with `skip_condition: false` and `dryRun` evaluate typed conditions as passing (true) or failing (false). */
  conditionsPass = true;
  private failure: { code: string; status?: number; details?: Raw } | null = null;
  settingsValue: AutomationSettings = clone(AUTOMATION_SETTINGS_DEFAULT);
  /** Fixed by default so specs are deterministic; move it with `store.clock = () => new Date(...)`. */
  clock: () => Date;
  audit: AuditRow[] = [];
  private entries = new Map<string, Entry>();
  private trashRows: TrashEntry[] = [];
  private ops = new Map<string, WriteResult | unknown>();
  private writeTimes: number[] = [];
  private lastRunAt = new Map<string, number>();
  private seq = 0;

  constructor(o: MockOptions = {}) {
    this.userId = o.user ?? 'installer';
    this.delegation = o.delegation ?? true;
    this.schedulerPresent = o.schedulerPresent ?? true;
    this.available = o.available ?? 'ok';
    const t0 = o.clock ?? new Date(CLOCK0);
    this.clock = () => t0;
    this.seed();
  }

  // ---- knobs

  get user(): MockUser { return this.users[this.userId]; }
  setUser(id: MockUserId): void { this.userId = id; }
  /** The next call that WRITES fails with this contract error code (default status from the table of §3.3). */
  failNext(code: string, status?: number, details?: Raw): void { this.failure = { code, status, details }; }
  /** A change made outside Arx (the HA editor): bumps the revision, records an `external` version and flags the item "שונתה מחוץ למערכת". */
  externalEdit(kind: ItemKind, id: string, mutate: (config: Raw) => void): void {
    const e = this.must(kind, id);
    if (!e.config) return;
    const next = clone(e.config);
    mutate(next);
    e.config = next;
    e.meta.changedOutside = true;
    this.pushVersion(e, 'external', null, 'שונתה מחוץ למערכת');
  }
  /** A running script finishes (the mock has no timers). */
  finishScript(id: string): void {
    const e = this.entries.get(`script:${id}`);
    if (e) e.meta.running = false;
  }
  entry(kind: ItemKind, id: string): Entry | undefined { return this.entries.get(`${kind}:${id}`); }
  /** The stored config of an item (what the file holds), for specs. */
  storedConfig(kind: ItemKind, id: string): Raw | null { return clone(this.entries.get(`${kind}:${id}`)?.config ?? null); }
  /** The fixture's config ids by entity id (specs address items by entity). */
  idOf(entityId: string): string {
    for (const e of this.entries.values()) if (e.entity === entityId) return e.id;
    throw new Error(`no fixture item with entity ${entityId}`);
  }
  trashSnapshot(): TrashEntry[] { return clone(this.trashRows); }

  // ---- seeding

  private seed(): void {
    const now = this.clock();
    const cfgs = fixtureConfigs();
    const meta = (over: Partial<Meta>): Meta => ({ ...DEFAULT_META, ...over });
    const add = (kind: ItemKind, id: string, entity: string, config: Raw | null, source: Item['source'], m: Meta) => {
      const e: Entry = { kind, id, entity, config, source, meta: m, versions: [], runs: [] };
      if (config) e.versions.push({ version_id: 'v1', revision: revisionOf(config), at: m.updatedAt ?? ago(now, 60 * 24 * 30), via: m.createdVia, actor: m.owner, summary: 'נוצרה', config: clone(config) });
      this.entries.set(`${kind}:${id}`, e);
      return e;
    };
    const by = 'יוני';
    const M: Record<string, Partial<Meta>> = {
      '1727700000001': { lastRun: { at: ago(now, 14 * 60), result: 'ok' }, runs7d: 7, createdVia: 'arx', owner: by, updatedAt: ago(now, 60 * 24 * 12) },
      '1727700000002': { lastRun: { at: ago(now, 4), result: 'ok' }, runs7d: 38, createdVia: 'arx', owner: by, updatedAt: ago(now, 60 * 6) },
      '1727700000003': { lastRun: { at: ago(now, 60 * 8), result: 'ok' }, runs7d: 5, createdVia: 'arx', owner: by, updatedAt: ago(now, 60 * 24 * 20) },
      '1727700000004': { lastRun: { at: ago(now, 60 * 24 * 3), result: 'ok' }, runs7d: 2, createdVia: 'arx', owner: 'דנה', updatedAt: ago(now, 60 * 24 * 40) },
      '1727700000005': { lastRun: { at: ago(now, 60 * 9), result: 'ok' }, runs7d: 14, updatedAt: ago(now, 60 * 24 * 60) },
      '1727700000006': { lastRun: { at: ago(now, 60), result: 'ok' }, runs7d: 112, updatedAt: ago(now, 60 * 24 * 90) },
      '1727700000007': { lastRun: { at: ago(now, 60 * 22), result: 'ok' }, runs7d: 14, updatedAt: ago(now, 60 * 24 * 90) },
      '1727700000008': { enabled: false, updatedAt: ago(now, 60 * 24 * 90) },
      '1727700000009': { lastRun: { at: ago(now, 60 * 10), result: 'error' }, runs7d: 6, updatedAt: ago(now, 60 * 24 * 90) },
      '1727700000010': { enabled: false, lastRun: { at: ago(now, 60 * 24 * 4), result: 'ok' }, runs7d: 0, changedOutside: true, updatedAt: ago(now, 60 * 24 * 4) },
      '1727700000011': { updatedAt: ago(now, 60 * 24 * 7), createdVia: 'arx', owner: by },
      '1727700000100': { lastRun: { at: ago(now, 60 * 8), result: 'ok' }, runs7d: 6, createdVia: 'arx', owner: by, updatedAt: ago(now, 60 * 24 * 50) },
      '1727700000101': { lastRun: { at: ago(now, 60 * 24 * 21), result: 'ok' }, runs7d: 0, createdVia: 'arx', owner: by, updatedAt: ago(now, 60 * 24 * 60) },
      '1727700000102': { lastRun: { at: ago(now, 60 * 30), result: 'ok' }, runs7d: 3, updatedAt: ago(now, 60 * 24 * 60) },
      '1727700000200': { lastRun: { at: ago(now, 120), result: 'ok' }, favourite: true, createdVia: 'arx', owner: by, updatedAt: ago(now, 60 * 24 * 3) },
    };
    for (const [id, c] of Object.entries(cfgs)) add(c.kind, id, c.entity, clone(c.config), 'ui', meta(M[id] ?? {}));
    // the configuration-file item: no config id, so the id is the entity (CR §2 "entity:<entity_id>")
    add('automation', 'entity:automation.irrigation_shabbat', 'automation.irrigation_shabbat', clone(YAML_AUTOMATION), 'yaml', meta({ lastRun: { at: ago(now, 60 * 24 * 2), result: 'ok' }, runs7d: 1 }));
    INTEGRATION_SCENES.forEach((s, i) => add('scene', `entity:${s}`, s, null, 'integration', meta({ favourite: s === 'scene.salon_evening', lastRun: s === 'scene.salon_evening' ? { at: ago(now, 60 * 20), result: 'ok' } : null, hidden: i === 4 })));
    // history of the hall-motion automation (as the approved mockup shows it)
    const a2 = this.entries.get('automation:1727700000002')!;
    const old1 = clone(a2.config!);
    ((old1.actions as Raw[])[1] as Raw).delay = dur(0, 2, 0);
    a2.versions = [
      { version_id: 'v9', revision: revisionOf(old1), at: ago(now, 60 * 24 * 29), via: 'arx', actor: 'יוני', summary: 'נוצרה מתבנית "תאורה לפי תנועה"', config: old1 },
      { version_id: 'v10', revision: 'a1b2c3d4e5f60718', at: ago(now, 60 * 24 * 17), via: 'arx', actor: 'דנה', summary: 'נוסף תנאי "אחרי השקיעה"', config: clone(old1) },
      { version_id: 'v11', revision: 'b2c3d4e5f6071829', at: ago(now, 60 * 24 * 3), via: 'external', actor: null, summary: 'השהיה 2 → 3 דקות', config: clone(old1) },
      { version_id: 'v12', revision: revisionOf(a2.config), at: ago(now, 60 * 6), via: 'arx', actor: 'יוני', summary: 'בהירות 30% → 40%', config: clone(a2.config!) },
    ];
    a2.runs = this.traceFixtures(now);
    const a5 = this.entries.get('automation:1727700000005')!;
    a5.runs = [this.mkTrace('r1', ago(now, 60 * 9), 61, 'ok', 'automation', null, 'השעה 06:30', 'triggers.1', [], [
      { path: 'actions.0', depth: 0, sentence: 'בחירה לפי תנאים', result: 'done', ms: 58 }, { path: 'actions.0.choose.0', depth: 1, sentence: 'ענף 1 · הטריגר הוא "night"?', result: 'skipped', ms: 1 },
      { path: 'actions.0.choose.1', depth: 1, sentence: 'ענף 2 · הטריגר הוא "morning"?', result: 'done', ms: 1 }, { path: 'actions.0.choose.1.sequence.0', depth: 2, sentence: 'כבה מזגן חדר שינה', result: 'done', ms: 54, vars: { 'climate.bed': 'cool → off' } }],
      { 'trigger.id': 'morning' })];
    this.trashRows = [
      { trash_id: 'x1', kind: 'automation', id: '1727600000001', name: 'תאורת מרפסת בלילה', sentence: 'בשקיעה – הדלק תאורת גינה', deleted_at: ago(now, 60 * 24 * 4), expires_at: new Date(now.getTime() + 26 * 86400000).toISOString(), deleted_by: 'דנה', sensitive: false, entities: ['light.garden'],
        config: { id: '1727600000001', alias: 'תאורת מרפסת בלילה', description: '', triggers: [{ trigger: 'sun', event: 'sunset' }], conditions: [], actions: [{ action: 'light.turn_on', target: { entity_id: ['light.garden'] } }], mode: 'single' } },
      { trash_id: 'x2', kind: 'script', id: 'arx_1727500000000', name: 'בדיקת צופר', sentence: 'הפעל צופר חיצוני', deleted_at: ago(now, 60 * 24 * 27), expires_at: new Date(now.getTime() + 3 * 86400000).toISOString(), deleted_by: 'יוני', sensitive: true, entities: ['siren.outdoor'],
        config: { alias: 'בדיקת צופר', sequence: [{ action: 'siren.turn_on', target: { entity_id: ['siren.outdoor'] } }], mode: 'single' } },
    ];
  }

  private mkTrace(id: string, at: string, ms: number | null, result: RunTrace['result'], parent: NonNullable<RunTrace['context']['parent']>, user: string | null, trig: string, path: string,
    conds: Array<{ path: string; sentence: string; passed: boolean | null }>,
    steps: Array<{ path: string; depth: number; sentence: string; result: RunTrace['steps'][number]['result']; ms?: number; error?: string; vars?: Raw }>, vars: Raw | null): RunTrace {
    let t = Date.parse(at);
    const t0 = new Date(t).toISOString();
    const rows: RunTrace['steps'] = steps.map((s) => {
      const started = s.result === 'not_run' ? null : new Date(t).toISOString();
      if (s.result !== 'not_run') t += s.ms ?? 0;
      return { path: s.path, depth: s.depth, sentence: s.sentence, result: s.result, started_at: started, duration_ms: s.result === 'not_run' ? null : s.ms ?? null, error: s.error ?? null, changed_variables: s.vars ? (maskSecrets(s.vars) as Raw) : null };
    });
    const tr: RunTrace = {
      run_id: id, at: t0, finished_at: ms === null ? null : new Date(Date.parse(t0) + ms).toISOString(), duration_ms: ms, result, sentence: '', trigger: { sentence: trig, path, description: null },
      conditions: conds, steps: rows, variables: vars ? (maskSecrets(vars) as Raw) : null, context: { user, parent },
    };
    tr.sentence = shortRunSentence(tr, { timeZone: 'Asia/Jerusalem' });
    return tr;
  }
  private traceFixtures(now: Date): RunTrace[] {
    const sunset = { path: 'conditions.0', sentence: 'אחרי השקיעה (17:58)', passed: true as boolean | null };
    const trig = 'חיישן תנועה פרוזדור עבר מ"אין תנועה" ל"תנועה"';
    return [
      this.mkTrace('r1', new Date(now.getTime() - 4 * 60000).toISOString(), 184512, 'ok', 'automation', null, trig, 'triggers.0', [sunset], [
        { path: 'actions.0', depth: 0, sentence: 'הדלק תאורת פרוזדור · בהירות 40%', result: 'done', ms: 41, vars: { 'light.hall': 'off → on' } },
        { path: 'actions.1', depth: 0, sentence: 'המתן 3 דקות', result: 'done', ms: 180004 }, { path: 'actions.2', depth: 0, sentence: 'כבה תאורת פרוזדור', result: 'done', ms: 38, vars: { 'light.hall': 'on → off' } }],
        { 'trigger.id': 'motion', 'trigger.to_state.state': 'on', 'trigger.from_state.state': 'off' }),
      this.mkTrace('r2', new Date(now.getTime() - 75 * 60000).toISOString(), 3, 'not_triggered', 'automation', null, trig, 'triggers.0', [{ ...sunset, sentence: 'אחרי השקיעה (17:58)', passed: false }], [], { 'trigger.id': 'motion' }),
      this.mkTrace('r3', new Date(now.getTime() - 9 * 3600000).toISOString(), 180160, 'ok', 'automation', null, trig, 'triggers.0', [sunset], [
        { path: 'actions.0', depth: 0, sentence: 'הדלק תאורת פרוזדור · בהירות 40%', result: 'done', ms: 52 }, { path: 'actions.1', depth: 0, sentence: 'המתן 3 דקות', result: 'done', ms: 180010 },
        { path: 'actions.2', depth: 0, sentence: 'כבה תאורת פרוזדור', result: 'done', ms: 40 }], { 'trigger.id': 'motion' }),
      this.mkTrace('r4', new Date(now.getTime() - 16 * 3600000).toISOString(), 2210, 'error', 'user', 'יוני', 'הרצה ידנית · "הרץ עכשיו"', 'trigger', [{ ...sunset, passed: null }], [
        { path: 'actions.0', depth: 0, sentence: 'הדלק תאורת פרוזדור · בהירות 40%', result: 'error', ms: 2201, error: 'המכשיר לא זמין' }, { path: 'actions.1', depth: 0, sentence: 'המתן 3 דקות', result: 'not_run' },
        { path: 'actions.2', depth: 0, sentence: 'כבה תאורת פרוזדור', result: 'not_run' }], { 'trigger.platform': 'manual', skip_condition: true, access_token: 'abc123secret' }),
    ];
  }

  // ---- helpers: errors, rights, items

  private err(status: number, code: string, details: Raw = {}, message?: string): never {
    const tpl = (AUTOMATION_ERROR_LABEL as Record<string, string>)[code] ?? code;
    const first = Array.isArray(details.errors) ? (details.errors[0] as Partial<Issue> | undefined) : undefined;
    const merged: Raw = { ...details, ...(first ? { field: first.path, what: first.message } : {}) };
    const text = message ?? tpl.replace(/\{(\w+)\}/g, (_m, k: string) => (typeof merged[k] === 'string' || typeof merged[k] === 'number' ? String(merged[k]) : '…'));
    throw new ApiError(status, { code, user_message: text, retryable: false, correlation_id: `mock-${++this.seq}`, details });
  }
  private statusOf(code: string): number {
    const t: Record<string, number> = { forbidden: 403, entity_not_controllable: 403, grant_required: 403, code_view_required: 403, locked_block_changed: 403, delegation_off: 403, not_ha_admin: 403, item_not_found: 404,
      trash_not_found: 404, item_changed: 409, confirmation_required: 409, feature_disabled: 409, validation: 422, ha_validation: 422, action_not_allowed: 422, code_not_allowed: 422, not_editable: 422, masked_values: 422,
      rate_limited: 429, run_too_soon: 429, config_refused: 502, config_api_unavailable: 503, ha_unavailable: 503, bridge_not_paired: 503, bridge_too_old: 503, config_timeout: 504 };
    return t[code] ?? 500;
  }
  /** Consumes a `failNext`. */
  private maybeFail(): void {
    if (!this.failure) return;
    const f = this.failure;
    this.failure = null;
    this.err(f.status ?? this.statusOf(f.code), f.code, f.details ?? {});
  }
  private key(kind: ItemKind, id: string) { return `${kind}:${id}`; }
  private must(kind: ItemKind, id: string): Entry {
    const e = this.entries.get(this.key(kind, id));
    if (!e) this.err(404, 'item_not_found');
    return e;
  }
  private classOf = (id: string): string | null => ENT[id]?.cls ?? null;
  private draftOf(e: Entry): AnyDraft {
    if (!e.config) return { name: nameOf(e.entity), icon: null, members: [] } satisfies SceneDraft;
    return configToDraft(e.kind, e.config, modelCtx()).draft;
  }
  /** CR §7: visible iff every action target is in scope; no target -> by trigger entities; neither -> installation-wide only. */
  private visible(e: Entry, u: MockUser = this.user): boolean {
    if (e.meta.hidden && !u.ha_admin) return false;
    if (e.kind === 'scene' && !e.config) return entityInScope(placeOf(e.entity) ?? { floor: null, area: null }, u.scope, 'target');
    return itemVisibleTo(this.draftOf(e), u.scope, (id) => placeOf(id));
  }
  /** Owner decision 1b (2026-10-01): no view-only access - an automation is seen by automation.manage only; scripts by script.run / script.manage; scenes by scene.manage or the control of a device. */
  private viewRight(kind: ItemKind, u: MockUser = this.user): boolean { return kind === 'automation' ? u.can.manage : kind === 'script' ? u.can.script_run || u.can.script_manage : u.can.scene_manage || u.can.scene_run; }
  /** 403 without the kind's right (the backend's order: no view-only access, decision 1b), 404 for an item outside the caller's scope. */
  private mustSee(kind: ItemKind, e: Entry): void {
    if (!this.viewRight(kind)) this.err(403, 'forbidden');
    if (!this.visible(e)) this.err(404, 'item_not_found');
  }
  private needGrants(draft: AnyDraft, u: MockUser = this.user): PreviewResult['sensitive_steps'] {
    return sensitiveSteps(draft, this.classOf, (g) => u.grants.has(g));
  }
  private stepNoun(action: string): string {
    if (action === 'alarm_control_panel.alarm_disarm') return 'נטרול';
    if (action.startsWith('alarm_control_panel.')) return 'דריכה';
    if (action === 'lock.unlock') return 'פתיחת מנעול';
    if (action === 'lock.lock') return 'נעילה';
    if (action.startsWith('siren.')) return 'הפעלת צופר';
    if (action.startsWith('cover.')) return /open/.test(action) ? 'פתיחת שער' : 'סגירת שער';
    return 'שליטה';
  }
  private firstMissingGrant(draft: AnyDraft, u: MockUser = this.user): void {
    const miss = this.needGrants(draft, u).find((s) => !s.granted);
    if (miss) this.err(403, 'grant_required', { grant: miss.grant, path: miss.path, name: nameOf(miss.entity_id), action: this.stepNoun(miss.action) });
  }
  /** Every target in scope and controllable by the caller (a scoped caller never controls an unplaced entity). */
  private checkControl(draft: AnyDraft, u: MockUser = this.user): void {
    for (const id of draftTargets(draft)) {
      const place = placeOf(id);
      if (!entityInScope(place ?? { floor: null, area: null }, u.scope, 'target')) this.err(403, 'entity_not_controllable', { name: nameOf(id), entity_id: id });
    }
  }
  private editBlock(e: Entry, u: MockUser = this.user): { code: string; message: string; entity_id?: string } | null {
    if (e.source === 'integration') return { code: 'integration_scene', message: 'סצנה של מכשיר: הפעלה בלבד' };
    if (e.source === 'yaml' || e.source === 'dynamic') return { code: 'yaml_managed', message: 'מוגדרת בקובץ תצורה – לצפייה בלבד' };
    if (!manageRight(e.kind, { can: u.can })) return { code: 'no_permission', message: 'אין הרשאת עריכה' };
    if (this.available === 'config_api_unavailable') return { code: 'config_api_unavailable', message: 'עריכה אינה זמינה כרגע' };
    if (!u.ha_admin && !this.delegation) return { code: 'delegation_off', message: 'שמירה דורשת מנהל' };
    const miss = this.needGrants(this.draftOf(e), u).find((s) => !s.granted);
    if (miss) return { code: 'grant_required', message: `אין לך הרשאה ל${this.stepNoun(miss.action)} ב־${nameOf(miss.entity_id)}`, entity_id: miss.entity_id };
    return null;
  }
  private runRight(e: Entry, u: MockUser = this.user): boolean {
    if (e.kind === 'automation') return u.can.manage && e.source !== 'integration';
    if (e.kind === 'script') return u.can.script_run;
    return true;
  }
  private placement(draft: AnyDraft): { floors: Item['floors']; areas: Item['areas'] } {
    const floors = new Map<string, string>(); const areas = new Map<string, string>();
    for (const id of [...draftTargets(draft), ...triggerEntities(draft)]) {
      const p = placeOf(id);
      if (p?.floor) floors.set(p.floor.id, p.floor.name);
      if (p?.area) areas.set(p.area.id, p.area.name);
    }
    return { floors: [...floors].map(([id, name]) => ({ id, name })), areas: [...areas].map(([id, name]) => ({ id, name })) };
  }
  private itemOf(e: Entry, u: MockUser = this.user): Item {
    const draft = this.draftOf(e);
    const ctx = modelCtx();
    const targets = draftTargets(draft).map((id) => ({ entity_id: id, name: nameOf(id), floor: placeOf(id)?.floor?.name ?? null, area: placeOf(id)?.area?.name ?? null, class: ENT[id]?.cls ?? null,
      sensitive: !!ENT[id]?.cls, missing: !ENT[id] || !!ENT[id].missing }));
    const locks = lockedBlocks(draft);
    const steps = this.needGrants(draft, u);
    const sensClasses = sensitiveClassesOf(draft);
    const sensitive = sensClasses.length > 0 || steps.length > 0;
    const ro = this.editBlock(e, u);
    const warnings: Item['warnings'] = [];
    if (targets.some((t) => t.missing) || triggerEntities(draft).some((id) => !ENT[id])) warnings.push({ code: 'missing_entity', message: 'מכשיר חסר' });
    if (e.meta.invalid) warnings.push({ code: 'invalid_config', message: 'שגיאה בהגדרה' });
    if (e.meta.changedOutside) warnings.push({ code: 'changed_outside', message: 'שונתה מחוץ למערכת' });
    if (sensitive) warnings.push({ code: 'sensitive', message: 'כולל פעולה רגישה' });
    if (hasUnknownEffects(draft)) warnings.push({ code: 'unknown_effects', message: 'כולל פעולה מתקדמת' });
    if ('triggers' in draft && triggerEntities(draft).some((id) => draftTargets(draft).includes(id)) && !draft.conditions.length) warnings.push({ code: 'self_trigger', message: 'הפעולה משנה את מה שמפעיל אותה' });
    const editable = e.source === 'ui' && !ro && manageRight(e.kind, { can: u.can });
    const place = this.placement(draft);
    const isScene = e.kind === 'scene';
    return {
      kind: e.kind, id: e.id, config_id: e.config && typeof e.config.id === 'string' ? e.config.id : e.kind === 'script' && e.source === 'ui' ? e.id : null, entity_id: e.entity,
      name: !e.config ? nameOf(e.entity) : isScene ? (draft as SceneDraft).name : (draft as AutomationDraft).alias, description: !isScene ? (draft as AutomationDraft).description : '',
      icon: isScene ? (draft as SceneDraft).icon : e.kind === 'script' ? (draft as ScriptDraft).icon : null, source: e.source,
      state: e.kind === 'automation' ? (e.meta.invalid ? 'invalid' : e.meta.enabled ? 'on' : 'off') : e.kind === 'script' ? (e.meta.running ? 'running' : 'off') : 'scene',
      sentence: e.config ? draftSentence(e.kind, draft, ctx) : '',
      floors: isScene && !e.config ? [entFloor(ENT[e.entity]?.area ?? null)].filter((f): f is { id: string; name: string } => !!f) : place.floors,
      areas: isScene && !e.config ? [entArea(ENT[e.entity]?.area ?? null)].filter((f): f is { id: string; name: string } => !!f) : place.areas,
      targets, sensitive, sensitive_classes: sensClasses, locked_count: locks.length, unknown_effects: hasUnknownEffects(draft),
      mode: isScene ? null : (draft as AutomationDraft).mode, extras: e.config ? extraKeys(e.kind, e.config) : [], labels: [], category: null,
      last_run: e.meta.lastRun, runs_7d: e.meta.runs7d, created_via: e.meta.createdVia, owner: e.meta.owner ? { display_name: e.meta.owner } : null, updated_at: e.meta.updatedAt,
      revision: e.config && e.source === 'ui' ? revisionOf(e.config) : null, pinned: e.meta.pinned, favourite: e.meta.favourite, hidden: e.meta.hidden,
      can: {
        edit: editable, code_view: u.can.code_view && e.source === 'ui' && this.visible(e, u), toggle: e.kind === 'automation' && u.can.manage && e.source !== 'integration' && !steps.some((s) => !s.granted),
        run: this.runRight(e, u) && (e.kind !== 'automation' || !steps.some((s) => !s.granted)), delete: editable, copy: editable && u.can.manage,
      },
      read_only: ro ? { reasons: [ro] } : null, warnings,
    };
  }
  /** The draft the caller may see: typed blocks that watch an entity outside the scope are locked views (shown by name; CR §7). */
  private lockedView(draft: AnyDraft, u: MockUser): AnyDraft {
    if (isInstallationWide(u.scope) || !('triggers' in draft)) return draft;
    const out = clone(draft) as AutomationDraft;
    const lock = (b: AutomationDraft['triggers'][number] | AutomationDraft['conditions'][number], section: 'trigger' | 'condition') => {
      if (b.kind !== 'typed' || !('entity_ids' in b)) return b;
      if (b.entity_ids.every((id) => entityInScope(placeOf(id) ?? { floor: null, area: null }, u.scope, 'watch'))) return b;
      const raw = emitBlock(b, section, modelCtx());
      const l: LockedBlock = { uid: b.uid, kind: 'locked', raw, sentence: b.sentence, fingerprint: fingerprintOf(raw), reason: 'unknown', label: b.sentence, sensitive: false, effects: 'none', template_text: null, masked: false };
      return l;
    };
    out.triggers = out.triggers.map((b) => lock(b, 'trigger')) as AutomationDraft['triggers'];
    out.conditions = out.conditions.map((b) => lock(b, 'condition')) as AutomationDraft['conditions'];
    return out;
  }
  private detailOf(e: Entry, u: MockUser = this.user): ItemDetail {
    const item = this.itemOf(e, u);
    let draft = this.draftOf(e);
    draft = this.lockedView(draft, u);
    if (e.kind === 'scene' && !e.config) draft = { name: item.name, icon: null, members: [] };
    return { ...item, draft, versions: e.versions.length, trash_restore_of: null };
  }
  private stamp(): string { return this.clock().toISOString(); }
  private pushVersion(e: Entry, via: 'arx' | 'external', actor: string | null, summary: string): void {
    if (!e.config) return;
    const rev = revisionOf(e.config);
    if (e.versions.length && e.versions[e.versions.length - 1].revision === rev) return;
    const nextNo = Math.max(0, ...e.versions.map((v) => Number(/\d+/.exec(v.version_id)?.[0] ?? 0))) + 1;
    e.versions.push({ version_id: `v${nextNo}`, revision: rev, at: this.stamp(), via, actor, summary, config: clone(e.config) });
    const keep = this.settingsValue.versions_keep;
    while (e.versions.length > keep) e.versions.shift();
    e.meta.updatedAt = this.stamp();
  }
  private rate(): void {
    const now = this.clock().getTime();
    this.writeTimes = this.writeTimes.filter((t) => now - t < 60000);
    if (this.writeTimes.length >= this.settingsValue.limits.writes_per_min) this.err(429, 'rate_limited');
    this.writeTimes.push(now);
  }
  private writeGate(kind: ItemKind): void {
    if (this.available === 'feature_disabled' || !this.settingsValue.enabled) this.err(409, 'feature_disabled');
    if (this.available === 'ha_unavailable') this.err(503, 'ha_unavailable');
    if (this.available === 'config_api_unavailable') this.err(503, 'config_api_unavailable');
    if (!manageRight(kind, { can: this.user.can })) this.err(403, 'forbidden');
  }
  private idem<T>(rid: string, fn: () => T): T {
    const k = `${this.userId}:${rid}`;
    if (this.ops.has(k)) return clone(this.ops.get(k) as T);
    const r = fn();
    this.ops.set(k, clone(r));
    return r;
  }
  private audited(action: string, e: Pick<Entry, 'kind' | 'id'>): void {
    this.audit.push({ action, kind: e.kind, id: e.id, user: this.user.name, delegated: !this.user.ha_admin, at: this.stamp() });
  }
  /** The bridge's checks (CR §8.3): profile `code` needs an HA admin; profile `builder` needs an HA admin or the delegation switch. */
  private bridge(profile: 'builder' | 'code'): void {
    if (!this.user.ha_admin) {
      if (profile === 'code') this.err(403, 'not_ha_admin');
      if (!this.delegation) this.err(403, 'delegation_off');
    }
  }
  /** CR §10: the revision the caller based the edit on must still be the stored one (the conflict knob plays "someone saved in between"). */
  private checkRevision(e: Entry, base: string | null): void {
    if (this.conflictNext) {
      this.conflictNext = false;
      if (e.config) this.externalEdit(e.kind, e.id, (c) => { c.description = `${String(c.description ?? '')}${c.description ? ' ' : ''}(עודכן)`; });
    }
    if (e.config && revisionOf(e.config) !== base) this.err(409, 'item_changed', { current: this.detailOf(e) as unknown as Raw });
  }
  private checkValid(kind: ItemKind, draft: AnyDraft, id: string | null): void {
    const errs = validateDraft(kind, draft, { notifyTargets: this.settingsValue.notify_targets.length ? Object.keys(NOTIFY).filter((a) => this.settingsValue.notify_targets.includes(NOTIFY[a])) : null, shabbatSensor: SHABBAT_SENSOR });
    void id;
    if (errs.length) {
      const code = errs.find((i) => i.code === 'code_not_allowed') ? 'code_not_allowed' : errs.find((i) => i.code === 'action_not_allowed') ? 'action_not_allowed' : 'validation';
      this.err(422, code, { errors: errs as unknown as Raw[] });
    }
  }
  /** The locked-block rule (§3.2): every locked block must be (by fingerprint) a locked block of the stored item or the raw of a block the caller sees locked (outside their scope). */
  private checkLocked(draft: AnyDraft, stored: Entry | null, viaCode: boolean): void {
    const storedDraft = stored ? this.draftOf(stored) : null;
    let bad = changedLockedBlocks(draft, storedDraft);
    if (storedDraft && !isInstallationWide(this.user.scope)) {
      const outside = new Set(walkDraft(storedDraft).filter((w) => w.block.kind === 'typed' && w.block.raw !== null).map((w) => fingerprintOf(w.block.raw)));
      bad = bad.filter((b) => !outside.has(b.fingerprint));
    }
    if (bad.length && !viaCode) this.err(403, 'locked_block_changed', { paths: bad.map((b) => b.uid) });
  }

  // ---- reads

  async status(): Promise<AutomationsStatus> {
    const u = this.user;
    const items = [...this.entries.values()].filter((e) => this.viewRight(e.kind) && this.visible(e));
    const att = items.filter((e) => { const i = this.itemOf(e); return i.state === 'invalid' || i.warnings.some((w) => w.code === 'missing_entity') || e.meta.lastRun?.result === 'error'; }).length;
    const needed = !u.ha_admin;
    const block: AutomationsStatus['write_block'] = this.available === 'feature_disabled' ? 'feature_disabled' : this.available === 'ha_unavailable' ? 'ha_unavailable' : needed && !this.delegation ? 'delegation_off' : null;
    return {
      available: this.available, stale: false, last_sync_at: this.stamp(), writable: this.available === 'ok' && block === null && (u.can.manage || u.can.scene_manage || u.can.script_manage), write_block: block,
      scheduler_present: this.schedulerPresent, can: { ...u.can }, delegation: { on: this.delegation, needed },
      ui: { sensitive_warning: this.settingsValue.sensitive_warning, ask_when_on_new: this.settingsValue.ask_when_on_new, templates_enabled: this.settingsValue.templates_enabled, phone_filter: this.settingsValue.phone_filter, sensitive_chip: this.settingsValue.sensitive_chip },
      counts: { automations: items.filter((e) => e.kind === 'automation').length, scripts: items.filter((e) => e.kind === 'script').length, scenes: items.filter((e) => e.kind === 'scene').length,
        running: items.filter((e) => e.meta.running).length, attention: att, hidden: u.ha_admin ? [...this.entries.values()].filter((e) => e.meta.hidden).length : null },
      ...(u.can.configure ? { admin: { ha_version: '2026.9.4', bridge_version: '0.6.0', bridge_required: '0.6.0', delegation_changed_at: ago(this.clock(), 60 * 24 * 2), caller_is_ha_admin: u.ha_admin, config_api: 'ok' as const, authoring_block_reason: null } } : {}),
    };
  }
  async list(q: ListQuery = {}): Promise<{ items: Item[]; total: number }> {
    if (this.available === 'ha_unavailable') this.err(503, 'ha_unavailable');
    const all = [...this.entries.values()].filter((e) => this.viewRight(e.kind) && this.visible(e)).map((e) => this.itemOf(e));
    const items = filterItems(all, q, { me: this.user.name });
    return { items, total: items.length };
  }
  async get(kind: ItemKind, id: string): Promise<ItemDetail> {
    const e = this.must(kind, id);
    if (!this.viewRight(kind)) this.err(403, 'forbidden');
    if (!this.visible(e)) this.err(404, 'item_not_found');
    return this.detailOf(e);
  }
  async catalog(): Promise<AutomationCatalog> {
    const u = this.user;
    if (!u.can.manage && !u.can.scene_manage && !u.can.script_manage) this.err(403, 'forbidden');
    const wide = isInstallationWide(u.scope);
    const actionsByDomain: Record<string, ActionSpec[]> = {};
    const spec = (action: string, role: ActionSpec['role'] = 'device'): ActionSpec => ({ action, label: (ACTION_VERBS[action] ?? action).replace(/\{n\}|־$/g, '').trim(), role, sensitive: sensitiveClassOf(action) !== null, args: ARGS[action] ?? [] });
    for (const a of DEFAULT_ALLOWED_ACTIONS) (actionsByDomain[a.split('.')[0]] ??= []).push(spec(a));
    const entities: CatalogEntity[] = Object.entries(ENT).filter(([id]) => !id.startsWith('scene.') && !id.startsWith('script.')).filter(([id]) => entityInScope(placeOf(id) ?? { floor: null, area: null }, u.scope, 'watch')).map(([id, e]) => {
      const dom = catalogDomain(id);
      const controllable = !!actionsByDomain[dom] && (wide || !!placeOf(id));
      return { entity_id: id, name: e.name, domain: dom, floor: entFloor(e.area), area: entArea(e.area), class: e.cls ?? null, state: e.st ?? null, missing: !!e.missing,
        triggers: ['binary_sensor', 'sensor', 'person', 'light', 'switch', 'climate', 'alarm_control_panel', 'lock', 'cover', 'zone', 'media_player'].includes(dom) ? (dom === 'sensor' || dom === 'zone' || dom === 'climate' ? ['state', 'numeric_state'] : ['state']) : [],
        actions: controllable ? (actionsByDomain[dom] ?? []).map((s) => s.action) : [] } as CatalogEntity;
    });
    return {
      entities, actions: actionsByDomain, notify_targets: Object.entries(NOTIFY).map(([action, name]) => ({ action, name })),
      scenes: [...this.entries.values()].filter((e) => e.kind === 'scene' && this.visible(e)).map((e) => ({ entity_id: e.entity, name: this.itemOf(e).name, area: entArea(ENT[e.entity]?.area ?? null)?.name ?? null, integration: !e.config })),
      scripts: [...this.entries.values()].filter((e) => e.kind === 'script' && this.visible(e)).map((e) => ({ entity_id: e.entity, name: this.itemOf(e).name, fields: (this.draftOf(e) as ScriptDraft).fields })),
      floors: FLOORS.map((f) => ({ ...f })).filter((f) => wide || u.scope.floors?.includes(f.id)), areas: AREAS.map((a) => ({ id: a.id, name: a.name, floor: a.floor })).filter((a) => wide || u.scope.floors?.includes(a.floor)),
      shabbat_sensor: SHABBAT_SENSOR,
    };
  }
  async templates(): Promise<{ templates: AutomationTemplate[] }> {
    if (!this.user.can.manage) this.err(403, 'forbidden');
    if (!this.settingsValue.templates_enabled) return { templates: [] };
    const ctx = modelCtx();
    const T = (id: string, name: string, description: string, icon: string, config: Raw, extra: Partial<AutomationTemplate> = {}): AutomationTemplate => {
      const draft = configToDraft('automation', { alias: name, description: '', conditions: [], mode: 'single', ...config }, ctx).draft;
      const sens = lockedBlocks(draft).some((b) => b.sensitive) || this.needGrants(draft, { ...this.user, grants: new Set() }).length > 0;
      return { id, name, description, icon, target: 'automation', suggest_schedule: false, sensitive: sens, draft, ...extra };
    };
    const list: AutomationTemplate[] = [
      T('t1', 'תאורה לפי תנועה', 'נדלקת כשיש תנועה, נכבית אחרי כמה דקות בלי תנועה', 'motion', { triggers: [{ trigger: 'state', entity_id: [], to: 'on' }], actions: [{ action: 'light.turn_on', target: { entity_id: [] }, data: { brightness_pct: 40 } }, { delay: dur(0, 3, 0) }, { action: 'light.turn_off', target: { entity_id: [] } }], mode: 'restart' }),
      T('t2', 'דלת או חלון פתוחים זמן רב', 'התראה אחרי N דקות', 'door', { triggers: [{ trigger: 'state', entity_id: [], to: 'on', for: dur(0, 5, 0) }], actions: [{ action: 'notify.mobile_app_yoni', data: { message: 'נשאר פתוח' } }] }),
      T('t3', 'יציאה מהבית', 'כולם יצאו: תאורה ומיזוג כבויים, חימוש אזעקה לבחירה', 'users', { triggers: [{ trigger: 'numeric_state', entity_id: ['zone.home'], below: 1 }], actions: [{ action: 'light.turn_off', target: { entity_id: [] } }, { action: 'climate.turn_off', target: { entity_id: [] } }, { action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: ['alarm_control_panel.home'] } }] }),
      T('t4', 'חזרה הביתה אחרי השקיעה', 'תאורת כניסה כשמישהו חוזר בחושך', 'sunset', { triggers: [{ trigger: 'state', entity_id: ['person.yoni', 'person.dana'], to: 'home' }], conditions: [{ condition: 'sun', after: 'sunset' }], actions: [{ action: 'light.turn_on', target: { entity_id: ['light.entry'] } }] }),
      T('t5', 'הצפה', 'התראה לכל המכשירים כשחיישן מים נרטב', 'drop', { triggers: [{ trigger: 'state', entity_id: [], to: 'on' }], actions: [{ action: 'notify.notify', data: { message: 'זוהתה הצפה' } }] }),
      T('t6', 'תאורה בשקיעה', 'נדלקת בשקיעה; מתאים גם כתזמון', 'sun', { triggers: [{ trigger: 'sun', event: 'sunset' }], actions: [{ action: 'light.turn_on', target: { entity_id: ['light.entry'] } }] }, { suggest_schedule: true }),
      T('t7', 'מזגן לפי שעות', 'הפעלה וכיבוי בשעות קבועות; מתאים גם כתזמון', 'clock', { triggers: [{ trigger: 'time', at: '22:00:00' }], actions: [{ action: 'climate.set_temperature', target: { entity_id: ['climate.bed'] }, data: { temperature: 24 } }] }, { suggest_schedule: true }),
    ];
    const hidden = new Set(this.settingsValue.templates_hidden);
    const rank = new Map(this.settingsValue.templates_order.map((id, i) => [id, i]));
    return { templates: list.filter((t) => !hidden.has(t.id)).sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)) };
  }

  // ---- preview and dry-run

  private effectsOf(draft: AnyDraft): PreviewResult['effects'] {
    const out: PreviewResult['effects']['entities'] = [];
    for (const w of walkDraft(draft)) {
      if (w.section !== 'action' || w.block.kind !== 'typed' || (w.block as { type: string }).type !== 'service') continue;
      const b = w.block as Extract<ActionBlock, { type: 'service' }>;
      for (const id of b.entity_ids) {
        if (out.some((x) => x.entity_id === id)) continue;
        const p = placeOf(id);
        out.push({ entity_id: id, name: nameOf(id), floor: p?.floor?.name ?? null, area: p?.area?.name ?? null, from: ENT[id]?.st ?? null, to: effectWord(b.action, b.data) });
      }
    }
    return { entities: out, unknown: hasUnknownEffects(draft) };
  }
  async preview(body: { kind: ItemKind; id?: string | null; draft: AnyDraft }): Promise<PreviewResult> {
    if (!manageRight(body.kind, { can: this.user.can })) this.err(403, 'forbidden');
    const { kind, draft } = body;
    const stored = body.id ? this.entries.get(this.key(kind, body.id)) ?? null : null;
    const errors = validateDraft(kind, draft, { shabbatSensor: SHABBAT_SENSOR });
    const ctx = modelCtx();
    const warnings: Issue[] = [];
    if (kind === 'automation') {
      const d = draft as AutomationDraft;
      const watched = triggerEntities(d);
      if (watched.some((id) => draftTargets(d).includes(id)) && !d.conditions.length) warnings.push({ path: 'actions', code: 'self_trigger', message: 'הפעולה משנה את מה שמפעיל אותה; בחרו אפשרות "התעלם" או הוסיפו תנאי' });
    }
    const steps = this.needGrants(draft);
    const changed = changedLockedBlocks(draft, stored ? this.draftOf(stored) : null);
    const sugg = kind === 'automation' ? suggestSchedule(draft as AutomationDraft, { schedulerPresent: this.schedulerPresent, shabbatSensor: SHABBAT_SENSOR, classOf: this.classOf }) : null;
    return {
      valid: errors.length === 0, errors, warnings, ha_validation: errors.length ? 'skipped' : 'ok', sentence: draftSentence(kind, draft, ctx), block_sentences: blockSentences(draft, ctx),
      effects: this.effectsOf(draft), sensitive: steps.length > 0, sensitive_steps: steps,
      requires: { confirm: hasUnknownEffects(draft), code_view: changed.length > 0, ha_admin: changed.length > 0 }, suggest_schedule: sugg ? { schedule_draft: sugg.schedule_draft } : null,
    };
  }
  async dryRun(kind: ItemKind, id: string): Promise<DryRunResult> {
    const e = this.must(kind, id);
    if (!this.visible(e)) this.err(404, 'item_not_found');
    const draft = this.draftOf(e);
    const ctx = modelCtx();
    const conds = 'conditions' in draft ? draft.conditions.map((c) => ({ sentence: c.sentence || c.kind, passed: c.kind === 'locked' ? null : this.conditionsPass })) : [];
    void ctx;
    return { conditions: conds, effects: this.effectsOf(draft) };
  }

  // ---- writes

  private result(e: Entry, op: string, status?: 'not_loaded'): WriteResult {
    void status;
    return { item: this.detailOf(e), op_id: op };
  }
  private newId(kind: ItemKind): string {
    const ms = this.clock().getTime() + ++this.seq;
    return kind === 'script' ? `arx_${ms}` : String(ms);
  }
  private entityFor(kind: ItemKind, id: string, name: string): string {
    const slug = name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
    return `${kind}.${slug || id}`.replace(/^script\.arx_/, 'script.arx_');
  }
  private storeNew(kind: ItemKind, draft: AnyDraft, enabled: boolean, id: string, name: string, like: Raw | null = null, summary = 'נוצרה'): Entry {
    const config = draftToConfig(kind, draft, like ? { ...like, ...(kind === 'script' ? {} : { id }) } : null, modelCtx(), { id: kind === 'script' ? null : id });
    const e: Entry = { kind, id, entity: kind === 'script' ? `script.${id}` : this.entityFor(kind, id, name), config, source: 'ui',
      meta: { ...DEFAULT_META, enabled, createdVia: 'arx', owner: this.user.name, updatedAt: this.stamp() }, versions: [], runs: [] };
    this.entries.set(this.key(kind, id), e);
    this.pushVersion(e, 'arx', this.user.name, summary);
    return e;
  }
  async create(kind: ItemKind, body: WriteBody & { draft: AnyDraft; enabled?: boolean }): Promise<WriteResult> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      this.writeGate(kind);
      this.rate();
      this.checkValid(kind, body.draft, null);
      this.checkControl(body.draft);
      this.firstMissingGrant(body.draft);
      this.checkLocked(body.draft, null, false);
      if (hasUnknownEffects(body.draft) && !body.confirm) this.err(409, 'confirmation_required');
      this.bridge('builder');
      const id = this.newId(kind);
      const e = this.storeNew(kind, body.draft, body.enabled ?? true, id, kind === 'scene' ? (body.draft as SceneDraft).name : (body.draft as AutomationDraft).alias);
      this.audited(`${kind === 'automation' ? 'automation' : kind}.create`, e);
      return this.result(e, `op-${this.seq}`);
    });
  }
  private editable(kind: ItemKind, id: string): Entry {
    const e = this.must(kind, id);
    this.mustSee(kind, e);
    if (e.source !== 'ui') this.err(422, 'not_editable');
    return e;
  }
  async replace(kind: ItemKind, id: string, body: WriteBody & { draft: AnyDraft; base_revision: string | null }): Promise<WriteResult> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      this.writeGate(kind);
      this.rate();
      const e = this.editable(kind, id);
      this.checkValid(kind, body.draft, id);
      this.checkControl(this.draftOf(e));
      this.checkControl(body.draft);
      this.firstMissingGrant(body.draft);
      this.checkLocked(body.draft, e, false);
      if (hasUnknownEffects(body.draft) && !body.confirm) this.err(409, 'confirmation_required');
      this.checkRevision(e, body.base_revision);
      this.bridge('builder');
      e.config = draftToConfig(kind, body.draft, e.config, modelCtx());
      e.meta.changedOutside = false;
      this.pushVersion(e, 'arx', this.user.name, 'נערכה');
      this.audited(`${kind}.update`, e);
      return this.result(e, `op-${this.seq}`);
    });
  }
  async putCode(kind: ItemKind, id: string, body: WriteBody & { config: unknown; base_revision: string | null }): Promise<WriteResult> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      this.writeGate(kind);
      if (!this.user.can.code_view) this.err(403, 'code_view_required');
      this.rate();
      const e = this.editable(kind, id);
      if (typeof body.config !== 'object' || body.config === null || Array.isArray(body.config)) this.err(422, 'validation', { errors: [{ path: 'config', code: 'object_required', message: 'התוכן צריך להיות אובייקט' }] });
      const cfg = clone(body.config as Raw);
      const parsed = configToDraft(kind, cfg, modelCtx()).draft;
      if (lockedBlocks(parsed).some((b) => b.reason === 'code')) this.err(422, 'code_not_allowed');
      this.checkValid(kind, parsed, id);
      this.checkControl(parsed);
      this.firstMissingGrant(parsed);
      const profile = saveProfile(parsed, this.draftOf(e));
      if (hasUnknownEffects(parsed) && !body.confirm) this.err(409, 'confirmation_required');
      this.checkRevision(e, body.base_revision);
      this.bridge(profile);
      if (kind !== 'script') cfg.id = e.config?.id ?? e.id;
      e.config = cfg;
      e.meta.changedOutside = false;
      this.pushVersion(e, 'arx', this.user.name, 'נערכה בתצוגת הקוד');
      this.audited(`${kind}.code_edit`, e);
      return this.result(e, `op-${this.seq}`);
    });
  }
  async remove(kind: ItemKind, id: string, body: WriteBody & { base_revision: string | null }): Promise<{ trash_id: string; expires_at: string }> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      this.writeGate(kind);
      this.rate();
      const e = this.editable(kind, id);
      const blocked = this.editBlock(e);
      if (blocked && blocked.code !== 'grant_required') this.err(403, blocked.code === 'delegation_off' ? 'delegation_off' : 'forbidden');
      this.checkRevision(e, body.base_revision);
      this.bridge('builder');
      const draft = this.draftOf(e);
      const now = this.clock();
      const row: TrashEntry = {
        trash_id: `x${++this.seq}${e.id.slice(-4)}`, kind, id: e.id, name: this.itemOf(e).name, sentence: draftSentence(kind, draft, modelCtx()), deleted_at: now.toISOString(),
        expires_at: new Date(now.getTime() + this.settingsValue.trash_days * 86400000).toISOString(), deleted_by: this.user.name,
        sensitive: this.itemOf(e).sensitive, entities: draftTargets(draft), config: clone(e.config!),
      };
      this.trashRows.unshift(row);
      this.entries.delete(this.key(kind, id));
      this.audited(`${kind}.delete`, e);
      return { trash_id: row.trash_id, expires_at: row.expires_at };
    });
  }
  async copy(kind: ItemKind, id: string, body: { name: string; client_request_id: string }): Promise<WriteResult> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      this.writeGate(kind);
      this.rate();
      const src = this.editable(kind, id);
      if (!this.itemOf(src).can.copy && this.editBlock(src)?.code !== 'grant_required') this.err(403, 'forbidden');
      const draft = clone(this.draftOf(src));
      if (kind === 'scene') (draft as SceneDraft).name = body.name; else (draft as AutomationDraft).alias = body.name;
      this.bridge('builder');
      const e = this.storeNew(kind, draft, true, this.newId(kind), body.name, src.config, 'שוכפלה');
      this.audited(`${kind}.copy`, e);
      return this.result(e, `op-${this.seq}`);
    });
  }
  async setEnabled(id: string, enabled: boolean, body: WriteBody): Promise<{ item: Item; changed: boolean }> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      const e = this.must('automation', id);
      this.mustSee('automation', e);
      if (!this.user.can.manage) this.err(403, 'forbidden');
      if (e.source === 'integration') this.err(422, 'not_editable');
      const draft = this.draftOf(e);
      this.checkControl(draft);
      if (enabled) this.firstMissingGrant(draft);
      if (enabled && hasUnknownEffects(draft) && !body.confirm) this.err(409, 'confirmation_required');
      const changed = e.meta.enabled !== enabled;
      e.meta.enabled = enabled;
      this.audited(enabled ? 'automation.enable' : 'automation.disable', e);
      return { item: this.itemOf(e), changed };
    });
  }
  private tooSoon(key: string, seconds: number): void {
    const now = this.clock().getTime();
    const last = this.lastRunAt.get(key);
    if (last !== undefined && now - last < seconds * 1000) this.err(429, 'run_too_soon');
    this.lastRunAt.set(key, now);
  }
  private markRun(e: Entry, result: RunResult): void {
    e.meta.lastRun = { at: this.stamp(), result };
    e.meta.runs7d = (e.meta.runs7d ?? 0) + 1;
  }
  async run(id: string, body: WriteBody & { skip_condition: boolean }): Promise<{ run_id: string | null }> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      const e = this.must('automation', id);
      if (!this.visible(e)) this.err(404, 'item_not_found');
      if (!this.runRight(e)) this.err(403, 'forbidden');
      const draft = this.draftOf(e);
      this.checkControl(draft);
      this.firstMissingGrant(draft);
      const item = this.itemOf(e);
      if ((item.sensitive || item.unknown_effects) && !body.confirm) this.err(409, 'confirmation_required');
      if (item.unknown_effects && !(this.user.can.manage && isInstallationWide(this.user.scope))) this.err(403, 'forbidden');
      this.tooSoon(`automation:${e.id}`, this.settingsValue.limits.run_interval_s);
      const pass = body.skip_condition || this.conditionsPass;
      const runId = `r${e.runs.length + 1}-${this.seq++}`;
      const d = draft as AutomationDraft;
      const tr = this.mkTrace(runId, this.stamp(), pass ? 120 : 3, pass ? 'ok' : 'not_triggered', 'user', this.user.name, 'הרצה ידנית · "הרץ עכשיו"', 'trigger',
        d.conditions.map((c, i) => ({ path: `conditions.${i}`, sentence: c.sentence, passed: body.skip_condition ? null : this.conditionsPass })),
        pass ? d.actions.map((a, i) => ({ path: `actions.${i}`, depth: 0, sentence: a.sentence, result: 'done' as const, ms: 40 })) : [], { skip_condition: body.skip_condition });
      e.runs.unshift(tr);
      this.markRun(e, pass ? 'ok' : 'not_triggered');
      this.audited('automation.run', e);
      return { run_id: runId };
    });
  }
  async runScript(id: string, body: WriteBody & { fields: Record<string, unknown> }): Promise<{ run_id: string | null }> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      const e = this.must('script', id);
      if (!this.visible(e)) this.err(404, 'item_not_found');
      if (!this.user.can.script_run) this.err(403, 'forbidden');
      const draft = this.draftOf(e) as ScriptDraft;
      this.checkControl(draft);
      this.firstMissingGrant(draft);
      const item = this.itemOf(e);
      if ((item.sensitive || item.unknown_effects) && !body.confirm) this.err(409, 'confirmation_required');
      if (item.unknown_effects && !(this.user.can.manage && isInstallationWide(this.user.scope))) this.err(403, 'forbidden');
      const missing = draft.fields.filter((f) => f.required && body.fields[f.key] === undefined && f.default === undefined);
      if (missing.length) this.err(422, 'validation', { errors: missing.map((f) => ({ path: `fields.${f.key}`, code: 'field_required', message: `חסר ${f.name}` })) });
      this.tooSoon(`script:${e.id}`, this.settingsValue.limits.run_interval_s);
      e.meta.running = true;
      this.markRun(e, 'running');
      this.audited('script.run', e);
      return { run_id: `sr-${this.seq++}` };
    });
  }
  async stopScript(id: string, body: WriteBody & { fields?: Record<string, unknown> }): Promise<{ ok: true }> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      const e = this.must('script', id);
      if (!this.visible(e)) this.err(404, 'item_not_found');
      if (!this.user.can.script_run) this.err(403, 'forbidden');
      e.meta.running = false;
      return { ok: true as const };
    });
  }
  async applyScene(id: string, body: WriteBody): Promise<{ run_id: string | null }> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      const e = this.must('scene', id);
      if (!this.visible(e)) this.err(404, 'item_not_found');
      if (e.config) {
        const d = this.draftOf(e) as SceneDraft;
        for (const m of d.members) {
          const p = placeOf(m.entity_id);
          if (!entityInScope(p ?? { floor: null, area: null }, this.user.scope, 'target')) this.err(403, 'entity_not_controllable', { name: nameOf(m.entity_id) });
          if (ENT[m.entity_id]?.cls === 'lock' && !this.user.grants.has(GRANT_OF_CLASS.lock)) this.err(403, 'grant_required', { grant: GRANT_OF_CLASS.lock, path: `members.${m.entity_id}`, name: nameOf(m.entity_id), action: 'שליטה במנעול' });
        }
      }
      this.tooSoon(`scene:${e.id}`, this.settingsValue.limits.scene_apply_interval_s);
      this.markRun(e, 'ok');
      this.audited('scene.run', e);
      return { run_id: null };
    });
  }
  async capture(body: { entity_ids: string[] }): Promise<{ members: SceneMember[] }> {
    this.maybeFail();
    if (!this.user.can.scene_manage) this.err(403, 'forbidden');
    for (const id of body.entity_ids) {
      if (!ENT[id]) continue;
      if (!entityInScope(placeOf(id) ?? { floor: null, area: null }, this.user.scope, 'target')) this.err(403, 'entity_not_controllable', { name: nameOf(id) });
      if (ENT[id].cls === 'lock' && !this.user.grants.has(GRANT_OF_CLASS.lock)) this.err(403, 'grant_required', { grant: GRANT_OF_CLASS.lock, path: id, name: nameOf(id), action: 'שליטה במנעול' });
    }
    const states = body.entity_ids.filter((id) => ENT[id] && (SCENE_CAPTURE_DOMAINS as readonly string[]).includes(catalogDomain(id))).map((id) => ({ entity_id: id, ...(STATES[id] ?? { state: 'off' }) }));
    return { members: captureMembers(states).members };
  }

  // ---- runs, versions, trash, meta, review, settings

  async runs(kind: ItemKind, id: string): Promise<RunSummary[]> {
    const e = this.must(kind, id);
    this.mustSee(kind, e);
    return this.traces(e).map((t) => ({ run_id: t.run_id, at: t.at, finished_at: t.finished_at, result: t.result, sentence: t.sentence }));
  }
  /** Authored traces, else one synthetic run for an item that has a last run. */
  private traces(e: Entry): RunTrace[] {
    if (e.runs.length) return e.runs;
    if (!e.meta.lastRun) return [];
    const draft = this.draftOf(e);
    const steps = 'actions' in draft ? draft.actions : 'sequence' in draft ? draft.sequence : [];
    const tr = this.mkTrace('r1', e.meta.lastRun.at, 120, e.meta.lastRun.result === 'running' ? 'running' : e.meta.lastRun.result, 'automation', null, 'triggers' in draft && draft.triggers[0] ? draft.triggers[0].sentence : 'הרצה', 'triggers.0', [],
      steps.map((s, i) => ({ path: `actions.${i}`, depth: 0, sentence: s.sentence, result: e.meta.lastRun!.result === 'error' && i === 0 ? ('error' as const) : ('done' as const), ms: 40, ...(e.meta.lastRun!.result === 'error' && i === 0 ? { error: 'המכשיר לא נמצא' } : {}) })), null);
    return [tr];
  }
  async runTrace(kind: ItemKind, id: string, runId: string): Promise<RunTrace> {
    const e = this.must(kind, id);
    this.mustSee(kind, e);
    const t = this.traces(e).find((x) => x.run_id === runId);
    if (!t) this.err(404, 'item_not_found');
    return clone(t);
  }
  async versions(kind: ItemKind, id: string): Promise<VersionRow[]> {
    const e = this.must(kind, id);
    this.mustSee(kind, e);
    const last = e.versions.length - 1;
    return e.versions.map((v, i) => ({ version_id: v.version_id, revision: v.revision, at: v.at, via: v.via, actor: v.actor, summary: v.summary, current: i === last })).reverse();
  }
  async restoreVersion(kind: ItemKind, id: string, versionId: string, body: WriteBody & { base_revision: string | null }): Promise<WriteResult> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      this.writeGate(kind);
      this.rate();
      const e = this.editable(kind, id);
      const v = e.versions.find((x) => x.version_id === versionId);
      if (!v) this.err(404, 'item_not_found');
      const parsed = configToDraft(kind, v.config, modelCtx()).draft;
      this.checkControl(parsed);
      this.firstMissingGrant(parsed);
      this.checkRevision(e, body.base_revision);
      this.bridge('builder');
      e.config = clone(v.config);
      this.pushVersion(e, 'arx', this.user.name, 'שוחזרה גרסה');
      this.audited(`${kind}.restore`, e);
      return this.result(e, `op-${this.seq}`);
    });
  }
  async trash(): Promise<TrashRow[]> {
    if (!this.user.can.manage && !this.user.can.scene_manage && !this.user.can.script_manage) this.err(403, 'forbidden');
    return this.trashRows.filter((t) => this.viewRight(t.kind) && t.entities.every((id) => entityInScope(placeOf(id) ?? { floor: null, area: null }, this.user.scope, 'target')))
      .map((t) => ({ trash_id: t.trash_id, kind: t.kind, config_id: t.id, name: t.name, sentence: t.sentence, deleted_at: t.deleted_at, expires_at: t.expires_at, deleted_by: t.deleted_by, sensitive: t.sensitive, entities: t.entities,
        can_restore: manageRight(t.kind, { can: this.user.can }) }));
  }
  async restoreTrash(trashId: string, body: WriteBody): Promise<WriteResult & { id_changed?: boolean }> {
    return this.idem(body.client_request_id, () => {
      this.maybeFail();
      const i = this.trashRows.findIndex((t) => t.trash_id === trashId);
      if (i < 0 || Date.parse(this.trashRows[i].expires_at) < this.clock().getTime()) this.err(404, 'trash_not_found');
      const t = this.trashRows[i];
      this.writeGate(t.kind);
      this.rate();
      const draft = configToDraft(t.kind, t.config, modelCtx()).draft;
      this.checkControl(draft);
      this.firstMissingGrant(draft);
      this.bridge('builder');
      const free = !this.entries.has(this.key(t.kind, t.id));
      const id = free ? t.id : this.newId(t.kind);
      const cfg = clone(t.config);
      if (t.kind !== 'script') cfg.id = id;
      const e: Entry = { kind: t.kind, id, entity: t.kind === 'script' ? `script.${id}` : this.entityFor(t.kind, id, t.name), config: cfg, source: 'ui', meta: { ...DEFAULT_META, createdVia: 'arx', owner: this.user.name, updatedAt: this.stamp() }, versions: [], runs: [] };
      this.entries.set(this.key(t.kind, id), e);
      this.pushVersion(e, 'arx', this.user.name, 'שוחזרה מסל המחזור');
      this.trashRows.splice(i, 1);
      this.audited(`${t.kind}.restore`, e);
      return { ...this.result(e, `op-${this.seq}`), id_changed: !free };
    });
  }
  async purgeTrash(trashId: string): Promise<{ ok: true }> {
    this.maybeFail();
    if (!(this.user.can.manage && isInstallationWide(this.user.scope))) this.err(403, 'forbidden');
    const i = this.trashRows.findIndex((t) => t.trash_id === trashId);
    if (i < 0) this.err(404, 'trash_not_found');
    this.trashRows.splice(i, 1);
    return { ok: true };
  }
  async setMeta(kind: ItemKind, id: string, patch: MetaPatch): Promise<Item> {
    const e = this.must(kind, id);
    this.mustSee(kind, e);
    if (patch.hidden !== undefined && !(this.user.can.manage && isInstallationWide(this.user.scope))) this.err(403, 'forbidden');
    if (patch.pinned !== undefined) e.meta.pinned = patch.pinned;
    if (patch.favourite !== undefined) e.meta.favourite = patch.favourite;
    if (patch.hidden !== undefined) e.meta.hidden = patch.hidden;
    return this.itemOf(e);
  }
  async review(): Promise<ReviewRow[]> {
    if (!(this.user.can.manage && isInstallationWide(this.user.scope))) this.err(403, 'forbidden');
    const rows: ReviewRow[] = [];
    for (const e of this.entries.values()) {
      const i = this.itemOf(e);
      if (i.sensitive && e.meta.changedOutside) rows.push({ kind: e.kind, id: e.id, name: i.name, issue: 'sensitive_external', detail: 'פעולה רגישה שונתה מחוץ למערכת', at: e.meta.updatedAt });
      if (i.state === 'invalid') rows.push({ kind: e.kind, id: e.id, name: i.name, issue: 'invalid', detail: 'שגיאה בהגדרה', at: null });
      for (const t of i.targets.filter((x) => x.missing)) rows.push({ kind: e.kind, id: e.id, name: i.name, issue: 'missing_entity', detail: t.name, at: null });
    }
    for (const a of this.audit.filter((x) => x.delegated)) rows.push({ kind: a.kind, id: a.id, name: a.id, issue: 'delegated_write', detail: `${a.user} · ${a.action}`, at: a.at });
    return rows;
  }
  async settings(): Promise<AutomationSettings> {
    if (!this.user.can.configure) this.err(403, 'forbidden');
    return clone(this.settingsValue);
  }
  async saveSettings(next: AutomationSettings, _from?: AutomationSettings): Promise<AutomationSettings> {
    this.maybeFail();
    if (!this.user.can.configure) this.err(403, 'forbidden');
    const merged = automationSettingsOf({ 'automations.enabled': String(next.enabled), 'automations.code_view_roles': next.code_view_roles, 'automations.trash_days': next.trash_days, 'automations.versions_keep': next.versions_keep,
      'automations.limits': next.limits, 'automations.storm_auto_disable': String(next.storm_auto_disable), 'automations.sensitive_warning': String(next.sensitive_warning), 'automations.templates_enabled': String(next.templates_enabled),
      'automations.templates_hidden': next.templates_hidden, 'automations.templates_order': next.templates_order, 'automations.notify_targets': next.notify_targets, 'automations.ask_when_on_new': String(next.ask_when_on_new),
      'automations.phone_filter': next.phone_filter, 'automations.sensitive_chip': next.sensitive_chip });
    if (merged.trash_days !== next.trash_days || merged.versions_keep !== next.versions_keep) this.err(422, 'validation', { errors: [{ path: merged.trash_days !== next.trash_days ? 'trash_days' : 'versions_keep', code: 'out_of_range', message: 'מחוץ לטווח' }] });
    this.settingsValue = merged;
    return clone(merged);
  }
  /** Spec helper: a draft built from a stored config of the fixture house (typed where possible). */
  draftFor(kind: ItemKind, id: string): AnyDraft { return clone(this.draftOf(this.must(kind, id))); }
  /** Spec helper: validates an action id the way the catalogue would. */
  allows(action: string): boolean { return classifyAction(action, {}).ok; }
  /** Spec helper: the canonical form of the stored config (what the revision hashes). */
  canonical(kind: ItemKind, id: string): string { return canonicalJson(this.must(kind, id).config); }
  /** Spec helper: the one-line summary of a captured member. */
  summary(m: SceneMember): string { return memberSummary(m); }
  /** Spec helper: parse a single raw action with the fixture house's context. */
  parse(raw: unknown) { return parseAction(raw, modelCtx()); }
  /** Known caps (for specs that build over-limit drafts). */
  readonly caps = CAPS;
}

// ---- small tables

/** The sensitive classes a draft touches: typed device calls by service / entity class, plus locked sensitive blocks (alarm calls). */
function sensitiveClassesOf(draft: AnyDraft): SensitiveClass[] {
  const out = new Set<SensitiveClass>();
  for (const w of walkDraft(draft)) {
    const b = w.block;
    if (w.section !== 'action') continue;
    if (b.kind === 'locked') { if (b.sensitive) out.add('alarm'); continue; }
    if ((b as { type: string }).type !== 'service') continue;
    const s = b as Extract<ActionBlock, { type: 'service' }>;
    if (s.role !== 'device') continue;
    for (const id of s.entity_ids.length ? s.entity_ids : ['']) { const c = sensitiveClassOf(s.action, id ? ENT[id]?.cls ?? null : null); if (c) out.add(c); }
  }
  return [...out];
}

const ARGS: Record<string, ActionSpec['args']> = {
  'light.turn_on': [{ key: 'brightness_pct', label: 'בהירות', kind: 'number', min: 1, max: 100, step: 1, unit: '%' }, { key: 'color_temp_kelvin', label: 'טמפרטורת צבע', kind: 'number', min: 2000, max: 6500, step: 100, unit: 'K' }],
  'climate.set_temperature': [{ key: 'temperature', label: 'טמפרטורה', kind: 'number', required: true, min: 16, max: 30, step: 0.5, unit: '°' }],
  'cover.set_cover_position': [{ key: 'position', label: 'מיקום', kind: 'number', required: true, min: 0, max: 100, step: 5, unit: '%' }],
  'media_player.volume_set': [{ key: 'volume_level', label: 'עוצמה', kind: 'number', required: true, min: 0, max: 1, step: 0.05 }],
  'fan.set_percentage': [{ key: 'percentage', label: 'מהירות', kind: 'number', required: true, min: 0, max: 100, step: 10, unit: '%' }],
};
function effectWord(action: string, data: Raw): string | null {
  if (/turn_on$|\.start$/.test(action)) return typeof data.brightness_pct === 'number' ? `דלוק ${data.brightness_pct}%` : 'דלוק';
  if (/turn_off$/.test(action)) return 'כבוי';
  if (/open_cover$/.test(action)) return 'פתוח';
  if (/close_cover$/.test(action)) return 'סגור';
  if (action === 'lock.lock') return 'נעול';
  if (action === 'lock.unlock') return 'פתוח';
  if (/alarm_arm/.test(action)) return 'דרוכה';
  if (/alarm_disarm/.test(action)) return 'מנוטרלת';
  if (action === 'climate.set_temperature' && typeof data.temperature === 'number') return `${data.temperature}°`;
  return null;
}

let store: AutomationsMockStore | null = null;
/** The session's mock store (one per page load; the installer until a spec or the mock bar switches the user). */
export function automationsMock(): AutomationsMockStore {
  return (store ??= new AutomationsMockStore());
}
/** A fresh store (specs). */
export function resetAutomationsMock(opts: MockOptions = {}): AutomationsMockStore {
  store = new AutomationsMockStore(opts);
  return store;
}
