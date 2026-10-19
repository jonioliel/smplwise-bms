# GET /tickets/dashboard - batched visibility (speed fix, branch pilot/DASHSPEED-290)

Base: `pilot/DASH3-290` @ ba6c3f718. Spec: `docs/design/MANAGER_DASHBOARD_SPEC_HE.md` section 5 (150 ms ceiling at 20,000 requests /
200,000 timeline rows) and the phase-3 as-built speed note (about 80 % of the time in `access.visible_by_id`, once per ticket).

## What changed

* `services/tickets/store.py` - `ticket_rows_unchecked(conn, ids)`: the same `_TICKET_SELECT` as `ticket_row_unchecked`, one `IN (...)`
  read. Rows are built with `dict(zip(names, row))` (one pass) instead of `dict(sqlite3.Row)` (a linear name lookup per column, quadratic
  in the 61 columns); when a column name repeats it falls back to `dict(row)` so the first-match rule is the same as the single read.
  Added to the bypass guard in `tests/test_tickets_visibility.py` (only `access.py` may call it).
* `services/tickets/access.py` - `visible_many(viewer, ids)`: reads the rows in batches of `BATCH_IDS` (500), reads the module switch once,
  then decides every row with `_decide()`, the body of `visible()` moved out unchanged (`visible()` = row present + module on + `_decide`).
* `services/tickets/dashboard.py` - `_Managed.prefetch(ids)` decides every id of a list in one batched read before the loop; `get()` is
  unchanged and still falls back to `visible_by_id` for an id nobody prefetched. The two `_Managed` objects of one answer (the filtered
  one and the all-departments `everywhere`) share the raw decisions, so a ticket is read once per answer.

Not changed: the rule itself, the manager / department filter, the API shape, the UI, the 30-second cache, any other route.

## Equivalence (identical results)

`tests/test_tickets_mgrdash_batch_visibility.py`, a mixed-permission seed: done / closed / sent-back / open tickets in two departments,
tickets placed on floor 2 and floor 3, a ticket created by a non-member, tickets sent to the vendor and to an outside contact with a quote
and a payment demand waiting. Callers: joni (admin), mona and cleo (department managers), alda (all departments, manages nothing), tom
(member, shared handler), nora (non-member creator), fred and gil (floor-scoped), dina (member with a tickets.view deny), vic (no ticket
permission).

* the batched rows equal the single reads (values, keys, key order);
* `visible_many` equals `visible_by_id` for every caller and every ticket (plus an unknown id), with batches of 500 and of 2 (the seams);
* the seed really mixes the permissions (each caller sees a different set);
* module off: the batch hides everything too;
* `dashboard.summary` with the batch equals the per-ticket path (`prefetch` switched off) for every caller x period (today / 7d / 30d) x
  department (none / maintenance / cleaning), at a fixed `now`;
* the route answers the same both ways for mona, cleo, joni.

No case was found where the batch shows a ticket the per-ticket path hid.

## Timings (workstation, 2026-10-19, local SQLite in a temp dir, 20,001 requests / 200,002 timeline rows, cold route, cache cleared per call)

The workstation was busy throughout (about 45 % CPU from other programs), so the standalone medians below varied by tens of ms between runs.
The reliable comparison is the interleaved A/B (last table): the same seed and process, old and new call by call.

Standalone `test_the_summary_answers_within_150_ms_on_20000_requests` (median of 7, ms):

| caller / period | before (per ticket) | after (batched) |
| --- | --- | --- |
| department manager today | 125.9 | 77.8 - 91.0 |
| department manager 7d | 104.5 | 83.3 - 99.5 |
| department manager 30d | 166.7 | 144.2 - 159.3 |
| all-departments today | 146.0 | 118.4 - 131.7 |
| all-departments 7d | 150.3 | 139.0 - 176.0 |
| all-departments 30d | 246.0 | 194.0 - 249.2 |

(The phase-3 note measured 204-636 ms on the same test earlier in the day; the machine load differs.)

Interleaved A/B `test_batched_visibility_against_the_per_ticket_path` (SW_DASH_PERF_RUNS=9, machine heavily loaded during this run, so the
absolute numbers are high; the answers were asserted identical on every call):

| caller / period | per-ticket median (worst) | batched median (worst) | speed-up |
| --- | --- | --- | --- |
| department manager today | 272.4 (725.1) | 199.1 (373.5) | x1.37 |
| department manager 7d | 350.7 (493.3) | 192.9 (274.3) | x1.82 |
| department manager 30d | 603.1 (808.0) | 387.0 (725.9) | x1.56 |
| all-departments today | 312.4 (543.2) | 231.0 (327.3) | x1.35 |
| all-departments 7d | 385.8 (884.6) | 370.0 (626.0) | x1.04 |
| all-departments 30d | 667.7 (953.5) | 434.9 (866.3) | x1.54 |

## Verdict

Visibility is no longer the main cost (about 1.35-1.8x faster on most views), but **the 150 ms ceiling is still not met reliably** for the
30-day views and the all-departments manager. A profile of the batched path (all-departments, 30 d) puts what is left in reads that are
not visibility:

* the board scan of the department comparison (`board.scan` -> `candidate_rows`), about 35 ms;
* `store_dash.assignment_at` once per ticket (about 950 single reads per answer), about 25 ms;
* the timeline range reads (`status_moves`), about 25 ms;
* the batched ticket-row read itself, about 30 ms (61-column rows; a narrower read would be faster, but `Seen.row` would then differ
  from the per-ticket path, so it was not done).

Next candidates (not done here, outside "batch the visibility"): batch `assignment_at` for the window's ticket ids, and reuse one board scan.

How to rerun: `SW_DASH_PERF=1 python -m pytest tests/test_tickets_mgrdash_perf.py -s -p no:cacheprovider` (both tests; add `-k batched` for
the A/B only).
