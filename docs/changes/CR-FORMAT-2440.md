# CR-FORMAT-2440

Code-review batch 16.11, frontend wave 2. Contract: the `pilot/CR-FORMAT-2436` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` (finding 08:F10). Base: `origin/release/2437-train` (2.43.7 train).

## What and why

Formatting helpers were re-typed per module with slightly different output: `formatBytes` x4, day arithmetic on `YYYY-MM-DD` x5,
inclusive day counts x3, zero padding in every one of them. They now live once in a small pure folder, and **every call site keeps
its exact output** by passing its own options. No screen was edited; the modules keep their exported names and signatures.

New `frontend/src/format/` (no DOM, no imports outside the folder):

| File | Exports | Replaces |
|---|---|---|
| `bytes.ts` | `formatByteSize(n, options)`, `BYTE_UNITS_EN`, `BYTE_UNITS_HE` | the four `formatBytes` bodies |
| `day-key.ts` | `addDays`, `addDaysByParts`, `addDaysIso`, `daysInclusive`, `daysDiff`, `dayKeyToUtc`, `utcToDayKey`, `dayKeyParts`, `DAY_MS` | five `addDays`, three inclusive counts |
| `pad.ts` | `pad2`, `dayKey`, `hhmm` | `p`, `p2`, inline `padStart(2, '0')` |

How each variant keeps its output:

| Call site | Was | Now |
|---|---|---|
| `api/exports.ts` `formatBytes` | KB (plain rounding), MB 1 decimal, GB 2 decimals, em dash for null | `formatByteSize(n, { gb: true })` (the null check stays local) |
| `public-ticket/claim/claim-model.ts` `formatBytes` | at least "1 KB", MB rounded half-up to 1 decimal | `{ minKb: 1, mb: 'round1' }` |
| `tickets/cost-model.ts` `formatBytes` | bytes under 1024 ("312 B"), KB, MB 1 decimal | `{ showBytes: true }` |
| `tickets/rfq-files-model.ts` `formatBytes` | Hebrew or English units, at least 1 KB, "1.2" / "3" / "12" MB, '' for a bad number | `{ units, minKb: 1, mb: 'short', invalid: '' }` |
| `access-control/events-logic.ts` `addDays` | key read by the ISO parser | `addDaysIso` (same form; a malformed key still throws `RangeError`) |
| `access-external/model.ts`, `request-model.ts` private `addDays`; `daysBetween`, `daySpan` | `Date.UTC` by position | `addDays`, `daysInclusive` |
| `electricity/elec-format.ts` `addDays`, `daysInclusive` | the same form | re-exported from `format/day-key.ts` under the same names |
| `tickets/calendar-model.ts` `addDays`, `keyOf` | key written from the calendar numbers | `addDaysByParts`, `dayKey` |
| `tickets/cost-model.ts` `todayIso`, `calendar-model.ts` `timeText`, `access-external/model.ts` `hoursText`, `request-model.ts` `codeDue`, `elec-format.ts` `periodContaining` | inline `padStart(2, '0')` | `dayKey` / `hhmm` / `pad2` |

Three `addDays` forms are kept as three functions on purpose: they agree on every well-formed day of the years 1000-9999 (pinned),
and differ only outside that (a year below 1000 or above 9999, a malformed key). Each call site keeps the form it had.

The one known difference, on an input no caller can produce: the claim page's `formatBytes(NaN)` wrote `'NaN KB'` and writes
`'NaN MB'` now (a `File.size` is always a number). Pinned in the spec so it is a recorded fact, not a surprise.

Left for a second pass, as the review says: `agoText` x8, `whenText` x7, `durationText` x7 (they read different catalogues) and the
`pad` copies in files outside this row.

## The pinning spec was written and run before the swap

`frontend/tests/unit-format-pins.spec.ts` holds, for every replaced variant, the old body copied verbatim (`LEGACY.*`) and compares
over a table (edges, a fixed pseudo-random sweep, leap days, the Israeli clock-change days, malformed keys):
the module export of today == the old body, and the shared helper with the call site's options == the old body; plus literal
strings for what the operator reads.

- Commit `d9d32d5d6` = the helpers + the spec, modules untouched: **11 passed** (so the copies are true copies and the options are
  right before anything is swapped).
- The swap is the next commit; the same spec after it is in "Tests actually run".

## Resolved file list

- new `frontend/src/format/bytes.ts`, `day-key.ts`, `pad.ts`
- `frontend/src/api/exports.ts`, `frontend/src/tickets/cost-model.ts`, `rfq-files-model.ts`, `calendar-model.ts`,
  `frontend/src/public-ticket/claim/claim-model.ts`, `frontend/src/access-control/events-logic.ts`,
  `frontend/src/access-external/model.ts`, `request-model.ts`, `frontend/src/electricity/elec-format.ts`
- new `frontend/tests/unit-format-pins.spec.ts`
- `docs/changes/CR-FORMAT-2440.md`

Outside my rows:

- `frontend/tests/unit-public-claim-model.spec.ts` (one line of its source lint): the claim page's sources could import only from
  `./` and `../lang-packs`; `claim-model.ts` is in this row and now imports `../../format/bytes`, so the lint also allows
  `../../format/<name>` (pure helpers with no imports of their own). The public bundle gains about 30 lines and loses the old body.

## Pixels

No (plan row): text output is identical by table. The pixel gate was NOT run locally (runner only).

## Tests actually run

Workstation, 16.11.2026 (16 GB, under 1 GB free for most of the session):

- Before the swap (commit `d9d32d5d6`, modules untouched):
  `npx playwright test -c playwright.unit.config.ts tests/unit-format-pins.spec.ts --workers=1`: **11 passed**.
  (The first draft of the spec had two wrong assumptions of mine - that the calendar's form agrees with the others below the year
  1000, and that an empty key gives `NaN` - both were corrected in the spec, not in the code; the nine equality tests passed from
  the first run.)
- After the swap: the same spec plus the unit specs of every touched module -
  `unit-format-pins`, `unit-access-events-logic`, `unit-access-external`, `unit-access-request`, `unit-electricity-billing`,
  `unit-electricity-readings`, `unit-public-claim-model`, `unit-public-claim-prefill`, `unit-rfq-attachments`, `unit-tickets-3b`,
  `unit-tickets-calendar`, `unit-tickets-costs`, `unit-tickets-quotes` (`--workers=1`): **196 passed, 0 failed**.
- `npx tsc --noEmit` (whole frontend): TSC_RESULT

NOT_RUN:

- The public-ticket build (`npm run build:public`) and its bundle check: no memory for a build. The new import is a relative path
  to a pure module inside `src/`, type-checked by `tsc`.
- Browser specs (evidence / layout) and the pixel gate: runner only.
