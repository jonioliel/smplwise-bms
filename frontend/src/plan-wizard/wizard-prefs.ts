/**
 * PLAN3D-R28-WIZARD-2433: the user's own choices for the plan wizard (/me/prefs `plan.wizard`, services/user_prefs.py). Pure and
 * tiny on purpose (PLAN3D-R32-ANSWERS-2438): the settings card "מפה תלת־ממדית" reads and writes the same value without pulling the
 * wizard's model (geometry, candidates) into the settings chunk. wizard-model.ts re-exports everything here.
 */

/** PLAN3D-R32-ANSWERS-2438 (owner round 32, Q-MAP-10 a): the six kits of the mockup, in its order. */
export const KIT_IDS = ['apartment', 'office', 'lobby', 'technical', 'commercial', 'empty'] as const;
export type KitId = (typeof KIT_IDS)[number];
export const KIT_HE: Readonly<Record<KitId, string>> = { apartment: 'דירה', office: 'משרד', lobby: 'לובי ושטחים ציבוריים', technical: 'טכני וחניון', commercial: 'מסחרי', empty: 'ריק' };
export type Unreviewed = 'as_detected' | 'reject';
export interface WizardPrefs {
  /** Percent: an item at or above it goes in without review. */
  auto_accept: number;
  /** Percent: under it an item never goes in without an explicit approval. */
  review_min: number;
  /** What an item between the two becomes when nobody looked at it. */
  unreviewed: Unreviewed;
  kit: KitId;
  furniture: boolean;
  auto_place: boolean;
}

/** The owner's answers (round 32, Q-MAP-9 a, confirming round 28's recommendation): >80% in, 50-80% marked for review and in as
 * detected when skipped, <50% only with an approval; the apartment kit first. */
export const WIZARD_DEFAULTS: Readonly<WizardPrefs> = { auto_accept: 80, review_min: 50, unreviewed: 'as_detected', kit: 'apartment', furniture: true, auto_place: true };

const pct = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 5 && v <= 99 ? v : null);

/** Any stored value in its full form: every key present, a bad value is the default, the thresholds stay ordered. */
export function normalizePrefs(raw: unknown): WizardPrefs {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: WizardPrefs = { ...WIZARD_DEFAULTS };
  out.auto_accept = pct(o.auto_accept) ?? out.auto_accept;
  out.review_min = pct(o.review_min) ?? out.review_min;
  if (out.review_min >= out.auto_accept) {
    out.auto_accept = WIZARD_DEFAULTS.auto_accept;
    out.review_min = WIZARD_DEFAULTS.review_min;
  }
  if (o.unreviewed === 'as_detected' || o.unreviewed === 'reject') out.unreviewed = o.unreviewed;
  if (typeof o.kit === 'string' && (KIT_IDS as readonly string[]).includes(o.kit)) out.kit = o.kit as KitId;
  if (typeof o.furniture === 'boolean') out.furniture = o.furniture;
  if (typeof o.auto_place === 'boolean') out.auto_place = o.auto_place;
  return out;
}
