/**
 * SHARED-CHECKBOX-2480: the pure state rules of the shared check box (components/sw-checkbox.ts), apart from Lit so the node unit specs
 * read them (tests/unit-sw-checkbox-2480.spec.ts).
 */

/** What a check box holds: on / off, and the "some of them" mark of a select-all box. */
export interface CheckState {
  checked: boolean;
  indeterminate: boolean;
}

/** The `aria-checked` value of a state: the mixed mark wins over `checked`, as on a native box. */
export function ariaChecked(s: CheckState): 'true' | 'false' | 'mixed' {
  if (s.indeterminate) return 'mixed';
  return s.checked ? 'true' : 'false';
}

/** The state after one press: a mixed box becomes checked (the native rule), any other box flips. */
export function pressed(s: CheckState): CheckState {
  if (s.indeterminate) return { checked: true, indeterminate: false };
  return { checked: !s.checked, indeterminate: false };
}

/**
 * The select-all box of a list or table: checked when every row is chosen, mixed when some are, empty when none are (or there is
 * nothing to choose). `selected` above `total` (a stale count) reads as all.
 */
export function selectAllState(selected: number, total: number): CheckState {
  if (total <= 0 || selected <= 0) return { checked: false, indeterminate: false };
  if (selected >= total) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

/** The new value inside a sw-checkbox `change` handler (what `(e.target as HTMLInputElement).checked` read on a native box). */
export function checkedOf(e: Event): boolean {
  const detail = (e as CustomEvent<{ checked?: unknown }>).detail;
  if (detail && typeof detail.checked === 'boolean') return detail.checked;
  return !!(e.target as { checked?: unknown } | null)?.checked;
}
