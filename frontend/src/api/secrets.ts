/** TKSECRETS2: the in-app secrets store (הגדרות › חיבורים › סודות) - the secrets that used to be add-on options of type `password`.
 * Every route needs `system.configure` and none exists on the remote channel. A value is WRITE-ONLY: no answer ever carries it. */
import { api, get, post, put } from './client';

export type SecretName = 'go2rtc_api_password' | 'wiskey_password' | 'wiskey_background_token' | 'openai_api_key' | 'push_relay_key'
  | 'ha_users_token' // USR1-263: the optional home-system users administrator token (store-only, never an add-on option)
  | 'announce_cloud_key' // ANNOUNCE-295: the optional cloud speech engine's key (store-only; the engine is OFF by default)
  | 'announce_translate_key'; // ANNOUNCE-297: the optional automatic-translation provider's key (store-only; translation is OFF by default)

/** set | not_set | unreadable (a stored row decides) · legacy (no row yet: the old add-on option or a developer variable is in use). */
export type SecretState = 'set' | 'not_set' | 'unreadable' | 'legacy';

export interface SecretStatus {
  name: SecretName | string;
  label_he: string;
  label_en: string;
  /** a background service picks a change up at the next start */
  restart_required: boolean;
  testable: boolean;
  configured: boolean;
  state: SecretState;
  /** ui | addon_import (a row) · addon_option | environment (no row) · null */
  source: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
}

export interface SecretsList {
  secrets: SecretStatus[];
  in_addon: boolean;
}

export interface SecretChange {
  restart_required: boolean;
  secret: SecretStatus;
}

export interface SecretTest {
  ok: boolean;
  code: string;
}

export const listSecrets = () => get<SecretsList>('system/secrets');
export const saveSecret = (name: string, value: string) => put<SecretChange>(`system/secrets/${encodeURIComponent(name)}`, { value });
export const clearSecret = (name: string) => api<SecretChange>(`system/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' });
/** `value` = a typed candidate (tested, never stored); absent = the stored value. */
export const testSecret = (name: string, value?: string) => post<SecretTest>(`system/secrets/${encodeURIComponent(name)}/test`, value === undefined ? {} : { value });

export const SECRET_TEST_LABEL: Record<string, string> = {
  ok: 'החיבור תקין',
  unauthorized: 'go2rtc דחה את הסיסמה',
  unreachable: 'go2rtc לא ענה',
  error: 'go2rtc החזיר שגיאה',
  not_configured: 'כתובת go2rtc לא הוגדרה',
  username_missing: 'שם המשתמש לא הוגדר בהגדרות החיבור של ההתקנה',
  wiskey_unavailable: 'נתוני WisKey אינם זמינים כרגע',
  no_station: 'אין עמדה מחוברת עם מצלמה שמשתמשת בחשבון המשותף',
  station_failed: 'לא התקבלה תמונה מהעמדה (סיסמה שגויה או מצלמה שלא ענתה)',
  go2rtc_unauthorized: 'go2rtc דחה את פרטי הגישה שלו',
};
