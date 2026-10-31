# CR-TEMPREPORT-297 - the temperature report as a document over WhatsApp, now, by temporary link

**Branch:** `pilot/TEMPREPORT-297` (from `origin/release/2241` @ 2e06b4779). **Owner approval:** 2026-10-27 - send the temperature report as a
document over WhatsApp now, without waiting for a WisKey file contract. **Migrations: none.** **Everything stays OFF by default.**

Builds on `CR-INFRA-TEMPERATURE.md` section 9 item 1 (document sending), section 12 (TEMPLINK-295, the user-made link), section 14
(WALINK-295, the manual link send) and `CR-TEMPVENDOR-295.md` (the `link` attachment mode for vendors).

## 1. What was missing

TEMPLINK / WALINK let a manager make a link and send it by hand to a fixed recipient list; TEMPVENDOR gave vendors the PDF by link. The
ordinary WhatsApp report (one-off and scheduled, the dialog the managers already use) still sent SYSTEM USERS the text summary only ("the
full report (PDF) is available in the system"): `attachment_for()` returned None for every user row, and `report_attachment` had no control
in the UI.

## 2. What is built (the no-file-contract option)

> **Amended by the security review TEMPREPORT-2310 (2026-10-30, `docs/security/REVIEW_TEMPREPORT_2310.md`).** The switch for system users is
> now its own installation setting `report_link_users` (OFF by default; still needs `reports.documents`) - `report_attachment` stays the
> VENDOR mode only. A linked PDF names no staff and carries no maintenance reason unless `report_link_people` is on (OFF). The links sent to a
> user die when he withdraws the WhatsApp opt-in or his number changes; "revoke all" covers the vendor links too; the link routes answer
> `Cache-Control: private, no-store`. Where the text below says `report_attachment` for system users, read `report_link_users`.

* **Switch** - the existing installation setting `report_attachment` (`none` by default | `link`) now has a control in Settings >
  Infrastructure > Temperatures > "temporary report download link" ("the full report in WhatsApp messages": none / temporary download link).
  The mode is effective only while the tickets module's `reports.documents` is on (the public listener's switch, already required by the
  link features). Both are off by default.
* **Permission** - a system user's message carries a link only when the person the send is made on behalf of (the one-off sender, or the
  schedule's creator) holds `infra.temperature.report_link_send` at SEND time (site_admin, system_admin by default; editable per role).
  Without it the user gets the plain summary as before. Sending a report at all stays `infra.temperature.manage`.
* **The link** - per recipient and per send, in `temperature_whatsapp.process()`: the recipient's PDF (the units HE may see, chart +
  events, no signature line) is rendered outside any write transaction, minted by `attachment_for()` into `outbound_documents`
  (`recipient_kind='user'`, `recipient_id` = the recipient, `source_id` = the send row, `created_by` = the sender), and the text's PDF note
  becomes "the full report (PDF), to download until <local time>:" with the link on its own line. Lifetime and downloads come from
  `report_link_hours` (default 24, 1-168) and `report_link_max_opens` (default 10, 1-20).
* **Token** - unchanged out_documents rules: 192-bit token derived from the module key and the document id (domain `doc`), never stored -
  only `sha256(token)`; the token travels in the URL fragment (`#d.<token>`), never in a server or proxy log.
* **Download** - the existing public routes only (`GET /t/api/doc`, `GET /t/api/doc/file` on the public listener, under the public
  prefix): no account, read-only, per-token / per-network / installation-wide rate limits, the downloads counted with compare-and-set, the
  uniform 404 for unknown, expired, revoked or used-up. **No new public route.**
* **Failures** - the PDF engine busy: the row retries (5, 10, 15 min), the text does not leave without the document the mode promises; the
  PDF too large / no public address / documents off at send time: `skipped` with the code. A message that surely did not leave revokes its
  link (`send_failed`); `unknown_outcome` keeps it (it may have left).
* **Revoke** - per link from the existing `DELETE /report/links/{id}`, and all at once from Settings: `DELETE /infra/temperature/report/links`
  (new, internal API, `infra.temperature.report_link`; a manager revokes all temperature links, anyone else his own). The Settings section
  lists the live links: recipient (or file name), valid until, downloads n/m, revoke; and "revoke all links".
* **No forwarding** - a link minted for one recipient inside a report (`source_id` set) is refused by the manual link send
  (`POST /report/links/{id}/send` answers 404 `link_not_found`): it is never re-sent to other people.
