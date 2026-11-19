# CR-FE-SMALL-2440 - six small frontend / documentation rows for 2.44.0

Branch `pilot/CR-FE-SMALL-2440`. Base: `origin/pilot/CR-W3B-FE-COMBINED-2443` (41bf2a6d6) merged with `origin/release/2438-train`
(d40eaf5d7) and with `origin/pilot/CR-TV-FONTS-ESCAPE-2443` (cf51f1f57). The last merge is needed by rows 3 and 4: they fix the
font generator and the documents in the layout that branch introduced (woff2 sources in `frontend/fonts-src/lobby/`, one sheet per
style family). It is on the 2.43.9 train list, so the merge adds nothing new to the train. All three merges were clean.

Sources of the rows: `private/handoff-package/READ_FIRST_2026-11-16-PM.md` (2.44.0 queue), `private/planning/REMAINING_WORK_2026-11-18.md`
(section B, small fix items), code review `06-frontend-screens.md` (RTL-1), owner questions 18.11 (`decisions_2026-11-18.html` q15, q16,
q19, q23; unanswered = recommendation, all four recommended "a").

Files left alone on purpose (other agents tonight): `screens/devices-*.ts`, `home-widgets.ts`, `area-quick-sheet.ts`, `shell/sw-app.ts`,
`router.ts`. None of the six rows needed them.

## 1. px-literal ratchet -16 (with BUILD-GUARDS)

FE-8 (`CR-FE-DEAD-CSS-2443`) removed 16 px literals; its note said the `px-literal` baseline may drop by 16 once the chain meets
`CR-BUILD-GUARDS-2438`. Done: `scripts/design_ratchet_baseline.json` `px-literal` 25911 -> **25895**. Measured on this branch: 25556
(one more px literal went with row 2: a four-value `padding` became `padding-block` + `padding-inline`). Only `px-literal` was lowered;
the other metrics keep their margin (lead rule in `CR-W3B-FE-COMBINED-2443`: no further lowering until the queue is empty), and
`px-literal` keeps 339 of margin for the 2.43.9 rows not on this base.

## 2. RTL-1 - the remaining eight physical sites (code review 06:RTL-1)

The ninth site (`investigate-history-map.ts:870`) had already gone. Each of the eight was checked: every one sits on an element that is
LTR on purpose (`dir="ltr"` or `direction: ltr`: code, JSON, attribute lists, the line-number gutter), so `start` / `end` resolve to
the same side as `left` / `right` did. Rendering is unchanged; the screens no longer mix physical and logical CSS.

| File | Was | Now |
|---|---|---|
| `automation-block-forms.ts` `.lockcode` (element has `dir="ltr"`) | `text-align: left` | `text-align: start` |
| `automation-code.ts` `.nums` (in `.wrap`, `direction: ltr`) | `text-align: right` | `text-align: end` |
| `automation-code.ts` `textarea` | `padding: 10px 12px 10px 56px`, `text-align: left` | `padding-block: 10px; padding-inline: 56px 12px`, `text-align: start` |
| `explore-entities.ts` `.attrs` | `text-align: left` | `text-align: start` |
| `system-fleet-report.ts` `pre.json` | `text-align: left` | `text-align: start` |
| `system-notices.ts` `.link code` | `text-align: left` | `text-align: start` |
| `system-video-conn-test.ts` `pre.report` | `text-align: left` | `text-align: start` |
| `system-audit.ts` details cell (inline style, `dir="ltr"`) | `text-align:left` | `text-align:start` |

Guard: new `frontend/tests/unit-rtl-logical-2440.spec.ts` (Node only): none of the nine files of the finding has a physical
`text-align` / `margin-*` / `padding-*` / `border-*` side, and the code editor keeps its gutter clearance on the start side of its LTR box.

## 3. TV board: Latin letters and digits in IBM Plex (owner q15 = a)

Bug found by `CR-TV-FONTS-ESCAPE-2443`: `scripts/notice_tv_fonts.py` chose a face's unicode-range with `"-hebrew-" in stem`, which also
matches the family name of `plex-sans-hebrew-latin-*`. The five Plex Sans Latin faces carried the Hebrew range, so Latin letters and
digits in Lumen, Axis and Prism were drawn in the fallback (Heebo) and ~100 KB of Plex Latin drew no glyph. Fix: the subset is the token
after the family name (`subset()`: `-latin-` -> latin, else hebrew). Regenerated `frontend/src/notice-tv/tv-fonts-hitech.css` (5 rules
change range only; 216,648 -> 217,168 bytes); `tv-fonts-luxury.css` unchanged byte for byte (`--check` passes).
Tests: `test_font_licences.py::test_each_lobby_face_carries_the_unicode_range_of_its_own_subset` (failed on the base, passes now);
`notice-tv-fonts-2443.spec.ts` now also expects five Latin `LobbySans` faces defined and one really loaded on Lumen / Axis / Prism.
**Pixels change** on purpose for the hi-tech styles (Latin text, digits of the clock / temperature): baselines
`pixel-notice-tv-portrait-chips.spec.ts-snapshots/portrait-chips-{lumen,axis,prism}-desktop-linux.png` (see "Runner" below).
Comments in `tv-hitech.css` / `tv-luxury.css` named the removed `tv-fonts.css`; now the family sheet. `docs/fonts/LOBBY_FONTS.md` records the fix.

