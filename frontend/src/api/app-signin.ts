/**
 * PUSH-GOLIVE-KIT-2380 follow-up (release/2380-train): the two switches of the phone app's sign-in in Settings › גישה מרחוק - until 2.38 the
 * field-test script (docs/operations/MOBILE_FIELD_TEST_HE.md, part B) set them from the browser console. GET / PUT `auth/app/settings`
 * (routers/app_refresh.py, services/app_refresh.update_settings):
 *  - `security.app_refresh` (saved sign-in in the app, APPREFRESH-295) - off | on;
 *  - `security.app_session_exchange` (the app screen signs in by a one-time code, SESSIONEXCH2-295) - off | on; needs the saved sign-in on,
 *    and the access-token lifetime (`security.app_refresh_access_minutes`) at most 15 minutes while it is on (422 otherwise).
 * The route's rules, mirrored here so the card never offers what the server refuses: a system administrator only (403 otherwise); ON only
 * from the local channel (403 `local_channel_only` on the remote channel), OFF from either channel; OFF of the saved sign-in ends every
 * phone's saved sign-in at once, OFF of the exchange ends the app-screen sessions. Pure model + the two calls.
 */
import { get, put } from './client';

export const APP_REFRESH_KEY = 'security.app_refresh';
export const APP_EXCHANGE_KEY = 'security.app_session_exchange';
export const APP_ACCESS_KEY = 'security.app_refresh_access_minutes';
/** services/app_session.ACCESS_MAX_WHILE_ON */
export const EXCHANGE_ACCESS_MAX = 15;

export interface AppSignIn { refresh: boolean; exchange: boolean; accessMinutes: number }
export type AppSwitch = 'refresh' | 'exchange';
export const APP_SIGNIN_OFF: AppSignIn = { refresh: false, exchange: false, accessMinutes: 10 };

/** The route's `settings` document as the card's state (a missing / unknown value = off; the access lifetime's factory value is 10). */
export function appSignInOf(raw: Record<string, unknown> | null | undefined): AppSignIn {
  const r = raw ?? {};
  const m = r[APP_ACCESS_KEY];
  return { refresh: r[APP_REFRESH_KEY] === 'on', exchange: r[APP_EXCHANGE_KEY] === 'on', accessMinutes: typeof m === 'number' && Number.isInteger(m) ? m : APP_SIGNIN_OFF.accessMinutes };
}

/** One switch set in the draft. Turning the saved sign-in off turns the exchange off too (it cannot work without it). */
export function setAppSwitch(d: AppSignIn, sw: AppSwitch, on: boolean): AppSignIn {
  if (sw === 'refresh') return { ...d, refresh: on, exchange: on ? d.exchange : false };
  return { ...d, exchange: on };
}

/** Is the "on" key of a switch closed? On the remote channel a switch that is saved off cannot be turned on (the route answers 403). */
export function onLocked(saved: AppSignIn, sw: AppSwitch, remote: boolean): boolean {
  return remote && !saved[sw];
}

export type AppSignInProblem = 'remote_on' | 'exchange_needs_refresh' | 'access_too_long';
/** What the server would refuse for this draft, checked before the save (the order is the route's). */
export function appSignInProblem(saved: AppSignIn, d: AppSignIn, remote: boolean): AppSignInProblem | null {
  if (remote && ((d.refresh && !saved.refresh) || (d.exchange && !saved.exchange))) return 'remote_on';
  if (d.exchange && !saved.exchange && !d.refresh) return 'exchange_needs_refresh'; // the route refuses turning it ON without the saved sign-in
  if (d.exchange && d.accessMinutes > EXCHANGE_ACCESS_MAX) return 'access_too_long';
  return null;
}

/** The PUT body: only the switches that changed, as 'on' / 'off'. */
export function appSignInBody(saved: AppSignIn, d: AppSignIn): Record<string, 'on' | 'off'> {
  const out: Record<string, 'on' | 'off'> = {};
  if (saved.refresh !== d.refresh) out[APP_REFRESH_KEY] = d.refresh ? 'on' : 'off';
  if (saved.exchange !== d.exchange) out[APP_EXCHANGE_KEY] = d.exchange ? 'on' : 'off';
  return out;
}

/** Which sign-ins a save ends at once (the confirmation names them): every phone's saved sign-in, the app-screen sessions, or nothing. */
export function appSignInEnds(saved: AppSignIn, d: AppSignIn): AppSwitch[] {
  const out: AppSwitch[] = [];
  if (saved.refresh && !d.refresh) out.push('refresh');
  if (saved.exchange && !d.exchange) out.push('exchange');
  return out;
}

export const getAppSignIn = () => get<{ settings: Record<string, unknown> }>('auth/app/settings');
export const putAppSignIn = (body: Record<string, 'on' | 'off'>) => put<{ settings: Record<string, unknown>; families_ended: number }>('auth/app/settings', body);
