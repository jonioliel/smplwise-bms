/**
 * CR-QUIET103 + APP-SERVER-LEFTOVERS-2380: the settings of the quiet window (one button on a floor / area header holds the informational
 * notifications for a while). GET / PUT `quiet/settings` (`services/quiet_windows.py`): five string settings, PUT by `system.configure`
 * with `confirmed: true`, 422 on an unknown key / bad value / a default longer than the maximum. Pure model + the two calls; the card is
 * screens/system-quiet-windows.ts.
 *
 * `quiet.windows.channels` (APP-SERVER-LEFTOVERS-2380, owner Q-3): `push` (default) = the window holds only the phone / browser push
 * (web push + the phone app); email, WhatsApp and announcements are delivered as if no window existed. `all` = every channel is held
 * (the behaviour before 2.38). The notification inbox keeps everything either way.
 */
import { get, put } from './client';

export type QuietChannels = 'push' | 'all';
export const QUIET_CHANNELS: readonly QuietChannels[] = ['push', 'all'];
export const QW_KEYS = {
  enabled: 'quiet.windows.enabled',
  default_minutes: 'quiet.windows.default_minutes',
  max_minutes: 'quiet.windows.max_minutes',
  mute_alerts: 'quiet.windows.mute_alerts',
  channels: 'quiet.windows.channels',
} as const;
export type QwField = keyof typeof QW_KEYS;
/** The server's range of both durations (minutes). */
export const QW_MINUTES: readonly [number, number] = [5, 720];

export interface QuietWindowSettings { enabled: boolean; default_minutes: number; max_minutes: number; mute_alerts: boolean; channels: QuietChannels }
/** The factory values (the server's `SETTINGS` defaults). */
export const QW_DEFAULTS: QuietWindowSettings = { enabled: false, default_minutes: 120, max_minutes: 240, mute_alerts: false, channels: 'push' };

const minutesOf = (v: unknown, d: number): number => {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= QW_MINUTES[0] && n <= QW_MINUTES[1] ? n : d;
};

/** The API's string map as the card's values; a missing / bad value reads as the factory value (an older backend has no `channels`). */
export function qwFromApi(raw: Record<string, unknown> | null | undefined): QuietWindowSettings {
  const r = raw ?? {};
  return {
    enabled: r[QW_KEYS.enabled] === 'on',
    default_minutes: minutesOf(r[QW_KEYS.default_minutes], QW_DEFAULTS.default_minutes),
    max_minutes: minutesOf(r[QW_KEYS.max_minutes], QW_DEFAULTS.max_minutes),
    mute_alerts: r[QW_KEYS.mute_alerts] === 'on',
    channels: r[QW_KEYS.channels] === 'all' ? 'all' : 'push',
  };
}

const wire = (f: QwField, s: QuietWindowSettings): string => {
  const v = s[f];
  return typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v);
};

/** The PUT `changes` map: only the keys whose value differs from the saved one, as the server's strings. */
export function qwChanges(saved: QuietWindowSettings, draft: QuietWindowSettings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of Object.keys(QW_KEYS) as QwField[]) if (wire(f, saved) !== wire(f, draft)) out[QW_KEYS[f]] = wire(f, draft);
  return out;
}

export type QwProblem = 'range' | 'default_over_max';
/** What the server would refuse (422), checked before the save. */
export function qwProblem(d: QuietWindowSettings): QwProblem | null {
  const ok = (n: number) => Number.isInteger(n) && n >= QW_MINUTES[0] && n <= QW_MINUTES[1];
  if (!ok(d.default_minutes) || !ok(d.max_minutes)) return 'range';
  return d.default_minutes > d.max_minutes ? 'default_over_max' : null;
}

/** Switching the feature off ends every open window at once (reason `switched_off`): the confirmation says so. */
export const qwEndsWindows = (saved: QuietWindowSettings, draft: QuietWindowSettings): boolean => saved.enabled && !draft.enabled;

export const getQuietSettings = () => get<{ settings: Record<string, string> }>('quiet/settings');
/** `confirmed: true` is sent only from the card's confirmation dialog. */
export const putQuietSettings = (changes: Record<string, string>) => put<{ settings: Record<string, string>; changed: string[] }>('quiet/settings', { changes, confirmed: true });