## 4. Licence documents point at the real font files (owner q16 = a)

`THIRD_PARTY_NOTICES.md`, `smplwise_vms/THIRD_PARTY_NOTICES.md` and `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md` still named
`frontend/public/fonts/lobby/` + `www/fonts/lobby/` as the home of the lobby fonts. Now: woff2 sources `frontend/fonts-src/lobby/`,
shipped inlined in `tv-fonts-hitech.css` / `tv-fonts-luxury.css`, OFL texts also in `frontend/public/fonts/lobby/` and
`smplwise_vms/www/fonts/lobby/`. New test `test_licence_documents_point_at_the_real_lobby_font_files`: each document has one lobby-font
row, it names `frontend/fonts-src/lobby/`, and every repository path it names exists.

## 5. ADR-007 superseded (owner q23 = a; owner backlog answer 18.11: T060 / T061 superseded)

`docs/architecture/DECISIONS.md`: ADR-007 "Plan AI proposes geometry" is struck through and marked **Superseded**, with the reference:
no AI plan normaliser; geometry proposals come from the local detector (T086, `services/plan_detect.py`) and the local stylizer
(`services/plan_stylize.py`) behind the human accept / publish screen - ADR-016 ("local detection before any AI") and
`docs/architecture/PLAN_STUDIO_DESIGN_HE.md`. The human publish gate stays binding. The task cards T060 / T061 are handled by
`chore/BACKLOG-HYGIENE-2443` (not touched here).

## 6. The 43 unused exports (owner q19 = a)

