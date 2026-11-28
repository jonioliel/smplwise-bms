# Deep review 2.57 (second pass) - area TICKETS (id prefix `TK2`)

Reviewed head: `v2.56.0` = `6ea807b2e` (read-only detached worktree, then this branch for this one file). Scope: the "Not covered"
list of `docs/review/DEEP-REVIEW-2560-TICKETS.md` (branch `origin/review/DEEP-2560-TICKETS`). Brief:
`private/handoff-package/scripts-2026-11-27/review2_brief_2570.md`. The findings of the 2.56 pass (TK-01, TK-02, TK-03) are not
repeated here; its "checked and fine" ground was not re-read.

Method: every write path, authorization path and money path of the scoped files was read end to end; the large frontend screens
were sampled (their load / write / race paths read, their rendering only scanned for unsafe sinks). Findings are CONFIRMED (read end
to end, and where stated, executed) or PLAUSIBLE. The area's tests were run on the runner (section 3).

## 1. Summary

| id | severity | title | file:line |
|---|---|---|---|
| TK2-01 | medium | "Approve with correction" re-taxes the claim at TODAY's VAT rate, not the rate frozen in the vendor's revision; the dialog previews the old rate, the server approves another total | `smplwise_vms/backend/smplwise/services/tickets/costs.py:712` -> `:475`; contrast `:690`; preview `frontend/src/tickets/ticket-cost-card.ts:623` |
| TK2-02 | low | Requests-for-quotation list: counts, state filters and search work only on the newest 200 loaded rows; a quiet refresh drops the pages loaded with "load more" | `frontend/src/screens/tickets-rfqs.ts:189-195, 234-241` |
| TK2-03 | low | Ticket detail: an action or photo upload still in flight when the user opens another ticket writes the OLD ticket back into the drawer | `frontend/src/tickets/ticket-detail.ts:497-508, 896-906, 812-818` |
| TK2-04 | low | Manager overview: the slow part (approval count, awarded-request details) has no department guard after its awaits - a department switch can show the previous department's numbers | `frontend/src/screens/tickets-overview.ts:607-641` |

Counts: critical 0, high 0, medium 1, low 3.

## 2. Findings

### TK2-01 (medium, CONFIRMED in code and by a runner test) "Approve with correction" re-taxes at today's VAT rate

`money.py` (module note) defines the VAT rate as "in basis points ... frozen in the revision". `costs.adjust` (the manager's
"אישור עם תיקון") builds the correction with `draft(conn, claim, {**body, "currency": base.get("currency")}, vat_mode=base.get("vat_mode"))`
(`costs.py:712`): it carries the corrected revision's currency and VAT MODE, but `draft` computes with `s.vat_rate_bp`, the CURRENT
installation setting (`costs.py:475`). The sibling path `approve(exceptional="exclude")` does it right and recomputes with
`int(base["vat_rate_bp"])` (`costs.py:690`). The cost card's adjust dialog previews the corrected total with the revision's own rate
(`ticket-cost-card.ts:623`, `this.preview(rev?.vat_mode, rev?.vat_rate_bp, ...)`), so the manager confirms one figure and the server
approves another.

Scenario: a vendor submits an invoice in December at 17 %; on 1 January the installation's VAT setting is changed to 18 % (as in
Israel in 2025), or an administrator corrects a wrong setting. In January the manager corrects one line of the December claim. The
dialog shows the total at 17 %; the approved revision (`kind = adjustment`) is stored with `vat_rate_bp = 1800` and a higher
`approved_total_minor`, which goes to the budget check, the payments board, the CSV export and "mark as paid". Nothing in the answer
says that the rate changed. The same happens with `vat_mode = included` (the net and the VAT split change).

Executed: `tests/test_p2570r_tk_confirm.py` (runner only, not committed) submits at 1800 bp, switches the setting to 1700 bp, adjusts,
and asserts the stored adjustment carries 1700 bp and a total taxed at 17 % (section 3 has the result).

Fix: pass the base revision's rate into `draft` for an adjustment (e.g. a `vat_rate_bp` parameter next to `vat_mode`, used by
`adjust` with `int(base["vat_rate_bp"])`), so adjust and approve-without-exceptional agree; add a regression test that changes the
setting between submission and adjustment.

### TK2-02 (low, CONFIRMED in code) The RFQ list computes everything from the first 200 rows

`tickets-rfqs.ts` loads ONE page of every visible request (`state: 'all', limit: 200`, line 193) and derives the state strip's counts
(`stripCounts(base, ...)`, line 241), the state filter and the text search (`visible()`, line 235: `inFilter`, `matchesQuery`) from
the loaded rows only. The server orders by latest activity (`rfq.visible_page`, `rfq.py:255-283`). With more than 200 requests
(about a year of use at a busy site; closed ones count), an OPEN request with no recent activity falls past row 200: the "open" count
is too low, the "open" filter does not list it, and a search by its number says "no match" until the user happens to press "load
more". In addition every quiet refresh (`onNotice` -> `load(true)`, line 216; also lines 156 and 351; `more = false`) replaces the list with page 1 again,
dropping the pages already loaded, and a refresh that lands after a "load more" (no sequence guard) can mix pages.

