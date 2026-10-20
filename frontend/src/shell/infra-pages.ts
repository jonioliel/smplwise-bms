import type { TabItem } from '../components/sw-tabs';
import type { DropdownItem } from '../components/sw-dropdown';
import type { PairChip } from './tab-pair';
import { HYBRID_MAX_ITEMS, type TabMode } from './tabs-mode';

/**
 * 2.9.2 (owner 2026-10-20): the page row of an infrastructure screen (גנרטור: מצב חי / התראות פעילות / גרפים / היסטוריה; מוני חשמל: מונים /
 * חשבונות / ...) follows the tab presentation mode of its group (`area`, shell/tabs-mode.ts) like every other tab row. In the dropdown form
 * (always in `dropdown`, in `hybrid` for a list longer than HYBRID_MAX_ITEMS) the screen does not draw the row itself: it publishes the
 * pages as the pair's second chip (shell/tab-pair.ts) and the shell draws it in the header row, after the area's chip (on the visual left in
 * RTL). Plain data, no Lit: tests/unit-infra-pages.spec.ts.
 */

/** Whether a page row of `count` items is drawn as the shell's second chip. */
export function infraPagesAsChip(mode: TabMode, count: number): boolean {
  if (count < 2) return false;
  return mode === 'dropdown' || (mode === 'hybrid' && count > HYBRID_MAX_ITEMS);
}

/** The pair chip for an infrastructure screen's page row: the same items (a count becomes the item's count), the active page as the value. */
export function infraPagesChip(label: string, items: readonly TabItem[], active: string, onPick: (id: string) => void): PairChip {
  const list: DropdownItem[] = items.map((t) => ({ id: t.id, label: t.label, ...(t.count ? { count: t.count } : {}) }));
  return { group: 'area', label, items: list, value: active, onPick };
}
