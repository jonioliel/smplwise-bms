/**
 * The intrusion alarm (CR-010, אבטחה › אזעקה): panels with their zones and bypass controls, arm / disarm / bypass, and
 * the code settings. A code the user types travels only in the body of the one request that needs it - never in a URL,
 * never kept in memory after the request (the keypad dialog clears it), never logged.
 */
import { del, get, patch, post, put } from './client';
import { commandId } from './request-id';
import { tr } from '../i18n/msg/api-devices';
import { isoZ } from './day-format';
import type * as Wire from './generated/wire-alarm';

type ArmMode = 'arm_home' | 'arm_away' | 'arm_night' | 'arm_vacation' | 'arm_custom_bypass';
export type AlarmAction = ArmMode | 'disarm';
/** What the user must type for an action: nothing, their personal PIN, the panel's code; or why they cannot. */
export type CodePrompt = Wire.AlarmCodePrompts['arm'];

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/alarm.py), generated into
 * ./generated/wire-alarm.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: the bypass control's domain, the arm modes, `panels` / `redacted` optional (an older server). A zone redacted for this caller
 * (security review M4) sends null for `available` / `open` / `fault` / `bypassed` / `aux` - the generated types say so. */
type ZoneBypass = Omit<Wire.AlarmBypassControl, 'domain'> & { domain: 'switch' | 'select' };

export interface AlarmZone extends Omit<Wire.AlarmZone, 'bypass' | 'panels' | 'redacted'> {
  bypass: ZoneBypass | null;
  /** Every panel that lists this zone (security review M4). */
  panels?: string[];
  /** The caller may not view every panel that lists this shared zone: name only, no state. */
  redacted?: boolean;
}

type UnpairedControl = Wire.AlarmUnpairedControl;

/** A panel of `GET /alarm/panels` (`can`, `panel_code_set`, `code` are answered there; the configuration answers `panel_code` instead). */
export interface AlarmPanel extends Omit<Wire.AlarmPanel, 'device_id' | 'arm_modes' | 'zones' | 'unpaired_controls' | 'can' | 'panel_code_set' | 'code' | 'panel_code'> {
  /** the platform's device of the panel (the demo store has none) */
  device_id?: string | null;
  arm_modes: ArmMode[];
  zones: AlarmZone[];
  unpaired_controls: UnpairedControl[];
  can: Wire.AlarmPanelCan;
  panel_code_set: boolean;
  code: Wire.AlarmCodePrompts;
  /** settings view only */
  panel_code?: Wire.AlarmPanelCodeInfo;
}

export type AlarmPanels = Omit<Wire.AlarmPanels, 'panels' | 'sync'> & { panels: AlarmPanel[] };

export type CodePolicy = Wire.AlarmMe['arm_policy'];

export const alarmPanels = () => get<AlarmPanels>('alarm/panels');

function envelope() {
  return { client_request_id: commandId(), expires_at: isoZ(Date.now() + 60_000) };
}

/** The device-action record (wire: AlarmAction); narrowed: the record's status values. */
type AlarmActionRecord = Pick<Wire.AlarmAction, 'id' | 'entity_id' | 'action_id' | 'error' | 'expected_state' | 'note'> & {
  status: 'pending' | 'confirmed' | 'unknown' | 'failed' | 'denied';
};

/** Arm or disarm. `code` is sent only when given, in the body. */
export function panelAction(entityId: string, action: AlarmAction, opts: { confirmed?: boolean; code?: string } = {}) {
  const body: Record<string, unknown> = { action, confirmed: !!opts.confirmed, ...envelope() };
  if (opts.code) body.code = opts.code;
  return post<AlarmActionRecord>(`alarm/panels/${encodeURIComponent(entityId)}/actions`, body);
}

export function zoneBypass(zoneEntityId: string, bypassed: boolean, opts: { confirmed?: boolean; code?: string } = {}) {
  const body: Record<string, unknown> = { bypassed, confirmed: !!opts.confirmed, ...envelope() };
  if (opts.code) body.code = opts.code;
  return post<AlarmActionRecord>(`alarm/zones/${encodeURIComponent(zoneEntityId)}/bypass`, body);
}

// ---- the caller's own code settings
export const alarmMe = () => get<Wire.AlarmMe>('alarm/me');
/** Change the own PIN (with the current one), or set the FIRST one with a stored panel code (security review M3). */
export function setMyPin(pin: string, currentPin?: string, panelCode?: string) {
  const body: Record<string, unknown> = { pin };
  if (currentPin) body.current_pin = currentPin;
  if (panelCode) body.panel_code = panelCode;
  return put<Wire.AlarmPinSet>('alarm/me/pin', body);
}

// ---- administration (system.configure)
type AlarmOverride = Wire.AlarmOverride;
/** `GET /alarm/config`: its panels carry `panel_code`, not the caller's `can` / `code` (those are answered by `GET /alarm/panels`). */
export type ConfigPanel = Omit<AlarmPanel, 'can' | 'panel_code_set' | 'code'> & Partial<Pick<AlarmPanel, 'can' | 'panel_code_set' | 'code'>>;
export interface AlarmConfig extends Omit<Wire.AlarmConfig, 'panels' | 'fallback_controls' | 'not_alarm' | 'settings'> {
  panels: ConfigPanel[];
  /** Bypass-like controls held because their config entry is unknown, and those released as "not an alarm control". */
  fallback_controls?: string[];
  not_alarm?: string[];
  settings: Omit<Wire.AlarmSettings, 'pin_min_length'> & Partial<Pick<Wire.AlarmSettings, 'pin_min_length'>>;
}
export const alarmConfig = () => get<AlarmConfig>('alarm/config');
export const putOverride = (zone: string, body: { panel_entity_id?: string | null; bypass_entity_id?: string | null; excluded?: boolean; confirm_not_bypass_like?: boolean }) =>
  put<AlarmOverride>(`alarm/overrides/${encodeURIComponent(zone)}`, body);
