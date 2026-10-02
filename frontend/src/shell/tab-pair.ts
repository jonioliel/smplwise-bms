/**
 * Release 0.1.153: the "pair". On the phone, in the dropdown form, the page chrome shows its TWO levels (the area's tabs / the
 * security sections and pages, and the screen's own filter: the areas of a floor, the rooms of the multimedia pages) as two
 * compact chips side by side in ONE row, each opening its own listbox. The first level is the shell's (sw-app); the second belongs to
 * the screen, which only publishes it here - the shell draws it, so both chips share one row, one sticky block and one height.
 * A screen publishes in its dropdown form only (shell/tabs-mode.ts) and clears it when it leaves.
 */
import type { DropdownItem } from '../components/sw-dropdown';

export interface PairChip {
  /** The accessible name of the chip (the list's name: "חדרים"). */
  label: string;
  items: DropdownItem[];
  value: string;
  /** Called with the chosen item's id (the screen navigates or filters). */
  onPick: (id: string) => void;
}

let owner: object | null = null;
let chip: PairChip | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** The second chip now published, or null. */
export function pairChip(): PairChip | null {
  return chip;
}

export function onPairChip(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function same(a: PairChip | null, b: PairChip | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.label === b.label && a.value === b.value && JSON.stringify(a.items) === JSON.stringify(b.items);
}

/** A screen publishes (or refreshes) its chip. The shell is told only when something visible changed. */
export function publishPairChip(who: object, next: PairChip): void {
  const changed = owner !== who || !same(chip, next);
  owner = who;
  chip = next;
  if (changed) notify();
}

/** A screen withdraws its chip (it left, or its mode is not the dropdown form any more). Only the publisher can clear it. */
export function clearPairChip(who: object): void {
  if (owner !== who) return;
  owner = null;
  chip = null;
  notify();
}
