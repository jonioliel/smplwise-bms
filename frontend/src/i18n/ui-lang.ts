/**
 * I18N-EN-SWITCH-2438 (owner round 32, Q-SYS-7 b): the user's interface language - Hebrew (the default) or English.
 *
 * The choice is stored on the server per user (`ui.lang`, GET/PUT /me/prefs, backend services/user_prefs.py), so it follows the
 * user to every device. The catalogues read the language from `<html lang>` when they render, and some build option lists while
 * a module initialises, so the language must be on `<html>` before the first module that renders is evaluated:
 *   1. `bootUiLang()` - the first import of main.ts - applies this browser's copy of the user's last choice (a per-browser mirror,
 *      a convenience only: without it the page starts in Hebrew).
 *   2. `syncUiLang()` - after the shell starts - reads the server's value; when it differs from the page, the mirror is updated and
 *      the page reloads once in the right language. If the mirror cannot be written (private mode, blocked storage) the language is
 *      applied in place without a reload, so a page can never reload in a loop.
 *   3. `setUiLang()` - the switch in החשבון שלי - writes the server, then the mirror, then reloads.
 * Direction follows the language: Hebrew right-to-left, English left-to-right. Video and map geometry are never mirrored by it
 * (they are laid out in their own coordinates). Arabic and Russian columns exist in some catalogues but are not offered here.
 */
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';
import { applyUiLang, bootedUiLang, currentUiLang, uiLangFromPref, writeMirror, type UiLang } from './ui-lang-boot';

export { UI_LANGS, UI_LANG_MIRROR, applyUiLang, bootUiLang, bootedUiLang, currentUiLang, isUiLang, uiLangFromPref, type UiLang } from './ui-lang-boot';

let reloadHook: () => void = () => globalThis.location?.reload();
/** Tests replace the reload. */
export function setReloadHookForTests(fn: () => void): void {
  reloadHook = fn;
}

/** Brings the page to `lang` (`from` = the language the page is built in): mirror + reload, or in place when the mirror cannot be kept. */
function bringPageTo(lang: UiLang, from: UiLang): void {
  if (lang === from) {
    writeMirror(lang);
    return;
  }
  if (writeMirror(lang)) reloadHook();
  else applyUiLang(lang);
}

/** Step 2: the server's value wins over the mirror (another device may have changed it). Errors leave the page as it is. */
export async function syncUiLang(load: () => Promise<{ prefs: Record<string, unknown> }> = getMyPrefs as never): Promise<UiLang | null> {
  try {
    const lang = uiLangFromPref((await load()).prefs['ui.lang']);
    // compared with the language the page STARTED in: a later change of <html lang> (a test, an embedding page) is not undone here
    bringPageTo(lang, bootedUiLang());
    return lang;
  } catch {
    return null; // signed out, demo build or an older server without the key
  }
}

/** Step 3: the user's choice. Throws when the server refuses it (the page stays as it is). */
export async function setUiLang(lang: UiLang, save: (v: UiLang | null) => Promise<unknown> = (v) => putMyPrefs({ 'ui.lang': v })): Promise<void> {
  await save(lang === 'he' ? null : lang); // Hebrew is the default: stored as "not set"
  bringPageTo(lang, currentUiLang());
}
