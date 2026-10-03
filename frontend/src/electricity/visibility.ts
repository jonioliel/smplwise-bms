import { isApi } from '../api/session';
import { listMeters } from '../api/electricity-meters';
import { applyInfraMeters } from '../shell/nav';
import { energyAccess } from './access';

/**
 * CR-023 section 3: "תשתיות" is shown to holders of energy.view only when the installation has at least one meter or the user holds energy.manage
 * (an installation without meters shows nothing). Asked once when the shell loads; a failed read leaves the area visible (never hide on an error).
 */
export async function refreshInfraVisibility(): Promise<void> {
  const a = energyAccess();
  if (!isApi() || !a.view || a.manage) return applyInfraMeters(true);
  try {
    applyInfraMeters((await listMeters()).length > 0);
  } catch {
    applyInfraMeters(true);
  }
}
