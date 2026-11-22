// CR-CMP2-SELECTS-2450: the keyboard rule of components/sw-segmented.ts, DOM-free (the node unit test reads it).

/** The arrow keys move the focus along the keys (the reading direction decides which arrow is "next"); Home / End jump to the ends.
 * Returns the index to focus, or -1 when the key is not ours. Pure, for the unit test. */
export function segmentedFocusStep(key: string, from: number, enabled: readonly boolean[], rtl: boolean): number {
  const n = enabled.length;
  if (!n) return -1;
  const walk = (start: number, step: number): number => {
    for (let i = 1; i <= n; i += 1) {
      const at = (((start + step * i) % n) + n) % n;
      if (enabled[at]) return at;
    }
    return -1;
  };
  switch (key) {
    case 'ArrowRight':
      return walk(from, rtl ? -1 : 1);
    case 'ArrowLeft':
      return walk(from, rtl ? 1 : -1);
    case 'Home':
      return enabled.indexOf(true);
    case 'End':
      return enabled.lastIndexOf(true);
    default:
      return -1;
  }
}

/** CR-CMP2-SEGMENTED-C-2450: the one key of a `roving` group that sits in the Tab order - the chosen key when it can be used, else the
 * first enabled key (a group whose value names no key, or names a disabled one, stays reachable). -1 when nothing is enabled. */
export function segmentedTabStop(values: readonly string[], value: string, enabled: readonly boolean[]): number {
  const at = values.indexOf(value);
  if (at >= 0 && enabled[at]) return at;
  return enabled.indexOf(true);
}

/** CR-CMP2-TABS-2460 (components/sw-chip-choice.ts): is this chip on? One choice: it is the value; `multi`: it is one of the values. */
export function chipOn(value: string, current: string, multi: boolean, values: readonly string[]): boolean {
  return multi ? values.includes(value) : value === current;
}

/** CR-CMP2-TABS-2460 (components/sw-tabs.ts): the count pill of a tab draws only a real figure - a number (0 included) or a non-empty
 * string; `undefined`, `null` and `''` draw nothing. */
export function tabPillShown(pill: number | string | null | undefined): boolean {
  return pill !== undefined && pill !== null && pill !== '';
}
