/**
 * Who may do what in the electricity module (CR-023 section 14): the ONE source of truth of the three energy permissions in the frontend - their
 * ids, their Hebrew labels (the roles screen's rows, src/electricity/permission-rows.ts and src/screens/system-access.ts) and the caller's access
 * (every electricity screen, both UI halves). The screens only SHAPE themselves from this; the server enforces every permission and strips money
 * from every answer for a caller without `energy.bills`.
 *   view   energy.view    meters, kWh, account status without money
 *   bills  energy.bills   money, bills, customers
 *   manage energy.manage  configure meters, accounts, customers, prices
 *   system system.configure the retention values
 * Without a backend (static preview, design review, the Playwright harness) everything is shown, except for a demo persona: `?perm=view` in the
 * hash route, or `persona` in localStorage `sw.demo.electricity` (`view` | `bills_only` | `full`, the billing mock's control).
 */
import { canAnywhere, isApi, onSession } from '../api/session';

export interface EnergyAccess {
  view: boolean;
  bills: boolean;
  manage: boolean;
  system: boolean;
}

export const ENERGY_PERMISSIONS = ['energy.view', 'energy.bills', 'energy.manage'] as const;
export type EnergyPermission = (typeof ENERGY_PERMISSIONS)[number];

/** Hebrew labels of the electricity permissions: the fallback while the server's role catalogue carries none of its own. */
export const ENERGY_PERMISSION_LABELS: Record<EnergyPermission, string> = {
  'energy.view': 'צפייה במונים ובצריכה',
  'energy.bills': 'חיובים: סכומים, לקוחות, הפקה וביטול',
  'energy.manage': 'ניהול מונים, חשבונות, לקוחות ומחירים',
};

/** The label of any permission id when it is an energy one (undefined otherwise), for label lookups keyed by a plain string. */
export const energyPermissionLabel = (id: string): string | undefined => (ENERGY_PERMISSION_LABELS as Record<string, string>)[id];

function demoPersona(): 'full' | 'view' | 'bills_only' {
  if (typeof window === 'undefined') return 'full';
  if (/[?&]perm=view\b/.test(window.location.hash)) return 'view';
  try {
    const p = (JSON.parse(localStorage.getItem('sw.demo.electricity') || '{}') as { persona?: string }).persona;
    return p === 'view' || p === 'bills_only' ? p : 'full';
  } catch {
    return 'full';
  }
}

export function energyAccess(): EnergyAccess {
  if (!isApi()) {
    const p = demoPersona();
    return { view: true, bills: p !== 'view', manage: p === 'full', system: p === 'full' };
  }
  return { view: canAnywhere('energy.view'), bills: canAnywhere('energy.bills'), manage: canAnywhere('energy.manage'), system: canAnywhere('system.configure') };
}

/** Calls `fn` now and whenever the session (and so the permissions) changes. Returns the stop function. */
export function onEnergyAccess(fn: (a: EnergyAccess) => void): () => void {
  return onSession(() => fn(energyAccess()));
}
