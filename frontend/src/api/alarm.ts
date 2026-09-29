/**
 * The intrusion alarm (CR-010, אבטחה › אזעקה): panels with their zones and bypass controls, arm / disarm / bypass, and
 * the code settings. A code the user types travels only in the body of the one request that needs it - never in a URL,
 * never kept in memory after the request (the keypad dialog clears it), never logged.
 */
import { del, get, patch, post, put } from './client';
import { commandId } from './request-id';

export type ArmMode = 'arm_home' | 'arm_away' | 'arm_night' | 'arm_vacation' | 'arm_custom_bypass';
export type AlarmAction = ArmMode | 'disarm';
/** What the user must type for an action: nothing, their personal PIN, the panel's code; or why they cannot. */
export type CodePrompt = 'none' | 'pin' | 'panel' | 'unverifiable' | 'pin_missing';

export interface ZoneBypass {
  entity_id: string;
  domain: 'switch' | 'select';
  name: string;
  state: string | null;
  available: boolean;
  bypassed: boolean | null;
  strategy: string;
  on_option: string | null;
  off_option: string | null;
}

export interface AlarmZone {
  entity_id: string;
  name: string;
  platform: string | null;
  device_class: string | null;
  kind: 'opening' | 'motion' | 'fault' | 'zone' | 'other';
  state: string | null;
  available: boolean;
  open: boolean;
  fault: boolean;
  tamper: boolean | null;
  battery_low: boolean | null;
  battery_level: number | null;
  alarmed: boolean | null;
  bypassed: boolean;
  last_changed: string | null;
  area_id: string | null;
  area_name: string | null;
  ha_floor_name: string | null;
  zone_number: number | null;
  aux: string[];
  shared: boolean;
  bypass: ZoneBypass | null;
}

export interface UnpairedControl {
  entity_id: string;
  domain: string;
  name: string;
  state: string | null;
  bypassed: boolean | null;
}

export interface AlarmPanel {
  entity_id: string;
  name: string;
  platform: string | null;
  integration: string;
  integration_note: string;
  config_entry_id: string | null;
  state: string | null;
  available: boolean;
  fresh: boolean;
  last_changed: string | null;
  changed_by: string | null;
  arm_modes: ArmMode[];
  features_reported: boolean;
  code_format: 'number' | 'text' | null;
  code_arm_required: boolean;
  needs_code_arm: boolean;
  needs_code_disarm: boolean;
  area_name: string | null;
  open_sensors: string[];
  bypassed_sensors: string[];
  zones: AlarmZone[];
  unpaired_controls: UnpairedControl[];
  ready: { ready: boolean; open: string[]; faults: string[] };
  can: { arm: boolean; disarm: boolean; bypass: boolean; restore: boolean };
  panel_code_set: boolean;
  code: { arm: CodePrompt; disarm: CodePrompt; bypass: CodePrompt };
  /** settings view only */
  panel_code?: { set: boolean; set_at: string | null; set_by: string | null };
}

export interface AlarmPanels {
  panels: AlarmPanel[];
  counts: { panels: number; zones: number; open: number; bypassed: number; faults: number };
  channel: 'local' | 'remote';
  remote: { control: boolean; disarm: boolean; codeless: boolean };
  code_mode: 'personal_pin' | 'panel_code';
  me: { arm_policy: CodePolicy; disarm_policy: CodePolicy; pin_set: boolean };
  can_configure: boolean;
}

export type CodePolicy = 'no_code' | 'code_required';

export const alarmPanels = () => get<AlarmPanels>('alarm/panels');

