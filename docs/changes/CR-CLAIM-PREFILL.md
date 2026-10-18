# CR-CLAIM-PREFILL - the payment demand is loaded from the approved quote

Status: **implemented on `pilot/CLAIM-PREFILL`** (cut from `integ/270`), not merged, not released. Contract: `docs/tickets/RFQ_BACKEND_CONTRACT.md`
v1.6 section 22. Migrations **0115** (additive, one nullable column) and **0116** (rebuild of `ticket_cost_claims`: one claim per
instalment, section 8). **A Fable public-surface review is required before it ships**
(it changes `GET /t/api/claim` and `POST /t/api/claim` on the public listener).

## 1. Owner request (2026-10-17, Hebrew intent, summarised)

When a vendor submits a payment demand (דרישת תשלום) after his quote was awarded, it makes no sense that he fills it in again: the form
must LOAD the information from the approved quote. Never any bank data - the system collects none, and keeps it that way.

## 2. Decisions taken in this implementation

| # | Decision | Why |
|---|----------|-----|
| D1 | The prefill rides on the existing `GET /t/api/claim` (`prefill` block) - no new route, no new rate kind. | The claim route already resolves the link, the code gate, claim mode and the uniform 404; a second route would be a second surface to review. |
| D2 | The source is the **baseline** of the link's OWN assignment (DETAIL 4.2: the latest approved / partially approved quote) and it must name the link's contact. An RFQ award reaches it through the work order (18.1: the awarded quote gets the order's `assignment_id`). | Ownership is structural: another vendor's link resolves another assignment, so it can never read this quote; the contact check is defence in depth. |
| D3 | A quote approved on the handler page (not through an RFQ) prefills too. | It is the same baseline the demand is already checked against (DETAIL section 5); the vendor already sees it on `GET /t/api/quote`. Open question Q1. |
| D4 | Only the APPROVED part: a partial approval's lines and its approved figures. | The demand is checked against the approved part; prefilling refused lines would invite exceptional lines. |
| D5 | With an approved payment schedule (RFQ 20.3) the form offers "which payment": the whole quote or one instalment (> 0). The instalment with an OPEN manager demand (RFQPAY2, 20.11) is pre-selected (the lowest index); a correction keeps the vendor's own last choice. | Owner brief: "instalment demands created by a manager pre-select that instalment". |
| D6 | An instalment demand is prefilled as ONE line of the instalment amount, of the first approved line's kind (never an exceptional line), VAT included (schedule amounts include VAT, 20.3). | The schedule has amounts, not lines; one line keeps the total exact. |
| D7 | Every field stays editable. A demand that differs is accepted and flagged for the manager (`quote_check` `differs`: `above_quote` / `below_quote` / `lines_differ` / `currency`); nothing is refused or sent. | Owner: fields editable, flag for the manager in the existing approval flow. |
| D8 | A vendor's demand ABOVE the approved total (or the named instalment) needs a short reason (`above_reason`, <= 500, text hygiene); the server refuses it without one (422 `required`) and refuses a reason that is not needed (422 `not_allowed`, never silently dropped). A manager's on-behalf demand is not refused. Another currency cannot be compared: no reason, flag `currency`. | Owner brief. |
| D9 | What the demand was compared with is stored on the revision (`basis_json`, migration 0115: quote id, basis, instalment index, the basis amount copied from the stored quote / schedule, the reason). | The managers' view must show what the vendor was shown, also after the claim moves on. A view-time guess of the instalment would be wrong. |
| D10 | `quote_check` does NOT set `needs_review`. | `needs_review` switches the manager's approve buttons to "with / without the exceptional line", which is about lines outside the quote; reusing it would offer a meaningless choice. The card shows a "differs" chip, the flags, the instalment basis and the vendor's reason. |
| D11 | The vendor sees the approved amount (or instalment) under the totals with the difference, and the read-only revisions show the difference too. The old `quoteRef` path (the quote card's total, wrong after a partial approval) was replaced by the server's approved figures. | "the vendor sees the approved amount next to the field". |
| D12 | All new public UI lives in a lazy chunk `claim-prefill-*` (fetched only when `prefill` is present), with its own 3 KB gzip cap in both bundle guards. The claim step only calls it; the moved "against the approved quote" string and the removed `quoteRef` / `approved()` paths more than pay for the hooks. | The ticket page had 3 B of headroom. |
| D13 | No bank field anywhere: strict models refuse unknown keys (tested with `iban`, `quote_id`, `total_minor`); `basis_json` holds ids, a copied amount and the reason; the audit row of a submission is unchanged (no reason text). | Owner rule. |

## 3. What was built

* Backend: `services/tickets/claim_prefill.py` (baseline ownership, `prefill`, `basis` validation, `present`, `check`); hooks in
  `costs.py` (`submit` stores the basis, `present_revision` adds `basis`, `public_claim` adds `prefill` and `limits.above_reason`),
  `quotes.demand_view` (`quote_check`), `public_claims.ClaimIn` (`instalment_index`, `above_reason`); migration 0115.
* Public page: `claim/claim-prefill.ts` (lazy: the starting form, the instalment choice, the approved amount + difference, the reason field,
  the client-side check, the payload fields; he / en / ar / ru - ar / ru developer translations pending a native review). `claim-step.ts`
  loads it when `prefill` is present; `claim-model.ts` types; `claim-text.ts` lost `vs_quote` (moved); `quote-card.ts` / `main.ts` lost the
  `approved()` / `quoteRef` path.
* Manager screen: `ticket-cost-card.ts` shows the instalment basis, a "differs from the approved quote" chip with the flags and the vendor's
  reason (he / en).
* Tests: `backend/tests/test_tickets_claim_prefill.py` (negative first), `frontend/tests/unit-public-claim-prefill.spec.ts`; the bundle
  guards book `claim-prefill-*` apart with a 3 KB cap.

## 4. Bundle budgets (the guard's method: gzip of each js / css file; local build into the scratch directory, `www-public` NOT rebuilt)

| Bundle | Before (integ/270 @ 4fde337e) | After | Budget |
|--------|------------------------------:|------:|-------:|
| ticket page (everything not booked apart) | 62,461 B | 62,371 B | 62,464 B |
| `claim-prefill-*` (new) | - | 2,141 B | 3,072 B |

## 5. Security notes (public surface)

* No new route. `GET /t/api/claim` gains `prefill` behind the same link resolution, code gate (403 `code_required`) and claim-mode rules;
  no token / a tampered token / a closed claim window stay the uniform 404 (tested).
* Exposed: HIS approved quote (lines, approved figures, window - already on `GET /t/api/quote`), HIS approved schedule (already on the RFQ
  page `terms`), and which of his instalments has an open demand (new - see Q3). Never a quote id, a vendor / contact field, another
  vendor's quote, a manager's name or a payment status.
* Accepted: `instalment_index` (validated against HIS schedule only - a foreign index is `invalid`, no oracle) and `above_reason` (text
  hygiene, length). The basis amount is the server's.

## 6. Open questions - owner decisions 2026-10-17

1. Q1 - handler-page approved quotes prefill and require the reason too: **keep as built**.
2. Q2 - several demands per assignment: **build it** - done, section 8 (migration 0116).
3. Q3 - the pre-selection shows which instalment has an open manager demand: **keep**.
4. Q4 - no note for a demand below / with other lines: **keep**.
5. Q5 - `differs` stays a flag on the card (no notification): **keep**.
6. Q6 - "according to the approved quote" showed the full quote total after a partial approval: **fix it** - done, section 9.

Still open (new, from section 8):

7. Q7 - A manager's on-behalf demand ("הזנת דרישה בשם הספק") still goes to the PRIMARY claim only; on-behalf demands for later
   instalments are not built (the vendor's page covers them).
8. Q8 - The public step shows the generic error text for the new 409 `instalment_not_open` (a new catalogue string would grow the 61 KB set;
   the page never offers a closed instalment, so only a stale tab meets it).

## 8. Several demands per assignment (owner decision on Q2; migration 0116)

| # | Decision | Why |
|---|----------|-----|
| D14 | `ticket_cost_claims` is rebuilt with `instalment_index` (NULL = the ordinary claim) and the uniqueness moves to `UNIQUE (assignment_id, IFNULL(instalment_index, -1))` (an expression index: two NULLs would not collide in a plain pair). CHECK 0..5. Every existing row is copied with NULL; the children (revisions, decisions, files, revision files) are kept in temp tables across the DROP (foreign keys are ON during migrations) and written back unchanged - the 0087 pattern. | Minimal model change; an assignment without a schedule keeps exactly one claim. |
| D15 | The vendor's FIRST demand that names an instalment takes that index on the ordinary claim ("adopts" it) - no manager demand needed (the existing rules: the claim opened at "done"). The required claim is therefore the one he answers, and no empty ordinary claim lingers in the close gate or the missing-claim janitor. | Keeps the close gate and `claim_missing` meaning unchanged. |
| D16 | After that, a NEW claim for instalment N is opened only when a manager opened an RFQPAY2 demand for N (`open`), N is an instalment of HIS approved schedule with an amount, and N has no claim yet; otherwise 409 `instalment_not_open`. The same instalment again goes to ITS claim (a correction supersedes; settled = 409 `claim_closed`) - never a second row (unique index). | "only if the manager opened a demand for it ... never twice for the same instalment". |
| D17 | Once a WHOLE-quote demand (no index) was approved / paid, no instalment demand opens (409 `claim_closed`); once his demands are per instalment, a demand without an index is 422 `{field: "instalment_index", code: "required"}`. | No double payment of the same money. |
| D18 | The new claim row is written only AFTER the submission validated (`costs._materialise` inside `submit`): a refused demand (no reason above the instalment, a bad line) writes no row. New instalment claims are `required = 0` (the vendor asks; nothing is missing if he does not). | Expected API errors commit the transaction (audit rows), so nothing may be written before the last refusal. |
| D19 | The page works on the FOCUS claim (`costs.focus_claim`): the latest open one; else the NEXT instalment's virtual claim when a manager opened its demand; else the latest. `GET /t/api/claim` adds `instalment_index`, `instalment_fixed` (the page then hides the payment picker) and `claims` (his other demands: instalment, status, counted amount). `claim_mode_ok` opens the claim step while ANY claim's window is open, or - after every window closed - for the department's claim window counted from the manager's demand. | The vendor reaches the next instalment after the job is closed; the link still dies when nothing is open. |
| D20 | Readers: `claim_for_assignment` = the PRIMARY claim (ordinary, else the earliest) for the requirement switch, the claim at "done" and on-behalf; `claims_of_assignment` for the quote-approval lock (any demand locks) and the cost-flow stage (the latest); the vendor portal reads the latest; ticket-level aggregates, the board total, the report, retention, purge and the contact export already iterate claims by ticket / contact. The managers' claim answer adds `instalment_index` (card chip "תשלום N"). | One claim per assignment was assumed only in these places. |

Rollback note: see the header of `0116_ticket_cost_claims_instalments.sql` - possible only while no assignment holds two claims (a
`GROUP BY assignment_id HAVING COUNT(*) > 1` check), by the same rebuild with `assignment_id ... UNIQUE` and without the column.

## 9. Q6 - the approved total everywhere

The quote card's "according to the approved quote" line (`quote-card.ts` `approvedRef`) now reads `quote.approved.total_minor` (the
approved part of a partial approval) instead of the quoted total (+3 B in the ticket set, 62,374 / 62,464). The claim form's approved line
and the read-only revisions' difference already read the server's approved figures (`prefill.total_minor`, the revision `basis`); the
managers' "against quote version N" line reads `baseline.total_minor` = `approved_total_minor` (server, unchanged) - both covered by a
partial-award test. `claim-prefill-*` after section 8: 2,377 B (cap 3,072).

## 7. Tests run

See the branch report: backend pytest (the new file + the related ticket suites), frontend `tsc --noEmit` and the node-only unit specs.
NOT run here (the runner was busy with a release gate): Playwright evidence / layout / pixel suites (incl. the evidence bundle guard against
a rebuilt `www-public`), the add-on build, screenshots.
