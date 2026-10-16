/**
 * TK259: the handler page's look. The installation chooses `public.theme` (light by default, dark, or auto = follow the device); the
 * vendor may flip it on his own phone with a small toggle in the header, and that choice is remembered in THIS browser only
 * (localStorage, the one place the page uses it - every access in try/catch: a private tab or blocked storage just forgets it).
 * The mode is applied as `data-theme` on <html> (styles.css): light | dark | auto (auto = prefers-color-scheme). Pure decisions here,
 * tested in node (tests/unit-public-ticket.spec.ts); the DOM and storage helpers are guarded for a page without them.
 */
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemeChoice = 'light' | 'dark';

export const THEME_KEYS = { choice: 'arx.t.theme', server: 'arx.t.theme.srv' } as const;

export function isMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'auto';
}

/** The mode to show: the vendor's own choice wins, else the installation's setting (last seen or fresh), else light. */
export function resolveMode(choice: unknown, server: unknown): ThemeMode {
  if (choice === 'light' || choice === 'dark') return choice;
  return isMode(server) ? server : 'light';
}

/** Whether the page is dark right now (auto follows the device). */
export function isDark(mode: ThemeMode, prefersDark: boolean): boolean {
  return mode === 'dark' || (mode === 'auto' && prefersDark);
}

/** What one tap on the toggle chooses: the opposite of what is shown now. */
export function nextChoice(mode: ThemeMode, prefersDark: boolean): ThemeChoice {
  return isDark(mode, prefersDark) ? 'light' : 'dark';
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* blocked storage: the choice lasts until the page is closed */
  }
}

export function storedChoice(): ThemeChoice | null {
  const v = read(THEME_KEYS.choice);
  return v === 'light' || v === 'dark' ? v : null;
}

export function saveChoice(choice: ThemeChoice): void {
  write(THEME_KEYS.choice, choice);
}

export function storedServerMode(): ThemeMode | null {
  const v = read(THEME_KEYS.server);
  return isMode(v) ? v : null;
}

export function saveServerMode(mode: ThemeMode): void {
  write(THEME_KEYS.server, mode);
}

export function prefersDark(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function applyMode(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
}
