/** HAND-SWITCH-2480: the new value in a sw-toggle's `change` handler (the switch that replaced a check box read `e.target.checked`).
 * Decorator-free on purpose (RELEASE-2480-TRAIN): render-helper modules that Node-side unit specs import (`screens/plan-studio-panel.ts`)
 * read it from here, so loading them does not load the decorated `sw-toggle` element ("Unsupported decorator location: field"). The
 * element itself is registered app-wide by the shell. `components/sw-toggle.ts` re-exports it for every other caller. */
export function toggled(e: Event): boolean {
  return (e.target as EventTarget & { checked: boolean }).checked;
}
