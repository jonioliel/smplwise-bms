# HA2610-IMPL — running status

Branch `pilot/HA2610-impl`, based on `origin/pilot/HA2610-compat` @ 66187c68 (origin/main 31fe5d7c + 478dc675 + the analysis doc).
Plan: `docs/operations/HA_2026_10_COMPATIBILITY_HE.md` section 4 ("תוכנית התאמה מסודרת", 11 rows).
If this agent is stopped, continue from "Next step" below. Push after every step.

| Plan row | Item | State |
|---|---|---|
| 1 | `for` rule aligned to HA 2026.10 | DONE before this branch (478dc675) |
| 2 | Username normalisation regression tests | DONE e9396b71 (runner: 12 passed) |
| 3 | Audit-log username filter normalised | DONE e9396b71 (runner: test_username_normalisation + test_access 12 passed) |
| 4 | Read-only scan of automations/scripts (`for` combos, mqtt/synology in scripts), admin-only warning in Settings | NOT STARTED |
| 5 | Unauthorized on manual run -> "requires administrator" message | NOT STARTED |
| 6 | Fake HA: probatio wording + 2026.10 `for` rule, version profile | NOT STARTED |
| 7 | Connection probe: block port 80 only for the HA host | DONE 075da7f1 (runner: 135 passed, nvr_connection + cr022 reviews + multi_nvr) |
| 8 | Lab verification after upgrade | OWNER-SIDE, skipped |
| 9 | WisKey gate env 2026.10 | coordination note only (no gate-env change) |
| 10 | upstream watch registry | NOT STARTED |
| 11 | climate/water_heater `temperature_unit` | NOT STARTED |

Next step: row 6 (fake HA), then 4, 5, 10, 11, docs.
