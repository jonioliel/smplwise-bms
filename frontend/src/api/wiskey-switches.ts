/**
 * SWITCHUI-295: the typed calls and the pure rules of the "access-control reads" switches screen (routers/wiskey_switches.py).
 * The server decides everything (system administrator + system.configure, the closed key list, the go-live permit); nothing here
 * grants anything. A go-live permit is never sent and never named: the screen only shows whether the build carries one.
 */
import { ApiError, get, put } from './client';

export type SwitchState = 'off' | 'on';

export interface SwitchesView {
  switches: Record<string, SwitchState>;
  go_live_permitted: boolean;
}

/** The four switches in the order shown (the same closed list as services/wiskey_switches.py SWITCHES). */
export const SWITCH_KEYS = ['wiskey.acr5_access_state', 'wiskey.acr5_normalize_user', 'wiskey.acr5_presence', 'wiskey.acr5_feature_plans'] as const;
export type SwitchKey = (typeof SWITCH_KEYS)[number];

/** The i18n key stem of a switch's plain-language title and one-line description. */
export const SWITCH_STEM: Record<SwitchKey, 'access' | 'schedule' | 'presence' | 'plans'> = {
  'wiskey.acr5_access_state': 'access',
  'wiskey.acr5_normalize_user': 'schedule',
  'wiskey.acr5_presence': 'presence',
  'wiskey.acr5_feature_plans': 'plans',
};

export const getSwitches = () => get<SwitchesView>('wiskey/switches');
export const putSwitch = (key: SwitchKey, value: SwitchState) => put<SwitchesView>('wiskey/switches', { switches: { [key]: value } });

/** Turning a switch ON is offered only while the build carries the go-live permit; turning it OFF is always allowed. */
export function canTurnOn(view: Pick<SwitchesView, 'go_live_permitted'>): boolean {
  return view.go_live_permitted === true;
}

export type RefusalKind = 'permit' | 'forbidden' | 'invalid' | 'other';

/** The closed refusals of the route, as the screen words them (never the server's text, never the caller's key). */
export function refusalKind(err: unknown): RefusalKind {
  if (!(err instanceof ApiError)) return 'other';
  if (err.code === 'wiskey_not_permitted' || err.status === 409) return 'permit';
  if (err.status === 403) return 'forbidden';
  if (err.status === 422) return 'invalid';
  return 'other';
}

/** The state of one switch; anything the server did not send reads off. */
export const stateOf = (view: SwitchesView | null, key: SwitchKey): SwitchState => (view?.switches?.[key] === 'on' ? 'on' : 'off');
