# CR-I18N-ELECTRICITY-2443 - electricity: the remainder of the i18n row (08:F11) and the shared customer form (08:F25)

Branch `pilot/CR-I18N-ELECTRICITY-2443`, cut from `origin/release/2438-train` at 5bcea468d (it contains the i18n combined
branches A/B/C, `CR-I18N-CAL-ELEC-2441` and `CR-I18N-API-2442`). MASTER_PLAN row `pilot/CR-I18N-ELECTRICITY-2436` (code review
08:F11 electricity, 08:F25 customer helpers); REMAINING_WORK_2026-11-18 group G11. Scope: `src/electricity/*` except
`meter-card.ts`; `src/screens/water/page-customers.ts` is not touched (held by `pilot/CR-A11Y-ROWS-2443`).

## Measured before (on the base)

The planning note said only `elec-settings` / `-settings-calendar` / `-wizard` were done. On the base the whole area is done:
`CR-I18N-CAL-ELEC-2441` (in the train) moved those three files and added a completeness spec and a lint spec for the area, and
the base had moved every other file before. Checked, not assumed:

- `tests/unit-i18n-cal-elec-lint.spec.ts` and `-completeness.spec.ts` on the base: 13 passed. No Hebrew literal outside `tr()`
  in `src/electricity/*` except the lint's listed exceptions.
- `node scripts/i18n_missing_keys.mjs --json`: `msg/electricity` 585 keys, 0 missing, 0 identical, 0 Hebrew, 0 unused;
  `msg/api-electricity` 73 keys, 0 missing.
- No `Asia/Jerusalem` or `he-IL` literal in `src/electricity/*` (the zone half of F11 does not apply to this area).

So no text was left to move. What remained was F25 and one dead Hebrew export.

## What changed

1. **`src/electricity/customer-form.ts`** (new, 08:F25): the customer card's form, once - the fields, the empty form, the form
   of a loaded customer, the checks (name, e-mail, customer number; an empty number fails only with `numberRequired`), the
   body sent on save (name trimmed; an unchanged number left out of an edit) and the list search. No text and no UI: each page
   words its own errors. Both customer pages edit the same record (CR-WATER78 section 16), and both carried a copy.
2. **`src/electricity/elec-customers.ts`** uses it; its own copy (`EMAIL`, `Form`, `blank`, the inline checks, the body, the
   search) is gone. Behaviour is the same: the same checks in the same order with the same texts, the same bodies sent.
3. **`src/electricity/elec-format.ts`**: `HEBREW_DAYS_UNIT` removed - exported, imported nowhere (`src`, `tests`, scripts).
   Its two Hebrew words were one of the lint's listed exceptions; the entry is removed from
   `tests/unit-i18n-cal-elec-lint.spec.ts` (the lint fails on a listed text that is gone).
4. **`tests/unit-electricity-customer-form.spec.ts`** (new, 5 cases): the empty / loaded form, the checks with and without a
   required number, the save body, the search, and that `elec-customers.ts` keeps no copy of its own.

No change to `src/i18n/msg/electricity.ts` and no new English: no text was added or moved. Nothing for `GLOSSARY_EN.md`.

## Hebrew output: identical

Token compare, as `CR-I18N-API-2442` did: every Hebrew-bearing string / template text of `src/electricity/*.ts` (TypeScript
parser, comments and regular expressions not counted), base 5bcea468d against the final tree, as a multiset per file.
Result: one file differs, `elec-format.ts`, by the two words of the removed dead export (`יום`, `ימים`). `elec-customers.ts`:
35 texts before, the same 35 after. 1,017 texts in the area in all.

## Left for the water side (not this branch)

`screens/water/page-customers.ts` still has its copy (`EMAIL`, `Form`, `blank`, `customerFormOf`-like load, checks with an
optional number, save body, search with the address). Adopting `customer-form.ts` there is a few lines:
`customerFormProblems(form, { numberRequired: false })`, `customerSaveBody(form, card)`, `customerMatches(c, q, [c.address])`;
the create keeps its `customer_number: f.customer_number || undefined`. It belongs to the branch that holds the file
(A11Y-ROWS) or a follow-up after it merges.

## Still Hebrew in the English electricity screens (by design, not changed)

- The lint's listed literals: the A4 bill paper (`elec-bill-paper.ts`, kept word for word with the Hebrew PDF), its watermark
  and the settings preview's sample bill, the demo data, and the names saved to the server (`name_he` of a new season / band
  and of the Israeli template's seasons, day types and bands in `elec-tou.ts`).
- Server texts shown as they arrive (`*_he` fields: notes, warnings, formula sentence, day-type names, special-day names).

## Tests actually run (workstation, `--workers=1`)

- `npx tsc --noEmit` (frontend): clean (exit 0) on the final tree.
- Playwright unit config, 7 spec files, one run: **84 passed, 1 failed** (85).
  - new: `unit-electricity-customer-form` 5;
  - the area's i18n guards: `unit-i18n-cal-elec-lint` 4, `unit-i18n-cal-elec-completeness` 9;
  - electricity logic: `unit-electricity-billing` 25, `unit-electricity-readings` 6;
  - registry / core guards: `unit-i18n-core` 9, `unit-i18n-api-2442` 27 (26 passed, 1 failed - see below).
  - The one failure is **not this branch's** and is on the base already: `unit-i18n-api-2442` "completeness: msg/api-home"
    reports `api/tile-layout.ts: אוטומטי` without English in `src/i18n/msg/api-home.ts`. The missing-keys report run on the
    untouched base showed the same (`msg/api-home` 1 missing). `src/api/*` and the home table are outside this row; for the
    lead (one line in `msg/api-home.ts`, "Automatic" per the glossary).
- `node scripts/i18n_missing_keys.mjs` (no `--write`), before and after: `msg/electricity` 585 keys, 0 missing, 0 unused;
  `msg/api-electricity` 73, 0 missing. Hard-coded Hebrew in `src/electricity/`: 138 -> 136 literals (the dead export), all of
  them the lint's listed exceptions.
- The token compare above (a throw-away script in the agent's scratchpad, not committed).

## NOT_RUN

- Page, evidence, layout and pixel suites of the area (`electricity-*.spec.ts`, `evidence-electricity-*.spec.ts`,
  `layout-electricity*.spec.ts`): they need a build and a browser; the PC is busy and the runner is not used tonight.
- No runner job and no entry check (acceleration rule (c): the branch merges into the train, the release gate checks it).

## Pixels to refresh

None. Hebrew and English output are unchanged.
