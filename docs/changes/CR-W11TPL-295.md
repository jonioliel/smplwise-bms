# CR-W11TPL-295 - WhatsApp template send outside the 24-hour window (WisKey item W11), Arx side

**Status:** built on `pilot/W11TPL-295` (base `origin/integ/2111`). **OFF by default. `intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED` stays `False`**
(no flag, permit or setting flipped). Fakes only: nothing here can send a real message, and no route, screen or WisKey call uses it yet.
No operator screen is touched (so no ticket action and no Home Assistant wording is added anywhere).

## 1. Why

WisKey's reply (2026-10-21) lists W11 as a gap on the Arx side. Arx's `intercom_messaging_adapter.send(..., wa_template=)` carried a template
reference as "part of the contract" but dropped it (`del wa_template`), and the consent-by-link flag logic hides the configured template while
the permit is False. A first contact outside Meta's 24-hour customer-service window must be an approved template; the Arx half of that
(registry, admission, request, answer states, pacing) is now in place behind two gates, awaiting a WisKey command.

## 2. What is built (`smplwise/services/wa_template_send.py`)

| Piece | What it does |
|---|---|
| **Template registry** (`messaging.wa_templates`) | Arx holds only REFERENCES, never bodies (Meta owns the body): `{id, name, language, params[], purpose}`. `params` are ordered slots from the closed set `name, organization, link, days` (the template's `{{1}}..{{n}}`); `purpose` is `consent_request` or `notice`. Same name/language rules as `intercom_messaging.WA_TEMPLATE_NAME/LANG`; max 20; unique id and (name, language). A registry with any bad entry reads as EMPTY (fail closed). |
| **Switch** (`messaging.template_send {enabled}`) | Default OFF; unreadable = OFF. Needs BOTH the switch and the permit (`TEMPLATE_SEND_SUPPORTED`, False): otherwise `not_sent / template_unsupported`, no transport call. |
| **Admission** (`TemplateSender.admit`) | In order, each refusal provably sends nothing: switch + permit; reference exists; exactly the declared slots filled (non-empty, <= 1024 chars); consent (`declined` never; `unknown` only for a `consent_request`, and for a `notice` only while `consent_by_link` is off - the people screen's existing rule); the pacing budget; then the window rule below. |
| **Request / answer** | `TemplateRequest` (`wa_template_send_proposal.v0`, Arx's PROPOSAL, see 4). Answer states: `accepted` -> `sent`; `not_sent` only from a closed result of the matching version (`read_v1` / `read_v2`; the former `PRE_SEND_CODES` legacy reading was removed, WKB3-295); everything else (timeout, exception after hand-over, HA error code, malformed, legacy shape, other version) -> `unknown`, **never retried**. `request_id` is the attempt's `client_request_id` (idempotency key). Parameter values are excluded from `repr` and never logged. |
| **Transport** | Protocol. Production gets `UnwiredTransport` (refuses, nothing leaves). `FakeTemplateTransport` is for tests. |
| **Window** | `WindowProbe` Protocol; `NoWindowProbe` always says `unknown`. `needs_template()`: only an explicit `open` allows free text; `closed`/`unknown` take a template. A notice is refused with `window_open` if the caller says open. |
| **Pacing** | A template send is a **normal class**: `KLASS = ticket` (the class of every people-screen message); `USE_CLASS` gains `intercom.messages` and `intercom.template` -> `ticket`; no class of its own. It is checked with the shared `WaPacer.check` before the hand-over; `rate_limited`/`pair_rate_limited` answers feed `WaPacer.on_result` (account/pair backoff). **Counted once:** the caller writes the attempt row in `intercom_messages` BEFORE the send (as every message), which `wa_pacing.wiskey_foreign_use` already counts as WisKey-bound load; the sender adds nothing to any ledger. |
| **Adapter seam** | `MessagingAdapter.send_template(sender, **kw)` returns the usual `SendResult` (`sent / not_sent / unknown`). The old `send(..., wa_template=)` is unchanged. |

Tests: `tests/test_wa_template_send_w11.py` (negative cases first: permit False in production, switch off/unreadable, unwired transport, unknown reference,
wrong slots, declined/unknown consent, open window, budget hold; then accepted / not_sent / unknown incl. exceptions, proposal shape, normal class,
backoff, registry validation).

## 3. What WisKey must provide (nothing below exists in the documents under `private/planning`)

No WisKey document defines a template command: `ARX_RESPONSE_HE.txt` only lists W11 as an Arx gap, and the pacing documents (`wa_pacing_2026-10-21/`)
mention `CloudTemplateProvider` as a path to be counted, with no wire detail. Needed:
1. A send command for one person with `{template name, language, ordered params}` (the module's `TemplateRequest.wire()` is Arx's proposal, to be replaced by theirs).
2. Idempotency by `request_id`; a repeat never sends twice.
3. Answer states `accepted | not_sent | unknown` with proof rules, and the pre-send codes (Arx assumed: `template_not_found`, `template_not_approved`, `template_params_mismatch`, plus the existing `rate_limited`, `pair_rate_limited`, `pacing_expired`, `whatsapp_unavailable`, `whatsapp_invalid_phone`).
4. Template state visibility (approved / rejected / paused) so a registry entry can be checked, or the exact error it returns.
5. Whether sends from `CloudTemplateProvider` appear in `wiskey_own.charged_*` (so the budget does not double count) - same sender_ref as the text path.
6. Optionally a per-person window state (`open | closed | unknown`).

## 4. Open questions

1. Command name, fields and the `api_contract` version for the template send; may the service identity call it?
2. Is the Arx registry the source of truth for the template name, or does WisKey keep the account's templates and Arx only references an id?
3. The window: Arx has no inbound messages. Will WisKey report it, or does Arx always use a template for a first contact (current assumption: `unknown` = closed)?
4. Which failure codes provably precede the provider call? Until answered, unlisted codes are `unknown`.
5. Is a per-template or per-category (utility / marketing) pacing different on the provider side? Arx counts one budget, class `ticket`.
6. Does a consent-request template sent as a first contact need a different Meta category than a notice? (The registry has `purpose` only; no category field was invented.)
7. Product: should a `notice` to a person with `unknown` consent be allowed when `consent_by_link` is off (current rule, as for text)?

## 5. Not built (needs the answers above, or a task of its own)

- No HTTP route, settings editor, or UI for the registry/switch; no call from `routers/access_control_messaging.py` or `intercom_consent.release_due`.
- No real transport (`LiveTemplateTransport`) and no change to `TEMPLATE_SEND_SUPPORTED` or to the consent settings' hiding of `consent_wa_template`.
- No live check against WisKey (NOT_RUN by design).

## 6. Rollback

Delete `wa_template_send.py` and its test; revert the two-line `USE_CLASS` addition and the `send_template` method. No migration, no stored data
(the two settings keys are never written by the product), nothing else depends on it.
