# CR-VENDORQ2-295 - leftovers of VENDORQ-294: settings card, e-mail channel, temperature hook-up (specified), WhatsApp file contract

**Branch:** `pilot/VENDORQ2-295` (from `origin/pilot/VENDORQ-294` @ ea5250342; VENDORQ-294 is already merged on `integ/2100`, so everything
here is additive). **Migrations: none** (the e-mail channel reuses the `ticket_outbox` columns of the provisional 0129; the one new setting
lives in the tickets settings document). **All switches stay OFF by default. No real WhatsApp or e-mail was sent (fakes only). The eight WisKey
switches and `GO_LIVE_PERMITTED` are untouched.**

## 1. Settings card (built)

Settings > the service module > "message channel" tab (administrators only: the tab needs `system.configure` and so does the server route)
shows a new card "Reports to vendors" (`tickets/reports-settings.ts`, element `<tickets-reports-settings>`, words in
`i18n/vendor-reports.ts` in he / en / ar / ru; ar / ru are developer translations, native review pending). It has three switches and two
numbers and no explanatory paragraphs:

| Control | Key (`PUT /api/v1/tickets/settings`, block `reports`) | Default | Range |
|---|---|---|---|
| Send reports to external contacts | `reports.to_contacts` | off | bool (master switch) |
| Also send by e-mail | `reports.email` (new) | off | bool; disabled while the master switch is off |
| Document by temporary link | `reports.documents` | off | bool; disabled while the master switch is off |
| Link validity (hours) | `reports.document_hours` | 72 | 1..168; disabled unless documents are on |
| Downloads per link | `reports.document_max_opens` | 5 | 1..20; disabled unless documents are on |

Values are checked in the browser (`reports-settings-model.ts`) and again by the server (`settings_doc`). An older server without the
`reports` block shows nothing. The card offers no service-request action, so the tickets-module-off rule has nothing to hide; the settings
tabs themselves exist only while the module is enabled.

## 2. E-mail as the second delivery channel (built)

