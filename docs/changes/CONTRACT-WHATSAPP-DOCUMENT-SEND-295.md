# Contract: sending a file by WhatsApp (what Arx needs from the WisKey / WhatsApp service side)

**Task:** VENDORQ2-295, item 4. **Status:** a REQUEST for the owner to pass on. Nothing here is built in Arx and nothing here describes
behaviour that was verified: the WhatsApp send service (the `whatsapp.*` services that `services/tickets/channel_whatsapp.py` calls) is NOT
in this repository, a search for `send_document` / `send_image` / `send_file` finds no definition anywhere, and no live check was run. Every
name below is a PROPOSAL. If the real service already offers something similar, the other side answers with its real names and Arx adapts
the adapter (a few lines), not the queue.

## 1. Why

CR-VENDORQ-294 sends a report to an external contact as text plus (optionally) a temporary download link (design doc section 5). The owner
also wants the report itself to arrive in the chat as a file (attachment mode `html`, design doc section 5.3). The Arx queue, send hours,
pacing and outcome handling already exist; the only missing piece is a service that carries ONE file with a caption to ONE number.

## 2. What Arx will call (proposal)

One service call, same transport and same account selection as `send_message`:

```
POST /api/services/whatsapp/send_document?return_response
{
  "account":    "<entry id | typed value - ALWAYS sent, as for send_message>",
  "target":     "<digits only, international, no +>",
  "caption":    "<text, 1..1000 characters, UTF-8, newlines allowed, no markup>",
  "filename":   "<[A-Za-z0-9._-]{1,80}; the extension matches media_type: .html or .pdf>",
  "media_type": "text/html" | "application/pdf",
  "size_bytes": <integer, 1..2097152>,
  "sha256":     "<64 lowercase hex characters of the exact bytes>",
  "content_base64": "<standard base64 of the bytes>",
  "client_ref": "<the Arx outbox row id, 32 hex>"
}
```

* **Inline bytes (mode A, preferred).** Arx sends the bytes inside the call. 2 MiB is about 2.8 MB of base64, inside Home Assistant's
  default REST body limit; no shared file system and no second network hop are assumed. Arx never sends a path.
* **Fetch by URL (mode B, optional).** If the service prefers to download, `url` replaces `content_base64`; Arx would then expose a
  single-use, 2-minute, loopback-only download URL. Offer this only if inline bytes are impossible; it is new surface on the Arx side.
* Arx already guarantees before the call: the bytes are exactly what the contact may receive (HTML is self-contained: no script, frame,
  form or external `src` / `href`; a PDF has the `%PDF-` magic), the size is at most 2 MiB, the file name is the safe name above, and the
  digest matches. The service should still verify `size_bytes` and `sha256` against the decoded bytes (error codes in section 4).

## 3. Limits the service must enforce (defence in depth)

| Item | Limit | Notes |
|---|---|---|
| File size | 2 MiB (2 097 152 bytes) | WhatsApp itself allows far more; Arx caps lower on purpose. Refuse larger, never truncate. |
| Media types | `text/html`, `application/pdf` only | No images, audio, video, archives or executables through this call. |
| Caption | 1000 characters | The Arx outbox already caps the message at 1000. |
| File name | `[A-Za-z0-9._-]{1,80}` | No path separators, no spaces, no non-ASCII. |
| Files per call | 1 | One target per call, as for `send_message`. |
| Timeout | Arx waits 30 s for this call (15 s for text) | A slower answer is `unknown` on the Arx side (never retried). |

## 4. The answer and the error codes

Success: HTTP 200 with a response body `{"success": true, "message_id": "<1..128 characters of A-Za-z0-9_-:.@>"}` (the shape Arx already
reads for `send_message`; `message_id` optional).

Failure: HTTP 200 with `{"success": false, "error": "<code>"}` for a decision of the service, or an HTTP error for transport problems (the
classification table in `channel_whatsapp.py` applies unchanged). The codes Arx needs and the outcome each produces:

