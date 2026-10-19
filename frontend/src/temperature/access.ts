/**
 * CR-INFRA-TEMPERATURE 2.9.1: who may do what with the temperature units in the frontend (the server checks every call again).
 *   view    devices.read                the Infrastructure tab (scoped by the units' sensors on the server)
 *   ack     infra.temperature.ack       acknowledge alerts, mute a unit's warnings (operator and above)
 *   manage  infra.temperature.manage    page edit mode: add / edit / delete units, the learned defrost windows; Settings › תשתיות › טמפרטורות
 * The tab appears once the server lists at least one unit for the viewer - or, for a manager, always (that is where units are added).
 */
import { canAnywhere, isApi, onSession } from '../api/session';
import { listUnits, type UnitsResponse } from '../api/temperature';
import { applyInfraTemperature } from '../shell/nav';

export const TEMPERATURE_MANAGE = 'infra.temperature.manage';
export const TEMPERATURE_ACK = 'infra.temperature.ack';

export interface TemperatureAccess {
  view: boolean;
  ack: boolean;
  manage: boolean;
}

export function temperatureAccess(): TemperatureAccess {
  if (!isApi()) return { view: false, ack: false, manage: false };
  return { view: canAnywhere('devices.read'), ack: canAnywhere(TEMPERATURE_ACK), manage: canAnywhere(TEMPERATURE_MANAGE) };
}

export function onTemperatureAccess(fn: (a: TemperatureAccess) => void): () => void {
  return onSession(() => fn(temperatureAccess()));
}

/** Asked once when the shell loads (and after a change): a failed read hides the tab (never an error banner on a module the installation may not use). */
export async function refreshTemperatureVisibility(): Promise<UnitsResponse | null> {
  const a = temperatureAccess();
  if (!a.view) {
    applyInfraTemperature(false);
    return null;
  }
  try {
    const r = await listUnits(false);
    applyInfraTemperature(r.units.length > 0 || a.manage);
    return r;
  } catch {
    applyInfraTemperature(a.manage);
    return null;
  }
}
