# Deep review 2.56 - area 5 TICKETS (id prefix `TK`)

Reviewed head: `origin/release/2560-train` at `3739e3ded` (read-only detached worktree). Plan: `docs/review/FINAL-REVIEW-PLAN-2560.md`
section 3, area 5. Method: read-only; no test was run for this review (every finding below is CONFIRMED by reading the code path end to
end unless marked PLAUSIBLE; none was executed - NOT_RUN). Weekly usage was near its ceiling, so the never-read ground was sampled, not
read in full (see section 5).

## 1. Summary

| id | severity | title | file:line |
|---|---|---|---|
| TK-01 | medium | Public handler page: a draft edited after a lost answer is "sent" as the OLD request (replay by route only) - the correction is silently dropped | `frontend/src/public-ticket/state.ts:195-199`, `smplwise_vms/backend/smplwise/services/tickets/public_app.py:359-375`, `services/tickets/handler_actions.py:144-148` |
| TK-02 | medium | RFQ compare: a multi-vendor award stops at the first award that needs a second approval; the other selected vendors are never awarded, the selection is cleared and the toast says "the choice was saved" | `frontend/src/tickets/rfq-compare.ts:159-172`, `frontend/src/tickets/rfq-model.ts:364-366` |
| TK-03 | low | Home "send note": a retry after a lost answer with an edited text replays the first note (same class as TK-01) | `frontend/src/home/home-tickets.ts:157-167`, `smplwise_vms/backend/smplwise/routers/home_family.py:205-231` |

Counts: critical 0, high 0, medium 2, low 1. Old findings of the area: 4 FIXED, 0 still open, 0 partial.

## 2. Findings

### TK-01 (medium, CONFIRMED in code) Public handler page: an edit after a lost answer is swallowed by the idempotent replay

The page keeps one request id per part of the draft (`crids.status`, `crids.note`, `crids.eta`). `planSend` creates them on the first
press and reuses them "on every retry" (`state.ts:171-192`); `editDraft` drops the `queued` flag but deliberately keeps the ids
(`state.ts:195-199`; the unit test `frontend/tests/unit-public-ticket.spec.ts:114-118` asserts "the request ids stay" after one more
letter, another chip or another ETA). The server replays by `(link scope, crid, route)` only: `Idempotency.run` returns the stored first
answer when the route matches (`public_app.py:365-370`), and `handler_actions.set_status` / `add_note` / `set_eta` do the same inside the
transaction through `claim(...)` (`handler_actions.py:144-148, 182-187`). The body of the repeat is never compared with the first.

Scenario: a technician on bad reception taps "done", types "replaced the compressor", presses send. The request reaches the server (the
status moves to done, the note is stored, door access ends via `access_grants.on_ticket_ended`) but the answer is lost -> `offline` ->
queued (`afterSendFailure`). He corrects the note ("replaced the compressor and the fan") or switches the chip back to "in progress",
and presses send. Same `crids.status` -> the server replays `{"ok": true, "status": "done"}`; `afterStep` clears the draft
(`state.ts:213-218`), the page shows "sent". The corrected note never reaches the ticket; the chip change is not applied. The status case
shows itself after the reload, the note text does not (the page has no echo of the stored note). The same shape exists on the claim
page: `claim-model.ts:767-775` keeps the pending `crid` across form edits (`claim-step.ts:1333-1347`) - an edited amount after an
unknown outcome replays the first submission (PLAUSIBLE there: the reloaded claim shows the stored revision, so the loss is visible).

Fix (preferred, server): keep a digest of the request body with the stored answer (`RequestLog.put` and the in-transaction `claim`) and
answer `409 request_id_reused` when a repeat carries a different body; the page then drops that part's id, reloads the view and
re-plans. Client alternative: `editDraft` drops the id of each part whose content changed (status chip -> `crids.status`; note ->
`crids.note` and `crids.status` when the status step carries the note; ETA -> `crids.eta`) and the page re-reads the ticket before the
re-planned send. Update the unit test at `unit-public-ticket.spec.ts:114-118` accordingly.

### TK-02 (medium, CONFIRMED in code) RFQ multi-vendor award: everything after a pending second approval is dropped

`splitPlan` (`rfq-model.ts:364-366`) turns the selection into one award call per vendor, `finalize` only on the last. `award()` in
`rfq-compare.ts:159-165` sends them in order and `break`s as soon as one answer is `pending_second` (correct: the server refuses any
further award with `409 award_pending`, `services/tickets/rfq.py:1113-1114`). After the loop the page shows `awardPendingDone`
("the choice was saved and waits for a second approval", `rfq-text.ts:310`) and clears the selection (`this.sel = new Map()`,
line 171), the payment plans, the arrivals and the notice choices.

Scenario: the department has a threshold; the manager selects vendor A (plumbing, above the threshold) and vendor B (electrical, below)
and confirms. A becomes `pending_second` with `finalize = 0`; B is never sent. The toast says the choice was saved; the selection and
B's edited payment schedule are gone. When the second approver confirms A, `_finalize` runs with `finalize = 0`
(`rfq.py:1084-1086`), so B's and every other vendor's quotes stay `submitted` and nothing is closed out - the manager's decision for B
exists nowhere and nobody is told.

