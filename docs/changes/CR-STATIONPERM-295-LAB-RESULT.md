# CR-STATION-PERMISSIONS-295 - lab result for the UNPROVEN WisKey behaviour (section 10, items 4a / 4b)

**Date:** 2026-10-21 (owner authorization in chat, 2026-10-21). **Target:** the lab WisKey (`hikvision_intercom`)
2.0.1-rc.1, ten real door stations. **Evidence:** private, `private-evidence/lab-2026-10-21/STATIONPERM_4AB.md` (gitignored).

## How it was run
- A dedicated test person (`LABTEST-4AB`: no groups, no PIN, no card, no phone, no photo) was created, changed and
  deleted through the existing Arx -> WisKey command path (`services/intercom_client.py`: `users/create`, `users/update`,
  `users/get`, `users/delete`) with the exact data shape of `WiskeyServiceEngine.set_station_access` (CR section 4).
- The Arx station-permission routes were NOT used: `GO_LIVE_PERMITTED` stayed False, the eight WisKey switches and
  `access.station_permissions` stayed off. No door release, no call, no credential presented at a station, no schedule
  template written to a device, no HA user / group / token change.
- Device state was read with WisKey's `stations/inventory` (a fresh read of the station's user database) before and
  after every step. One station that was in sync and error-free was used.
- Rollback: the test person was deleted. People, tombstones, revocations, every station's sync state and counts, and the
  test station's user set are identical to the original state (four stations already in a sync error before the test
  stayed exactly as they were).

## Results

| Item | Result | Observed |
|---|---|---|
| 4a - Arx removes a person's personal `allow` and no group grants the station | **PASS** | WisKey accepted `{permission_overrides: {}, door_permissions: {}}`, dropped the station from the person's assignments and removed the person's user record from the real station within ~1 s (sync operation `verified`; two fresh device reads: absent, user set identical to before the allow). The station did not keep its previous assignment. |
| 4b - native timing policy with a binding for the station; Arx writes `deny` | **PASS** (scope limit below) | WisKey accepted `{permission_overrides: {<station>: deny}, door_permissions: {}}`; the whole `access_timing_policy` (mode, schedule, the station's binding) is byte-identical in the answer and in a fresh read; the station is stored `enabled: false`, no relays, `synced`. |

## Limits (NOT_RUN parts)
- 4a was proven at the station's user database, not by presenting a credential at the door (no physical action). The
  case where a group still grants the station was not exercised (expected: access stays through the group).
- 4b: the person had no native plan DEPLOYED on the station before the block (deploying would write schedule templates
  to a real station, outside this check; all lab stations report `capabilities.schedules: false`). Whether WisKey also
  cleans a deployed device plan (RightPlan / templates) when a native-mode station is blocked remains NOT_RUN.

## Effect on the build
The two assumptions the fake (`tests/fake_wiskey.FakeAccessEngine`) models in CR section 10 match the real WisKey
2.0.1-rc.1 for the cases tested. No code change follows from this result. This is not an activation: the switch stays
off and `GO_LIVE_PERMITTED` stays False.
