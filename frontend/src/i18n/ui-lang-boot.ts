/**
 * I18N-EN-SWITCH-2438: the first module main.ts evaluates. It imports nothing, so `<html lang dir>` is set from this browser's copy
 * of the user's language before any catalogue or tab list is built (see i18n/ui-lang.ts for the whole flow).
 */
export type UiLang = 'he' | 'en';
/** The languages the switch offers, in order. */
export const UI_LANGS: readonly UiLang[] = ['he', 'en'];
/** The per-browser mirror of the user's choice (read before the first render). */
export const UI_LANG_MIRROR = 'sw.ui.lang';

export function isUiLang(v: unknown): v is UiLang {
  return v === 'he' || v === 'en';
}

/** The server value -> the language (null / unknown = Hebrew). */
export function uiLangFromPref(v: unknown): UiLang {
  return isUiLang(v) ? v : 'he';
}

/** The language the page is in now. */
export function currentUiLang(): UiLang {
  const l = typeof document !== 'undefined' ? (document.documentElement?.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

/** `<html lang dir>` for a language. */
export function applyUiLang(lang: UiLang): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'he' ? 'rtl' : 'ltr';
}

function readMirror(): UiLang | null {
  try {
    const v = globalThis.localStorage?.getItem(UI_LANG_MIRROR);
    return isUiLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** Writes the mirror; true when it reads back (so a reload will start in that language). */
export function writeMirror(lang: UiLang): boolean {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return false;
    if (lang === 'he') ls.removeItem(UI_LANG_MIRROR);
    else ls.setItem(UI_LANG_MIRROR, lang);
    return (ls.getItem(UI_LANG_MIRROR) ?? 'he') === lang;
  } catch {
    return false;
  }
}

/** Step 1: before anything renders. Only a stored English choice changes the page; otherwise index.html's Hebrew stays. */
export function bootUiLang(): void {
  const lang = readMirror();
  if (lang && lang !== currentUiLang()) applyUiLang(lang);
  booted = currentUiLang();
}

let booted: UiLang | null = null;
/** The language the page was built in (set by `bootUiLang`; the live `<html lang>` before it ran). */
export function bootedUiLang(): UiLang {
  return booted ?? currentUiLang();
}

bootUiLang();
