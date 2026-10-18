/**
 * CR-INFRA-ELEVATORS: who may do what with the elevators in the frontend.
 *   view    devices.read             the Infrastructure tab and the home tiles (the server scopes them by the floors of the linked sensors)
 *   manage  infra.elevators.manage   Settings › תשתיות › מעליות (define, link sensors, order, delete)
 * The tab and the home tiles exist only once the server lists at least one elevator for the viewer: no elevators = no change anywhere.
 */
import { canAnywhere, isApi, onSession } from '../api/session';
import { listElevators, type ElevatorsResponse } from '../api/elevators';
import { applyInfraElevators } from '../shell/nav';

export const ELEVATORS_MANAGE = 'infra.elevators.manage';

export interface ElevatorsAccess {
  view: boolean;
  manage: boolean;
}

export function elevatorsAccess(): ElevatorsAccess {
  if (!isApi()) return { view: false, manage: false };
  return { view: canAnywhere('devices.read'), manage: canAnywhere(ELEVATORS_MANAGE) };
}
export function onElevatorsAccess(fn: (a: ElevatorsAccess) => void): () => void {
  return onSession(() => fn(elevatorsAccess()));
}

/** Asked once when the shell loads (and after a settings change): the tab appears when the viewer sees at least one elevator. A failed read
 * hides it (never an error banner on a module the installation may not have). */
export async function refreshElevatorsVisibility(): Promise<ElevatorsResponse | null> {
  if (!elevatorsAccess().view) {
    applyInfraElevators(false);
    return null;
  }
  try {
    const r = await listElevators();
    applyInfraElevators(r.elevators.length > 0);
    return r;
  } catch {
    applyInfraElevators(false);
    return null;
  }
}
