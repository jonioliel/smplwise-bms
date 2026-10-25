# REL2200 assembly (2.20.0 candidate)

Branch `release/2200`, cut from `origin/release/2190` @ `e476e48ae` (the 2.19.0 candidate, not yet released).
Every pilot branch is merged with `--no-ff` in the order below, so later fixes merged into `release/2190`
can be merged into `release/2200` again without rework. The version is NOT bumped, `contracts/API_INVENTORY.md`
is NOT regenerated (the new routes are listed below), nothing is tagged.

`pilot/LEGALPACK-295` is NOT merged (docs only; the lead decides).

## Merge order and result

| # | Branch | Tip | Result |
|---|--------|-----|--------|
| 1 | `pilot/EMROLE-295` | `b3da0e262` | clean |
| 2 | `pilot/TEMPLINK-295` | `14392f522` | clean (auto-merged `roles.json`, `routers/access.py`) |
| 3 | `pilot/WALINK-295` | `514b421ed` | clean (contains TEMPLINK; only its own two commits were new) |
| 4 | `pilot/NOTICECAPS-295` | `6b2618a1a` | clean |
| 5 | `pilot/ANNOUNCE-295` | `7046fdfb2` | 3 conflicts, resolved; migration renumbered 0193 -> 0177 |
| 6 | `pilot/WKF01F02-295` | `9eca5e924` | clean (auto-merged `main.py`) |
| 7 | `pilot/CAPMAP-295` | `fe213bd71` | clean |
| 8 | `pilot/WKVEC-295` | `514c66fdc` | clean (shares `f4c0283e2` with WKF01F02; only its test commit was new) |

## Conflicts and how they were resolved

All three conflicts in the ANNOUNCE-295 merge have the same cause. ANNOUNCE-295 was cut before
NOTICEADD-295 (already on `release/2190`) moved the notice board tab out of the home-area tab row
into the rail (`NOTICES_AREA`, owner decision 2026-10-24). ANNOUNCE-295 appended its announce tab
after the notice board tab that no longer exists on the release line.

- `frontend/src/shell/nav.ts` (`DEVICES_TABS`): kept the release line (no `notices` tab; the NOTICEADD-295
  comment stays) and added ANNOUNCE-295's `announce` tab. Result: `building`, `automations`, `announce`.
- `frontend/tests/unit-schedules-nav.spec.ts`: the expected hrefs, labels and ids follow the same row
  (`#/devices/building`, `SCHEDULES_HREF`, `#/devices/announce`), in both the registry test and the static-demo test.
- `frontend/tests/unit-tabs-config.spec.ts`: `byId['devices']` expects `['building', 'automations', 'announce']`.

### Post-merge test fix (semantic, not a textual conflict)

`tests/test_presence.py::test_presence_permissions_in_every_role_but_kiosk_and_labelled` requires every built-in
role except the listed add-on grants to hold `presence.report`. ANNOUNCE-295 adds the built-in role `announcer`
(`devices.read` + `media.announce`, the delegable announcer) without `presence.report`, and it did not update this test.
The assertion and the catalogue are the same on the pilot alone, so the test would fail there too. `announcer` has the
same shape as the other add-on grants (`door_opener`, the CR-039 door roles, `tickets_*`, `notices_*`), so the test
now lists it as an add-on grant. For the same reason `tests/test_wiskey_door_path.py::test_d3_grant_card_switches_users_groups_and_custom_roles`
(the door-grant card answer of every built-in role) now expects `announcer: per_user`, because the role holds no door
permission. The role catalogue is unchanged. If the lead wants `announcer` to be a full base role,
the fix is the other way round: add `presence.report` to the role.

No backend conflicts. `roles.json`, `routers/access.py` and `main.py` were changed by several branches and
auto-merged; `roles.json` and `contracts/examples/role-catalog.design.json` were checked to still parse, and
`main.py` carries each branch's hunk once (ANNOUNCE janitor `release_queued`, NOTICECAPS listener `caps=`,
WKF01F02 `intercom_media.shutdown_bridge` on shutdown).

## Migrations

Only ANNOUNCE-295 adds a migration. No other branch adds or renames one.

| Number | File | Origin |
|--------|------|--------|
| 0177 | `0177_announce_stage_a.sql` | ANNOUNCE-295, built as provisional `0193_announce_stage_a.sql` |

The chain is contiguous `... 0175, 0176, 0177`. The renaming is part of the ANNOUNCE merge commit, and the file
header now records the provisional number. No code, test or document referenced the number 0193 or the file name.

## New routes per branch (for the next `API_INVENTORY.md` regeneration)

All are mounted under `/api`.

- EMROLE-295: `GET /doors/emergency/grants`, `POST /doors/emergency/grants`, `POST /doors/emergency/grants/{binding_id}/revoke`
- TEMPLINK-295: `GET /infra/temperature/report/links`, `POST /infra/temperature/report/links`,
  `DELETE /infra/temperature/report/links/{link_id}` (`GET /infra/temperature/report.pdf` changed, not new)
- WALINK-295: `POST /infra/temperature/report/links/{link_id}/send`
- NOTICECAPS-295: none (the TV board listener caps are settings read by the existing settings routes)
- ANNOUNCE-295: `POST /announcements/emergency`, `GET /announcements/templates`, `PUT /announcements/templates`
- WKF01F02-295, CAPMAP-295, WKVEC-295: none

`app.openapi()` after the merges: 1243 paths, 1551 operations, no duplicate operationId and no duplicate-operation warning.
