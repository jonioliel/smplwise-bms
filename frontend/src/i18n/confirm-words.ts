/**
 * CR-I18N-CONFIRM-WORDS-2442 (owner decision 17.11): the fixed words an operator types before a dangerous action, per interface
 * language. The server (smplwise_vms/backend/smplwise/services/confirm_words.py - the same keys and words; a unit spec compares
 * the two files) accepts the Hebrew word or its one fixed English counterpart, so each interface shows its own word:
 *
 *   - `confirmWord(key)` - the word to SHOW (English interface: the English word; every other language: the Hebrew word);
 *   - `confirmWordTyped(key, typed)` - which word was typed (`'he'` / `'en'`) or null, by the server's own rule: the Hebrew word
 *     trimmed and otherwise exact, or the English word trimmed, ASCII only, letter case ignored. Nothing looser;
 *   - `shownConfirmWord(serverWord)` - for a word the server sends in its view (always the Hebrew one): the word to show.
 *
 * The screens send what the operator typed, as typed. Texts that are data (a station's name, a user name, a count) are not here.
 */
import { docLang, fill, registerCatalogue, type Vars } from './core';

type ConfirmWordLang = 'he' | 'en';

/** key -> the two words. `{slot}` is filled from `vars` in both. Keep in step with the backend table (unit-confirm-words-2442). */
export const CONFIRM_WORDS = {
  nvr_save_untested: { he: 'שמור', en: 'save' },
  nvr_remove: { he: 'הסר', en: 'remove' },
  schedules_allow_disarm: { he: 'אפשר נטרול', en: 'allow disarm' },
  privacy_local_purge: { he: 'מחיקה לצמיתות', en: 'delete permanently' },
  capture_lookup_wide: { he: 'הרחב בירור', en: 'widen lookup' },
  installer_pulse: { he: 'פתיחת דלת לבדיקה', en: 'open door for test' },
  installer_host_clock: { he: 'שעון השרת', en: 'server clock' },
  installer_webhook_key: { he: 'הצגת המפתח', en: 'show key' },
  installer_import_apply: { he: 'ייבוא תצורה', en: 'import configuration' },
  installer_retention_apply: { he: 'מחיקת אירועים', en: 'delete events' },
  installer_config_apply: { he: 'החלה על העמדות', en: 'apply to stations' },
  installer_maint_enqueue: { he: 'תזמון תחזוקה', en: 'schedule maintenance' },
  lineage_reinit: { he: 'אתחול', en: 'reinitialise' },
  relay_map_confirm: { he: 'אשר', en: 'confirm' },
  access_gone: { he: 'נמחק', en: 'deleted' },
  access_revoke_all: { he: 'בטל הכל', en: 'revoke all' },
  access_delete_person: { he: 'מחק', en: 'delete' },
  visitors_revoke_all: { he: 'בטל מבקרים', en: 'revoke visitors' },
  managed_enabled: { he: 'מאשר ניהול התקנה', en: 'approve managed install' },
  managed_core_risk: { he: 'מאשר סיכון סביבה', en: 'approve environment risk' },
  managed_adopt: { he: 'מאשר העברה לניהול', en: 'approve move to managed' },
  legacy_import_apply: { he: 'ייבוא מהמערכת הישנה', en: 'import legacy' },
  door_code: { he: 'קוד {slot}', en: 'code {slot}' },
} as const satisfies Record<string, Record<ConfirmWordLang, string>>;

export type ConfirmWordKey = keyof typeof CONFIRM_WORDS;

/**
 * Words only the browser compares (the server has no check of its own for them): the same two-language rule, a table of its own
 * so that `CONFIRM_WORDS` stays exactly the server's table.
 */
export const CLIENT_CONFIRM_WORDS = {
  calendar_guest_purge: { he: 'מחיקה', en: 'delete' },
} as const satisfies Record<string, Record<ConfirmWordLang, string>>;

type ClientConfirmWordKey = keyof typeof CLIENT_CONFIRM_WORDS;

type AnyKey = ConfirmWordKey | ClientConfirmWordKey;

