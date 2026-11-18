# CR-I18N-COMBINED-C-2442 - durations/units + typed confirmation words, one entry check

Base: `pilot/CR-I18N-UNITS-2442` (f2efe4574, on CR-I18N-COMBINED-B-2442 4f1c8988f). Merged:
`pilot/CR-I18N-CONFIRM-WORDS-2442` (e075ead38). Read the two source notes for the content.

## Conflicts and resolution
- `docs/i18n/GLOSSARY_EN.md`: union - UNITS' "stay Hebrew" paragraph (Hebrew calendar date) without the typed words (they now
  have English counterparts), UNITS' durations paragraph, then CONFIRM-WORDS' table section.
- `frontend/tests/unit-i18n-api-2442.spec.ts` (allow-list): union of removals - UNITS removed the format helpers (FORMAT const,
  rules.ts entry), CONFIRM-WORDS removed the typed words (TYPED const, schedules.ts / nvr-connection.ts / installer.ts /
  capture-lease.ts entries). Kept: HEBREW_DATE (home-config.ts 34) and the CONFIRM-WORDS comment.

## Tests actually run (workstation)
- `npx tsc --noEmit`: exit 0.
- unit config, --workers=1: unit-i18n-api-2442, unit-i18n-locale, unit-confirm-words-2442, unit-i18n-core: 51 passed.

## NOT_RUN
Everything else (entry check on the runner): browser specs, pixel, backend (the backend side is CONFIRM-WORDS' own commits,
run there: 50 + 50 + 284/287 then 53).

## Pixels expected
None in Hebrew.

## Entry check 89d53b12d (RED) - repair 18.11
1. Backend `tests/test_gate_always_run.py::test_every_package_scanner_is_listed_or_reviewed`.
   Cause: CONFIRM-WORDS added `tests/test_confirm_words_2442.py`, whose tests walk the whole backend package
   (`ROOT.rglob("*.py")`: no router / service keeps its own copy of a confirmation word; only the listed modules call
   `confirm_words.typed_lang(`). The detector (`select_tests.PACKAGE_SCAN_RE`) matches it, but the file was not on
   `tests/gate_always_run.json`. A real scanner: a far change (a new router that copies a word) would not reach it by import
   closure or name stem. Fix: listed under `backend` (it now runs in every gate), with what it pins.
2. Preview `evidence-tickets.spec.ts:56 [desktop]` drawer evidence: `Test timeout of 60000ms exceeded` inside
   `page.screenshot` (after "fonts loaded"), in the full run and again in the retry; the mobile retry passed (25.3 s).
   Findings: the runner wrote the light/classic, dark/classic and light/domus drawer images 15-19 s apart and timed out on the
   fourth (dark/domus) - every step slow, no single step stuck. The whole run was overloaded (load ~45, nightly gate in
   parallel): 40 other previews failed in the full run and passed alone, and the retry shard ran 17 tests in 6.7 min. The same
   test on main: nightly cc69447f1 21.3 s, release train d849af79c 26.0 s; CR-I18N-COMBINED-2441 failed it once in its full
   run and passed its retry in 12.0 s. Workstation (this head + the fix): passed in 20.5 s, each image 2-3 s; a probe of the
   open drawer in all four skin x scheme cases showed no render loop (0-1 mutations and 120 frames in 2 s, no running
   animation). No translated string or selector of this spec changed. Verdict: runner load, not a code fault; no code or
   test change, no quarantine.
   Runner, a private copy of the gate's own build of 89d53b12d (~/work/i18nc, removed after), load 45-49 with the nightly
   gate running: 1 passed in 20.1 s (the four images 2-6 s apart), then `--repeat-each=3`: 3 passed in 49.0 s.

### Tests actually run (repair)
- Workstation backend, `py -m pytest tests/test_gate_always_run.py tests/test_confirm_words_2442.py -p no:xdist`: 69 passed
  (the completeness guard failed before the fix with exactly `['test_confirm_words_2442.py']`).
- Workstation `npx vite build` + `evidence-tickets.spec.ts:56 --project=desktop --workers=1`: 1 passed (20.5 s).
- Runner (gate build of 89d53b12d, private copy): `evidence-tickets.spec.ts:56 [desktop]` 1 + 3 passed.

### NOT_RUN (repair)
- `npx tsc --noEmit` (no TypeScript touched), the other previews, pixel, the full backend: the new entry check runs them.