Fix: send the state filter, the department and the query to the server (the route already takes `state`, `department_id` and `q`)
and take the counts from a count answer, or at least say "showing the newest 200" next to the strip; give `load()` a sequence guard
and keep the loaded pages on a quiet refresh.

### TK2-03 (low, CONFIRMED in code) Ticket detail: a late answer of the previous ticket overwrites the drawer

`willUpdate` resets the drawer and loads the newly opened ticket (`ticket-detail.ts:449-464`), and `load()` checks
`id !== this.ticketId` (line 474). The write paths do not: `run()` assigns `this.t = next` (line 508) whatever ticket is open now;
`uploadFiles` does the same once per photo (line 905), and `sendHandlerMessage` too (line 818).

Scenario: a manager uploads three photos to ticket A from the drawer and, while they upload (seconds each on a phone), taps ticket B
in the list. B loads; then each finished photo of A puts ticket A back into the drawer while the address and the list selection say B.
An action pressed now targets `t.id` = A (the content shown is A's, so it is not a silent wrong target, but the screen contradicts
the list and the user may act on the wrong request). The `ticket-changed` event also carries A while B is selected.

Fix: capture the ticket id at the start of `run`, `uploadFiles` and `sendHandlerMessage` and ignore the answer when
`this.ticketId` changed meanwhile (the same guard `load()` has).

### TK2-04 (low, CONFIRMED in code) Manager overview: the slow part ignores a department switch after its awaits

`loadSlow()` (`tickets-overview.ts:607-641`) guards the requests-for-quotation pages once (`this.slowKey !== dept`, line 612), but
the awarded-request details are assigned after a second await without that check (line 620), and the approval count
(`accountClaims ... .then((r) => (this.approval = r.rows.length))`, line 636) and the handled counts have no guard at all. When the
manager switches from department A to B while A's slow answers are in flight, A's answers that arrive after B's overwrite them: the
"waiting for my approval" tile (when the summary route is not available, line 729) and the payment dates of awarded requests show
department A's figures under department B.

Fix: re-check `this.slowKey === (dept ?? '')` before every assignment in `loadSlow` (or one sequence number per slow load).

## 3. Tests run (runner, slot B, v2.56.0 detached worktree)

All on the Linux runner, worktree at `6ea807b2e`, through `~/work/slotb.sh` (job scripts `p2570r_tk_run.sh`, `p2570r_tk_confirm.sh`).

| what | command | result |
|---|---|---|
| backend, the area's 129 test files (name matches ticket / rfq / portal / claim / cost / whatsapp / vendor / wa_ / home_ticket) | `pytest -q -o addopts=""` in 11 chunks of 12 files, one process per chunk, `SW_WIRE_STRICT=1` | **3,834 passed, 7 skipped, 0 failed** (11 chunks, all exit 0) |
| frontend, the area's 76 node-only unit specs (`unit-*` matching tickets / rfq / portal / claim / cost / vendor / visit / board / public / quote / demand / whatsapp / tk) | `npx playwright test -c playwright.unit.config.ts --workers=2` | **668 passed, 0 failed** (all 76 files ran) |
| TK2-01 confirmation (not committed) | `pytest tests/test_p2570r_tk_confirm.py` | **1 passed**: base revision 1800 bp, adjusted revision 1700 bp, approved total 35,100 (2 h x 150 at 17 %) - the bug reproduced |

The 7 skips are opt-in measurements or by design, not hidden failures: 3 x `test_tickets_image_intake::test_peak_rss_of_one_decode_per_path`
(`SW_MEASURE_RSS=1` only), 2 x `test_tickets_mgrdash_perf` (`SW_DASH_PERF=1` only), `test_tickets_naming` (the defaults file itself),
`test_tickets_public_prefix::test_f3_a_rebuilt_public_bundle_does_not_hardcode_t_in_its_calls` (the committed public bundle predates
TK255; the release rebuilds it - worth a look that the release gate runs it against the rebuilt bundle).

Observation on test strength: the whole suite passes on a build that has TK2-01, i.e. no existing test changes the VAT setting between
a submission and an adjustment (`test_tickets_costs.py::test_adjust_creates_a_manager_revision_with_a_reason_and_the_vendor_sees_it`
asserts the VAT MODE is carried, not the rate). NOT_RUN: Playwright evidence / layout / pixel specs of the area (not in scope of a
review run), the page-driven `unit-*` specs (none of the 76 selected was a page spec).

## 4. Checked and fine

- `public_rfq.py` (all routes): the token resolves only through `rfq_context`; every write re-reads the link inside its transaction
  (`_still_serving`: revoke, new generation, contact change, read-only grace, code switched on meanwhile); idempotency by
  `(link scope, crid, route)` in-process and inside the write transaction; files served only past the code, link re-read, plain ids
  only, fixed headers; the upload refuses a declared length above the configured cap before any budget, the edge counts streamed
  bytes against `max_body`, one upload in flight per link, memory / storage admission before the body, the precheck and the write
  re-check the link, stored bytes removed on every failure and on a raced replay; the code send / verify map every refusal to a fixed
  code. The multipart parser refuses duplicates, unknown fields, file/text mismatches and extra parts.
