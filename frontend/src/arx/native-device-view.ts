import type { DeviceStatus } from './native-app';
import { t, type I18nKey } from '../i18n/he';

/** MOBILE214: the plain-language rows of the "המכשיר שלי" card (pure, so a node test can read them). */
export interface DeviceRow {
  key: string;
  label: string;
  value: string;
}

const SENSOR_LABELS: Record<string, string> = {
  activity: 'פעילות',
  steps: 'צעדים',
  altitude: 'גובה',
  battery: 'סוללה',
  network: 'רשת',
  beacon: 'משואה',
  app_state: 'מצב האפליקציה',
  location: 'מיקום',
};

const AUTH: Record<string, I18nKey> = {
  always: 'nativeDevice.authAlways',
  when_in_use: 'nativeDevice.authWhenInUse',
  denied: 'nativeDevice.authDenied',
  not_determined: 'nativeDevice.authNotDetermined',
};

const SENSOR_STATE: Record<string, I18nKey> = {
  on: 'nativeDevice.sensorOn',
  off: 'nativeDevice.sensorOff',
  unavailable: 'nativeDevice.sensorUnavailable',
};

export function sensorLabel(key: string): string {
  return SENSOR_LABELS[key] ?? key;
}

export function sensorState(value: string): string {
  const k = SENSOR_STATE[value];
  return k ? t(k) : value;
}

export function locationAuthText(v: string | null): string {
  if (v === null) return t('nativeDevice.unknown');
  const k = AUTH[v];
  return k ? t(k) : v;
}

/** An ISO instant as local date and time; anything unreadable is shown as received. */
export function lastEventText(iso: string | null, locale = 'he-IL'): string {
  if (iso === null) return t('nativeDevice.never');
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleString(locale);
}

export function deviceRows(d: DeviceStatus, locale = 'he-IL'): DeviceRow[] {
  const rows: DeviceRow[] = [
    { key: 'status', label: t('nativeDevice.status'), value: d.registered ? t('nativeDevice.registered') : t('nativeDevice.notRegistered') },
  ];
  if (!d.registered) return rows;
  rows.push({ key: 'name', label: t('nativeDevice.name'), value: d.name ?? t('nativeDevice.unknown') });
  rows.push({ key: 'location_auth', label: t('nativeDevice.locationAuth'), value: locationAuthText(d.location_auth) });
  rows.push({ key: 'precise', label: t('nativeDevice.precise'), value: d.precise === null ? t('nativeDevice.unknown') : d.precise ? t('nativeDevice.yes') : t('nativeDevice.no') });
  rows.push({ key: 'last_event_at', label: t('nativeDevice.lastEvent'), value: lastEventText(d.last_event_at, locale) });
  if (d.sensors) {
    for (const [k, v] of Object.entries(d.sensors)) rows.push({ key: `sensor:${k}`, label: `${t('nativeDevice.sensors')}: ${sensorLabel(k)}`, value: sensorState(v) });
  }
  return rows;
}
