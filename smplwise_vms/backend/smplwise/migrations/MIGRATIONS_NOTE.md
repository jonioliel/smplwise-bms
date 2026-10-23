# Migration numbers on pilot/READYFLEET-295 (placeholders)

`main` ends at `0151_ticket_acceptance.sql`. This branch adds two migrations, numbered contiguously right after it:

| Placeholder file | Built on | Number there | Content |
|---|---|---|---|
| `0152_readiness.sql` | pilot/READY96B-295 (CR-READY96) | 0152 (provisional) | `readiness_attestations`, `readiness_history` |
| `0153_fleet_report_log.sql` | pilot/FLEET215-295 (CR-FLEET215) | 0149 (provisional; collided with main's `0149_zone_counts.sql`) | `fleet_report_log` |

Both numbers are **placeholders**. `release/2150` is being assembled separately and takes `0152`..`0157`
(`0152_infra_water_alerts`, `0153_insight215_runs_delivery`, `0154_fleet_report_log`, `0155_maintenance`,
`0156_ticket_visits_budgets`, `0157_app_refresh_device_key` at the time of writing).

## How to renumber at integration

1. Neither file's content depends on its number; nothing in code, tests or fixtures names either number. Renumbering is a
   `git mv` of the file plus its header comment.
2. Keep the order: readiness first, then the fleet log (they are independent, the order only keeps the history readable).
3. **Stacked on release/2150:** `release/2150` already merged pilot/FLEET215-295 and carries the same table as
   `0154_fleet_report_log.sql`. Do NOT add `0153_fleet_report_log.sql` a second time: drop it in the merge and keep 0154. Only
   `0152_readiness.sql` moves, to the next free number after release/2150's highest file (0158 at the time of writing).
4. **Stacked on main without release/2150:** the placeholders are already contiguous (0152, 0153); keep them.
5. After renumbering, `scripts/release_check.py` and the backend suite confirm the migration set (fresh database and upgrade).
