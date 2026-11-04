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
   "יעדי הכרזה": "מנוע הקראה קבוע" (`ברירת המחדל של המערכת (<name>)` first, then WisKey's engines) and "שפת ההקראה" (automatic + the
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
content area; the measured heights are recorded in the receipts below.

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

## Receipts

(filled below)

## NOT_RUN

(filled below)
