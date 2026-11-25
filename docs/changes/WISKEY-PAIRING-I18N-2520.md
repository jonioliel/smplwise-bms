# WISKEY-PAIRING-I18N-2520 - the pairing lines of "חיבור Arx ל-WisKey" in the page language

Branch `pilot/WISKEY-PAIRING-I18N-2520`, cut from `pilot/WISKEY-STATUS-I18N-2520` at `4c0014602` (merged into the 2.52 train).
Coordinator decision Q1 = a of WISKEY-STATUS-I18N-2520: the pairing LINES of the same card, their "how to fix", the steps outside Arx
(`owner_steps`) and the steps after a re-pair (`steps`) get the same code + params path. Q2 = a: Arabic / Russian later, with the whole
screen.

## What

- **Backend, additive (ADR-015); every Hebrew text unchanged.**
  - `services/wiskey_pairing.py` `_line`: every line also carries `fix_code` (the FIX key of `fix`; `null` when `fix` is null - an ok line,
    or a reason without a fix) and `params` (the values `text` was filled with). A value that is itself a Hebrew word also carries its
    stable code as `<name>_code` (new `codes=` argument): `bridge_silent` `since_code: pairing` (no directory time yet), `discovery_feed`
    `video_code` / `talk_code: yes | no`, `events_gap` `start_code: unknown` and `why_code: <EVENT_GAP_WHY key>`, `events_ok`
    `caught_code: until | not_yet` (+ `caught_at`), `error` `code_code: <ERROR_TEXT key>`.
  - The steps are now a table, `STEP` (11 codes, the same Hebrew word for word; `{url}` = `addon_url`), with `ANNOUNCED_STEPS` /
    `MANUAL_STEPS` and `step_texts()`. `owner_step_codes()` gives the codes; `owner_steps()` keeps its signature and Hebrew output.
    The status answer adds `owner_step_codes` next to `owner_steps`; `routers/wiskey_pairing.py` repair adds `step_codes` next to `steps`.
  - `wire/wiskey_pairing.py`: the optional fields on both line models, both status models and the repair model;
    `frontend/src/api/generated/wire-wiskey-pairing.ts` regenerated (`scripts/gen_wire_types.py`).
- **Frontend catalogue** `frontend/src/i18n/wiskey-pairing-status.ts` (new) + English pack `lang/en/i18n/wiskey-pairing-status.ts`
  (moved by `scripts/i18n-split-langs.mjs`, `lang/en.ts` regenerated): `lbl_<line key>`, `l_<reason>`, `x_<fix_code>`, `s_<step code>`,
  `v_<param>_<code>` (the word values, the 6 gap reasons, the 14 error texts) and `link_providerRow`. Hebrew page: the server's words.
  English page: the sentence of the code with the params (word values replaced by their English); a code, word or step the page does not
  know, or a missing value, falls back to the server's Hebrew. An older server without `fix_code` keeps its Hebrew fix; without step codes
  (or a count that does not match) the Hebrew steps.
  - The server's Hebrew still names the probe button by its older words ("בדיקה מול WisKey"); the English uses the button's real
    English, "Check the signed connection".
- **Screen** `frontend/src/screens/system-wiskey-pairing.ts`: the line label / text / fix, the provider line's link label, the owner steps
  and the repair steps read through the catalogue. `frontend/src/api/wiskey-pairing.ts` types the optional fields.

The card's refusal messages are not part of this row: they go through the `ApiError` English table (`error_text_en.json`), which has
`confirm_required`, `repair_not_needed` and `rotation_in_progress` of the repair, but not the two `not_system_admin` texts that
`require_system_admin(text=...)` raises for the probe and the repair (open question 1).

## Files

- `smplwise_vms/backend/smplwise/services/wiskey_pairing.py`, `smplwise_vms/backend/smplwise/routers/wiskey_pairing.py`,
  `smplwise_vms/backend/smplwise/wire/wiskey_pairing.py`, `smplwise_vms/backend/tests/test_wiskey_pairing_i18n_2520.py` (new)
