# CR-TEMPVENDOR-295 - the temperature report on the vendor-report queue

**Branch:** `pilot/TEMPVENDOR-295` (from `origin/integ/2100` @ f32770899 + a merge of `origin/pilot/VENDORQ2-295` @ 6e7ed2dc5; the merge was
conflict-free). **Migrations: none** (`infra_temp_report_sends` already has `recipient_kind` / `contact_id`, `status` has no CHECK; the channel
rides in `request_json`). **Everything stays OFF by default** behind the existing `reports.*` switches of the service module
(`reports.to_contacts`, `reports.email`, `reports.documents`). Fakes only in tests: no real WhatsApp, e-mail, PDF engine or phone.
Implements the exact list of `CR-VENDORQ2-295.md` section 3 and the hook-up notes of `CR-VENDORQ-294-DESIGN.md` section 7.

## Owner decision applied (lead's recommendation)

A vendor has no Arx scope. He receives **exactly the units the sender selected**; the send is **refused at queue time** (`vendor_scope`,
HTTP 422) when the sender cannot see every one of them (devices.read on the unit's sensor, the same rule as the unit list), and it is checked
**again at hand-off and again at send time** (units the sender can no longer see are dropped; nothing left -> nothing is sent). A report is never
a way around the scope. A schedule uses its creator as the sender.

## What changed (the 8 items of section 3)

1. **Provider** - new `services/temperature_vendor_reports.py`, registered once as `temperature` (imported by `temperature_whatsapp` and
   `temperature_runtime`, so it exists before any queued report is sent). `body()` rebuilds the text at SEND time from the send row's
   request (`rep.build` + `rep.text_summary(..., external=True)`; no "full report available in the system" note, a vendor has no access);
   `outcome()` mirrors the outbox state on the send row (`sent`; `unknown` -> `failed/unknown_outcome`; `not_sent|refused|cancelled|superseded`
   -> `failed` with the outbox code); `still_relevant()` is False for a deleted send row or a deleted / disabled schedule (the outbox asks it when the module was switched off and on
   again, as for every message; a report already handed to a running outbox is withdrawn with the managers' existing cancel act).
2. **`recipients()`** - vendors are `selectable` when vendor reports are on (module on + `reports.to_contacts`) and at least one channel can
   carry the report; `channels` gives `ok` or the reason per channel (`no_whatsapp | no_email | reports_email_off | no_contact`), `channel` is the
   first usable one, and `vendor_reports: {enabled, email}`. While off: unchanged (`selectable: false`, `coming_later`). Never a number or address.
3. **`_check_recipients()`** - a vendor row is accepted only while the service module is on and `reports.to_contacts` is on (else the old
   422 `vendor_coming_later`), for an active, non-erased `ticket_contacts` row of kind vendor (`recipient_vendor`), with a channel `whatsapp`
   or `email` (`validation`; e-mail also needs `reports.email`, else `reports_email_off`).
4. **`queue_send()`** - vendor rows: `recipient_kind='vendor'`, `contact_id`, `user_id=NULL`, `created_by` = the sender (the schedule's
   creator for a schedule run), `request_json.channel`. The `vendor_scope` check happens here. `save_schedule()` runs the same check.
5. **`process()`** - a vendor row goes to `_hand_off_vendor()` instead of `_send` / `resolve_number`: it calls `contact_reports.queue(
   module="temperature", source_id=<send row id>, idempotency_key="temperature:<id>", use_key="infra.temperature.reports", channel=...,
   document_id=...)` inside one write transaction and sets the row `handed`. A `ReportRefused` ends the row `skipped` with the code as the reason.
   The outbox owns the send hours, pacing, retries, number / address rules and the outcome.
6. **Document by temporary link** - `ATTACHMENT_MODES` gains `"link"` (installation setting `report_attachment`, now `none | link`).
   With mode `link` **and** `reports.documents` on, a vendor row renders the PDF (outside any write transaction; chart + events, no signature
   line), mints it with `out_documents.mint(recipient_kind='contact')` in the SAME transaction as the queue row and passes `document_id`. The
   queue then appends the line "the full report (available until ...): <link>" with the `#d.<token>` fragment link. A failure after the mint
   revokes the document (`send_failed`). PDF engine busy -> `retry` (5, 10, 15 min), then `skipped/pdf_unavailable`; PDF too large ->
   `skipped/document_too_large`. **The text is never sent without the document the sender asked for.** The `html` mode still waits for
   `CONTRACT-WHATSAPP-DOCUMENT-SEND-295.md`. System users never get a link (`attachment_for` returns None for them).
7. **Dialog** (`frontend/src/temperature/whatsapp.ts`) - vendors selectable when the API says so; a per-vendor channel pick (WhatsApp, and
   e-mail only when `reports.email` is on) with the reason shown on the button / next to the row; the picked channel travels with the
   recipient (`recipientPicks`); the preview shows the vendor text when only vendors are chosen; statuses `handed` etc. in four languages
   (he / en / ar / ru; ar / ru are developer translations, native review pending). No hint paragraphs, no service-request action (the dialog has
   none, and the vendor list is empty-disabled while the module is off), no platform branding.
8. **Tests** - see below.

## Rules kept

* **Channel**: WhatsApp or e-mail **per report, chosen by the manager; there is no automatic fallback in either direction** (a vendor with no
  number and a WhatsApp pick is `skipped/no_whatsapp`, never an e-mail; a failed or unknown WhatsApp report is final).
* **Quiet hours**: the temperature pass holds vendor rows until the installation's send hours (`held/send_hours`), and the outbox applies
  its own send hours again to the handed report (the send row stays `handed` until the outbox sends).
* **Audit rows**: `infra.temperature.report.send` (now with the vendor count), `infra.temperature.report.handoff` (allowed / denied with the
  code, channel, unit count, whether a document), `infra.temperature.report.schedule_skip` (a scheduled recipient refused), the outbox's
  `ticket.message.send` (module, document flag), `report.document.mint`. None carries a number, an address, a text or a token.
* **Tickets module off**: no vendor is selectable and a vendor send is refused (`vendor_coming_later`) even with `reports.to_contacts` on; the
  dialog has no ticket action.

## Test evidence

See the closing report of the task (exact counts). Backend: `tests/test_tempvendor_295.py` (new) plus the existing
`test_infra_temperature*.py` and `test_vendorq_294_*.py`. Frontend: `tests/unit-tempvendor-295.spec.ts` (new), `unit-temperature*.spec.ts`,
`unit-reports-settings.spec.ts`; screenshots from `tests/evidence-temperature.spec.ts` (three new tests) in
`docs/design/evidence/TEMPVENDOR-295/`.

## Known limits / open items

* `report_attachment = link` is set through the temperature settings API only (there is no control for it in the UI; "no new capabilities").
  Superseded by TEMPREPORT-297 (2026-10-27): Settings > Infrastructure > Temperatures has the control, and the mode now also covers system users.
* The attached-file (WhatsApp document) and `html` modes still wait for the WhatsApp file contract.
* The dialog is manager-only (`infra.temperature.manage`), as before; no separate permission for sending to vendors was added.
* A document is a snapshot taken at hand-off; the text is rebuilt when the message leaves (after a night hold the text can be a few hours
  fresher than the PDF; the range is fixed, so only late-arriving data differs).
* The public document page still needs the Fable public-surface review before `reports.documents` is switched on in a release (VENDORQ-294).

## Rollback

Switch `reports.to_contacts` off (vendors vanish from the dialog; queued report rows still leave unless cancelled by the managers' cancel act,
open `handed` rows keep their state) or revert the branch: the schema is untouched. A leftover `handed` row with the provider unregistered ends
`not_sent/report_unavailable` in the outbox.
