/**
 * CR-NAV-LABELS-2436 (review 08:F02): the two names the personal home sheet (shell/sw-home-personal.ts) needs from the elevators
 * model - the display-mode key of each mode and the user's own hidden list - in a module of their own, so the shell no longer pulls
 * the whole of elevators/model.ts into the entry chunk. elevators/model.ts re-exports all three; behaviour is unchanged.
 * Type-only imports: no code of another module comes with it.
 */
import type { ElevatorMode } from '../api/home-config';
import type { EltKey } from '../i18n/elevators';

/** The words of the three display modes of the home widget (elt keys). */
export const MODE_KEY: Record<ElevatorMode, EltKey> = { combined: 'modeCombined', cards: 'modeCards', both: 'modeBoth' };

/** A list with `id` added (on) or removed (off), order kept, no duplicates. */
export function toggled<T extends string>(list: readonly T[], id: T, on: boolean): T[] {
  return on ? (list.includes(id) ? [...list] : [...list, id]) : list.filter((x) => x !== id);
}

/** Review L5: the user's own hidden list after ticking (shown = true) or unticking one elevator; it is ADDED to the installation's list on the
 * server, so it only ever holds the user's own choices. */
export const personalHidden = (mine: readonly string[], id: string, shown: boolean): string[] => toggled(mine, id, !shown);