- `frontend/src/api/generated/wire-wiskey-pairing.ts`, `frontend/src/api/wiskey-pairing.ts`, `frontend/src/screens/system-wiskey-pairing.ts`
- `frontend/src/i18n/wiskey-pairing-status.ts` (new), `frontend/src/i18n/lang/en/i18n/wiskey-pairing-status.ts` (new), `frontend/src/i18n/lang/en.ts`
- `frontend/tests/unit-wiskey-pairing-i18n-2520.spec.ts` (new), `frontend/tests/evidence-wiskey-pairing-i18n-2520.spec.ts` (new),
  `frontend/tests/fixtures/wiskey-pairing-i18n-2520.json` (new; the lines as the backend's `_line` builds them, synthetic)

## Tests

Runner job `~/work/p2520_wkpairingi18n_run.sh` at `abfe2dee8` (the code of this row; the commit after it adds only this note):

| Check | Command | Exit | Result |
|---|---|---|---|
| ruff | the 3 backend files + the new test | 0 | All checks passed |
| wire types | `scripts/gen_wire_types.py --check` | 0 | the regenerated `wire-wiskey-pairing.ts` matches |
| backend, one process per file (`SW_WIRE_STRICT=1`) | `pytest tests/<file>.py` | 0 each | `test_wiskey_pairing_i18n_2520` 47 passed; `test_wiskey_status_i18n_2520` 36; `test_wire_routers_b_2450` 66; `test_wire_routers_c_2470` 58; `test_wire_routers_d_2470` 170; `test_wire_route_coverage_2460` 5; `test_wiskey_talk_caps_2382` 28; `test_wiskey_listen_gate_2520` 31; `test_wiskey_pairing_2382` 32; `test_wiskey_activation_runbook` 16; `test_bridge_stale_discovery_2383` 32; `test_wiskey_direct_v2_2520` 39; `test_admin_gate_2438` 22 |
| tsc | app / tests | 0 / 0 | |
| eslint | the 4 source files | 0 | |
| design ratchet | `scripts/design_ratchet.py` | 0 | no count above the baseline |
| unused exports | `scripts/unused-exports.mjs` | 0 | nothing new |
| unit (node) | `playwright test -c playwright.unit.config.ts` | 0 each | `unit-wiskey-pairing-i18n-2520` 5 passed; `unit-wiskey-feature-status-i18n-2520` 6; `unit-wiskey-pairing-2382` 3; `unit-settings-intercom-cards-2401` 15; `unit-i18n-en-ratchet-2490` 6; `unit-i18n-lang-packs-2443` 10; `unit-i18n-core` 9 |
| build | `npm run build` | 0 | |
| evidence, desktop + mobile | `evidence-wiskey-pairing-i18n-2520` (new: English + Hebrew x light + dark, re-pair steps en / he), `evidence-wiskey-status-i18n-2520`, `evidence-wiskey-pairing-2382`, `evidence-settings-intercom-cards-2401`, `layout-settings-intercom-cards-2401` (`--workers=2`) | 0 | 51 passed, 33 skipped (other projects), 0 failed |
| Hebrew pixel baselines (no update) | `pixel-access-s12`, `pixel-skin-qa-followup-2404` | 0 | 15 passed, 15 skipped, 0 failed - no baseline refreshed |
| the new evidence spec on the BASE (`4c0014602`) | same spec, re-run alone | 1 (expected) | the 6 English tests fail (Hebrew lines and steps on the English page), the 6 Hebrew tests pass - the Hebrew output is the same before and after |

On the PC: `pytest tests/test_wiskey_pairing_i18n_2520.py` 47 passed (exit 0); `unit-wiskey-pairing-i18n-2520` 5 passed (exit 0).
NOT_RUN: the full backend / frontend suites (the train's gate covers them).

The runner's disk was full during the job (`/` at 100%, about 1 GB free; not this job's files): the first "before" run failed with
`ENOSPC` in npm and was re-run on its own (`~/work/p2520_wkpairingi18n_before.sh`) after this row's head worktree was removed.

Compare page (local, Hebrew), updated with a second part for the lines: `private/planning/wiskey-status-i18n_compare_2026-11-25.html`.
The card is taller than the screen, so its element shots show the part inside the page's scroll area (the top lines are cut on
some shots); the evidence assertions read every line, not the shots.

## Open questions

1. The two `not_system_admin` refusals of this card ("רק מנהל מערכת יכול לבדוק את החיבור החתום ל־WisKey." / "רק מנהל מערכת יכול לצמד
   מחדש את Arx ו־WisKey.") stay Hebrew on an English page. a) add them to `error_text_en.json` in the next i18n-errors row, and teach
   `scripts/i18n_backend_errors.py` the `text=` argument of `require_system_admin` (recommended) b) leave them.

(Arabic / Russian for the whole card: decided Q2 = a, later with the screen's pack.)
