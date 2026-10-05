/**
 * CR-031 GEN1: who may do what on the generator screens - the one source of the two permissions in the frontend (ids, Hebrew labels, the caller's access).
 *   view    generator.view    live screen, charts, alerts, acknowledge and mute
 *   manage  generator.manage  Settings: detection, sensor mapping, thresholds, alert routing (Arx alert settings only: nothing is ever sent to the controller)
 * The tab "גנרטור" under תשתיות is offered to a holder of generator.view when a generator is detected, and to a manager always (setup / detection).
 * Without a backend (static preview) there is no generator and the tab is not offered.
 */
import { canAnywhere, isApi, onSession } from '../api/session';
import { listDevices } from '../api/generator';
import { applyInfraGenerator } from '../shell/nav';

export interface GeneratorAccess {
  view: boolean;
  manage: boolean;
}
export const GENERATOR_PERMISSIONS = ['generator.view', 'generator.manage'] as const;
export const GENERATOR_PERMISSION_LABELS: Record<(typeof GENERATOR_PERMISSIONS)[number], string> = {
  'generator.view': 'צפייה בגנרטור והתראותיו',
  'generator.manage': 'ניהול הגנרטור (זיהוי, מיפוי, ניתוב התראות)',
};
export const generatorPermissionLabel = (id: string): string | undefined => (GENERATOR_PERMISSION_LABELS as Record<string, string>)[id];

export function generatorAccess(): GeneratorAccess {
  if (!isApi()) return { view: false, manage: false };
  return { view: canAnywhere('generator.view'), manage: canAnywhere('generator.manage') };
}
export function onGeneratorAccess(fn: (a: GeneratorAccess) => void): () => void {
  return onSession(() => fn(generatorAccess()));
}

/** Asked once when the shell loads: the generator tab appears when a generator is detected or the user may manage. A failed read hides it for a viewer
 * (never an error banner on an area the installation may not have) and leaves it for a manager. */
export async function refreshGeneratorVisibility(): Promise<void> {
  const a = generatorAccess();
  if (!a.view) return applyInfraGenerator(false);
  if (a.manage) return applyInfraGenerator(true);
  try {
    const r = await listDevices();
    applyInfraGenerator(r.devices.some((d) => d.core_met));
  } catch {
    applyInfraGenerator(false);
  }
}
