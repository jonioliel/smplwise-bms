# CR-NAV-LABELS-2436 - the shell's tab labels in one small module (review 07:F3, 08:F02 shell-facing names)

Branch `pilot/CR-NAV-LABELS-2436`, from `origin/main` at 665ec8f24 (2.43.4). Row: code-review master plan section 3.2
(wave 1, frontend). No version bump, no migration, no backend file. Visuals and behaviour unchanged; pixels: none.

## What changed

- New `frontend/src/i18n/nav-labels.ts`: the labels `shell/nav.ts` reads, and only those, in every column their dictionary has
  (he / en, or he / en / ar / ru): 16 tickets keys (area, scopes, the four sections and their short names, list, handlers), the
  board / overview / vendor-accounts tabs, external access, door windows, announce, the 33 tab-registry names and surfaces, the
  maintenance section, building reports, public transport, synoptic map, "who is in", live incident. Each getter follows its
  dictionary's rule word for word (document language, Hebrew fallback, `{var}`s last, the module's configured name through
  `tn()` for the tickets families). It imports only `tickets/naming.ts` (which imports nothing).
- The fifteen dictionaries keep every key, in place and in order; the value of a moved key is now a reference
  (`tab: NAV_XT.he.tab`). So each string exists once, and `xt()`, `XT_TABLES`, `XT_KEYS`, `TICKET_TEXT_KEYS` etc. answer as before.
  The literals were moved by a script that rewrote each `key: '<literal>'` and copied the same literal byte for byte.
- `tickets/text.ts`: `ticketsLang()` and `ticketsSectionLabel()` are defined in nav-labels (the navigation needs them) and
  re-exported from text.ts unchanged; every caller still imports them from text.ts.
- New `frontend/src/i18n/nav-label-bridges.ts`: the two labels whose dictionaries this branch must not edit -
  `he.generator.pages[id]` (`i18n/he.ts`, held by AUDIT30) and `rt('navTitle')` (`tickets/rfq-text.ts`, left to SHELL-LAZY).
- `shell/nav.ts`: imports `i18n/nav-labels` and the bridges instead of 16 dictionary modules (`navTst as tst`, `navTt as tt`
  keep the long registry lines as they were).
- `api/notifications.ts`: the `tickets` category label reads `navTt('area')` instead of importing `tickets/text`.
- New `frontend/src/elevators/personal-mode.ts`: `MODE_KEY`, `toggled`, `personalHidden` (type-only imports);
  `elevators/model.ts` re-exports all three; `shell/sw-home-personal.ts` imports them from personal-mode.

## Resolved file list (the row's list plus two)

Row files: `shell/nav.ts`, `i18n/nav-labels.ts` (new), `api/notifications.ts`, `tickets/text.ts`, `board-text.ts`,
`overview-text.ts`, `cost-text.ts`, `i18n/access-external.ts`, `door-windows.ts`, `announce.ts`, `tab-sections.ts`,
`maintenance.ts`, `insights.ts`, `transit.ts`, `xsection.ts`, `presence.ts`, `incidents.ts`, `shell/sw-home-personal.ts`,
`elevators/model.ts`, `elevators/personal-mode.ts` (new). Added:

- `tickets/text-s4.ts` (one key): `hdTitle` (the handlers tab) is defined there and spread into text.ts; without the edit the
  string would exist twice. No other branch of the wave holds the file.
- `i18n/nav-label-bridges.ts` (new): see the contradiction below.

`i18n/he.ts` and `tickets/rfq-text.ts` are untouched, as the row says.

## Contradiction recorded (not silently resolved)

The brief asks for three things at once: nav.ts imports no dictionary module; `i18n/he.ts` and `tickets/rfq-text.ts` stay
untouched; no string exists twice. nav.ts needs one label from each of those two files. Copying them into nav-labels would
duplicate the strings; editing them is not allowed. So nav.ts reads them through `i18n/nav-label-bridges.ts`, which imports the
two dictionaries unchanged. Both are in the entry chunk through other importers anyway (he.ts is the base dictionary; rfq-text
through `shell/sw-app.ts:38`), so the bridge costs nothing today.

Why a separate module and not inside nav-labels: the dictionaries import nav-labels, and rfq-text imports `tickets/text.ts`.
Importing rfq-text from nav-labels would close the cycle text.ts -> text-s4.ts -> nav-labels -> rfq-text -> text.ts, in which a
table is read before it is initialised (depending on which module the bundle enters first). nav-labels stays a leaf; the new
test holds it so.

**For SHELL-LAZY:** when the RFQ tab label gets its own small module (`tickets/nav-text.ts`), point `navRfqTitle` in
`i18n/nav-label-bridges.ts` at it (one line) - otherwise the bridge keeps rfq-text in the entry after sw-app stops importing it.

Pre-existing equal strings under different keys were left as they were (not created by this move): `'תחזוקה ובקרה'` is both the
maintenance section (`mt('section')`) and the tickets section (`tt('secMaintenance')`) with different English; `'סקירה'` /
`'Overview'` is both `ot('tab')` and `tt('secReportsShort')`; `'{module}'` is `area` and `settingsTab`. Each now has one home in
nav-labels per key.

## Entry chunk (npm run build, `dist/assets/index-*.js`)

| | bytes | vite kB | vite gzip kB |
|---|---|---|---|
| before (665ec8f24) | 4,074,343 | 4,074.34 | 1,160.31 |
| after | 3,875,590 | 3,875.59 | 1,108.70 |
| change | -198,753 (-4.9 %) | -198.75 | -51.61 |

Same machine, same `node_modules`, both builds from this worktree. By probe strings (one non-moved string per dictionary),
these modules left the entry: `tickets/overview-text.ts`, `i18n/access-external.ts`, `i18n/announce.ts`, `i18n/tab-sections.ts`,
`i18n/insights.ts`, `i18n/transit.ts`. The others (`tickets/text.ts`, `board-text.ts`, `cost-text.ts`, `rfq-text.ts`,
`i18n/door-windows.ts`, `maintenance.ts`, `xsection.ts`, `presence.ts`, `incidents.ts`) are still reached from the entry by
other importers (sw-app, eager screens and components); that is the work of SHELL-LAZY and the wave-2 load-path branches, not
of this one.

## Tests

- New `frontend/tests/unit-nav-labels-2436.spec.ts` (written first; it failed before the change: the module did not exist):
  nav.ts imports no dictionary module; nav-labels imports only `tickets/naming.ts`; the bridges import exactly `i18n/he.ts` and
  `tickets/rfq-text.ts`; notifications.ts imports no tickets text catalogue; sw-home-personal imports personal-mode, not the
  elevators model, and the re-exports are the same functions; every moved label reads the same through nav-labels as through its
  dictionary in every document language (he, en, ar, ru, en-GB, none) and every explicit column; each moved key is a reference
  to its nav-labels value exactly once in its dictionary.
- Run on this workstation, `--workers=1`, `playwright.unit.config.ts`: the new spec, the ten `unit-*-nav*.spec.ts`
  (incidents, people, schedules, serviceia1, settings-295, tickets-assign, uxfix-295, water, wiskey-schedules,
  wiskey-stations) and the `*_TABLES` parity specs of the touched dictionaries (access-external, announce-297, announce-stage-a,
  announce2-297, announceb-295, door-emergency-roles-emrole-295, door-windows, insights, maintenance, partner-api,
  tabset-registry, vendor-marker-295, whoin034-295): **190 passed**.
- `tsc --noEmit`: clean. `npm run build`: built.
- NOT_RUN here: pixel, evidence and layout suites (the runner's entry check; not queued by this branch).
