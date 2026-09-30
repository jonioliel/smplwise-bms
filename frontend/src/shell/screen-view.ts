/**
 * Home redesign follow-up (owner idea, 2026-09-30): a screen's own VIEW choice (the home screen's "כרטיסים | אריחים") does not
 * take a row of the page - it lives in the user menu as a compact "תצוגה" item with an inline two-option control. A screen
 * that has such a choice registers it while it is on screen, next to shell/screen-edit.ts's edit modes:
 *
 *   const off = registerScreenView({ id: 'devices-layout-view', label: 'תצוגה', options: [{ value: 'cards', label: 'כרטיסים' }, ...],
 *                                    value: () => this.layout, set: (v) => this.setLayout(v), can: () => !this.editing });
 *   ...                                   // connectedCallback
 *   off();                                // disconnectedCallback
 *   notifyScreenViews();                  // whenever the value changed from inside the screen
 *
 * The shell shows one item per registered choice whose `can()` is true when the menu opens, and calls `set()` on a pick; the
 * menu stays open so the person sees the screen change. Persistence stays the screen's own (the home screen keeps its
 * per-browser choice and the installation's `devices.default_view`).
 */
export interface ScreenViewOption {
  value: string;
  label: string;
}

export interface ScreenViewAction {
  /** Stable id (the menu item's `data-menu-screen-view`). */
  id: string;
  /** The item's text, e.g. "תצוגה". */
  label: string;
  /** sw-icon name; default `layers`. */
  icon?: string;
  /** Two (or more) options, in the order shown. */
  options: ScreenViewOption[];
  /** The current value (read whenever the shell renders the menu). */
  value: () => string;
  /** Apply a picked value. */
  set: (value: string) => void;
  /** Whether the choice is offered now (default: always while registered). */
  can?: () => boolean;
}

const views = new Map<string, ScreenViewAction>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** Register a screen's view choice; returns the function that removes it (call it when the screen leaves). */
export function registerScreenView(action: ScreenViewAction): () => void {
  views.set(action.id, action);
  notify();
  return () => {
    if (views.get(action.id) === action) {
      views.delete(action.id);
      notify();
    }
  };
}

/** The registered choices that are offered now, with their current value. */
export function screenViews(): (Omit<ScreenViewAction, 'value' | 'set' | 'can'> & { current: string })[] {
  const out: (Omit<ScreenViewAction, 'value' | 'set' | 'can'> & { current: string })[] = [];
  for (const a of views.values()) {
    try {
      if (a.can && !a.can()) continue;
      out.push({ id: a.id, label: a.label, icon: a.icon, options: a.options, current: a.value() });
    } catch {
      /* a screen that is going away */
    }
  }
  return out;
}

export function findScreenView(id: string): ScreenViewAction | undefined {
  return views.get(id);
}

/** The value changed from inside the screen (or `can()` did): the open menu re-reads it. */
export function notifyScreenViews(): void {
  notify();
}

export function onScreenViews(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
