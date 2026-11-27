# FIX-PUSH-APPROVAL-2560 (2.56)

Fixes from the final deep review: SA-01 (medium), SA-02 (low), FE-06 (low).

## SA-01 - push approval collided with its own rate limit
- `routers/push_approval.py`: the one per-user bucket `paphone:` is split by kind of call: `pastate:` (the requesting screen's poll,
  45/min, 1500/h), `paphone:` (the phone's background look, 20/min, 900/h), `paact:` (challenge / approve / deny, 30/min, 200/h; the phone-key
  lockout still guards guessing). Request creation keeps `pareq:`.
- `shell/push-approval-watch.ts`: the phone looks every 15 s while nothing is pending (5 s after a request was handled); opening the app
  still looks at once. `look()` takes injected deps and returns the next delay.
- `components/sw-step-up-dialog.ts` + `api/push-approval.ts` (`pushPollRetryDelay`): a temporary 429 on the requester poll is retried
  (3-10 s, up to 8 in a row) instead of dropping the request; any other error is final as before.
- Tests: `test_mfa_t095_rest_2530.py::test_the_requesters_poll_and_the_phones_look_do_not_starve_each_other` (phone + requester polling together
  for the whole 90 s) and `::test_an_app_left_open_for_an_hour_keeps_working`.

## SA-02 - SEC-8 follow-up
- `routers/backup_offbox.py`: `gdrive/connect` and `gdrive/poll` of a target that already has an account, and `key/import`, are local-network
  only (`_local_only`, audited `local_only`). Diagnose, disconnect, push, rotation and restore stay remote.
- Test: `test_lows_backend_2550_security.py::test_sa02_gdrive_relink_and_key_import_are_local_only`.

## FE-06
- `look()` releases `showing` in a `finally` and swallows a failed sheet load; the chain no longer rejects.
- Test: `frontend/tests/unit-push-approval-fix-2560.spec.ts`.

No look changes (no pixel baselines). New text: none.

## Tests run
See the branch report (results are recorded in the final report; anything not run is marked NOT_RUN there).
