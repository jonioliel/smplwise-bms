/**
 * CR-036 S12 (section 6.2): the parity report of the Settings page "בקרת כניסה" - `GET access-control/parity`. Per native screen the
 * server reads the same intercom command twice (unfiltered, and through the screen's own read for the report's subject) and answers
 * with counts, a keyed digest per side and the outcome; never a name, an id or a value. `access.admin.read` for every station;
 * `as_user` (another Arx user's view) needs `system.configure` as well. Asked only on the administrator's button: one report costs
 * up to about 30 reads of the integration.
 */
import { api } from './client';
import type { StatusHead } from './access-status';

export const PARITY_SCREENS = ['stations', 'people', 'events', 'groups', 'schedules', 'alerts'] as const;
export type ParityScreen = (typeof PARITY_SCREENS)[number];
export const PARITY_OUTCOMES = ['match', 'filtered', 'mismatch', 'partial', 'not_permitted', 'unsupported', 'unavailable'] as const;
export type ParityOutcome = (typeof PARITY_OUTCOMES)[number];

export interface ParitySide {
  count: number | null;
  /** False: the side stopped at its scan cap (no verdict). */
  complete: boolean;
  /** A keyed digest of the side's ids (comparable inside one report only); null when the side is not complete. */
  digest: string | null;
}

export interface ParityRow {
  screen: ParityScreen | string;
  feature: string | null;
  permission: string;
  /** The native screen's route. */
  route: string;
  /** The unfiltered read; null when it was not asked (unsupported) or did not answer. */
  source: ParitySide | null;
  /** What the projection rules leave of the source for the subject. */
  expected_count: number | null;
  /** The native view; null when the subject may not open the screen. */
  native: ParitySide | null;
  outcome: ParityOutcome | string;
  /** The rule that filtered: station_scope / installation_wide / permission. */
  rule: string | null;
  /** A machine code for unsupported / unavailable. */
  reason: string | null;
}

export interface ParityReport {
  window_hours: number;
  window: { start: string; end: string };
  subject: { user_id: string; display_name: string; self: boolean };
  screens: ParityRow[];
  summary: Record<string, number>;
}

export interface ParityReply extends StatusHead {
  parity: ParityReport | null;
}

export interface ParityQuery {
  asUser?: string;
  hours?: number;
}

export function parityQueryString(o: ParityQuery): string {
  const qs = new URLSearchParams();
  if (o.asUser) qs.set('as_user', o.asUser);
  qs.set('hours', String(o.hours ?? 24));
  return qs.toString();
}

export const getParity = (o: ParityQuery = {}, signal?: AbortSignal) => api<ParityReply>(`access-control/parity?${parityQueryString(o)}`, { signal });