* `reports.email` (default off) is a second switch ON TOP of `reports.to_contacts`; both must be on.
* `contact_reports.queue(..., channel="whatsapp" | "email")` - the caller picks the channel per report. **There is no automatic switch
  between the two** (a failed WhatsApp report does not become an e-mail, and the reverse). Refusal codes added: `report_channel`,
  `reports_email_off`, `no_email` (no address on the contact, or the installation's SMTP is not configured).
* The report goes through the SAME queue (`ticket_outbox`, purpose `report`): the outbox's send hours hold it at night, the existing
  e-mail pacing (10 per hour) applies, `unknown` is final and never retried, the audit row and the module's outcome hook are unchanged. The
  contact's own address is read from the directory at send time (never stored in the row); the SMTP configuration is the product's own
  (`channel_email`), the administrator recipient list is not involved.
* Same text rules as WhatsApp: the provider's text is rebuilt at send time, one paragraph, at most 700 characters, a link-looking provider
  text ends `not_sent` / `report_unsafe`; an organisation line first. The subject is one word per language ("Report"). With a document the
  same "full report (available until ...)" line carries the same `#d.<token>` link (the token rides in the fragment, so mail scanners that
  fetch the URL consume no download).
* Failures: a text/document problem ends `not_sent` with the same non-retryable codes; an SMTP failure before hand-over is `not_sent`, a
  recipient refusal `refused`, a timeout `unknown`; the report's document is revoked when the report does not leave.
* Design doc corrections: section 4 ("WhatsApp only ... no e-mail fallback") and section 8 ("No e-mail fallback") are superseded by this
  section; the rule "no automatic fallback" stands.

## 3. The temperature report on the vendor-report queue (NOT connected - exact list of what is missing)

**What was found.** The temperature report is on `integ/2100` (merged from `origin/pilot/TEMPCTL3-293` and `origin/pilot/TEMPFIX-293`); it is
not part of this branch's base, so it could not be changed or tested here. Relevant code on `integ/2100`:
`services/temperature_whatsapp.py` (queue_send, recipients, process, attachment_for, schedules), `services/temperature_report.py`
(`build`, `text_summary`), `routers/temperature.py` (the recipients route, `vendor_coming_later` refusal), `frontend/src/temperature/whatsapp.ts`
(vendors listed disabled), table `infra_temp_report_sends` (migration 0124: `recipient_kind`, `contact_id` already reserved, `status` has no
CHECK). `contact_reports` has no registered provider yet (the module name `temperature` is reserved in the design doc, section 7).

**Why not connected now.** It needs edits in five temperature files plus the dialog, on a base this branch does not contain, and it contains
one open product decision (below). It is mechanical once that is decided. Estimated size: about 250 lines backend + 60 lines frontend + 12
tests.

**Exact changes needed (on a branch cut from `integ/2100`):**

1. New file `services/temperature_vendor_reports.py`: a provider with `body(conn, row, lang)`, `outcome(conn, row)`, `still_relevant(conn, row)`
   registered once at import (`contact_reports.register("temperature", Provider())`).
   * `body`: read `infra_temp_report_sends` by `row.source_id`; rebuild with `temperature_report.build(conn, units, doors, from, to, lang,
     ts, chart=False, events=False, signature=False)` for the units named in the send row's `request_json`; return
     `ReportBody(temperature_report.text_summary(model), document_id=<minted PDF id or None>)`. Return None (-> `report_unavailable`) when no
     unit is left.
   * `outcome`: map the outbox state onto `infra_temp_report_sends.status` (`sent` -> `sent`; `unknown` -> `failed` / `unknown_outcome`;
     `not_sent` / `refused` / `cancelled` / `superseded` -> `failed` with the outbox `outcome_code` as `reason`).
   * `still_relevant`: False when the send row or its schedule was deleted or disabled.
2. `temperature_whatsapp.recipients()`: vendors become `selectable` when `contact_reports.reach(conn, id, channel)` is `ok` (add
   `reach` per channel: `ok | no_whatsapp | no_email | reports_email_off | no_contact`); keep the reason string otherwise.
3. `temperature_whatsapp._check_recipients()`: accept `kind == "vendor"` when `contact_reports.enabled(conn)` and the contact is an active,
   non-erased `ticket_contacts` row of kind vendor; keep the 422 `vendor_coming_later` only while `reports.to_contacts` is off.
4. `temperature_whatsapp.queue_send()`: insert vendor rows with `recipient_kind='vendor'`, `contact_id=<id>`, `user_id=NULL`; add the chosen
   `channel` (`whatsapp` | `email`) to `request_json` (no schema change).
5. `temperature_whatsapp.process()`: a vendor row does not go through `_send` and `resolve_number` (those are for system users and their
   personal consent). It calls `contact_reports.queue(conn, module="temperature", source_id=<send row id>, contact_id=..., requested_by=<created_by>,
   idempotency_key="temperature:<send row id>", use_key="infra.temperature.reports", channel=..., document_id=...)` inside a write
   transaction and sets the row `status='handed'` (new value, no CHECK on the column). The outbox then owns hours, pacing, retries and the
   outcome; the provider's `outcome` closes the row. A `ReportRefused` ends the row `skipped` with `reason=<code>`.
6. `attachment_for()` / `ATTACHMENT_MODES`: add `"link"`: mint the PDF with `out_documents.mint(...)` for the vendor (`recipient_kind='contact'`)
   when `reports.documents` is on, return its id. The `html` mode waits for the WhatsApp file contract
   (`CONTRACT-WHATSAPP-DOCUMENT-SEND-295.md`).
7. `frontend/src/temperature/whatsapp.ts`: vendors selectable when the API says so; a per-recipient channel pick (WhatsApp, and e-mail when
   `reports.email` is on) with the reason shown when a channel is not available; no new hint paragraphs.
8. Tests (fakes only, on the existing temperature fixtures): vendor row -> outbox `report` row; send hours hold it; provider rebuilds the
   text at send time; outcome mirrored; vendor with no number / no address -> `skipped` with the reason; switches off -> `vendor_coming_later`;
   a module with the scope of the sender only (below); both channels; the schedule path; no number / text / token in rows or logs.

**Open decision for the owner (blocks step 4/5).** A system-user recipient gets only the units he may see himself (`_visible_units`). A
vendor has no Arx scope. Proposal: the vendor receives exactly the units the sender selected in the dialog (or that the schedule names), and
the send is refused at queue time for any unit the sender may not see himself, so a report is never a way around the scope. Alternative:
a per-vendor unit list kept on the contact. Recommendation: the proposal; it needs no new table.

## 4. WhatsApp file attachment (contract written, nothing built)

The WhatsApp send service is not in this repository (no `send_document` / `send_image` / `send_file` anywhere). The exact interface Arx
needs from that side - call shape, limits, error codes and their outcomes, idempotency, capability discovery, privacy, and five questions -
is in `docs/changes/CONTRACT-WHATSAPP-DOCUMENT-SEND-295.md` for the owner to pass on. Until it is answered the only document mode is the
temporary link.

## 5. Tests

* Backend `tests/test_vendorq_294_reports.py` (extended): the settings default now lists `email: False`; the e-mail switch needs its own
  switch and never opens the master switch; refusal codes; an e-mail leaves with the text built at send time (subject, text, no WhatsApp
  call, no address / number / text in the row or the log); send hours hold an e-mail report; unusable text / missing provider end `not_sent`
  without switching channel; an SMTP timeout is `unknown` and final; an erased contact gets nothing; a live document gives the same link line.
* Frontend `tests/unit-reports-settings.spec.ts`: model (defaults off, ranges, patches), four-language catalogue parity, copy rules (no
  platform branding, short labels, no ticket action), mount point and permission tab.
