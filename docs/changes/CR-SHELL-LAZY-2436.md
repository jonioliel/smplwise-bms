# CR-SHELL-LAZY-2436 - on-demand features out of the entry chunk (review 07:F4 a-c, 06:BUNDLE-1 shell side, 08:F02 shell imports, 07:F24)

Branch `pilot/CR-SHELL-LAZY-2436`, cut from `origin/pilot/CR-NAV-LABELS-2436` at 7e0c44191 (it builds on that branch's
`i18n/nav-label-bridges.ts`). Row: code-review master plan section 3.2 (wave 1, frontend). No version bump, no migration, no
backend file. Visuals unchanged; pixels: none. The only behaviour difference is timing: the first opening of each part below
waits for one chunk fetch.

## Entry chunk (`npm run build`, `dist/assets/index-*.js`)

| | raw bytes | gzip -9 bytes |
|---|---|---|
| before (7e0c44191) | 3,875,590 | 1,097,740 |
| after | 3,432,771 | 977,357 |
| change | -442,819 (-11.4 %) | -120,383 (-11.0 %) |

New chunks: `schedule-editor-*.js`, `ticket-create-*.js`, `sw-second-factor-*.js` (with `qrcode-generator`), `boot-*.js`
(remote sign-in, welcome, local identity words), `sw-xsection-*.js`.

## What changed

- **07:F4 a / 06:BUNDLE-1 - `components/device-activity.ts`.** `screens/schedule-editor` and `tickets/ticket-create` are no
  longer imported eagerly. `loadPart()` imports each with `import()` (once; a failed fetch may be retried). The popup sets the
  state that renders the tag (`editing`, `creating`) only after the chunk landed, and `renderEditor` / `renderCreate` also check
  `customElements.get(...)` - GATE2342: never upgraded in place. A popup closed or reopened while a chunk is in flight opens
  nothing (`popupSeq`). The schedules / tickets tab fetches its part's chunk when first shown, so the press rarely waits.
- **Route `#/devices/schedules/<id>/edit`.** The shell rendered `<schedule-editor>` relying on the popup's eager import; it is
  now listed in `LAZY_SCREENS` (`shell/lazy-screens.ts`), so the shell's GATE2342-B path waits for the chunk before it renders
  the route. The header's "Not listed: schedule-editor" exception is replaced by a paragraph on the on-demand parts.
- **The three schedule dialogs stay in the entry chunk.** `schedule-lowering-dialog`, `schedule-create-dialog` and
  `schedules-week-view` came into the entry through schedule-editor; the lazy schedules screens (`devices-schedules`,
  `schedule-drawer`) render them by tag without importing them. Those two files are held by AUDIT30 / CR-EDITORS-MEMO, so the
  shell's import block now imports the three dialogs (about 44 KB source) and nothing changes for those screens. Moving them to
  the screens that render them is left to the branch that holds `devices-schedules.ts`.
- **07:F4 b - `<media-remote>`.** The shell imported `components/media-remote` but never renders it; the import is removed.
  The element is rendered by `screens/home-widgets.ts` and `screens/devices-media-card.ts`, which import it themselves, so it is
  still in the entry chunk through `home-widgets` (devices-building). Taking it out is CR-HOME-LAZY's part (it holds
  `home-widgets.ts`); no size gain is claimed for it here.
- **07:F4 c - `main.ts`.** `if (REMOTE) void import('./arx/boot').then((m) => m.bootRemote());` - the remote start-up, the
  sign-in and welcome pages and the local identity words load only on the remote channel.
- **07:F24 - `shell/sw-user-menu.ts`.** `components/sw-second-factor` (and `qrcode-generator`) is imported when the second
  factor section is first opened (`onFactorToggle`); `<sw-second-factor>` renders once `factorReady`. `<sw-passkeys>` is
  unchanged. The other half of F24 (extracting `fitDd` / notification wiring from sw-app) is not in this row.