The 43 names `CR-W3B-FE-COMBINED-2443` baselined (`node scripts/unused-exports.mjs`; the script counts any word use in `src/`, `tests/`
or `scripts/`, so nothing used by a test or script is on the list; repo-wide `git grep` also checked the 9 deleted names: only the
backend's own Python constants of the same name and change notes use them):
- **Deleted (9 unreferenced):** `api/capture-lease.ts` `LOOKUP_WIDE_WORD`; `api/nvr-connection.ts` `SAVE_WORD`, `REMOVE_WORD` (and their
  now unused `CONFIRM_WORDS` imports - the screens use `confirmWord(...)`); `i18n/confirm-dialog.ts` `CdKey`; `i18n/msg.ts` `msgTables`
  (and the `MSG_TABLES` map that only it read); `i18n/wiskey-profiles.ts` `PF_EN`; `map/sun.ts` `LIGHT_MOODS`; `tickets/map-text.ts`
  `MAP_TEXT_KEYS`, `MAP_TEXT_EN_KEYS`.
- **Un-exported (34 file-local, still used inside their own file):** `ConfirmDialogOptions`, `HandModalOptions`, `LayerOptions`,
  `KeyedDebounce`, `CdLang`, `cdLang`, `ClientConfirmWordKey`, `ConfirmWordLang`, `CatalogueTable`, `RegisteredCatalogue`, `UiLangCode`,
  `PfLang`, `pfLang`, `TriageText`, `AlarmMotion`, `LightMarkMode`, `MARK_LINE_M`, `RoomMarksMode`, `ALARM_TINT_OPACITY`, `WallCut`,
  `MapTextKey`, `mapText`, and the twelve `*_DEV_MARKED` of access-external, access-request, backup-offbox, bulk-people, door-windows,
  generator-escalation, generator-routing, messaging-pacing, messaging-policy, polish, wa-installed, wiskey-switches.
- `scripts/gates-baseline.json` `unusedExports` pruned with `--update-baseline`: unreferenced 56 -> **47**, file-local 88 -> **54**
  (exactly the 43; the bundle budget part is unchanged).

Merge note for the lead: `CR-I18N-LAZY-LANG-2443` rewrites most `src/i18n/*.ts`. This branch changes one line per file there
(`export const X_DEV_MARKED` -> `const`, and the deletions in `confirm-dialog.ts`, `msg.ts`, `wiskey-profiles.ts`). See "Merge check".

## Merge fix found on the way: `v2Eta`

`tests/unit-notice-tv-escape-2443.spec.ts` (from `CR-TV-FONTS-ESCAPE-2443`) imports `v2Eta` from `src/notice-tv/v2-transit.ts`, which
`CR-FE-DEAD-CODE-2442` (in `CR-W3B-FE-COMBINED-2443`) had un-exported. `tsc -p tsconfig.tests.json` failed with TS2459 after the merge;
`v2Eta` is exported again (a test uses it). **`origin/release/2439-train` (4a3ffe5c5) has the same break** (it holds both branches and
still declares `function v2Eta` unexported): the 2.43.9 typecheck fails there until this one-word fix is merged or ported.

## Merge check

`git merge-tree --write-tree HEAD origin/release/2439-train` (4a3ffe5c5): clean (no conflict). That train already holds
`CR-I18N-LAZY-LANG-2443`; none of the 43 names is imported anywhere on the train outside its own file (`git grep -w` per name: the train
has only the declaring file and `gates-baseline.json`; `PF_EN` also appears in three comments). A full typecheck of the merged tree was
not run (see NOT_RUN).

## Tests actually run (workstation)

- `npx tsc --noEmit -p tsconfig.json` (app): exit 0. `-p tsconfig.tests.json`: first run TS2459 (`v2Eta`, the merge break above),
  after the fix exit 0. `-p tsconfig.scripts.json`: exit 2, only `eslint.config.mjs` cannot resolve `eslint` / `typescript-eslint` /
  `eslint-plugin-lit` - the workstation's shared `node_modules` has no ESLint packages (environment, not this branch; not run elsewhere).
- Node unit specs (`-c playwright.unit.config.ts --workers=1`), 38 files that import a touched module + the new guard + the TV units:
  **333 passed, 1 failed** - `unit-i18n-core.spec.ts` "every *_DEV_MARKED ..." found the markers by `export const` and saw 21 < 30 after
  the un-export. The test was stale, not the code (every marker is still handed to `registerCatalogue`): its regex now also counts
  file-local ones. Re-run of that file: **9 passed**. `unit-a11y-polished-lint.spec.ts` (reads `modal-stack.ts` source): **6 passed**.
- Backend (`.venv` python, `-p no:xdist`): `test_font_licences.py` **7 passed** (the new range test was also run on the unfixed generator + sheet:
  it failed there).
- Static guards: `py -3.12 scripts/design_ratchet.py` OK (px-literal 25556 / 25895); `py -3.12 scripts/notice_tv_fonts.py --check` OK;
  `node scripts/unused-exports.mjs --enforce` OK (47 / 54); `npx vite build` exit 0; `node scripts/bundle-budget.mjs --dir dist --enforce` OK;
  `node scripts/lazy-tags-check.mjs` OK.

## Runner (pixels, `~/work/fesmall2`, `nice -n 10`, `--workers=1`, a release gate was running - load 48-65; nothing else touched)

Shared clone of the runner checkout in `~/work/fesmall2`, the workstation's `vite build` (no maps) copied in, `vite preview` on a private
port, `node_modules` linked to the runner checkout's. Folder removed afterwards.
- `pixel-notice-tv-portrait-chips.spec.ts` + `notice-tv-fonts-2443.spec.ts`, `--project=desktop -g "lumen|axis|prism|fonts of the"
  --update-snapshots=changed`: **19 passed** (9 portrait geometry / pixel / worst-case for the three styles, 10 font probes incl. the new
  Latin-face assertions). Exactly three baselines were rewritten: `portrait-chips-{lumen,axis,prism}-desktop-linux.png` (the old ones
  differed, as expected). Re-run against the new baselines: **3 passed**. Reviewed by eye: clock, date, temperature and the times are in
  IBM Plex (no longer Heebo); the Hebrew lines move a few pixels (mixed-font line metrics); no overlap, no chip lost.

## NOT_RUN

- Full unit suite, full Playwright, all other pixel specs (only the hi-tech TV styles change pixels; the RTL-1 edits are rendering-neutral
  by construction - LTR elements - and were not pixel-checked), `pixel-notice-tv-mock.spec.ts` and `evidence-notice-tv.spec.ts` for the
  hi-tech styles (they write evidence images, no committed baselines) - runner entry / release gate.
- Full typecheck of this branch merged with `release/2439-train` (only `git merge-tree` + per-name `git grep`).
- Backend suite beyond `test_font_licences.py` (no backend code changed).
- No entry check queued (brief: push only).