// the missing-keys report and the completeness specs read the registry: both tables, by language
const byLang = (lang: ConfirmWordLang): Record<string, string> =>
  Object.fromEntries(Object.entries({ ...CONFIRM_WORDS, ...CLIENT_CONFIRM_WORDS }).map(([key, word]) => [key, word[lang]]));
registerCatalogue('i18n/confirm-words', { he: byLang('he'), en: byLang('en') });

const pair = (key: AnyKey): Record<ConfirmWordLang, string> =>
  (CONFIRM_WORDS as Record<string, Record<ConfirmWordLang, string>>)[key] ?? (CLIENT_CONFIRM_WORDS as Record<string, Record<ConfirmWordLang, string>>)[key];

/** The language whose word the interface shows now: English in the English interface, Hebrew in every other. */
export function confirmWordLang(): ConfirmWordLang {
  return docLang(['en']) === 'en' ? 'en' : 'he';
}

/** The word to show for `key` (in `lang`, default: the interface's). */
export function confirmWord(key: AnyKey, vars?: Vars | null, lang: ConfirmWordLang = confirmWordLang()): string {
  return fill(pair(key)[lang], vars);
}

const trimmed = (text: string): string => text.trim();
const ASCII = /^[ -~]*$/; // printable ASCII (the trimmed text holds no control character of its own word)

/**
 * Which word `typed` is - `'he'`, `'en'` - or null when it is neither (the server would refuse it). `heNorm` is the comparison a
 * screen always used for its Hebrew phrase (default: trimmed), applied to both sides; the English word is always trimmed, ASCII
 * only, case ignored.
 */
export function confirmWordTyped(key: AnyKey, typed: unknown, vars?: Vars | null, heNorm: (text: string) => string = trimmed): ConfirmWordLang | null {
  if (typeof typed !== 'string') return null;
  if (heNorm(typed) === heNorm(confirmWord(key, vars, 'he'))) return 'he';
  const text = typed.trim();
  // ASCII lower-casing only: `toLowerCase()` of an ASCII string never leaves ASCII, and a non-ASCII text is refused before it
  if (ASCII.test(text) && text.toLowerCase() === confirmWord(key, vars, 'en')) return 'en';
  return null;
}

/** True when `typed` confirms `key` (the Hebrew word or the English one, as the server accepts). */
export function confirmWordMatches(key: AnyKey, typed: unknown, vars?: Vars | null, heNorm?: (text: string) => string): boolean {
  return confirmWordTyped(key, typed, vars, heNorm) !== null;
}

const KEY_OF_HE = new Map<string, ConfirmWordKey>((Object.keys(CONFIRM_WORDS) as ConfirmWordKey[]).map((k) => [CONFIRM_WORDS[k].he, k]));

/** The key of a FIXED word the server sent (its Hebrew word or template), undefined for any other text (a station's name ...). */
export function confirmWordKeyOf(serverWord: string | null | undefined): ConfirmWordKey | undefined {
  return typeof serverWord === 'string' ? KEY_OF_HE.get(serverWord) : undefined;
}

/**
 * Whether `typed` confirms a phrase the server sent. A fixed word of the table: its Hebrew or its English word (the server's rule);
 * any other text (a station's name ...): itself only, compared with `heNorm`.
 */
export function serverWordMatches(serverWord: string, typed: unknown, vars?: Vars | null, heNorm: (text: string) => string = trimmed): boolean {
  const key = confirmWordKeyOf(serverWord);
  if (key) return confirmWordMatches(key, typed, vars, heNorm);
  return typeof typed === 'string' && serverWord.length > 0 && heNorm(typed) === heNorm(fill(serverWord, vars));
}

/** A word (or `{slot}` template) the server sent, as the interface shows it; a text that is not a fixed word is returned as it is. */
export function shownConfirmWord(serverWord: string, vars?: Vars | null): string {
  const key = confirmWordKeyOf(serverWord);
  return key ? confirmWord(key, vars) : fill(serverWord, vars);
}
