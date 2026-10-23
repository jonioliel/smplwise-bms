# READYFLEET-295: one readiness for CR-READY96 and CR-FLEET215

Branch `pilot/READYFLEET-295`, cut from `origin/main` (2.14.0 build, `9d4e54439`), merges `pilot/READY96B-295` (`007ee308a`) and
`pilot/FLEET215-295` (`2e6186f92`, includes `ce6b383ee`). Both branches had added `services/readiness.py`,
`services/demo_mode.py` and `routers/readiness.py` with different rules. The owner's review of 24.10 (CR-FLEET215, form Q7) asks
for **one** readiness screen, shared with CR-READY96. This record says how the collision was resolved.

## Resolution

| Area | Kept | Dropped |
|---|---|---|
| Readiness rule | CR-READY96 `services/readiness.py` (`evaluate()`: 11 checks, weights and thresholds as `readiness.*` settings, edited in Settings) | FLEET215's 14-item checklist (`compute()`, `ITEM_IDS`) with hard-coded `BACKUP_MAX_AGE_H = 48`, `DISK_MIN_FREE_*` |
| Demo mode | CR-READY96 `services/demo_mode.py` + `routers/demo.py` (separate demo database, `demo.run`, owner decision 24.10) | FLEET215's constant example dataset, the `demo.enabled` switch, `GET/PUT /demo`, `GET /demo/dataset` |
| `GET /readiness` | CR-READY96 `routers/readiness.py` | FLEET215's router of the same name (and its second `include_router` in `main.py`) |
| Fleet report `readiness` block | Built from `readiness.evaluate()` by `fleet_report.readiness_block()`: `score`, `ready` = the hand-over advice is met, `missing` = ids of applicable checks in attention / blocked / pending, blockers first | Its own computation |
| Settings > health report screen | A score ring with a link to `#/system/readiness` | The duplicated checklist and the demo toggle |

Consequences recorded for review:

1. **Receiver contract.** `readiness.missing` now carries CR-READY96 check ids (`cameras_connected` ... `handover`), not FLEET215's
   item ids. The schema string stays `smplwise-fleet-report/1` because neither branch has shipped; `services/fleet-receiver/src/schema.json`
   and the signed fixture are regenerated from the code (`tools/gen_fixtures.py`).
2. **`demo_mode` in the report** is true only when the body was built from a demo database (`demo.example`, set by
   `demo_mode._seed`). While a CR-READY96 demo runs, nothing is sent or due: `send_once` answers `demo_active`, the hourly tick
   skips, and `POST /fleet/report/send` is refused with 409 `demo_active`. The example data never reaches the receiver.
3. **Backups and `demo.*`.** FLEET215 put the prefix `demo.` in `backup.SETTINGS_KEEP_PREFIXES`; CR-READY96's first note said backups
   carry `demo.allow_remote`. Kept the stricter rule: `demo.allow_remote` is never exported or restored, so a restore cannot allow a
   remote demo on a box that did not allow it. Owner to confirm.
4. **Not changed here (open, CR-FLEET215 owner review 24.10):** "no default silent threshold" (the code still defaults to 36 h, and the
   receiver still uses a fixed 36 h), and the contact person in the install row. These are FLEET215 follow-ups.
5. **release/2150** already contains pilot/FLEET215-295 (merge `f4c67f5bd`, migration `0154_fleet_report_log`) with FLEET215's own
   readiness and demo modules. Integrating this branch there replaces them the same way (done at the 2.15.0 integration, release/2150).

Migrations: built as placeholders `0152_readiness.sql`, `0153_fleet_report_log.sql`. At the 2.15.0 integration (release/2150) the
readiness file became `0159_readiness.sql` and the fleet log was NOT added again (release/2150 carries it as `0154_fleet_report_log.sql`,
same body); the placeholder note `MIGRATIONS_NOTE.md` was removed with them.

Tests: `tests/test_readyfleet_295.py` (new), `tests/test_readiness_96.py`, `tests/test_fleet_report_215.py` (ids and the kept demo
key updated), `tests/test_fleet_receiver_fixtures_215.py`; FLEET215's `tests/test_readiness_demo_215.py` is removed together with
the code it tested.