| `error` code | Meaning | Arx outcome / code | Retried by Arx |
|---|---|---|---|
| `account_not_found` | the account value matches no paired number (or several match) | `not_sent` / `account_not_found` | yes (bounded, as today) |
| `session_down` | the account is paired but not connected | `not_sent` / `channel_down` | held, then "not sent" |
| `rate_limited` | the service's own limiter refused | `not_sent` / `rate_limited` | yes, later |
| `file_too_large` | decoded size above 2 MiB | `not_sent` / `file_too_large` | no |
| `unsupported_media_type` | type not in the list | `not_sent` / `unsupported_media_type` | no |
| `invalid_filename` | name outside the safe pattern | `not_sent` / `invalid_filename` | no |
| `size_mismatch`, `digest_mismatch` | decoded bytes differ from `size_bytes` / `sha256` | `not_sent` / `file_corrupt` | no |
| `caption_invalid` | empty, too long, or control characters | `not_sent` / `caption_invalid` | no |
| `recipient_not_on_whatsapp` | the number has no WhatsApp account | `refused` / `provider_refused` | no |
| `upload_failed` | the service failed BEFORE anything was handed to WhatsApp | `not_sent` / `upload_failed` | yes |
| `capability_off` | document sending is switched off in the service | `not_sent` / `documents_unsupported` | no |

The rule that matters most: **an error code may be returned only when the service is certain that nothing was sent.** Anything uncertain
(a crash or timeout after the upload to WhatsApp started) must NOT return a code: let the call time out or return a 5xx so that Arx records
`unknown` and never sends a second copy. A second delivery of a report is worse than a missing one.

## 5. Idempotency

`client_ref` is the Arx outbox row id. If the service receives the same `client_ref` again within 24 hours (a transport retry before the
answer arrived) it returns the first answer (`message_id`) and sends nothing. Arx itself never repeats an `unknown` row; this protects only
against duplicate delivery inside the service / the Home Assistant call path.

## 6. Capability discovery (Arx must not guess)

Arx will not call `send_document` unless the service announces it. Proposal: a state attribute (or a `whatsapp.capabilities` service with a
response) per account:

```
{"send_document": true, "document_max_bytes": 2097152, "document_media_types": ["text/html", "application/pdf"], "contract": 1}
```

Absent, false, or a smaller `document_max_bytes` means: Arx does not offer the file mode for that account (the link mode keeps working), and
a row that nevertheless reaches the call ends `not_sent` / `documents_unsupported`.

## 7. Privacy and logging (both sides)

* Neither side logs the number, the caption, the file name of a person-specific report, the bytes, the digest or the base64.
* The service keeps no copy of the bytes after the hand-over to WhatsApp (or after the error).
* No automatic reply handling for these messages (same as `send_message`: Arx reads replies only through its own inbound path).
* The service must not add a link, button or footer of its own to the caption.

## 8. What Arx will do on its side once the contract is agreed (NOT done now)

1. `OutboundMessage` gains an optional `document` (the id of a live `outbound_documents` row; the bytes are read at send time and are not
   stored in the queue).
2. `channel_whatsapp.ALLOWED_SERVICES` gains `send_document`, and `WhatsAppChannel.supports_documents()` reads the capability of section 6.
3. `contact_reports.render` returns the caption instead of the link line when the report's attachment mode is `file` and the account
   supports it; otherwise it falls back to the link line (never silently drops the report).
4. The codes above are added to the adapter's classification table; `file_too_large`, `unsupported_media_type`, `invalid_filename`,
   `file_corrupt`, `caption_invalid` and `documents_unsupported` join the outbox's `NON_RETRYABLE`.
5. Tests with a fake service for every row of the tables above; a live check only after the owner approves it, in the order of
   `private/planning/TICKETS_WHATSAPP_LIVE_CHECKS_HE.md`.

## 9. Questions for the other side (answers needed before Arx builds anything)

1. Does a document-send service exist in the current WhatsApp service? If yes: its name, field names, size limit and error shapes.
2. Does it accept bytes inline, a URL, or a path? (Arx can only offer inline bytes or a loopback URL.)
3. Is `text/html` delivered as a file the recipient can open on a phone, or blocked / converted? (If blocked, PDF is the only mode.)
4. Can it report "certainly not sent" separately from "uncertain" (section 4, last paragraph)?
5. Is there a per-account document rate limit that differs from text?
