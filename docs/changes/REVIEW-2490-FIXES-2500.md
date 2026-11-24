# REVIEW-2490-FIXES-2500 - the three findings of the 2.49.0 review, fixed for 2.50

Branch `pilot/REVIEW-2490-FIXES-2500`, cut from `origin/release/2490-train` at `f73c20728` (the train itself is not touched). Source:
`docs/changes/REVIEW-2490-DIFF.md` on `pilot/REVIEW-2490-DIFF` (findings F1-F3). No setting, migration, wire or API change; no visible
look change (F1 is behaviour; F2 and F3 only change which language a text is in).

## F1 - the tickets table stays on page 1 after its automatic follow-up load (TICKETS-PAGING-2490)

`frontend/src/screens/tickets-table.ts`: `load(more, silent, auto)`. The follow-up load the table starts by itself after a short first
answer with a cursor (fewer than `min(10, limit)` rows: the server's scan budget under the visibility check) passes `auto = true`, and the
page-of-the-first-new-row jump (`fit.reveal(prev.length)`) now runs only for a pressed "load more" (`more && !auto`). So a handler whose
visibility rules hide most tickets opens the table on page 1 (the newest tickets), however many short answers the chain takes. A pressed
"load more" whose own answer is short still shows its first new row: the reveal it set is kept (`PageFit.resetKeep` keeps a wanted
item, or the page shown once measured) and the automatic loads after it do not move it. Phone list and the `scroll` setting: unchanged
(the reveal never ran there).

Test: `frontend/tests/layout-tickets-table-autoload-2500.spec.ts` (mocked API on top of `tickets-table-mocks.ts`).
- desktop: a 1280-wide window short enough that page 1 holds fewer than 10 rows (600 / 520 / 460 px tried in turn); the first answer
  is cut to exactly the rows of page 1 (so the old code opened page 2), the automatic load (cursor checked in the call log) answers 40
  rows: the pager has more than one page and stays on page 1, row 0 drawn. Then on the last page a pressed "load more" shows the page
  of its first new row (as `layout-tickets-table-paging-2490`).
- mobile: the compact list takes the automatic load (6 + 40 rows drawn), no pager, the first row on screen.

## F2 - generator settings follow an in-place switch to English (GEN-UNITS-FIELD-2490)

`frontend/src/generator/gen-settings.ts`: the English settings table was merged once when the module was evaluated; on a page that
booted in Hebrew the English pack (a live table filled in place, `i18n/lang-packs.ts`) was still empty, so "English" was a copy of the
Hebrew. It is now built on an English read from the words in at that moment (`englishText()`), cached, and built again only when the
pack's table is another object. Hebrew reads are unchanged.

Test: a new case in `frontend/tests/evidence-gen-units-en-2490.spec.ts`: a Hebrew page on the thresholds section switches `<html lang>`
to English in place, waits for `html[data-lang-words="en"]` (the pack in and the page asked to render again), then every field label
is English and the units are `bar` / `%`. There is no Node unit pattern for this: in Node every pack is installed before any catalogue
is evaluated, so the defect cannot occur there.

## F3 - the hand-over preview names an unnamed window in the reader's language (I18N-EN-2490, owner N53)

`smplwise_vms/backend/smplwise/services/door_conversion.py`: `listing(..., lang=)` and `_offer(..., lang)` pass the language to
`program_plan`, as `_hand_over` already does; `routers/doors.py` (`GET /intercom/door-path-conversion`) passes
`default_names.lang_of(conn, principal)`. The previewed `program.name` of a schedule without a name is now the name the hand-over
creates ("Door window" for an English administrator). The service default stays Hebrew (a caller without a reader). The rest of the
preview's words (`days_text`, reason texts) stay Hebrew as before - outside this finding.

Test: `test_review2500_hand_over_preview_names_an_unnamed_window_in_the_readers_language` in
`smplwise_vms/backend/tests/test_wxd10_door_jobs.py`: the hold schedule's name emptied in `schedule_cache`; the listing previews
"חלון פתיחה" for a reader without a stored language, "Door window" after `ui.lang = en`; the service called directly gives Hebrew by
default and English with `lang="en"`.

## Tests run (real results)

| Check | Where | Result |
|---|---|---|
| `tests/test_wxd10_door_jobs.py` (whole file, 14 tests incl. the new one), main `.venv` | workstation | **14 passed** (53.7 s) |
| The new backend test with the F3 fix stashed (service + router reverted) | workstation | **failed as expected**: `'חלון פתיחה' == 'Door window'` |
| `ruff check` (py -3.12) on `routers/doors.py`, `services/door_conversion.py` | workstation | clean (the test file shows 4 old F811/F841 findings on lines this change does not touch) |
| `scripts/gate/lint_spec_waits.py` on the new spec and `evidence-gen-units-en-2490.spec.ts` | workstation | 0 findings |
| `tsc` (app + tests/scripts), `vite build`, Playwright `layout-tickets-table-autoload-2500`, `layout-tickets-table-paging-2490`, `unit-tickets-table`, `evidence-gen-units-en-2490` (desktop + mobile, `--workers=2`) | runner slot B, one job (`~/work/revfix_job.sh`, log `~/work/revfix_job.log`) | **NOT_RUN** - queued at 04:59 UTC, lost in the runner reboot (~05:55 UTC), re-queued once at 05:58 UTC; at 07:59 UTC it had not started (the 2.49.0 gate was still running and slot B needs 6 GB free during a gate; 13 jobs queued). Left queued: the log fills when it runs. |

No screenshot or look change is expected (F1 is behaviour, F2 / F3 change only the language of a text), so no compare page was made.
