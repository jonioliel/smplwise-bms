# CR-REDACT-2440 - one home for the redaction helpers

Branch `pilot/CR-REDACT-2440`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` (`97080bbc4`). Code review 2026-11-13,
MASTER_PLAN section 3.4 row `CR-REDACT-2436`: report 05 P2-14 and the go2rtc header text of report 03 F25.
Behaviour is identical: every helper keeps its name, signature and output.

## Order of work

1. First commit: `tests/test_redact_table.py`, a table of inputs to outputs proven against the helpers **where they were**,
   and this resolved list. Nothing moved yet.
2. Second commit: `services/redact.py` and the aliases; the same table is asserted against the shared functions.

## Resolved file list

Edited (helper owners not held by another 3A branch):

| File | Helper | Shared function |
|---|---|---|
| `services/redact.py` | new | - |
| `services/go2rtc.py` | `redact_url`, `redact_ha_source`, the WisKey arm of `redact_source`; the stale header paragraph (03:F25) | `url_userinfo`, `url_scheme_only`, `url_host` |
| `services/thumbnails.py` | `_redact` | `text_without` |
| `services/skins/provider.py` | `redact` | `secrets_in_text` |
| `services/access_grants.py` | `mask_number` | `phone_tail2_dots` |
| `services/bulk_people.py` | `_mask_phone` | `phone_tail2_dots` |
| `services/access_arrival.py` | the inline mask in `_label` | `phone_tail2_dots` |
| `services/intercom_messaging.py` | `mask_phone` | `phone_tail2_bullets` |
| `services/tickets/contacts.py` | `mask_phone` | `phone_tail4_bullets` |
| `services/tickets/staff_links.py` | the inline mask in the phone status | `phone_tail4_bullets` |
| `services/ha_user_auth.py` | `mask_address` | `ip_network` |
| `tests/test_redact_table.py` | new | - |

Skipped - owned by another 3A branch, left for the closing chain (3B):

| File | Helper | Owner branch |
|---|---|---|
| `services/camera_sources.py` | `mask` (password and secret-looking query values) | `CR-HEALTH-POLLERS` |
| `services/exports.py` | `scrub_credentials` | `CR-EXPORTS-HOUSEKEEPING` |
| `services/recorders/frigate_http.py` | `scrub_text`, `scrub` | `CR-DEVICE-REUSE` |
| `services/notify_whatsapp.py` | `mask` (as `phone_tail2_dots` but `""` for no digits and a mask for one digit), `mask_own` (`····` + last four) | `CR-SENDER-WORKER` |
| `services/notify_email.py` | `mask_address` (e-mail) | `CR-SENDER-WORKER` |
| `services/intercom_sync.py` | `_masked` (card number) | `CR-PERSON-PROJECTION` |

Left where they are on purpose (no equal twin, tied to their module's own data): `recorders/frigate_perm_restream.redact`
(host labels of one report), `live_diag.sanitize` (go2rtc error text classes), `alarm.scrub`, `docread/certificate_rules.scrub`,
`plan_anchor_scope.redact`, `scenarios.redact`, `schedule_view.redact`, `automation_policy.mask_secrets` (document shapes, not
strings). `needs_review._mask` already delegates to `tickets/contacts.mask_phone`. The inline `····` + last two digits in
`routers/local_identity.py:410` is a router line, not a helper; left for 3B.
