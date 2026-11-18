# CR-I18N-DATES-2442 - dates, times, numbers and time words follow the interface language

Branch `pilot/CR-I18N-DATES-2442`, based on `origin/pilot/CR-I18N-COMBINED-2441` (910a7dbc0; contains main 2.43.7).

## The problem

With the interface switched to English (I18N-EN-SWITCH-2438), the texts were English but every date, clock time, weekday and
month name, grouped number and currency amount was still formatted with a hard-coded `'he-IL'` (`Intl.*`,
`toLocale*String`), and several "5 minutes ago" helpers and weekday tables were written in Hebrew in the source.

## The rule and the helper

`frontend/src/i18n/locale.ts` (new, imports only `i18n/core.ts`):

- `uiLocale()` - the locale of the interface language, read from `<html lang>` at call time: Hebrew -> `he-IL`, English -> `en-GB`.
- `localeFor(lang)` - the same rule for a language a module already holds (`frigateLang()`, `ticketsLang()`, a report's `lang`);
  `ar` -> `ar`, `ru` -> `ru-RU` (the tags the bridge-key and partner cards already used; not offered by the switch).
- `UI_LOCALE` - the table.

**Why `en-GB` and not `en-US`.** The Hebrew screens show day before month and a 24-hour clock. `en-GB` keeps both
(17/11/2026, 14:05). `en-US` would print the same instant as 11/17/2026 and 2:05 PM, so a date would read as another day after
a language switch. It is also what the code base already chose wherever a screen had an English branch
(`api/day-format.ts` `dateInputLangFor`, frigate, insights, tickets, transit, announcements, plan package, bridge key, partner
API, temperature report: about fifteen places before this branch, against one `en-US`, a plain number in
`i18n/building-presence.ts`, whose output is the same in both). MASTER_SPEC_HE does not name an English locale.

**Time zone.** Not touched. Every call keeps the `timeZone` option it had (`Asia/Jerusalem`, the installation's zone, a
device's zone, `UTC` after a manual offset). Only the first argument of the call changed. The unit spec checks a winter and a
summer instant in English.

## Call sites

112 formatting calls in 69 files under `frontend/src` now take their locale from the helper:

- 108 by a mechanical replacement in 65 files:
  - `'he-IL'` -> `uiLocale()` (dates, times, numbers; also the default argument of `formatTime` / `formatLocalTime` in
    `screens/wiskey-format.ts`, `lastEventText` / `deviceRows` in `arx/native-device-view.ts`, `chipsOf` / `healthChips` / `hhmm` in
    `temperature/model.ts`);
  - `xLang() === 'en' ? 'en-GB' : 'he-IL'`, `lang === 'he' ? 'he-IL' : 'en-GB'` and the four-language tables -> `localeFor(...)`;
  - `document.documentElement.lang || 'he-IL'` (or `|| 'he'`) -> `uiLocale()` (access-external, identity card, call history,
    door tech, temperature). **This one changes English output on purpose:** the bare tag `en` formatted as en-US (month before
    day; 12-hour clock where the options did not force 24). Hebrew is unchanged: `he` and `he-IL` give the same text (spec).
- 4 by hand: `screens/tickets-overview.ts` (`toLocaleDateString([], ...)`, the browser's own locale) and
  `door-windows/emergency.ts` (`toLocaleString()`, twice) now use the interface's locale; `api/remote.ts` country names
  (`Intl.DisplayNames(['he'])`); `screens/wiskey-bulk-people.ts` passes `localeFor(btLang())` instead of the bare language.
- `tickets/cost-model.ts` `formatMoney`: its private two-row table replaced by `localeFor` (same two locales).

Hand-written time words (new source-text table `frontend/src/i18n/msg/time.ts`, 41 texts, read through `tr()`; Hebrew returns
the Hebrew argument as written):

- relative time: `api/automations.ts` `lastRunText`, `api/notifications.ts` `relativeTime` / `dayLabel`, `api/remote.ts`
  `whenLabel`, `api/schedules.ts` `whenLabel`, `api/home-config.ts` `sinceText`, `screens/devices-building.ts` `agoHe`,
  `screens/system-wall.ts` `rel`;
- weekday names: `api/schedules.ts` `DAY_SHORT` / `DAY_LONG`, `api/notifications.ts` (now read at call time),
  `screens/system-wall.ts` `DAYS`.

## Left as they are, on purpose

- **Machine formats**: `en-CA` day keys, `en-US` / `en-GB` `formatToParts` readers, `sv-SE` ISO days, and the fixed `en-US`
  number formats of electricity, insights, generator, water and temperature (digits and separators are the same in `en-GB`).
- **Not printed**: three same-day comparisons (`home/home-api.ts`, `home/home-diary.ts`, `home/home-intercom.ts`) and the
  zone-name probe in `api/home-config.ts` keep `'he-IL'`. The guard lists them by file.
- **`api/day-format.ts`** (`dayText`, `timeText` ...): the operator screens' fixed format "30.09.2026 14:05" - not a locale
  call. It takes `lang: 'en'` to write `/` instead of `.`, and no caller passes it, so these dates stay dotted in English.
  See owner question 1.
- **The Hebrew calendar date** (`api/home-config.ts` `he-u-ca-hebrew`, `notice-tv/heb-date.ts`): Hebrew by nature.
- **`notice-tv/` and `public-ticket/`**: their language is the board's display language / the visitor's language, not the
  interface language, and they already format by it (`en-GB`; the public pages use `en-IL`). They are separate bundles.
- **Text that is not a date** and is still Hebrew in the same files (the sentence builder of `api/automations.ts` including its
  private `WD_SHORT` inside "בימים ...", `'כל היום'` in `api/home-config.ts`, the rest of `screens/system-wall.ts`,
  `api/rules.ts` `DAY_LABEL` whose letters are joined without a separator): translation rows of those modules, not this one. In
  English these screens therefore still mix languages; the dates inside them are English.
- **Weekday / month tables that already go through a catalogue** (`calendars/model.ts`, `home/*`, `electricity/elec-format.ts`,
  `components/recorded-month-logic.ts`, `tickets/calendar-text.ts`, `i18n/*`): already translated; not moved to `Intl`, because
  `Intl`'s Hebrew ("יום א׳", "יום ראשון") is not the text these screens show ("א׳", "ראשון").

Notes for whoever follows:

- Module-level formatters (`home/sw-home.ts`, `home/home-p2-ui.ts`, `home/home-p3-logic.ts`, `water/billing-format.ts`,
  `api/remote.ts`) take the locale when the module loads. In the app that is right (the switch reloads the page; the language
  is on `<html>` before any module is evaluated). A spec must set the language before importing them.
- `localeFor('ar' | 'ru')` returns an Arabic / Russian locale where the replaced ternary fell back to `he-IL`. `<html lang>` is
  only ever `he` or `en`, so no screen changes; Arabic would bring Arabic-Indic digits if the switch ever offered it.

## Hebrew is unchanged

- By construction: in Hebrew `uiLocale()` returns the same `'he-IL'` string the calls had, and `tr()` returns its argument.
- `frontend/tests/unit-i18n-locale.spec.ts` (new, 8 cases): the rule; 22 date option shapes and 5 number shapes taken from the
  call sites, old expression (`'he-IL'`, and `'he'` for the document-language sites) against the helper for a fixed instant;
  moved functions against their old expressions and against literal Hebrew texts (`formatDay`, `formatClock`, `formatTime`,
  `formatLocalTime`, `monthLabel`, `formatMoney`, `clockText`, `relativeTime`, `dayLabel`, `lastRunText`, `whenLabel`,
  `sinceText`, `DAY_SHORT`, `DAY_LONG`); the English output of the same; and a guard: no `'he-IL'` literal in `src/` outside six
  listed files and the two own-language folders, and no `Intl` / `toLocale*String` call fed from `document.documentElement.lang`.

## Also in this branch

- `docs/i18n/MISSING_KEYS_EN.md` / `.json` refreshed with `node scripts/i18n_missing_keys.mjs --write`. The committed copy was
  older than the combined branch (131 catalogues; now 135, `msg/time` among them with 0 missing), so most of its diff is the
  combined branch's work, not this one's.

## Tests actually run (workstation)

- `npx tsc --noEmit` (frontend): clean.
- Playwright unit config, `tests/unit-i18n-locale.spec.ts`, `--workers=1`: 8 passed.
- Playwright unit config, every `tests/unit-*.spec.ts` (node-only), `--workers=2`: 4,449 tests - 4,435 passed, 8 skipped (skips the
  specs declare themselves), 6 failed:
  - 1 x `unit-i18n-core.spec.ts` "every catalogue module registers its tables": the new `i18n/locale.ts` holds no texts. The
    behaviour is intended and the spec's list of non-catalogue modules was stale; `locale.ts` added to it. Rerun: passes.
  - 5 x `unit-session-me-failure-2435.spec.ts`: a page spec the unit config does not recognise as one (`page.goto('./#/...')`
    with no base URL -> "Cannot navigate to invalid URL"). Not touched by this branch; it passes against the preview (below).
- Playwright unit config, `--workers=1`, after the list fix: `unit-i18n-core`, `unit-i18n-locale`, `unit-ui-lang`,
  `unit-day-format`, `unit-date-format-module`, `unit-i18n-home`, `unit-i18n-cal-elec-lint`, `unit-i18n-cal-elec-completeness`,
  `unit-i18n-map-wizard-2441`: 62 passed.
- `npx vite build`, then `playwright.config.ts --project=desktop --workers=1` on a private port (4342): `home-v3-p2`,
  `home-v3-p3`, `evidence-schedules-list`, `evidence-calendars-manage-2310`, `unit-session-me-failure-2435`: 92 passed.
  (A first attempt lost its preview server after 5 tests - connection refused, while a type check ran beside it - and was
  stopped; the figures are the clean rerun's. The evidence PNGs these specs rewrite were restored, none is committed.)
- `node scripts/i18n_missing_keys.mjs --write`: 135 catalogues, `msg/time` 41 keys, 0 missing.

## NOT_RUN

- Pixel suites (list below), layout suites, the other evidence specs, the tablet and mobile projects.
- Page unit specs (`SW_UNIT_PAGES=1`).
- The backend (no backend file changed).
- The runner entry check - not queued, by instruction.
- No English screen was looked at in a browser: the English output is checked by the unit spec only (Node's ICU; a browser's
  ICU may differ in punctuation such as the comma in "17/11/2026, 14:05").

## Pixels

No PNG committed. Hebrew pixels are not expected to move (the Hebrew strings are the same strings). Pixel specs that cover
touched screens, all NOT_RUN here:

- home: `pixel-home-auditfix-2437`, `pixel-home-fb-2431`, `pixel-home-gaps-2436`
- wall / kiosk: `pixel-wall-followups-2390`, `pixel-wall-plan`
- intercom (WisKey): `pixel-wiskey-access-diag`, `pixel-wiskey-deeplinks`, `pixel-wiskey-door-tech`, `pixel-wiskey-messaging`,
  `pixel-wiskey-people`, `pixel-wiskey-people-writes`, `pixel-wiskey-schedule-writes`, `pixel-wiskey-station-media`,
  `pixel-wiskey-stations`, `pixel-wiskey-talk-dial-2382`, `pixel-wiskey-triage-2400`, `pixel-settings-intercom-cards-2401`
- access: `pixel-access-events`, `pixel-access-s12`, `pixel-access-schedules`, `pixel-access-status`
- others: `pixel-audit30a-glass-bridge` (bridge key card), `pixel-frigate-f2b-2405`, `pixel-plan-wizard-2433`,
  `pixel-plan-wizard-2434`

There is no English pixel baseline; English screens are covered by the unit spec only.

## Owner questions

1. The operator screens' fixed date format (`api/day-format.ts`: "30.09.2026 14:05", used by most tables) - in English:
   a. keep the dots (as today; one format in both languages) - **recommended**: it is the product's own format, unambiguous, and
      changing it touches every table;
   b. slashes in English ("30/09/2026"), as the helper already supports - a separate small task.
2. English locale:
   a. `en-GB` (day/month/year, 24-hour clock) - **recommended**, implemented;
   b. `en-US` (month/day/year, AM/PM) - one line in `i18n/locale.ts`.
3. The public pages (`public-ticket/`) format English money with `en-IL` and dates with `en-GB`; the operator screens now use
   `en-GB` for both. Unify them later under the same helper?
   a. yes, with the next public-pages task - **recommended**;
   b. leave the public pages on their own table.
