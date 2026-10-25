import type { EmergencyState, GrantsView } from '../api/door-windows';

/**
 * EMROLE-295: the pure logic of the emergency-open holders panel. The server is the only authority (who may grant, the longest expiry, the
 * refusals); these helpers only shape what the panel offers and turn the typed expiry into the UTC instant the server expects.
 */

/** The panel is offered to a system administrator or a security manager - exactly what the state says (`can.grant`). */
export function canManageGrants(em: Pick<EmergencyState, 'can'> | null | undefined): boolean {
  return !!em && em.can.grant === true;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DDTHH:mm` in the browser's local time, the value an `<input type="datetime-local">` takes. */
export function localInputValue(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The expiry the panel pre-fills: now plus the default hours; '' when the default is "none" (hours = 0). */
export function defaultExpiryValue(now: Date, hours: number): string {
  return hours > 0 ? localInputValue(new Date(now.getTime() + hours * 3600_000)) : '';
}

/** The typed local date and time as a UTC instant (`...Z`, whole seconds), or null when it is empty or not a date. */
export function expiryToUtc(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const at = new Date(local);
  return Number.isNaN(at.getTime()) ? null : at.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export type GrantProblem = 'person' | 'expiry_required' | 'expiry_past' | 'expiry_too_long' | null;

/** What stops the "give the role" button before any request: the server repeats every one of these checks. */
export function grantProblem(view: Pick<GrantsView, 'can_no_expiry' | 'max_hours'>, person: string, local: string, noExpiry: boolean, now: Date): GrantProblem {
  if (!person) return 'person';
  if (noExpiry) return view.can_no_expiry ? null : 'expiry_required';
  const iso = expiryToUtc(local);
  if (!iso) return 'expiry_required';
  const at = new Date(iso).getTime();
  if (at <= now.getTime()) return 'expiry_past';
  if (!view.can_no_expiry && at > now.getTime() + view.max_hours * 3600_000) return 'expiry_too_long';
  return null;
}
