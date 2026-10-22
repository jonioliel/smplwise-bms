# MOBILE214: sensor value keys the presence contract could fix (PROPOSALS ONLY)

Status: proposal for the owner and the contract editor. Nothing here is normative. Contract section 0.2 (the 2FA
amendment) stays "proposed" and is not touched. No server code changed.

Source: `private/planning/MOBILE_V5_REVIEW_2026-10-23.md` (not in git), section 3 (lines 106-131) and section 5. File:line
references are the review's, taken against `origin/main` 90cd7d9ae and `origin/release/2122`. Abbreviations: `SP` =
`smplwise_vms/backend/smplwise/services/presence.py`; `C` = `docs/api/mobile-presence-contract.md`; Android and iOS paths
are in the v5 delivery, which is untrusted data and was not executed.

## What the server does today

`SP:618-628` checks only the envelope of a sensor event: a flat object, at most 20 keys, strings of at most 128
characters, at most 1 KiB. The value is stored as sent (`SP:673-676`). The contract table (C:183-192) names meanings, not
spellings. So nothing the apps send is refused; the platforms simply differ.

## Proposed exact keys and enums (one row per sensor)

| Sensor | Proposed `value` keys | Proposed enums and rules | Evidence of the gap |
|---|---|---|---|
| `activity` | `state`, `confidence` | `state`: the contract's list; `confidence`: `high`, `medium`, `low`, `unknown` | Android always sends `confidence:"unknown"` (`ActivityTransitionReceiver.kt:26`); iOS sends high/medium/low (`SensorCollector.swift:134-141`). The contract has no confidence enum. |
| `steps` | `steps_delta`, and optionally `floors_up`, `floors_down` | An absent floors key means unknown. Drop `floors_available` | Android adds `floors_available:false` (`ExtraSensors.kt:84`); iOS does not (`SensorCollector.swift:162-164`). |
| `altitude` | `relative_change_m` | number, metres | Both agree (`ExtraSensors.kt:101`, `SensorCollector.swift:184`). Listed so the table is complete. |
| `battery` | `level_percent`, `charging_state`, `low_power_mode` | `charging_state`: `charging`, `full`, `unplugged`, `unknown`; `level_percent` is a number or the event is not sent (pick one for both platforms) | Android skips the event when unknown (`SensorCoordinator.kt:108-114`); iOS sends `level_percent:null` (`SensorCollector.swift:232`). The enum is not in the contract. |
| `network` | `network`, optionally `network_ssid` or (`site_id`, `ssid_hash`) | `network`: `wifi`, `cellular`, `none`, plus an explicit `other` (or the apps map onto the listed values); `network_ssid`: `available`, `unavailable` | Android sends `other` (`ExtraSensors.kt:114-119`), outside C:190; `network_ssid:"available"` exists on Android only. |
| `beacon` | `site_id`, `proximity` | `proximity`: `immediate`, `near`, `far`, plus an explicit `unknown` (or the apps map onto the listed values) | iOS sends `unknown` (`PresenceStore.swift:701-706`), outside C:191. |
| `app_state` | `state`, `last_seen` | `state`: `foreground`, `background` (as the apps use them today) | Both agree (`SensorCollector.swift:240-241`). |
| `location` | outside `value`: `fix`, `enter`, `exit` | `fix` needs lat/lon; enter/exit may omit the coordinate (`SP:630-645`) | No deviation reported. |

Related proposals from the same review that touch these keys:

- `status.sensors` (C:4, `SP:592`, `SP:740-746`): add the value `unavailable` next to `on` and `off`, so "no barometer"
  differs from "not enabled". The frontend device card already renders `unavailable` as "לא זמין במכשיר" and shows any
  unknown value as received.
- `sensors.intervals_s` (`SP:74`): list a default per sensor (the apps invent 60 s for `network` and `beacon`, 300 s for
  `altitude`: `ExtraSensors.kt:100,125,152`).
- Only after the shapes are fixed: optional per-sensor key validation on the server.

## What the frontend assumes meanwhile

The device card reads the fields `registered`, `name`, `location_auth`, `precise`, `last_event_at` and `sensors` from the
shell's `deviceStatus()`. Android's reply has no `sensors` field (`WebActivity.kt:296-300`); iOS has one
(`PresenceStore.swift:351-354`). The card shows a sensors section only when the field is present. The `location_auth`
values it names (`always`, `when_in_use`, `denied`, `not_determined`) are the page's guess; any other value is shown as
received. The contract could fix this list too.