- `portal_more.py`: both sections behind their own switch after the session; ids are per-session HMACs (no enumeration across
  sessions); allow-listed answers; code-protected invitations show no title or quote; technician requests: the same answer whether or
  not the number exists, per-company pending and daily caps, duplicate tap returns the pending row; approver scope (configure / all
  departments / managed departments), department-scoped approvers cannot deactivate a shared technician and attach only to the
  intersection; retention and erase.
- `cost_files.py`: size cap before scanning, `%PDF-` / `%%EOF` checks, name scan with `#xx` decoding, bounded inflate (ratio, 32 MiB
  cap, 4000 streams, 4 layers), predictor / indirect filter refusals, never parsed or rendered by the server, download-only headers.
  The internal upload route runs the scan with the write lock released and re-checks the permission afterwards.
- `money.py` (integers only, half-up per line, VAT once, strings only, caps), `costs.py` decisions (revision + revision-id checks,
  self-approval refusal on approve / adjust, reasons, payment date range, reopen once), the bulk mark-paid (per-item permission and
  savepoint, idempotent), the budget confirmation savepoint, the CSV export (formula guard, rate limit, row cap, audit).
- `rfq.py` send / remind (`729-826`): manager check, revision check on send, every refusal before the first write, outbox idempotency
  keys per link generation / per hour; `rfq_orders.py`: order needs RFQ manager + department manager + create rights, refusals
  before writes, savepoint (`item_transaction`), idempotent by request key and by "order exists", the message only on an explicit
  click with the exact preview, re-send keyed per change.
- `rfq_terms.py`: plan parsing (one final last, advance first, dates ordered and in range, percent <= 100 %), conversion in integers
  with the remainder on the final instalment, explicit choice of a vendor proposal, vendor acknowledgement bound to the schedule hash
  when sent, compare-and-set on the terms revision, manager accept refuses a past window, instalment demands idempotent;
  `rfq_postpone.vendor_postpone` (range, one open notice, cap).
- `public_claims.py` claim submission: claim mode re-checked in the transaction, the body is part of the replay key (the TK-01 fix of
  2.56 for this route), no-money links refused.
- `channel_whatsapp.py`: connect vs transfer error split (unknown is never retried), no body or number logged, buttons only when
  enabled, the recipient guard.
- Ticket migrations 0079-0178: every table rebuild (0087 links, 0089 / 0128 / 0170 outbox, 0117 cost claims, 0128 RFQ messages)
  either has no ON DELETE CASCADE children or keeps them in temporary tables across the DROP (checked by grep of every
  `REFERENCES` to the rebuilt tables).
- `routers/tickets_map.py` (visible ticket; manager or creator to change; element ids only for map readers; SVG with a sandbox CSP),
  `routers/tickets_visits.py` (manager / assignee checks, revision on every change, zone-less times read as UTC by the shared helper).
- Frontend: no `unsafeHTML` / `innerHTML` in `tickets/`, `screens/tickets-*` or `public-ticket/` (the public bundle builds DOM through
  `dom.ts` text nodes); every `href` is built from ids or server-generated URLs; the claim page's money parsing mirrors the server's
  string rules; the board is read-only with a sequence guard; the cost card and the detail screen have busy guards.

## 5. Still not covered (honest)

- `tickets-overview.ts` (1,255 lines), `ticket-detail.ts` (1,287), `screens/tickets-board.ts`, `rfq-board.ts`, `rfq-terms.ts`: sampled
  for load / write / race paths only; rendering, layout and the settings panels were not read.
- `rfq.py` outside 700-860 and the quote / award parts already covered in 2.56 (e.g. `submit_quote`, `cancel`, `purge`,
  `retention`, `detail`, `comparison`) - not read; `rfq_terms.py` reminders / escalation / overdue (`690-770`, `1158-1222`) and
  `reschedule*` (`966-1102`) - not read; `claim_prefill.py` (instalment basis) - not read.
- The internal screens use the browser's time zone for RFQ dates (`rfq-model.ts` `localToIso` / `isoToLocal`), while messages use the
  installation zone; this is the documented screens rule ("the browser's zone, the screens' rule", `message-lines.ts:13`), so it is not
  reported as a finding, but a manager working from another zone sees and enters RFQ times in that zone.
- `outbox.py` (928 lines) retry and fallback logic, `inbound.py` (WhatsApp inbound), `messaging.py`: not read.
- The public `portal/` and `claim/` page code beyond the sinks, the token hand-off and the money parsing: not read.
- Test assertion strength: an AST scan of the 129 backend files for test functions without any assert / raises / helper found only
  helper-based tests (checked by sampling); no test that cannot fail was identified. For the 76 frontend unit specs only a count
  check was made (no spec has fewer `expect` calls than tests); their assertions were not read one by one.
