# PUSH-RELAY-SAFE-2380: a wrong relay address no longer un-registers phones

Status: prepared 2026-11-03 on `fix/PUSH-RELAY-SAFE-2380` (from `origin/pilot/APP-SERVER-LEFTOVERS-2380` @ `f8de881af`). Not merged, no version
bump, no tag. Source: finding 4 of `docs/changes/PUSH-GOLIVE-KIT-2380.md` (branch `pilot/PUSH-GOLIVE-KIT-2380`). **No real relay, device or runner
was used**; everything was tested against the in-process fake relay (`httpx.MockTransport`).

## Root cause

`services/mobile_push.record` treated every relay answer of 404 or 410 as "the phone's token is gone" and called `unregister`. The relay really
answers 404 for a path it does not serve (`not_found`), so a mistyped `push_relay_url` with an extra path (`https://x.workers.dev/v1`, which makes
the request go to `/v1/v1/push`) silently dropped the push registration of every phone that received a notification, until the app was next opened
and re-registered. A proxy or an HTML 404 page did the same.

## What changed

| Where | Change |
|---|---|
| `smplwise/relay_url.py` (new, no heavy imports) | `check_relay_url`: https only (http only with the tests' transport), host required, no path beyond `/`, no query, no fragment, no credentials, no whitespace, valid port; one trailing slash tolerated; Hebrew errors beginning `כתובת הממסר שגויה` (scheme / shape / host). Empty = not an error (channel simply not set up) |
| `services/mobile_push.py` `relay_url()` | now validated: a malformed `SW_PUSH_RELAY_URL` yields `None` (channel `skipped / channel_unavailable`, the app is never handed the bad `relay_url`), the Hebrew reason is `relay_url_error()`, logged once without the value |
| `services/mobile_push.py` `send_relay` / `record` | a 404 / 410 drops the registration **only** if the JSON body is the contract's token error: 404 `relay_token_unknown` or 410 `push_token_gone` (`docs/api/mobile-presence-contract.md` section 8, `services/push-relay/src/index.ts`). Any other 404 / 410 (HTML, empty body, the Worker's own `not_found`, other JSON) is a **configuration error**: registration kept, device `push_last_error = relay_url_wrong`, delivery row `failed / relay_url_wrong`, **no device failure counted** (ten counted failures drop a registration), no retry of that message |
| backoff | after a configuration error the relay is not called again for 60 s, then 300 s, 900 s, 3600 s while it keeps failing (calls inside the window are skipped without a request and recorded the same way); the first real relay answer (2xx, or the contract token error) clears the state. `mobile_push.CLOCK` is the test seam |
| health view | `GET notify/stats` (administrator, the push health view) has a new member `app_relay`: `{configured, state: ok / unconfigured / url_invalid / config_error, message (Hebrew: כתובת הממסר שגויה or the URL error), config_errors_in_a_row, last_config_error_at, last_config_error_status, backoff_seconds_left, last_ok_at}`; no URL, no key. `janitor_stats()` carries it as `relay`. The per-device `push.last_error` shows `relay_url_wrong` |
| options writer | `self_update.OPTION_TYPES["push_relay_url"]` is now kind `relay_url`: a write through the Supervisor options call with a bad URL is refused (`ProbeRefused`) by the same validator |
| `POST notifications/app/test` | answers `sent: false, reason: relay_url_wrong` for such an address |

## "On save" - what exists and what does not

The relay URL has no screen or Arx API: it is the add-on option `push_relay_url`, saved by the owner in the Supervisor and read at start. The
only code path that can write it from Arx is the options call (now validated). The owner-visible effect of a bad value is therefore the health
member above (state `url_invalid` with the Hebrew reason) and a skipped channel, not a form error. **Open owner decision:** also tighten the
manifest (`config.yaml` `schema`: `push_relay_url: match(...)?`) so the Supervisor refuses a bad value in its own form (English message). Not done:
an existing install holding a bad or `""` value could fail option validation after the update, which needs a deliberate release decision.

## Follow-up (lead-approved 2026-11-03): 401 and 403 are configuration errors too

Same class of risk as the wrong address: before, a 401 (server key refused) or a 403 `server_id_claimed` counted as a device failure and ten of
them silently dropped a registration. Now they follow the 404 / 410 path: registration kept, **no device failure counted**, same shared backoff
(60 / 300 / 900 / 3600 s), message not retried; the contract token errors (404 `relay_token_unknown`, 410 `push_token_gone`) stay the only drop path.

| Relay answer | code (device `push_last_error`, delivery reason, test-push `reason`) | `app_relay.state` | Hebrew message |
|---|---|---|---|
| 404 / 410 without the token body, 403 without `server_id_claimed` | `relay_url_wrong` | `config_error` | כתובת הממסר שגויה |
| 401 | `relay_auth_failed` | `auth_failed` | מפתח השרת לממסר נדחה |
| 403 `server_id_claimed` | `relay_server_id_taken` | `server_id_taken` | מזהה השרת תפוס |

`app_relay` gained a `code` member. A 401 / 403 no longer clears the health state (a 2xx, the contract token error or another 4xx from a relay that
accepted the key does). Tests: 401 contract / 401 html / 403 `server_id_claimed` (kept, distinct state, stats view, backoff, skipped message reason,
test push), plain 403 = wrong address, key fixed -> state clears, state changes between probes, 13 mixed 401 / 403 never drop and a 410 token error
still does.

## Tests (run 2026-11-03, venv, single process; 139 passed, 0 failed: the 132 of the first round plus 7 for the follow-up)

`pytest tests/test_mobile_push.py test_tickets_app_push.py test_app_server_leftovers_2380.py test_critical_sound.py test_self_update_s3_fixes.py test_docs_config_consistency.py test_secrets_store.py test_secrets_transitional_263.py`: 139 passed. NOT_RUN: the rest of the backend suite, any frontend / browser / runner check, anything against a real relay or phone.


`tests/test_mobile_push.py` (the fake relay now speaks the contract bodies and can answer html / empty / other-json): token-error body 404 and 410
-> unregister (`gone`); bare 404 and 410 as html, empty and other-json -> kept + `relay_url_wrong` + health `config_error`; backoff skips calls,
grows 60 -> 300 s and clears on a 200; the test push; 13 configuration errors never drop the registration; URL validation (accepted and refused
forms with the exact Hebrew errors); a malformed configured URL disables the channel and shows `url_invalid` in `notify/stats`; the options
writer. The pre-existing 410 test still passes (its fake now returns the contract body).

## Not changed / notes

- A wrong address that answers **200** (a website that accepts any POST) is still counted as sent; the relay's `{"ok": true}` body is not checked.
- No frontend change (the health member is API-only; no screen was added), so no browser or runner run.
- `docs/operations/ARX_PUSH_RELAY_DEPLOY_HE.md` is edited by the go-live kit branch (section 5, the 404 / 410 side effect) and was not touched
  here to avoid a conflict; after both merge its sentence about the immediate drop must say "only with the token error body".
- Rollback: revert the branch; no migration, no setting, no dependency.
