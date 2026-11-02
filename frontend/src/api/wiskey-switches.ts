/**
 * SWITCHUI-295: the typed calls and the pure rules of the "access-control reads" switches screen (routers/wiskey_switches.py).
 * The server decides everything (system administrator + system.configure, the closed key list, the go-live permit); nothing here
 * grants anything. A go-live permit is never sent and never named: the screen only shows whether the build carries one.
 * WISKEY-RC7-ADOPT-2331 S1 (WisKey M12 policy B): the same route also carries the owner's automatic-installation switch
 * (`wiskey.auto_install`, default off) with its own build permit (`auto_install_permitted`); while the build refuses it, ON is not offered.
 */
import { ApiError, get, put } from './client';

export type SwitchState = 'off' | 'on';

export interface SwitchesView {
  switches: Record<string, SwitchState>;
  go_live_permitted: boolean;
  /** S1: whether this build lets the owner turn the automatic installation on (absent = no). */
  auto_install_permitted?: boolean;
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

/** S1: the owner's automatic-installation switch - a separate entry, not one of the four reads. */
export const INSTALL_KEY = 'wiskey.auto_install' as const;
export type AnySwitchKey = SwitchKey | typeof INSTALL_KEY;

export const getSwitches = () => get<SwitchesView>('wiskey/switches');
export const putSwitch = (key: AnySwitchKey, value: SwitchState) => put<SwitchesView>('wiskey/switches', { switches: { [key]: value } });

/** Turning a switch ON is offered only while the build carries the go-live permit; turning it OFF is always allowed. */
export function canTurnOn(view: Pick<SwitchesView, 'go_live_permitted'>): boolean {
  return view.go_live_permitted === true;
}

/** S1: the automatic installation can be turned on only while the build permits it; anything but `true` is no. */
export function canTurnOnInstall(view: Pick<SwitchesView, 'auto_install_permitted'>): boolean {
  return view.auto_install_permitted === true;
}

export type RefusalKind = 'installPermit' | 'permit' | 'forbidden' | 'invalid' | 'other';

/** The closed refusals of the route, as the screen words them (never the server's text, never the caller's key). */
export function refusalKind(err: unknown): RefusalKind {
  if (!(err instanceof ApiError)) return 'other';
  if (err.code === 'auto_install_not_permitted') return 'installPermit';
  if (err.code === 'wiskey_not_permitted' || err.status === 409) return 'permit';
  if (err.status === 403) return 'forbidden';
  if (err.status === 422) return 'invalid';
  return 'other';
}

/** The state of one switch; anything the server did not send reads off. */
export const stateOf = (view: SwitchesView | null, key: AnySwitchKey): SwitchState => (view?.switches?.[key] === 'on' ? 'on' : 'off');