export const deleteOverride = (zone: string) => del(`alarm/overrides/${encodeURIComponent(zone)}`);
/** Final review item 3: mark a switch / select "אינו רכיב אזעקה" (or take the mark back). */
export const setNotAlarm = (entityId: string, notAlarm: boolean) =>
  put<Wire.AlarmNotAlarm>(`alarm/controls/${encodeURIComponent(entityId)}/not-alarm`, { not_alarm: notAlarm });
export const setPanelCode = (panel: string, code: string) => put<Wire.AlarmPanelCode>(`alarm/panels/${encodeURIComponent(panel)}/code`, { code });
export const clearPanelCode = (panel: string) => del(`alarm/panels/${encodeURIComponent(panel)}/code`);
export const alarmSettingsPatch = (changes: Record<string, string>) => patch<unknown>('settings', changes);

export type UserAlarmPolicy = Wire.AlarmUserPolicy;
export const userAlarmPolicy = (userId: string) => get<UserAlarmPolicy>(`alarm/users/${encodeURIComponent(userId)}`);
/** `currentPin`: required when administrators change their OWN policy or PIN (security review M3). */
export const setUserAlarmPolicy = (userId: string, body: { arm_policy?: CodePolicy; disarm_policy?: CodePolicy; current_pin?: string }) => put<UserAlarmPolicy>(`alarm/users/${encodeURIComponent(userId)}/policy`, body);
export const setUserPin = (userId: string, pin: string, currentPin?: string) => put<UserAlarmPolicy>(`alarm/users/${encodeURIComponent(userId)}/pin`, currentPin ? { pin, current_pin: currentPin } : { pin });
export const clearUserPin = (userId: string) => del(`alarm/users/${encodeURIComponent(userId)}/pin`);

// ---- words
export const ARM_LABEL: Record<AlarmAction, string> = {
  arm_away: tr('דריכה מלאה'),
  arm_home: tr('דריכה חלקית'),
  arm_night: tr('דריכת לילה'),
  arm_vacation: tr('דריכת חופשה'),
  arm_custom_bypass: tr('דריכה עם עקיפה'),
  disarm: tr('נטרול'),
};

/** The panel's state in words, with its tone (the header card's colour). */
export function panelState(state: string | null, available = true): { label: string; tone: 'disarmed' | 'armed' | 'partial' | 'pending' | 'triggered' | 'offline' } {
  if (!available || state === null || state === 'unavailable' || state === 'unknown') return { label: tr('לא זמינה'), tone: 'offline' };
  switch (state) {
    case 'disarmed':
      return { label: tr('מנוטרלת'), tone: 'disarmed' };
    case 'armed_away':
      return { label: tr('מופעלת מלאה'), tone: 'armed' };
    case 'armed_home':
      return { label: tr('מופעלת חלקית'), tone: 'partial' };
    case 'armed_night':
      return { label: tr('מופעלת · לילה'), tone: 'partial' };
    case 'armed_vacation':
      return { label: tr('מופעלת · חופשה'), tone: 'armed' };
    case 'armed_custom_bypass':
      return { label: tr('מופעלת · עם עקיפות'), tone: 'partial' };
    case 'arming':
      return { label: tr('בהשהיית יציאה'), tone: 'pending' };
    case 'pending':
      return { label: tr('בהשהיית כניסה'), tone: 'pending' };
    case 'triggered':
      return { label: tr('אזעקה!'), tone: 'triggered' };
    default:
      return { label: state, tone: 'offline' };
  }
}

/** A zone's state in words: עקוף / תקלה / פתוח / סגור / תנועה ... */
export function zoneState(z: AlarmZone): { label: string; tone: 'ok' | 'open' | 'fault' | 'bypassed' | 'motion' } {
  if (z.redacted) return { label: tr('משותף למחיצה שאינה בהרשאתך'), tone: 'ok' };
  if (z.bypassed) return { label: tr('עקוף'), tone: 'bypassed' };
  if (!z.available) return { label: tr('תקלה · לא זמין'), tone: 'fault' };
  if (z.fault) return { label: tr('תקלה'), tone: 'fault' };
  if (z.kind === 'motion') return z.open ? { label: tr('תנועה'), tone: 'motion' } : { label: tr('שקט'), tone: 'ok' };
  return z.open ? { label: tr('פתוח'), tone: 'open' } : { label: tr('סגור'), tone: 'ok' };
}

export const CODE_ERROR_LABEL: Record<string, string> = {
  wrong_code: tr('קוד שגוי'),
  code_locked: tr('יותר מדי ניסיונות שגויים - הקוד ננעל לזמן קצר'),
  rate_limited: tr('יותר מדי ניסיונות - נסו שוב בעוד כמה דקות'),
  code_rejected: tr('הלוח דחה את הקוד או את הפקודה'),
  pin_not_set: tr('עדיין אין לך קוד אישי - פנה למנהל המערכת לקבלת קוד אישי'),
  pin_by_admin: tr('פנה למנהל המערכת לקבלת קוד אישי'),
  own_change_by_other_admin: tr('את המדיניות והקוד שלך משנה מנהל מערכת אחר, או אתה עם הקוד האישי הנוכחי'),
  own_pin_by_other_admin: tr('את הקוד האישי שלך מוחק מנהל מערכת אחר'),
  code_unverifiable: tr('לא הוגדר קוד לוח לאימות'),
};
