# TPLWIRE-295 - wire Arx's WhatsApp template send to WisKey: findings (STOPPED, no command to wire)

Status: BLOCKED on WisKey. Nothing was built. `services/wa_template_send.py` (CR-W11TPL-295) is unchanged: production still gets
`UnwiredTransport`, `intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED` stays `False`, the `messaging.template_send` switch stays OFF,
no route was added (contracts/API_INVENTORY.md unchanged).

Owner decision 2026-10-22 (recorded here): the template send is wired WITHOUT consent blocking (TP-02 dropped). Meta template
approval work is a later task.

## Question

Does the WisKey source define a command that sends an approved WhatsApp (Meta Cloud) template - a name, a language and ordered
parameters - for one person? If so: service name, request fields, answer shape, error codes, consent requirement.

## Answer: NO. The WisKey source defines no public template-send command.

Read-only search of every WisKey copy on this workstation (`C:\hik intercom`, `C:\hik intercom_rev_wcc`,
`C:\hik intercom_rev_wrc01_c04`, the Mac review packages under `C:\hik intercom\handoff\`, and
`C:\cloude\smplwise-smart-work\wiskey-directive`, `...\wiskey-mac-delivery`). Paths below are relative to the named root.

### 1. The registered WhatsApp WebSocket commands (all copies)

`C:\hik intercom\custom_components\hikvision_intercom\websocket.py:235-247` (identical in `_rev_wcc` and `_rev_wrc01_c04`):
`whatsapp/status`, `whatsapp/templates_get`, `whatsapp/templates_update`, `whatsapp/preview {user_id, account, language}`,
`whatsapp/send {user_id, account, token, message, confirmed}`, `whatsapp/history`, `whatsapp/media`. No template-send command.

The newest package (`C:\hik intercom\handoff\windows-eccact295-mac-review-2026-10-21-1\package-source\custom_components\hikvision_intercom\`)
adds only `whatsapp/pacing_status_v1` and `whatsapp/send_pacing_v1` (`websocket.py:237-257`). `send_pacing_v1` has the SAME fields as
`send` (`user_id, account, token, message, confirmed`, `websocket.py:249-255`) - it is a TEXT send.

### 2. Both send commands end in a free-text HA service call, not a template

- `whatsapp_api.py:247-269` (`C:\hik intercom`): `whatsapp/send` checks `confirmed`, text 1..12000 chars, consumes the preview token,
  then `hass.services.async_call("whatsapp", "send_message", {account, target, message})`; any exception -> `whatsapp_send_uncertain`;
  success -> `{accepted: true}`.
- `whatsapp_api.py:423-482` (eccact package): `send` and `send_pacing_v1` build the same `service_data = {account, target, message}`
  (`:440-444`) and call `whatsapp.send_message` (`:478-482`). No template name, language or parameter field anywhere on the path.
- `whatsapp/templates_get` / `templates_update` (`whatsapp_api.py:182-188`, `whatsapp_templates.py:1`) manage WisKey's LOCAL message
  texts (placeholders rendered by `render_template`, `whatsapp_templates.py:98`). They are not Meta templates and send nothing.

### 3. The internal Cloud template code exists but is unregistered and OFF

- `C:\cloude\smplwise-smart-work\wiskey-directive\custom_components\hikvision_intercom\whatsapp_cloud_templates.py:1`:
  "Explicit approved Cloud API text-template provider, unregistered and OFF." (`CloudTemplateProvider`, `ApprovedTextTemplate`;
  allowed fields `_FIELDS = {display_name, employee_no, pin, valid_from, valid_until}` at `:23`, placeholders `{{1}}..{{99}}` at `:24`.)
- `...\trusted_actions\native_template_messaging.py:5`: "No route, native service replacement or activation is installed by this
  module." `:361-366` `TemplateMessagingComposition`: "Construction does not register it." It also expects the host to supply
  `fresh_consent` (`:369`).
- No file outside these two modules (and their tests) references them (grep of `websocket.py`, `api_contract.py`,
  `panel_permissions.py`, `whatsapp_api.py` in the same tree). They are Python objects, not a wire command Arx could call.

### 4. WisKey's own statement, dated today

`C:\hik intercom\docs\owner-development-2026-10-22\arx-release2121-reply-and-mac-handoff\WHATSAPP_TEMPLATE_CURRENT_SPEC_HE.txt`
(states it read WisKey CODE `677ed43d9b0ac077d32360d6a48ba3d2303dc7ac`):
- `:5` - there is no public HA command for sending an approved template with template_name/language/parameters; no command name or
  schema exists to hand to Arx; the internal `CloudTemplateProvider.send` is not a registered service or public API; Arx must not
  turn on `TEMPLATE_SEND_SUPPORTED` or guess an endpoint from an internal class name.
- `:10` - `send_pacing_v1` is a text route to `whatsapp.send_message {account, target, message}`; template fields must not be added
  to it on the assumption they would reach the provider.
- `:14-26` - `send_pacing_v1` result: `{schema_version: "whatsapp_send_outcome_v1", accepted: <bool>, error: null | {code, send_state,
  throttle_scope, retry_after_s, retry_after_source, cause}}`; codes `invalid_fields`, `whatsapp_unavailable`,
  `whatsapp_preview_expired`, `whatsapp_pacing_unavailable`, `rate_limited` (all `not_sent`) and `whatsapp_send_uncertain`
  (`unknown`). `:26`: even a completed HA service call on that route is reported `unknown` - there is no `accepted=true` branch as
  provider evidence today. (Code: eccact `whatsapp_api.py:216-224` `_send_outcome` / `_pacing_error`.)
- `:30-31` - the public text routes carry no recipient-consent field and do no consent check; the owner's no-consent-blocking decision
  applies to the future adapter; consent must never be faked.
- `:38-40` - Mac must first publish a numbered public adapter (command name, permissions, name/language/parameter/recipient-ref
  fields, the three-state result and closed failure codes); Arx wires only to a contract published and visible in discovery. No ETA.

## Consequence for Arx

Building a transport now would mean inventing a command name, fields and codes - forbidden by the task ("do NOT guess") and by
WisKey's own spec (`:5`, `:39`). Sending a template body as text through `whatsapp/send` or `send_pacing_v1` is NOT a template send
(WhatsApp would treat it as free text, and WisKey's `:10` forbids extending it). So the work stops here.

What already holds in Arx and stays as is:
- TP-01 is already enforced: `TemplateSender.admit` refuses `paced_unavailable` when no pacer is wired
  (`smplwise/services/wa_template_send.py:278-279`).
- `read_answer` maps only `accepted`, `not_sent` + a PRE_SEND code, and everything else to `unknown`; an unknown is never retried.

## What the owner / WisKey must provide before TPLWIRE can be built

1. A registered WebSocket command (exact `type`, e.g. a versioned name) listed in `overview.api.commands`, and its WisKey permission.
2. Request fields: person reference (`user_id`, never a phone), `account`, template reference (name + language, or WisKey's template
   id), ordered parameters (count, max length - the internal code uses 1024, no control characters), an idempotency/request id, and
   whether a preview token is needed (Arx must never receive WisKey's rendered body or a PIN).
3. Whether the parameter slots are Arx-filled values (Arx's `name | organization | link | days`) or WisKey-filled person fields
   (the internal `_FIELDS` include `pin`, which Arx must never see or send).
4. The answer shape and the closed list of codes with `send_state` (`not_sent` = provably before the provider call), plus whether a
   real provider acceptance can ever be `accepted: true` (today's text route never says so).
5. Confirmation that the command has no consent gate on WisKey's side (owner decision 2026-10-22) and how WisKey's pacing ledger
   counts a template send (once, shared with the text sends).

## Arx-side changes to make WHEN the contract exists (not done now)

- `wiskey_channels`: a new unpinned channel holding exactly the published command (like `PACING`), never added to `MESSAGING`.
- `wa_template_send`: a `WiskeyTemplateTransport` sending only after discovery lists the command; `PRE_SEND_CODES` replaced by the
  published `not_sent` codes; drop the consent refusals (`no_consent`, `consent_required`) per the owner decision; keep the pacer
  required.
- A permission-guarded (`system.configure`-style, as the other WisKey routes), audited single-send route; switch default OFF;
  regenerate `contracts/API_INVENTORY.md`.

## Tests

None added or run: no code changed. Evidence above is static source reading only; no WisKey or WhatsApp call was made.
