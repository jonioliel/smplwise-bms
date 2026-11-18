/**
 * CR-I18N-DATES-2442: THE locale of dates, times, weekday / month names, numbers and currency on the operator screens.
 *
 * One rule: the formatting locale follows the interface language (`<html lang>`, set before the first render by
 * i18n/ui-lang.ts and changed only by a reload): Hebrew -> `he-IL`, English -> `en-GB`.
 *
 * Why `en-GB` and not `en-US`: the product is installed in Israel and its Hebrew screens show day before month and a 24-hour
 * clock. `en-GB` keeps both (17/11/2026, 14:05); `en-US` would turn the same value into 11/17/2026 and 2:05 PM, so the same
 * number would mean another day after a language switch. It is also the tag the code already used wherever a screen had an
 * English branch (api/day-format.ts `dateInputLangFor`, frigate, insights, tickets, transit, announcements, bridge key ...).
 *
 * The time zone is NOT part of this module: every call site keeps the `timeZone` option it had (the installation's zone,
 * `Asia/Jerusalem`, or the zone of the device). Only the first argument of `Intl.*` / `toLocale*String` comes from here.
 *
 * Machine formats stay as they were and do not go through this module: `en-CA` day keys (yyyy-mm-dd), `en-US` / `en-GB`
 * `formatToParts` readers that take a wall-clock time apart, and `sv-SE` ISO days.
 */
import { docLang } from './core';

/** The BCP-47 tag of each language a catalogue may carry (ar / ru are not offered by the language switch; the tags are the ones the screens with an ar / ru column already used). */
export const UI_LOCALE = { he: 'he-IL', en: 'en-GB', ar: 'ar', ru: 'ru-RU' } as const;

/** The formatting locale of a language code or tag (`'en'`, `'en-GB'`, `'EN'` ...); Hebrew for anything else, empty or missing. */
export function localeFor(lang?: string | null): string {
  const l = String(lang ?? '').toLowerCase();
  if (l.startsWith('en')) return UI_LOCALE.en;
  if (l.startsWith('ar')) return UI_LOCALE.ar;
  if (l.startsWith('ru')) return UI_LOCALE.ru;
  return UI_LOCALE.he;
}

/** The formatting locale of the interface language, read from `<html lang>` at call time: `he-IL` or `en-GB`. */
export function uiLocale(): string {
  return UI_LOCALE[docLang(['en'])];
}
