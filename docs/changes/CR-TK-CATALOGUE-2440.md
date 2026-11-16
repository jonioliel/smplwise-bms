# CR-TK-CATALOGUE-2440 - one implementation of the tickets text catalogues (review 08:F07)

Branch `pilot/CR-TK-CATALOGUE-2440`, cut from `origin/release/2437-train` at 32c4a2275. Row: code-review master plan section 3.3
(wave 2, frontend), `pilot/CR-TK-CATALOGUE-2436`. No version bump, no migration, no backend file. The same string for every key
and language; pixels: none.

## What changed

- **New `frontend/src/tickets/catalogue.ts`.** `makeCatalogue(he, en)` returns `{ template, t, KEYS, EN_KEYS }`: the raw template
  of a key in a language (English falls back to Hebrew), the text function (the template in the document's language, the
  module's names rendered - D33 - then the `{var}`s) and the two key lists. Two smaller exports for the modules that keep an
  order of their own: `renderText(raw, lang, vars)` (names, then variables) and `fillVars(text, vars)`. The module holds no
  dictionary and does not import `./text` (the main catalogue is built with it); the language comes from `i18n/nav-labels`.
- **Thirteen regular modules export the same names from the factory** - `board-text`, `conversation-text`, `cost-text`,
  `delete-text`, `device-text`, `drawer-text`, `list-text`, `overview-text`, `quote-text`, `rfq-text`, `table-text`,
  `work-calendar-text` and `messages-text` (which had the lookup inline and exports no template function). Each keeps its two
  dictionaries, its key type and every exported name (`bt`, `boardTemplate`, `BOARD_TEXT_KEYS`, `BOARD_TEXT_EN_KEYS`, ...);
  the twelve copied lines are gone. `rfq-text` keeps `hasRfqText` and `RFQ_TEXT_HE`.
- **`text.ts`** (the main catalogue): `template` and the key lists come from the factory; `tt` keeps its guard for a key the
  dictionary does not know (a newer server's code renders as the key) and renders through `renderText`.
- **`calendar-text.ts`**: its dictionary holds name lists beside the strings, so it keeps its own `calTemplate` and key lists
  and renders through `renderText`. **`rules-text.ts`, `org-locations-text.ts`**: they fill the variables first and render the
  names only when a token is left - that order is kept; only the fill line is shared (`fillVars`).
- **Clashing short names renamed** (the row's note; a wrong auto-import compiled only by luck of the key types):
  - `ct` of `calendar-text.ts` -> `calt` (`ct` stays cost-text's). One importer: `tickets/calendar-view.ts`.
  - `lt` of `org-locations-text.ts` -> `loct` (`lt` stays list-text's). Ten importers: `screens/system-tickets.ts`,
    `screens/tickets-rfqs.ts`, `tickets/external-assign.ts`, `location-picker.ts`, `overview-tab.ts`, `rfq-board.ts`,
    `rfq-new.ts`, `settings-locations.ts`, `ticket-create.ts`, `ticket-detail.ts`.

## Left as they are (recorded)

- `tickets/nav-text.ts` - the shell's two RFQ words. It has the same three lines, but `unit-shell-lazy-2436.spec.ts` pins its
  imports to exactly `i18n/nav-labels` and `tickets/naming` (it is in the entry chunk); it is not moved onto the factory.
- `rfq-settings-text.ts`, `visits-settings-text.ts` (a plain lookup per language: no template, no names, no variables),
  `map-text.ts`, `text-s4.ts`, `text-ui6.ts`, `text-otp.ts`, `text-deptmgr.ts`, `text-needsreview.ts` (dictionaries only, spread
  into `text.ts`) and `ticket-device-context.ts` (not a catalogue): none carries the copied lines.
- The exported functions are `const`s now (`export const bt = catalogue.t`) instead of function declarations. No text module is
  part of an import cycle (`naming.ts` imports nothing, `nav-labels.ts` only `naming.ts`), so no importer can see one before it
  is initialised.

## Resolved file list

- new `frontend/src/tickets/catalogue.ts`
- `frontend/src/tickets/{board,conversation,cost,delete,device,drawer,list,messages,overview,quote,rfq,table,work-calendar}-text.ts`
- `frontend/src/tickets/text.ts`, `calendar-text.ts`, `rules-text.ts`, `org-locations-text.ts`
- the rename's importers: `frontend/src/tickets/calendar-view.ts`, `external-assign.ts`, `location-picker.ts`, `overview-tab.ts`,
  `rfq-board.ts`, `rfq-new.ts`, `settings-locations.ts`, `ticket-create.ts`, `ticket-detail.ts`,
  `frontend/src/screens/system-tickets.ts`, `frontend/src/screens/tickets-rfqs.ts`
- new `frontend/tests/unit-tk-catalogue-2440.spec.ts`

### Outside my rows

The eleven importers above are outside "every `*-text.ts`"; each change is the import name and its call sites
(`lt(` -> `loct(`, `ct(` -> `calt(`), nothing else. `CR-TK-HISTORY`, `CR-API-PATHS` or another branch that edits the same
lines of those files will meet a trivial conflict on the import line.

## Tests actually run (workstation, 2026-11-16)

- `npx tsc --noEmit` on a focused project (the new spec - which imports every text module - the eleven importers of the renamed
  functions, `nav-text.ts`, `unit-tickets-calendar.spec.ts`, `unit-tickets-org-locations.spec.ts`, and everything they import):
  no errors.
- `npx playwright test -c playwright.unit.config.ts --workers=1` on `unit-tk-catalogue-2440` (new), the 47 `unit-tickets-*`
  specs (unchanged), `unit-nav-labels-2436`, `unit-shell-lazy-2436`, `unit-entry-chunk`: 444 passed, 1 skipped (existing:
  `unit-entry-chunk` skips its committed-build check - this worktree is a sparse checkout without `smplwise_vms/www`).
  The new spec holds every key of the thirteen regular catalogues, in both languages, with and without variables, to the lines
  each module carried before (written out once more in the spec), and checks that no short name is exported by two text modules.

## NOT_RUN

- Full-project `npx tsc --noEmit` (0.1-0.4 GB free RAM during the batch). The focused project covers every changed file and
  every importer of a renamed name found by a search of `src/` and `tests/`; an importer the search missed would fail the full
  typecheck of the combined branch with "has no exported member".
- `npm run build`, browser specs of the tickets screens.
- No entry check (per the batch brief: the lead combines).