function envelope() {
  return { client_request_id: commandId(), expires_at: new Date(Date.now() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z') };
}

export interface AlarmActionRecord {
  id: string;
  entity_id: string;
  action_id: string;
  status: 'pending' | 'confirmed' | 'unknown' | 'failed' | 'denied';
  error: string | null;
  expected_state?: string | null;
  note?: string | null;
}

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
export const alarmMe = () => get<{ arm_policy: CodePolicy; disarm_policy: CodePolicy; pin_set: boolean; pin_set_at: string | null; code_mode: string }>('alarm/me');
export function setMyPin(pin: string, currentPin?: string) {
  const body: Record<string, unknown> = { pin };
  if (currentPin) body.current_pin = currentPin;
  return put<{ pin_set: boolean; pin_set_at: string | null }>('alarm/me/pin', body);
}

// ---- administration (system.configure)
export interface AlarmOverride {
  zone_entity_id: string;
  panel_entity_id: string | null;
  bypass_entity_id: string | null;
  excluded: number;
  updated_at: string;
  updated_by: string | null;
}
export interface EntityBrief {
  entity_id: string;
  name: string;
  platform: string | null;
  domain: string;
}
export interface AlarmConfig {
  panels: AlarmPanel[];
  excluded: string[];
  overrides: AlarmOverride[];
  candidates: { controls: EntityBrief[]; sensors: EntityBrief[] };
  integrations: Record<string, { label: string; note: string; verified: boolean }>;
  settings: { remote_control: boolean; remote_disarm: boolean; remote_codeless: boolean; code_mode: 'personal_pin' | 'panel_code' };
}
export const alarmConfig = () => get<AlarmConfig>('alarm/config');
export const putOverride = (zone: string, body: { panel_entity_id?: string | null; bypass_entity_id?: string | null; excluded?: boolean }) =>
  put<AlarmOverride>(`alarm/overrides/${encodeURIComponent(zone)}`, body);
export const deleteOverride = (zone: string) => del(`alarm/overrides/${encodeURIComponent(zone)}`);
export const setPanelCode = (panel: string, code: string) => put<{ panel_code: { set: boolean; set_at: string | null; set_by: string | null } }>(`alarm/panels/${encodeURIComponent(panel)}/code`, { code });
export const clearPanelCode = (panel: string) => del(`alarm/panels/${encodeURIComponent(panel)}/code`);
export const alarmSettingsPatch = (changes: Record<string, string>) => patch<unknown>('settings', changes);

export interface UserAlarmPolicy {
  user_id: string;
  arm_policy: CodePolicy;
  disarm_policy: CodePolicy;
  pin_set: boolean;
  pin_set_at: string | null;
  pin_set_by: string | null;
  code_mode?: string;
}
export const userAlarmPolicy = (userId: string) => get<UserAlarmPolicy>(`alarm/users/${encodeURIComponent(userId)}`);
export const setUserAlarmPolicy = (userId: string, body: { arm_policy?: CodePolicy; disarm_policy?: CodePolicy }) => put<UserAlarmPolicy>(`alarm/users/${encodeURIComponent(userId)}/policy`, body);
export const setUserPin = (userId: string, pin: string) => put<UserAlarmPolicy>(`alarm/users/${encodeURIComponent(userId)}/pin`, { pin });
export const clearUserPin = (userId: string) => del(`alarm/users/${encodeURIComponent(userId)}/pin`);

// ---- words
export const ARM_LABEL: Record<AlarmAction, string> = {
  arm_away: 'דריכה מלאה',
  arm_home: 'דריכה חלקית',
  arm_night: 'דריכת לילה',
  arm_vacation: 'דריכת חופשה',
  arm_custom_bypass: 'דריכה עם עקיפה',
  disarm: 'נטרול',
};

/** The panel's state in words, with its tone (the header card's colour). */
export function panelState(state: string | null, available = true): { label: string; tone: 'disarmed' | 'armed' | 'partial' | 'pending' | 'triggered' | 'offline' } {
  if (!available || state === null || state === 'unavailable' || state === 'unknown') return { label: 'לא זמינה', tone: 'offline' };
  switch (state) {
    case 'disarmed':
      return { label: 'מנוטרלת', tone: 'disarmed' };
    case 'armed_away':
      return { label: 'מופעלת מלאה', tone: 'armed' };
    case 'armed_home':
      return { label: 'מופעלת חלקית', tone: 'partial' };
    case 'armed_night':
      return { label: 'מופעלת · לילה', tone: 'partial' };
    case 'armed_vacation':
      return { label: 'מופעלת · חופשה', tone: 'armed' };
    case 'armed_custom_bypass':
      return { label: 'מופעלת · עם עקיפות', tone: 'partial' };
    case 'arming':
      return { label: 'בהשהיית יציאה', tone: 'pending' };
    case 'pending':
      return { label: 'בהשהיית כניסה', tone: 'pending' };
    case 'triggered':
      return { label: 'אזעקה!', tone: 'triggered' };
    default:
      return { label: state, tone: 'offline' };
  }
}

/** A zone's state in words: עקוף / תקלה / פתוח / סגור / תנועה ... */
export function zoneState(z: AlarmZone): { label: string; tone: 'ok' | 'open' | 'fault' | 'bypassed' | 'motion' } {
  if (z.bypassed) return { label: 'עקוף', tone: 'bypassed' };
  if (!z.available) return { label: 'תקלה · לא זמין', tone: 'fault' };
  if (z.fault) return { label: 'תקלה', tone: 'fault' };
  if (z.kind === 'motion') return z.open ? { label: 'תנועה', tone: 'motion' } : { label: 'שקט', tone: 'ok' };
  return z.open ? { label: 'פתוח', tone: 'open' } : { label: 'סגור', tone: 'ok' };
}

export const CODE_ERROR_LABEL: Record<string, string> = {
  wrong_code: 'קוד שגוי',
  code_locked: 'יותר מדי ניסיונות שגויים - הקוד ננעל לזמן קצר',
  rate_limited: 'יותר מדי ניסיונות - נסו שוב בעוד כמה דקות',
  code_rejected: 'הלוח דחה את הקוד או את הפקודה',
  pin_not_set: 'עדיין אין לך קוד אישי',
  code_unverifiable: 'לא הוגדר קוד לוח לאימות',
};
