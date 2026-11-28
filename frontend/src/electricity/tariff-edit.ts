/**
 * FIX-UTIL-A-2570 (review CU2-08): what saving the tariff dialog of an EXISTING tariff writes. Before, every save posted a price version
 * dated today - a rename alone added a version with the same price, so every later bill period crossing today was split with a "price
 * change" note, and the new name was dropped. Now:
 *   - nothing changed            -> nothing is written;
 *   - only the name changed      -> a rename alone (the prices are not touched);
 *   - the price / mode / hours (or, for a version being corrected, its date) changed -> the version request, the new name travelling
 *     in the same request (the server writes both in one transaction, and neither on a preview or a refusal).
 * Prices are compared as decimal TEXT (trailing zeros ignored), never as floating point.
 */
import type { PriceMode, Tariff, TariffVersion } from '../api/electricity-billing';
import type { TouDefinition } from './elec-tou';

export interface TariffForm {
  name: string;
  price: string;
  mode: PriceMode;
  from: string;
}

export type TariffEditPlan = 'nothing' | 'rename' | 'version';

/** "0.5430" and "0.543" are the same price; "00.5" and "0.5" too. Not a number -> the text as typed (it then differs). */
export function decimalKey(s: string | null | undefined): string {
  const t = (s ?? '').trim();
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(t);
  if (!m || (!m[2] && !m[3])) return t;
  const int = (m[2] ?? '').replace(/^0+(?=\d)/, '') || '0';
  const frac = (m[3] ?? '').replace(/0+$/, '');
  const key = frac ? `${int}.${frac}` : int;
  return key === '0' ? '0' : `${m[1]}${key}`;
}

/** The version that prices `day` (the latest one starting on or before it); the tariff's current version when none does. */
export function versionInForce(t: Tariff, day: string): TariffVersion | null {
  const on = t.versions.filter((v) => v.effective_from <= day).sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  return on[0] ?? t.current ?? null;
}

const defKey = (d: TouDefinition | null | undefined): string => JSON.stringify(d ?? null);

/**
 * @param t the tariff as loaded
 * @param f the form
 * @param corrected the version being corrected (picked from the list), or null for "a price from date X"
 * @param def the time-of-use definition in the editor (time-of-use tariffs only)
 */
export function tariffEditPlan(t: Tariff, f: TariffForm, corrected: TariffVersion | null, def: TouDefinition | null): TariffEditPlan {
  const ref = corrected ?? versionInForce(t, f.from);
  const tou = t.kind === 'tou';
  const valueChanged =
    !ref ||
    f.mode !== ref.price_mode ||
    (tou ? defKey(def) !== defKey(ref.definition) : decimalKey(f.price) !== decimalKey(ref.price)) ||
    (corrected !== null && f.from !== corrected.effective_from);
  if (valueChanged) return 'version';
  return f.name.trim() !== t.name ? 'rename' : 'nothing';
}
