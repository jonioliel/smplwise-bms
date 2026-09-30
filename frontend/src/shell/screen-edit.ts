/**
 * UI round 1c (owner 2026-09-30): the buttons that switch a whole SCREEN into an edit / arrange mode do not live in the
 * screens - they live in the user menu, in the corner, so a user without the permission never sees them and the screens'
 * headers stay clean. A screen that has such a mode registers it while it is on screen:
 *
 *   const off = registerScreenEdit({ id: 'devices-layout', label: 'עריכת פריסה', icon: 'edit', can: () => permitted, run: () => enter() });
 *   ...                                   // connectedCallback
 *   off();                                // disconnectedCallback
 *
 * The shell (sw-app) shows one item per registered action whose `can()` is true when the menu opens, closes the menu (and
 * its history entry, so Back keeps its meaning), then calls `run()`. `can()` is the SAME check the old in-screen button made
 * (never looser; the server still checks the permission on every write) and should be false while the screen is already in
 * its edit mode - the mode has its own bar with save / cancel / exit. The home screen's own contract stays: "עריכת המסך
 * הראשי" opens `#/devices/building?edit=1` (shell/nav.ts isHomeEditRoute), so the home does not register here.
 * Per-item actions (edit a schedule, a rule, a user, a view) are not screen modes and stay where they are.
 */
export interface ScreenEditAction {
  /** Stable id (the menu item's `data-menu-screen-edit`). */
  id: string;
  /** The menu item's text, e.g. "עריכת פריסה", "עריכת מפה". */
  label: string;
  /** sw-icon name; default `edit`. */
  icon?: string;
  /** Who may see it: the screen's own permission check, evaluated whenever the shell renders the menu. */
  can: () => boolean;
  /** Enter the edit mode (the screen's existing entry point). */
  run: () => void;
}

const actions = new Map<string, ScreenEditAction>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** Register a screen's edit mode; returns the function that removes it (call it when the screen leaves). A later
 * registration with the same id replaces the earlier one, and only its own remover takes it out again. */
export function registerScreenEdit(action: ScreenEditAction): () => void {
  actions.set(action.id, action);
  notify();
  return () => {
    if (actions.get(action.id) === action) {
      actions.delete(action.id);
      notify();
    }
  };
}

/** The registered edit modes the current user may enter now, in registration order. */
export function screenEdits(): ScreenEditAction[] {
  return [...actions.values()].filter((a) => {
    try {
      return a.can();
    } catch {
      return false;
    }
  });
}

export function findScreenEdit(id: string): ScreenEditAction | undefined {
  return actions.get(id);
}

export function onScreenEdits(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
