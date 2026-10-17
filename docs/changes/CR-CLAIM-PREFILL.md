# CR-CLAIM-PREFILL - the payment demand is loaded from the approved quote

Status: **implemented on `pilot/CLAIM-PREFILL`** (cut from `integ/270`), not merged, not released. Contract: `docs/tickets/RFQ_BACKEND_CONTRACT.md`
v1.6 section 22. Migration **0115** (additive, one nullable column). **A Fable public-surface review is required before it ships**
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

## 6. Open questions

1. Q1 - Should a quote approved on the handler page (not through an RFQ award) also prefill and require the "above" reason? Built: yes
   (same baseline, D3). Alternative: RFQ awards only.
2. Q2 - One claim per assignment (0083 `UNIQUE (assignment_id)`): once the vendor's first instalment demand is approved, the claim is
   settled and he cannot demand the next instalment through the page. A per-instalment demand on the vendor side needs a model change
   (one claim per instalment, or claim "rounds"). Not built.
3. Q3 - Contract 20.11 said the vendor's page shows nothing of a manager's instalment demand. The pre-selection reveals which instalment
   has an OPEN demand (his own payment, nothing else). Keep it, or pre-select only by due date?
4. Q4 - Should a demand BELOW the approved amount or with other lines also ask the vendor for a note? Built: no (accepted, flagged).
5. Q5 - Should `quote_check` `differs` raise a manager notification, or stay a flag on the card? Built: a flag only.
6. Q6 - The quote card's "according to the approved quote" line still shows the quote's full total after a PARTIAL approval (pre-existing,
   `quote-card.ts` `approvedRef`); fixing it costs bytes in the 61 KB set - fold into the next budget round?

## 7. Tests run

See the branch report: backend pytest (the new file + the related ticket suites), frontend `tsc --noEmit` and the node-only unit specs.
NOT run here (the runner was busy with a release gate): Playwright evidence / layout / pixel suites (incl. the evidence bundle guard against
a rebuilt `www-public`), the add-on build, screenshots.