Fix: order `splitPlan` so the awards that will need a second approval go last (the page already computes `secondApprovalHint` per
selection), or refuse a multi-vendor confirm that mixes a second-approval award with others; in every case, when the loop stops early,
keep the unsent selections, say which vendors were not awarded, and do not clear their schedules.

### TK-03 (low, CONFIRMED in code) Home ticket note: an edited retry replays the first note

STALE-ANSWERS-2540 gives the note one request id per opening of the sheet (`home-tickets.ts:135`) and keeps it after a failure
(`home-tickets.ts:164`: cleared only on success). The server replays by user scope + key + route (`home_family.py:220-225`), no body
comparison. Lost answer -> the resident edits the text -> send -> the first note's answer comes back, the toast says "sent", the edit is
lost. Fix: the same body digest as TK-01 on `ticket_requests`, or a new `noteCrid` when the text changed after a failed send.

## 3. Re-verification of old findings

| old id | status at `3739e3ded` | evidence |
|---|---|---|
| SCR-05 (high) | FIXED (SCREENS-FIX-B-2520) | `public-ticket/main.ts:136-140`: `online` resends only `this.queued()`; `state.ts:202-211`: queued only after a pressed send failed `offline`, any edit clears it; `parseDraft` keeps `queued` only with request ids (`state.ts:241`). Residual about edits after the press: TK-01. |
| SCR-39 (medium) | FIXED (STALE-ANSWERS-2540, `e45542b2f`) | `home-tickets.ts:158` early return on `busy`, `:162` immediate `requestUpdate()`, `:164` request id; server idempotent in the write transaction (`home_family.py:205-231`, `get_conn` = BEGIN IMMEDIATE, so two concurrent repeats serialize); tests `test_home_ticket_note_idem_2540.py`. Residual: TK-03. |
| SCR-40 (medium) | FIXED (SCREENS-FIX-B2-2520) | draft stored with `link = linkId(token)` (`main.ts:223-227`), read through `draftFor` (`state.ts:163-165`), `send()` stops when the link changed mid-send (`main.ts:366-369`), `forget()` drops only this link's draft (`main.ts:151-156`). |
| SCR-56 (low) | FIXED (LOWS-FRONTEND-2550, `83585bdbf`) | `tickets-table.ts:386-387` + `table-model.ts:402-412` `keepNewerRows` keeps the row the screen holds at a higher revision (the inline answer writes `revision`, `tickets-table.ts:445`); `calendars/view-calendar.ts:958-959` `rollbackMove` puts a refused drag back before the reload; unit test `unit-lows-frontend-2550-screens.spec.ts`. |

## 4. Improvements (short)

- `rfq.second_approvers` (`rfq.py:980-1001`) builds a full `Viewer` for every active user on every award, confirm, decline and dashboard
  count (`second_signer`). Fine at today's user counts; cache per request if the dashboard grows.
- `vendor-accounts.ts:252` `confirmPaid` has no `if (this.busy) return` (the button is disabled only after the next render). Harmless:
  the bulk mark-paid is idempotent per claim revision (`already_paid` counts as done), but the guard is one line.

## 5. Checked and fine / not covered

Checked and fine:
- New code since 2.52 in the area (15 files, +55/-39): `home-tickets.ts` (SCR-39), `tickets-table.ts` + `table-model.ts` (SCR-56), the
  `controlled` switches in `system-tickets.ts` (module switch, urgent, schedule arrival, question badge, vendor uploads) and the settings
  screens under `tickets/` - read every hunk; the switches stay in the server's state on failure.
- Public listener idempotency: `Idempotency.run` claims the key in-process before the lookup (concurrent duplicate -> 409
  `request_in_progress`), stores only 2xx, and the handler actions also record the id inside their own transaction (`public_routes.py:90-112`),
  so a crash between the effect and `RequestLog.put` does not double an action.
- Vendor portal sign-in (`vendor_portal.py:353-492`): uniform 202 for any number, the plan on a read connection, per-number cool-down and
  caps, code bound to the requesting network, 5 counted guesses, single-use compare-and-set, session hash only, 30 min absolute TTL.
- Outbound documents (`out_documents.py`, `public_documents.py`): derived token in the fragment, hash-only lookup, compare-and-set on
  `open_count`, `attachment` + `nosniff` + no-store, HTML served as octet-stream.
- Ticket e-mail channel (`channel_email.py`): body HTML-escaped, outcome classes (timeout = unknown, never retried), nothing logged.
- RFQ award / confirm / decline / cancel (`rfq.py:967-1260`): cost permission, quote revision, self-approval refusal, one pending
  award at a time, sole-signer path, terms prepared before the first write, notice checked before the write in confirm mode.
- RFQ compare page award loop: busy guard, locked dialog, selection re-filtered to `can.award` after the reload (a re-press cannot award
  an approved quote twice); vendor accounts load has a sequence guard.

Not covered (honest list): the rest of the ticket main app (`tickets-overview.ts`, the detail screen, board, map, visits), `tickets-rfqs.ts`
list, the RFQ send / remind / order flow (`rfq.py:729-840`, `rfq_orders.py`), `rfq_terms.py` (1,222 lines), `costs.py` (1,124 lines) and
`ticket-cost-card.ts`, the public `portal/` and `claim/` page internals beyond the draft / request-id logic, `public_rfq.py`,
`portal_more.py`, `cost_files.py` (PDF intake), the WhatsApp channel, the ticket migrations, and the area's tests beyond the ones named
above. Nothing was executed.
