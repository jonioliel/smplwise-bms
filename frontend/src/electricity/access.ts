/**
 * Who may do what in the electricity module (CR-023 section 14). The screens only SHAPE themselves from this; the server enforces every
 * permission and strips money from every answer for a caller without `energy.bills`.
 *   view   energy.view    meters, kWh, account status without money
 *   bills  energy.bills   money, bills, customers
 *   manage energy.manage  configure meters, accounts, customers, prices
 *   system system.configure the retention values
 * Without a backend (static preview) everything is shown; `?perm=view` in the hash route turns the demo into the view-only user.
 */
import { canAnywhere, isApi, onSession } from '../api/session';

export interface EnergyAccess {
  view: boolean;
  bills: boolean;
  manage: boolean;
  system: boolean;
}

export const ENERGY_PERMISSIONS = ['energy.view', 'energy.bills', 'energy.manage'] as const;

export function energyAccess(): EnergyAccess {
  if (!isApi()) {
    const viewOnly = typeof window !== 'undefined' && /[?&]perm=view\b/.test(window.location.hash);
    return viewOnly ? { view: true, bills: false, manage: false, system: false } : { view: true, bills: true, manage: true, system: true };
  }
  return { view: canAnywhere('energy.view'), bills: canAnywhere('energy.bills'), manage: canAnywhere('energy.manage'), system: canAnywhere('system.configure') };
}

/** Calls `fn` now and whenever the session (and so the permissions) changes. Returns the stop function. */
export function onEnergyAccess(fn: (a: EnergyAccess) => void): () => void {
  return onSession(() => fn(energyAccess()));
}
