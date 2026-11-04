# TTS-DEFAULT-ENGINE-2400 — a fixed announcement engine ("מנוע הקראה קבוע")

Branch `pilot/TTS-DEFAULT-ENGINE-2400` from `origin/release/2400-train` (`a96798dc8`). Target 2.40.0. Not merged, no tag, no version
bump. No lab, Home Assistant, WisKey or station contact: every test runs against fakes / mocks.

## What the owner asked (04.11, answer 1א)

The lab has several TTS engines in Home Assistant; the owner does not want to pick the engine for every announcement. Before this slice
every Arx announcement dialog preselected WisKey's reported default (`tts/engines` → `default`, which is
`tts.async_default_engine(hass)` — chosen by Home Assistant itself, with no Home Assistant UI to change it) and Hebrew when the engine had it.

## WisKey contract (read-only check)

`custom_components/hikvision_intercom/audio_tts.py` on `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` (`2834aa5e`):
- `tts/engines` returns `{default, engines: [{engine_id, name, supported_languages, default_language}]}` — no voices.
- `tts/start` accepts exactly `{id, type, station_id, engine_id, language, message}` (engine 1..128 chars, language ≤ 64) and refuses an
  engine not in the current list with `tts_engine_unavailable`. The audio options are fixed (wav, 8 kHz, mono).
