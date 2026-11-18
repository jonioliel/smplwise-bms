import { personalRowOf, type AreaRowPersonal } from '../api/area-row';
import { describeError } from '../api/client';
import { personalOf, type HomePersonal } from '../api/home';
import { getMyPrefs } from '../api/me-prefs';

/**
 * CR-UI-POLISH-2443: the first read of "החשבון שלי › המסך שלי" (sw-home-personal.ts), apart from the Lit element so the node
 * unit spec runs it without a DOM (tests/unit-home-personal-first-read-2443.spec.ts).
 */

/** The user's own stored choices, as the editor needs them. */
interface OwnChoices {
  personal: HomePersonal;
  row: AreaRowPersonal;
}

/** No stored choice at all: the demo mode, and a user who never chose. */
export const noChoices = (): OwnChoices => ({ personal: personalOf(null), row: {} });

/**
 * The user's own home choices and area-row choices from ONE read of /me/prefs - and a read that fails REJECTS. The readers the
 * other screens use (api/home.ts loadPersonal, api/area-row.ts loadPersonalRow) answer "no choices" on a failure, which is right
 * where the choices are only applied. The editor must not: it would show the installation's defaults as if nothing was stored,
 * and the next change saves the whole value (PUT /me/prefs `home.personal`), replacing the stored choices it could not read.
 */
export async function readOwnChoices(read: () => Promise<{ prefs: Record<string, unknown> }> = getMyPrefs): Promise<OwnChoices> {
  const { prefs } = await read();
  return { personal: personalOf(prefs['home.personal']), row: personalRowOf(prefs['devices.area_row']) };
}

/**
 * Runs the first reads of a section that paints nothing until its data arrived and hands their answer to `apply`. Never
 * rejects: the answer is '' when the data was applied, otherwise the reason (`describeError`) of the read that failed - or of a
 * fault while applying - for the section's own error note.
 */
export async function firstRead<T>(reads: () => Promise<T>, apply: (value: T) => void): Promise<string> {
  try {
    apply(await reads());
    return '';
  } catch (err) {
    return describeError(err);
  }
}