* **Dialog** - the WhatsApp dialog's subtitle says "a text summary with a temporary link to the full report (PDF)" when the server reports
  `user_attachment: "link"` for this sender (`GET /report/recipients`). No structural change, no hint paragraph.

## 3. Audit

* `infra.temperature.report.document.send` (one row per user send that carried, or was refused, a document): `sender` (user id),
  `recipient` (user id), `recipient_label` (display name), the audit time, the document id (resource), `status` / `reason`, unit count,
  `expires_at`, `max_opens`. Never the phone number, the text, the link or the token.
* `report.document.mint` / `report.document.open` (out_documents, one row per download with the running count) - the downloads count is also
  on the link row (`opens` in `GET /report/links`).
* `infra.temperature.report.link.revoke` / `.revoke_all` (count).

## 4. The attached-file variant (DESIGNED, NOT BUILT)

When WisKey delivers a WhatsApp file contract (a media upload / send-document capability of the WhatsApp integration), the document goes as an
attachment instead of (or besides) the link. Design:

```python
class DocumentAttachment(Protocol):
    mode: str                                   # "file"
    def available(self, conn) -> bool: ...      # the transport advertises the capability (contract version, size / type limits)
    def prepare(self, conn, row, model, pdf: bytes, now) -> AttachmentRef | None: ...   # stage the bytes (upload / media id); no send
    def message(self, ref: AttachmentRef, text: str) -> OutboundMessage: ...            # the message carrying the media + caption
    def release(self, conn, ref, outcome: str) -> None: ...                             # clean up a staged upload after the outcome

class NullAttachment:                           # the default until the contract exists
    mode = "file"
    def available(self, conn): return False     # never offered; the setting refuses "file" (422) while this is the registered adapter
    def prepare(self, *a, **k): return None
    def message(self, ref, text): raise NotImplementedError
    def release(self, *a, **k): return None
```

* **Seam**: `temperature_whatsapp.attachment_for()` stays the only entry point; a registry `ADAPTERS = {"link": LinkAttachment,
  "file": NullAttachment}` picks by `report_attachment`. Adding `"file"` to `ATTACHMENT_MODES` / `temperature.CHOICES` happens only when a real
  adapter replaces the null one (`available()` true).
* **Fallback rule** (to be confirmed by the owner): no silent fallback from file to link; a send whose adapter is unavailable is `skipped`
  with `attachment_unavailable`, like every typed refusal here.
* **Contract needs** (for WisKey): the send-document service name and payload, max size and media types, whether a caption is supported and
  its length, whether the provider returns a media id that can be reused, the session-window rule for media, and the outcome mapping (sent /
  refused / unknown). Until then: link mode only.
* **What stays**: the send queue, schedules, permissions, audit row (`mode` added to details), scope rule and retries are unchanged.

## 5. Tests

* `smplwise_vms/backend/tests/test_tempreport_297.py` (new): off by default; the documents switch; the sender permission gate; the link in
  the text and the PDF downloaded without an account; hash-only token; lifetime and downloads are settings; replay past the downloads limit
  (uniform 404); expiry (uniform 404); revoke one / revoke all (Settings) incl. the permission and the own-links rule; no forwarding through
  the manual send; the recipient's scope; engine busy -> retry, no text; oversized -> skipped + audited; a refused message revokes its link;
  the audit row (sender, recipient label, time, download count; no number, link or token); the text layout and cap; unknown modes refused.
* Re-run: `test_templink_295.py`, `test_walink_295.py`, `test_tempvendor_295.py`, `test_infra_temperature*.py`, `test_vendorq_294_*`.
* Frontend: `tsc --noEmit`. Playwright specs (`unit-temperature*.spec.ts`, `unit-tempvendor-295.spec.ts`, `evidence-temperature.spec.ts`) are
  for the runner (NOT_RUN on this workstation).

## 6. Known limits

* The PDF is a snapshot taken at send time (one per recipient and send); a later reading does not change it.
* The plain-text message relies on the existing summary path, which (unlike the manual link send) does not check the WhatsApp session window;
  the provider's own rule decides delivery, as for the summary today.
* The real PDF engines are not installed on the workstation: the tests use a fake renderer (as TEMPLINK / TEMPVENDOR).
* The public document page still needs the public-surface review before `reports.documents` is switched on in a release (VENDORQ-294).
* `report_attachment = link` also turns on the vendor link (TEMPVENDOR-295) when vendor reports are on - it is one switch for "the report
  travels as a link".

## 7. Rollback

Set `report_attachment` back to `none` (or switch `reports.documents` off: every link stops answering at once), or revert the branch. No
schema change; links already minted expire on their own and the janitor purges the bytes.
