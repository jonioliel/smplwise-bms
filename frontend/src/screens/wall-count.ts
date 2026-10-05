/**
 * How many cameras the live wall shows (LV1, owner request 2026-10-05). The ladder is a fixed set of steps cut off at the number of
 * cameras the user may see on the wall (every recorder, camera scope and disabled recorders already applied by the caller), plus a
 * final "all" option. Pure logic: unit-tested without a page.
 */
export const COUNT_STEPS: readonly number[] = [1, 2, 4, 6, 8, 9, 12, 16, 20, 25, 32, 40, 48, 64, 80, 100];
/** The stored / in-memory value of "all". */
export const COUNT_ALL = 9999;
export const COUNT_ALL_ID = 'all';

/** Steps strictly below the total: the total itself is what "all" means. An unknown / zero total offers no numeric step. */
export function countLadder(total: number): number[] {
  return COUNT_STEPS.filter((n) => n < total);
}

/** The option id the dropdown / buttons mark as chosen: a ladder step, or "all" when the choice is the whole wall or more. */
export function countChoiceId(count: number, total: number): string {
  if (count >= total || count === COUNT_ALL || !countLadder(total).includes(count)) return COUNT_ALL_ID;
  return String(count);
}

/** How many tiles to render: the chosen count capped by what exists. */
export function effectiveCount(count: number, total: number): number {
  return Math.max(1, Math.min(count === COUNT_ALL ? total : count, Math.max(total, 1)));
}

export function parseCountId(id: string): number {
  return id === COUNT_ALL_ID ? COUNT_ALL : Number(id) || 0;
}

/** A persisted value (this browser's last choice, or the installation default) back to a count; 0 = not usable. */
export function parseStoredCount(raw: string | null | undefined): number {
  if (raw === COUNT_ALL_ID) return COUNT_ALL;
  const n = Number(raw ?? 0);
  return COUNT_STEPS.includes(n) ? n : 0;
}

export const storeCount = (n: number): string => (n === COUNT_ALL ? COUNT_ALL_ID : String(n));

export const COLUMN_CHOICES: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
