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