- **08:F02 - RFQ words.** New `tickets/nav-text.ts` holds `navTitle` and `navQuestionsAria` (he / en) and `nt()`, rendered
  exactly as `rt()` (document language, the module's names, `{var}`s). `tickets/rfq-text.ts` keeps both keys in place; their
  values are references to `NAV_RFQ_HE` / `NAV_RFQ_EN`, so each string exists once and `rt()` / `RFQ_TEXT_*` answer as before.
  `shell/sw-app.ts` uses `nt('navQuestionsAria', ...)` for the badge's aria label.
- **08:F02 - cross-section options.** New `xsection/xs-options.ts` (no imports): the option lists, `XsOptions`, `SynColumn`,
  `XS_DEFAULT`, `normalizeXs`, `xsOptions` / `setXsOptions` / `onXsOptions`, `xsFromParams`, moved verbatim from
  `xs-model.ts`, which re-exports all of them (`export * from './xs-options'`), so its importers are unchanged. The shell imports
  `xs-options`. `xs-model` itself stays in the entry chunk through `devices-building`, `sw-fire-bar` and others.
- **08:F02 - `xsection/sw-floor-home-link.ts`.** It imported `sw-xsection` (the cross-section element) for `HOW_KEY` and
  `matchLine`. It now takes them from the module with `import()` on connect (type-only import for the type) and draws the dialog
  once the module landed (shared by every later dialog). `sw-xsection` left the entry chunk.
- **`frontend/scripts/lazy-tags-check.mjs`.** New `NOT_IN_ENTRY` deny-list: `screens/schedule-editor.ts`,
  `tickets/ticket-create.ts`, `components/sw-second-factor.ts`, `arx/boot.ts`, `arx/arx-login.ts`, `arx/arx-welcome.ts`,
  `tickets/rfq-text.ts`, `xsection/sw-xsection.ts` - a finding when any is in the eager closure of `main.ts`. `--stats` reports
  `notInEntry`.

## Edits outside the row (recorded)

- `frontend/src/i18n/nav-label-bridges.ts` (allowed by the lead): `navRfqTitle()` reads `nt('navTitle')` from
  `tickets/nav-text.ts`; `tickets/rfq-text.ts` is no longer reached from the bridges.
- `frontend/tests/unit-nav-labels-2436.spec.ts` line 64: the bridges' import list is now `['i18n/he.ts', 'tickets/nav-text.ts']`
  (a direct consequence of the line above).
- `frontend/tests/evidence-second-factor.spec.ts` (the administrator reset test): it created `<sw-second-factor-user>` on the page
  without opening anything; that element now comes with the second factor chunk, so the test opens the user menu's section once,
  waits for the definition, closes the menu and then places the element as before ("specs that open these surfaces must await
  the chunk").
- `frontend/tests/evidence-schedules-editor.spec.ts` and `frontend/tests/shoot-sched-polish-2331.spec.ts`: both loaded the home
  page and waited for `customElements.get('schedule-editor')`, then created the editor by hand. The editor is a chunk now, so they
  call the new helper `frontend/tests/lazy-chunk.ts` (`loadLazyChunk`): under `vite preview` it imports the chunk named in the
  entry chunk, under the dev server the source module, then waits for the definition. (The first run of
  `evidence-schedules-editor` without the helper: 34 failed, 2 passed - every failure the 60 s wait for that definition.)
- The row names `tests/unit/lazy-screens.spec.ts`, which does not exist in this repository; the new tests are in
  `frontend/tests/unit-shell-lazy-2436.spec.ts`, and the existing guard is `tests/unit-perf-home-devices.spec.ts`.

## Tests

New `frontend/tests/unit-shell-lazy-2436.spec.ts` (written first; Node only): the check passes with the deny-list; the shell
imports nav-text / xs-options and no rfq-text / xs-model / media-remote; nav-text and rfq-text give the same words in both
languages and each string is written once; xs-model re-exports the same bindings as xs-options; `main.ts` imports `arx/boot` only
dynamically; device-activity, the user menu and the floor link dialog import their parts with `import()` and render the tags
only once defined; `schedule-editor` is in `LAZY_SCREENS`.

Results on the workstation (desktop project only, `--workers=1`, against this branch's build unless said otherwise):

| Spec | Result |
|---|---|
| `node scripts/lazy-tags-check.mjs --stats` | OK, `notInEntry: 8` |
| `tsc --noEmit` | clean |
| `unit-shell-lazy-2436` (new) | 8 passed |
| `unit-nav-labels-2436`, `unit-perf-home-devices` (with the new spec, first run) | passed (20 passed in that run besides the two new-spec failures fixed in the spec itself: a substring of `qBadgeAria`, and a header wording check) |
| `evidence-device-activity`, `evidence-tickets-device`, `evidence-tickets-map-internal`, `evidence-xsection-synoptic`, `perf-home-load` | 67 passed, 2 skipped, 1 failed: the hold test (`evidence-device-activity.spec.ts:130`, "a hold that moves past 8 px ... opens nothing") - passed on its own rerun; the press logic (`device-activity-press.ts`) is not touched by this branch, so it is read as load timing on the busy workstation |
| `evidence-device-activity.spec.ts:130` rerun, `evidence-second-factor` (adjusted), `evidence-synoptic-ha-2310` (opens the floor link dialog) | 32 passed, 6 skipped |
| `evidence-schedules-editor` (with `loadLazyChunk`) | 36 passed |
| `evidence-media-remote` | against `vite` dev server (the spec imports `/src/api/media-screens-mock.ts`, which only a dev server serves - under preview every test fails on that import): 32 passed |

NOT_RUN: the other `evidence-tickets-*` specs (none opens the device popup's form; their screens import `ticket-create`
themselves), `shoot-sched-polish-2331` (a design shoot harness, adjusted but not run), `layout-schedules-parity` (opens the
editor route through the shell, which now waits for the chunk), `evidence-arx-second-factor` (remote channel),
the tablet / mobile projects, and the pixel gate. The runner entry check is not queued (lead's instruction).

Evidence PNGs rewritten by the evidence specs were restored, not committed.
