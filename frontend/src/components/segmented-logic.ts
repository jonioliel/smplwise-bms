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