- **There is no voice field**, so no voice setting was built (the dialog's existing "קול ברירת המחדל" preview text is unchanged).

## What this slice builds

1. **The setting** (one installation setting, two keys) — `routers/settings.py`:
   `access.tts_engine` ("" = "ברירת המחדל של המערכת", today's behaviour, the default) and `access.tts_language` ("" = automatic:
   Hebrew when the engine has it, else the engine's default). Through the existing product-settings path: `PATCH /settings` needs
   `system.configure` (the system administrator) and is audited as `settings.update` with the changed keys; `GET /settings` gives the
   values to every user (the dialogs preselect from it). Validation: plain ids only — engine `^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`,
   language `^[A-Za-z]{1,8}([_-][A-Za-z0-9]{1,8}){0,6}$`, or "" (WisKey's own length bounds; no spaces, control characters or markup).
   The engine is NOT checked against WisKey's list at save time (the list can be unreachable); the dialogs handle a missing engine.
2. **The engine list for the administrator** — `routers/access_control.py` `_caller`: `GET intercom/tts/engines` is also readable with
   `system.configure` (so the administrator choosing the fixed engine reads the same list), besides `access.call`. Speaking still needs
   `access.call` on the station's chain.
3. **The announcement audit row** gains `engine_choice`: `fixed` / `override` (a fixed engine is set, the sender picked another) /
   `no_fixed`. The server never substitutes the fixed engine: the request still names its engine (an empty engine is refused, 422).
4. **Settings UI** — `screens/system-access-display.ts` ("תצוגת מסך התחנות", Settings › כללי › מתגי מסכי כניסה), two rows right after
   "יעדי הכרזה": "מנוע הקראה קבוע" ("ברירת המחדל של המערכת" first, then WisKey's engines; while it is chosen a second hint line
   says which engine that is now, "ברירת המחדל כעת: <name>" - the 240 px control cut a name inside the option) and "שפת ההקראה" (automatic + the
   chosen engine's languages; shown when the engine lists languages or a language is saved). Saved with the card's own button.
   Changing the engine keeps the language only when the new engine supports it. A saved engine WisKey no longer lists stays selected,
   labelled "· לא זמין כרגע", and the row says "המנוע הקבוע X לא זמין כרגע". The list is read only for who may edit (read-only viewers
   see the stored values, no request). If the list cannot be read: "רשימת המנועים אינה זמינה כרגע. הבחירה השמורה נשארת".
5. **Every announcement path** preselects through one function, `api/tts-default.ts` `resolveTtsPick`:
   - the intercom overview's "הכרזה בעמדה" (`screens/wiskey-overview.ts`);
   - the station drawer's "הכרזה" and the multi-station announcement — the same composer `components/wk-announce-dialog.ts`.
   Each opening starts from the fixed engine/language again (the engine list is re-read when older than 60 s; the settings through the
   shared 60 s settings cache, which the settings card invalidates on save). The fixed engine is marked "· קבוע" in the engine list.
   A per-send pick changes only that announcement ("להכרזה הזו בלבד. ההגדרה הקבועה לא משתנה").
   **A fixed engine not in WisKey's current list is never silently replaced**: no engine is selected, the dialog says
   "המנוע הקבוע X לא זמין כרגע. בחרו מנוע אחר להכרזה הזו" (the composer opens its engine choice by itself) and the send stays disabled
   until the user picks an engine. A fixed language the selected engine does not support falls back to the automatic language and says
   so ("השפה הקבועה X לא נתמכת במנוע הזה. נבחרה Y").
6. **i18n** — `i18n/tts-default.ts`, Hebrew + English, same keys and placeholders (unit-checked); no platform names.

## Fit / no-scroll

No new navigation entry: the settings side column (`system-nav`, the control-screen rule of decision 402) is unchanged; the new evidence
spec measures it at 1440x900 (`scrollHeight <= clientHeight`). The two rows add to the "תצוגת מסך התחנות" card inside the settings
content area. Measured on the runner (classic, desktop 1440x900, mocked backend): side column 760 / 760 (no scroll of its own), the
document 900 / 900 (the page itself does not scroll), the display card 891 px of which the two new rows are 165 px. The settings
content pane of this tab already held more than one screen before this slice (the switches card plus the display card at ~726 px plus
the call-banner, parity, pairing and diagnostics cards), so it keeps its own inner scroll as before; this slice adds 165 px to it and
no scroll anywhere else. Settings is not an operator control screen; the dialogs (the control surfaces) did not grow except for the
one warning line when a fixed engine is missing.

## Tests

- Backend: `smplwise_vms/backend/tests/test_tts_default_engine_2400.py` (6) — defaults, validation (bad/good engine and language ids, ""
  reset), admin only + audit, the engine list for a system administrator whose call right is denied (and still no speaking), the
  server never substitutes the engine + `engine_choice` audit (`no_fixed` / `fixed` / `override`), an empty / missing engine refused.
- Unit (node): `frontend/tests/unit-tts-default-2400.spec.ts` (13) — parse, validation = the server's patterns, preselection (none /
  fixed / missing engine / unsupported language / engine without languages), per-send pick, the multi-station send carries the given
  engine, language names, every path wired through `resolveTtsPick`, settings card source checks, he/en parity, wording, no platform names.
- Browser (runner, mocked backends): `frontend/tests/evidence-tts-default-2400.spec.ts` — the two settings rows + save body, missing
  engine in settings, read-only site admin (no list request), 1440x900 side column fit + page height, the composer preselect / override /
  missing engine, the overview dialog preselect / missing engine. Evidence PNGs are written on the runner under
  `docs/design/evidence/TTS-DEFAULT-ENGINE-2400/`.
- `frontend/tests/access-control-mocks.ts` answers `intercom/tts/engines` (two engines) so the settings card shows a real list.

## Rollback

Revert the branch. No migration. With both keys at "" (the default) every dialog behaves exactly as before; older code ignores the keys.

## Pixel baselines

`frontend/tests/pixel-access-s12.spec.ts-snapshots/` re-taken on the runner (`linux-pixel --update-snapshots=changed`) and reviewed:
- `s12-{classic,domus}-display-{1440,390}`: the display card with the two new rows (reviewed; the phone images are clipped by the
  shell's bottom bar and top area exactly as the previous baselines were).
- `s12-{classic,domus}-parity-{1440,390}`, `s12-classic-parity-operator-390`, `s12-classic-checklist-390`: same content; the taller
  card above moves them by a fraction of a pixel (258 strongly differing pixels in the monospace `not_listed` cell on desktop,
  +1 px height on the phone). The first re-take also showed the report's first row hovered (the pointer left on "run" landed on it
  after the page moved): the spec now moves the pointer away after "run" (`page.mouse.move(0, 0)`), and the images were re-taken.
- On `release/2400-train` itself (`2cec97a47`) the same spec passed with the old baselines (10 passed): the changes are this slice's.

## Receipts (04.11)

| What | Where / SHA | Result |
|---|---|---|
| `tsc --noEmit` | workstation, `6e2ccf0ed` content | ok (exit 0) |
| Unit `unit-tts-default-2400.spec.ts` (node, `playwright.unit.config.ts`) | workstation | 13 passed |
| Unit regression `unit-round4-leftovers-2390`, `unit-wiskey-stations`, `unit-wkdirect-talk-max`, `unit-wxmedset` + the new spec | workstation, `9f8c21b79` content | 83 passed |
| Backend `test_tts_default_engine_2400.py` | workstation, repo `.venv` | 6 passed |
| Backend `test_tts_default_engine_2400.py` + `test_intercom.py` + `test_ui_settings.py` + `test_intercom_authority.py` + `test_settings_nav_pref.py` + `test_access_permissions_wxperm.py` + `test_security_review_wxd_fixes.py` | workstation, repo `.venv` | 278 collected, exit 0 (no failure; the quiet output did not print the skip count) |
| `scripts/release_check.py` | workstation | RESULT: ready for the owner's approval |
| Evidence `evidence-tts-default-2400` + `evidence-access-s12` + `evidence-wxmedset` + `evidence-wiskey-stations`, desktop + mobile | runner `run_smart.py spec` @ `296533e7c` | 127 passed, 27 skipped (project-only tests), 2 failed = the new spec's own hint locator (two hint lines now), fixed in `3554201b3` |
| Evidence `evidence-tts-default-2400`, desktop + mobile | runner @ `3554201b3` | 15 passed, 1 skipped (the 1440x900 measure is desktop only) |
| Pixel `pixel-access-s12`, desktop + mobile, after the re-take | runner `linux-pixel` @ `296533e7c` | 10 passed |
| Pixel `pixel-access-s12` on `release/2400-train` (reference) | runner @ `2cec97a47` | 10 passed |
| Design detector (`impeccable detect`) over the three changed UI files | workstation | no findings |

Evidence PNGs were written on the runner under `docs/design/evidence/TTS-DEFAULT-ENGINE-2400/` and were not copied back.
The runner's `.tmp_*` of these jobs was deleted. No gate was running (gate status `done`), 104-110 GB free.

## NOT_RUN

- `layout-access-s12.spec.ts` (the layout guard sweep over skins x themes x widths, ~30 min): not run - the display card's rows use
  the card's existing `.row` / `.lbl` / `.ctl` pattern; run it with the train's layout lane.
- `pixel-wiskey-stations.spec.ts` / `layout-wiskey-stations.spec.ts`: not run. With no fixed engine (the default) the composer renders
  exactly as before; the new warning line appears only with a missing fixed engine (covered by the evidence spec, not by pixels).
- `evidence-wiskey-actions.spec.ts` (fixture backend, `SW_WISKEY_FIXTURE=1`): not run; the overview dialog is covered by the new evidence
  spec against the mocked backend.
- The full backend suite and the full release gate: not run (targeted files only).
- Real WisKey / Home Assistant / station: not contacted (no lab access in this slice). Whether the lab's engines list languages for
  every engine was not checked; an engine that lists none takes the fixed language as it is.
- A local Vite / browser run on the workstation: not done (runner only, per the brief).
