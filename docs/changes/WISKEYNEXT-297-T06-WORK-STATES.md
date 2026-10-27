# WISKEYNEXT-297 slice A - T06 work-state mapping (board r152, WisKey W-031)

Branch `pilot/WISKEYNEXT-297` from `origin/main` @ 1b0ddd85c (v2.23.2). Tests only, no product code changed. Fakes only: no WisKey,
Home Assistant, station, door or network was touched.

## Why

WisKey's open note on T06 (W-031, `ALL_OPEN_CURRENT_34.json`): "a static `status.active` is not proof; `admitted` / `pending` /
`running` are not `accepted`". The identity + role + scope half of T06 is already pinned per signed command by
`tests/test_t06_admission_295.py` (docs/changes/T06-ADMISSION-MAPPING-295.md). Nothing pinned the work-state half as one table.

## The mapping (pinned by `smplwise_vms/backend/tests/test_t06_work_states_297.py`)

| WisKey answer | Arx durable intent (`wiskey_feature_intents.state`) | What the caller is told |
|---|---|---|
| `features/start`, the closed `admitted` ack (`execution_result: pending`, `replay_available: false`) | `sent` (not `accepted`) | `StartOutcome("admitted")` |
| `features/start`, any other state (`accepted`, `running`, `pending`, `finished`, `active`), an extra flag (`active: true`, `accepted: true`, `status.active`), a claimed `execution_result`, a missing key | `unknown` | `StartOutcome("unknown")`; the same request id is never sent again |
| `features/result` `running` | stays `sent` | `DoorOutcome("unknown", "running")`; a live attempt is never retried |
| `features/result` with a state outside `running / finished / cancelled / unknown` (14 words tried) | nothing settled by the read | `FeatureWireError(unknown)` |
| `features/result` `finished`, target outcome not `acknowledged / denied / superseded` (`admitted`, `pending`, `running`, `accepted`, `active`, `ok`, `opened`) | `unknown` (`receipt_unknown`) | `DoorOutcome("unknown", "receipt_unknown")` |
| `features/result` `finished`, target `acknowledged` | `accepted` | `DoorOutcome("acknowledged")`; `physical_confirmed` stays False (a native receipt, never a physical observation) |
| `features/status` (any body, including `active: true`) | nothing | no product module calls it (AST guard over every module that can reach the feature client) |

`fx.settle_feature` refuses every state but `accepted / refused / unknown` (tested with `admitted`, `pending`, `running`, `sent`, `active`).

## Tests

`smplwise_vms/backend/tests/test_t06_work_states_297.py` (58 cases). Results: see the slice report (runner run, SHA in the header).

## Not covered / NOT_RUN

- A real WisKey host, station or door (owner S8 session).
- `people_csv` job states (`paused / running / completed ...`): already judged by `wiskey_people_csv.py` (`outcome.state != "admitted"` refuses)
  and its own suite; not repeated here.
- The owner26 adoption (`pilot/WISKEY-OWNER26-297`) adds the automation sender (`wiskey_auto_door.py`) as a second `features/result` caller.
  When it lands, its completion read must be added to this matrix (one parametrised test, same outcomes).

## Rollback

Delete the test file and this note. No migration, no setting, no product code.
