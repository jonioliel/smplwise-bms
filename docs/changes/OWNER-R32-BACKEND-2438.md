# OWNER-R32-BACKEND-2438 - owner round 32 backend decisions: generator alert roles (O1 a), RTSP passwords in the go2rtc log (Q-SEC-2), go-live permit texts (O9 a)

Branch `pilot/OWNER-R32-BACKEND-2438`, from `origin/pilot/CR-WAVE1B-COMBINED-2436` at ffb4af2d5 (it carries `services/notify_recipients.py` and the
generator rule held behind a flag, docs/changes/CR-RECIPIENTS-2436.md). No migration, no version bump, no frontend change, no device or lab action.

## 1. Generator alerts: role holders through a group, no expired bindings (Q-SYS-1 / O1 a, review 04:F02)

Owner answer: both corrections. `services/generator_alerts.recipient_users` now calls `notify_recipients.expand(conn, rec, ROUTABLE_ROLES)` with the
shared rules, exactly as the elevator, temperature and water alerts do, and then keeps its own `generator.view` check at installation scope.

| Case (a generator alert routed to a role) | Before | After |
|---|---|---|
| User holds the role directly, live binding | receives | receives |
| User holds the role through a group binding | not addressed | receives (if generator.view) |
| User's role binding expired, another live binding gives generator.view | receives | not addressed by that role |
| Revoked / deny binding | not addressed | not addressed |
| Inactive user | dropped at the generator.view step | dropped by the expansion (same outcome) |

The flag was only a hold, so it is removed: `generator_alerts.ROLE_EXPANSION` is gone, and the three switches of `notify_recipients.expand`
(`role_via_groups`, `role_expiry`, `active_only`), which existed for the generator alone, are gone with it. `expand` has one behaviour for all four
alert modules; the SQL of the defaults is unchanged.

Tests:
- `tests/test_notify_recipients.py`: the two "today's generator rule / what O1 (a) would change" tests are replaced by
  `test_generator_has_no_held_role_rule_any_more` (no `ROLE_EXPANSION`, the switches are refused) and
  `test_generator_roles_reach_group_holders_and_drop_expired` (group-held role in, expired / revoked / deny / inactive out).
- `tests/test_generator.py::test_routing_by_role_reaches_group_holders_and_not_expired_bindings`: through the real routing (policy saved via the
  API, `recipient_users` with the real rbac): an operator by direct binding and an operator through a group are addressed; a user whose operator
  binding expired but who holds a live installation `site_admin` binding (so generator.view still passes) is not. This case fails on the old rule.

## 2. RTSP passwords in the go2rtc service log (Q-SEC-2) - analysis only, no code change

Owner answer: accept for now (LAN only); do option ג (a connection that does not put the password in the address) only if it is cheap and
risk-free. It is neither, so this item stops at this analysis. Status: option א (accepted risk) stays in force.

What Arx does today:
- Arx writes its own streams (`smplwise_` namespace only) with `PUT /api/streams?name=...&src=rtsp://user:pass@host/...`
  (`services/go2rtc.rtsp_url` / `ensure_stream` / `create_stream`). The password travels inside the source address because that is the only way the
  go2rtc RTSP source accepts credentials.
- Arx's OWN logs never carry it: every log line of the adapter goes through `redact_source` (credentials masked; camera and HA sources show the
  scheme only; WisKey station sources hide the whole host). Nothing to fix on the Arx side of the log.
- The password reaches go2rtc's log because go2rtc itself prints the source address (older versions on every GetOrPatch, see
  RELEASE_263_DELTA_REVIEW; the round-32 question reports the lab's go2rtc log still shows it; which log line does so on 1.9.15 was not re-checked here, no lab access was used). That is go2rtc behaviour, outside Arx code.

Ways to keep the password out of the address, and why none is cheap and risk-free inside Arx code only:

| Option | Why not now |
|---|---|
| go2rtc credentials outside the URL (`${ENV}` / secrets in go2rtc.yaml, expanded by go2rtc) | Needs a change to the go2rtc host's configuration or environment. That go2rtc is shared with the separate intercom project; the brief forbids touching its config. go2rtc may still print the expanded address. |
| Separate auth field on the RTSP source | go2rtc's RTSP source has none; credentials are URL userinfo only. |
| `ffmpeg:` / `onvif:` / `isapi:` sources | All take the credentials in the address too. |
| `echo:` / `exec:` source that fetches the address from Arx at run time | go2rtc restricts exec/echo sources created through the API; the address it then opens is printed the same way; adds a new failure mode to every live view. |
| An Arx-side RTSP relay that holds the credentials (go2rtc pulls `rtsp://<arx>/<token>`, no password) | A new media path in Arx (RTSP server, auth tokens, re-streaming every camera): large, touches all live video, needs lab testing - not cheap, not risk-free. |
| A dedicated read-only RTSP user on the NVR | Limits the damage of a leak but does not stop the logging; it is a write to the NVR (needs owner approval). Worth proposing as the cheap mitigation. |

Recommendation for a later task (not done here): the NVR read-only RTSP user (owner approval for the NVR write), and the Arx-side relay only if
the exposure ever leaves the LAN. The WisKey consolidated prompt F3 asks WisKey for the same check on its station streams. No lab read or write was
made for this item.

## 3. Eight go-live permit texts (Q-SYS-2 / O9 a) - not done here

Not fixed on any branch yet: on this base `routers/access_grants.py:5` and `services/bulk_people.py:13` still say the feature cannot be on in this
build. MASTER_PLAN assigns the docstrings of 02:P2-10 to `pilot/CR-ADMIN-GATE-2436` (row 212; not on origin yet). `pilot/CR-MAIN-RUNTIME-2438`
exists only as a local worktree (not pushed) and its plan row (172) covers `main.py` handlers, not the permits. Left to CR-ADMIN-GATE, as
instructed, to avoid duplicate edits; the lead must confirm that branch is actually scheduled, otherwise nobody fixes the texts.

## Tests actually run (local Windows workstation, Python 3.12, repo venv, one process, `-p no:xdist -o addopts=`)

1. `pytest tests/test_notify_recipients.py tests/test_generator.py` -> **85 passed, 0 failed** (5:46 min).
2. `pytest tests/test_elevator_alert_recipients_295.py tests/test_water_alerts_s2.py tests/test_genalert_295.py` -> **35 passed, 0 failed** (6:44 min).

## NOT_RUN

- Whole backend suite, ruff: NOT_RUN locally (runner entry check).
- Temperature alert tests: NOT_RUN locally (their call of `expand` uses the defaults, whose SQL did not change).
