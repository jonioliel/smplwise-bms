/** HAND-SWITCH-2480: the new value in a sw-toggle's `change` handler (the switch that replaced a check box read `e.target.checked`).
 * Decorator-free on purpose (RELEASE-2480-TRAIN): render-helper modules that Node-side unit specs import (`screens/plan-studio-panel.ts`)
 * read it from here, so loading them does not load the decorated `sw-toggle` element ("Unsupported decorator location: field"). The
 * element itself is registered app-wide by the shell. `components/sw-toggle.ts` re-exports it for every other caller. */
export function toggled(e: Event): boolean {
  // HONEST-STATES-2540: a `controlled` sw-toggle has not moved when its `change` fires - the asked value is in `detail.checked` (an
  // uncontrolled one carries the same value there; a native check box's event has no detail and reads its own `checked`)
  const asked = (e as Partial<CustomEvent<{ checked?: unknown }>>).detail?.checked;
  return typeof asked === 'boolean' ? asked : (e.target as EventTarget & { checked: boolean }).checked;
}
