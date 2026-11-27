# FIX-NVR-PULSE-2560 - alarm-output pulse: honest "unknown" and server-side confirmation

Findings VD-02 (medium) and VD-04 (low) of DEEP-REVIEW-2560-VIDEO-DEVICES. Additive API (ADR-015).

## VD-02
`nvr_system.pulse_output`: a pulse that was sent but whose answer was lost (a transport failure other than ConnectError /
ConnectTimeout / PoolTimeout, or a 5xx from the recorder) is recorded `status="unknown"` in the NVR change log and audited
`decision="allowed"`, `details.outcome="unknown"`; the route answers 504 `action_outcome_unknown` with `details.outcome="unknown"`
(read by `physicalOutcome`). A refusal or "nothing sent" stays `failed` / `denied` (the audit now also carries `outcome: refused`).
The change log of the system screen shows "unknown - check on site" (he/en). Settings writes (`nvr_write.apply_change`) are not changed.

## VD-04
`POST /nvr/outputs/{id}/pulse` requires a body `{confirm: true, client_request_id}` (422 without). A repeated id of the same user,
recorder and output within 120 s returns the first record (marked `duplicate: true`) or repeats the first "unknown" answer and sends
nothing; a refused attempt is not remembered, so the same id may retry. The memory is per process (a restart forgets it).
The UI call (`api/nvr.ts`, PHYSICAL-CONFIRM-2540 dialog path) sends both, one id per confirmed press.

## Tests (fake NVR only)
`tests/test_nvr_pulse_confirm_2560.py` (new); `test_nvr_system.py` and `test_nvr_write_guard_2438.py` send the new body;
`frontend/tests/unit-physical-confirm-2540.spec.ts` source assertions.
