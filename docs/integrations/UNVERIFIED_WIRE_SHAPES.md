# Register of unverified wire shapes and unproven assumptions (video, media, NVR, plan)

Code review 2026-11-13, finding 03:F28; branch `pilot/CR-DOCS-REGISTERS-2440`. Documentation only: no code changed.

The video / media / NVR / plan side of the backend says in its comments where it talks to a device in a shape nobody has
seen on a real device yet. Those notes are honest, but they lived only in comments. This file lists each assumption once,
with the guard that makes it safe today and the check that would close it, so they can be ticked off.

## How to use it

- **Closing a row**: run the check, keep the evidence (a redacted capture under `tests/fixtures/`, or the id of the
  supervised change row), correct the code where the device disagreed, reword the comment in the code (drop
  "UNVERIFIED", name the evidence), then set the row's status here to `closed <date> <evidence>`.
- **Adding a row**: new code that sends or parses a shape not yet seen on a real device writes `UNVERIFIED` in its comment
  **and** adds a row here in the same commit.
- Every check below touches a device. It needs the owner's explicit, task-specific approval (`CLAUDE.md`, "Device access
  is read-only by default"); a check marked *write* additionally goes through the product's own first-supervised-write
  rule. Captures are redacted (hosts, serial numbers, MAC addresses, credentials) before they leave `private-evidence/`.
- Status values: `open`, `reconcile` (the code itself holds later evidence that may already close it; see the row),
  `closed <date> <evidence>`, `accepted` (will stay unproven by decision).

## How the rows were collected

At `4e52e5e4a` (`origin/pilot/CR-WAVE2-COMBINED-2439`), over the review's scope (`services/recorders/*` plus every
`services/` and `routers/` module whose name matches media / nvr / go2rtc / camera / stream / playback / record / plan /
map / health / frigate / provision / app_refresh / live_ / capture / exports / video / timeline, without the wiskey,
intercom, door engine, tickets and access modules; 134 files):

```
grep -niE "unverified|not verified|unproven|not yet verified|not proven|never verified"
```

72 matching lines (the review counted 71 at v2.43.4). **38 lines are assumption notes**; they collapse into the 24 rows of
sections 1 to 5, because one assumption is usually stated in the adapter, the service and the router. **34 lines are not
assumptions**: they are the word `unverified` used as a status value or a verdict (section 6). Line numbers are those of
`4e52e5e4a` and drift; the symbol names are the stable reference. Paths are relative to
`smplwise_vms/backend/smplwise/`.

## 1. Frigate: reads

| Id | Assumption | Stated at | Guard today | Check that closes it | Status |
|---|---|---|---|---|---|
| FR-R1 | The payloads of the `reviews` and `events` frames on Frigate's `/ws` (no detection happened during the passive listen of the study). | `services/recorders/frigate_events.py` module docstring (`:11`) and the poll loop (`:644`) | Every frame parser is defensive (an unknown shape is counted and ignored); an `events` frame only hints that a poll is due; polling `GET /api/review` is always on and a connected socket slows it only after it delivered a real review item. | Read-only: listen on `/ws` during one real alert and one detection, keep the redacted frames as a fixture, compare with the parsers. | open |
| FR-R2 | The time anchors of HLS playback (`ANCHORS_PROVEN = False`): that the first segment's `start_time` is the media anchor, and how seek, reconnect and cleanup behave. | `services/recorders/frigate_playback.py` (`ANCHORS_PROVEN`, `playback_plan` `:127`, `:139`); `routers/frigate.py` `playback_plan` (`:426`) | The answer says `"proven": false, "status": "unproven"` and lists `to_prove`; the window is capped. | Read-only, with a player (the F1-M1 measurement step): media anchor, seek generation, rendered time against the anchor, consumer reconnect, cleanup. Then flip `ANCHORS_PROVEN`. | open |
| FR-R3 | The server-cut clip of one camera and window: `GET /api/{camera}/start/{s}/end/{e}/clip.mp4`. | `services/recorders/frigate_http.py` `CLIP_ALLOWED` (`:113`); `services/recorders/frigate.py` `open_clip` (`:546`); `routers/frigate.py` `camera_clip` (`:520`); `services/recorders/frigate_playback.py` `export_plan` (`:152`, design only) | Off the F1 read allow-list; reachable only through `open_clip`; first read is refused 409 `frigate_first_write_unsupervised` until a system administrator passes `supervised=true` once; byte and time caps. | Read-only: one supervised clip GET of a short window; confirm status, content type, that the stream ends, and the "no recordings" answer. | reconcile: `frigate_http.py:565` records a live 0.18.0 answer for an empty window (FRIGLIVE-295), so this route was reached at least once. |
| FR-R4 | The clip of one tracked object: `GET /api/events/{id}/clip.mp4` (and, from 0.18, a review item's clip). | `services/recorders/frigate_http.py` `CLIP_ALLOWED`; `services/recorders/frigate.py` (`:551`) | As FR-R3. | Read-only: one supervised GET for an existing event id and one for a review id. | open |

## 2. Frigate: writes

Common guards of every row in this section: the write class is off per recorder by default; the first write of each kind
toward a recorder is refused unless it is sent with `supervised: true` by a holder of `system.configure`
(`services/frigate_native_svc.py`, `check_supervised`, table `frigate_first_write`); every write is read back, and a
write the read-back cannot confirm is logged with status `unverified`, not as failed; nothing is retried or queued.
`GET /frigate/{recorder_id}/control/first-writes` shows which kinds already had their supervised first write: **that
list is the product's own evidence and the first thing to read when reconciling this section.**

| Id | Assumption | Stated at | Check that closes it | Status |
|---|---|---|---|---|
| FR-W1 | Runtime switch: `PUT /api/camera/{cam}/set/{feature}` with `{"value": "ON" \| "OFF"}`, and that the effective `GET /api/config` shows the new state. | `services/recorders/frigate_control.py` module docstring (`:8`-`:13`) | *Write*: one supervised toggle and its undo on one camera; confirm the read-back. | open |
| FR-W2 | Profile switch: `PUT /api/camera/*/set/profile` with `{"value": "<name>" \| "none"}`. | same docstring; `services/frigate_auto_profile.py` (`:12`: the first automatic switch is never automatic) | *Write*: one supervised manual switch and back. Closes the kind `profile_auto` precondition too. | open |
| FR-W3 | Review marks: `POST /api/reviews/viewed` with `{"ids": [...]}`, `DELETE /api/review/{id}/viewed`. | same docstring | *Write*: mark one review item viewed and unviewed. | open |
| FR-W4 | Event retain: `POST` / `DELETE /api/events/{id}/retain`. | same docstring | *Write*: retain and release one event. | open |
| FR-W5 | Event sub label: `POST /api/events/{id}/sub_label` with `{"subLabel": "<text>"}`. | same docstring | *Write*: set and clear on one event. | reconcile: `frigate_control.py:302` already cites the 0.18 source for the body (`""` clears, `null` is a 422). Source reading, not a live write. |
| FR-W6 | PTZ: the message `{"topic": "<cam>/ptz", "payload": "<command>"}` on `/ws`. | same docstring; `ptz` | *Write* (moves a camera: physical action, needs its own approval): one preset recall on a PTZ camera. | open |
| FR-W7 | Manual events: `POST /api/events/{cam}/{label}/create`, `PUT /api/events/{id}/end`. | `services/recorders/frigate_http.py` `WRITE_ALLOWED["events"]` (`:98`); `services/recorders/frigate_control.py` F2b block (`:305`); `services/frigate_native_svc.py` (`:5`); `routers/frigate_f2b.py` (`:6`, `:96`) | *Write*: create one manual event and end it. | open |
| FR-W8 | Exports: `POST /api/export/{cam}/start/{s}/end/{e}`, `PATCH /api/export/{id}/rename`, `POST /api/exports/delete`, `POST /api/exports/reassign`; that a new export is a queued job with no row until it starts. | `services/recorders/frigate_http.py` `WRITE_ALLOWED["exports"]` (`:101`); `services/frigate_native_svc.py`; `routers/frigate_f2b.py` | *Write*: one short export, rename, assign to a case, delete (only objects Arx created). | reconcile: the delete and reassign routes were checked against the 0.18.2 OpenAPI (FRIGATE-295, same comment), and `frigate_control.py:110` records the live row shape of `GET /api/exports` (FRIGLIVE-295). |
| FR-W9 | Cases: `POST /api/cases`, `PATCH` / `DELETE /api/cases/{id}`. | `services/recorders/frigate_http.py` `WRITE_ALLOWED["cases"]`; `services/frigate_native_svc.py` | *Write*: create, rename and delete one case. | open |
| FR-W10 | Configuration write: `PUT /api/config/set` with `{"requires_restart": 0, "update_topic": "config/cameras/<cam>/<section>", "config_data": {...}}`; an empty string removes a key. | `services/recorders/frigate_config.py` module docstring (`:16`) and `FrigateConfig._set` (`:358`); `services/recorders/frigate_http.py` `WRITE_ALLOWED["config"]` (`:109`); `routers/frigate_config.py` (`:6`) | *Write*: one supervised setting change and its revert on one camera; one zone create and delete. | reconcile: `frigate_config.py:304` and `services/frigate_config_svc.py:181` record live 0.18.0 behaviour of `config/set` (FRIGLIVE-295), and `frigate_perm_restream.py:203` says the camera sections are verified live. The module docstring still says "NOT verified". |
| FR-W11 | The upper bound of a Frigate zone name (`ZONE_NAME`, 40 characters). | `services/recorders/frigate_config.py` (`:32`) | Source reading of the Frigate version in use, or a zone write at the bound. | open |
| FR-W12 | `config/set` for the **go2rtc** section with `requires_restart: 1` (new `go2rtc.streams` entries only). | `services/recorders/frigate_perm_restream.py` `config_set_body` (`:202`) | *Write* into Frigate's own go2rtc section (not the lab host's go2rtc, which also serves another project): one added stream and its removal, then a Frigate restart at a time the owner chooses. The dry run and the manual YAML snippet do not depend on it. | open |

## 3. Hikvision NVR

| Id | Assumption | Stated at | Guard today | Check that closes it | Status |
|---|---|---|---|---|---|
| NV-1 | The shape of a stream's capability document (`.../capabilities`: `opt` / `min` / `max` attributes, width and height lists paired by position). It follows the contract; no lab document was read. | `services/nvr.py` `parse_stream_capabilities` (`:1206`) | Tokens outside a strict alphabet are dropped; a non-XML or DOCTYPE document raises. | Read-only: GET the capability document of one channel (main and sub) on the lab NVR; keep it redacted as a fixture and run the parser on it. | open |
| NV-2 | The shape of `.../dynamicCap` (`<resolution>2560*1440</resolution>` or `2560x1440`). | `services/nvr.py` `parse_dynamic_resolutions` (`:1245`) | Same parser rules. | Read-only: one GET per codec on the lab NVR; fixture. | open |
| NV-3 | Synchronized playback across **two recorders**: per-recorder zone and clock offset (`GET /ISAPI/System/time`), composed into each member's request. Experimental. | `services/recorder_clock.py` module docstring (`:3`); `services/playback_groups.py` (`:28`); refusal in `routers/playback_groups.py` (`:102`) | Off by default (`playback.cross_recorder_sync` = "false"): a mixed group is refused 409 `sync_cross_recorder_unproven`; when on, a zone mismatch or a large offset is refused. | Needs two real recorders: a mixed group, the measured offset against a visible clock in both pictures. | open (no second recorder in the lab) |

## 4. Multimedia and TV profiles

| Id | Assumption | Stated at | Guard today | Check that closes it | Status |
|---|---|---|---|---|---|
| MD-1 | Whether Home Assistant's own group volume works on a Music Assistant entity. | `services/media_groups.py` `plan_volume` (`:327`) | Not used: the volume is a `media_player.volume_set` per member. | A group of two MA players: one group-volume call, read both members back. | open |
| MD-2 | The Samsung blue key is `KEY_CYAN` on the models that have one. | `services/media_profiles.py` `MODEL_CODES` (`:68`) | A "model key": sent only for a screen whose `model_keys` an administrator set. | Press it on one Samsung model that has the key. | open |
| MD-3 | LG webOS text entry. | `services/media_profiles.py` `TEXT` (`:78`) | Off for `lg_webos`. | Send text to one LG screen through the integration; then turn the capability on. | open |
| MD-4 | The full per-model list of LG sound outputs. | `services/media_profiles.py` `LG_SOUND_OUTPUTS` (`:87`) | Only the five documented values are offered. | Read the output list of each LG model in use. | accepted (a per-model list is not maintainable; extend on demand) |

## 5. Plan

| Id | Assumption | Stated at | Guard today | Check that closes it | Status |
|---|---|---|---|---|---|
| PL-1 | How a commercial CAD product orders right-to-left runs of the exported MTEXT (Hebrew labels are stored in logical order). | `services/plan_dxf_export.py` module docstring (`:21`) | Bidi embedding and override marks are stripped; MTEXT control characters are escaped. | Open one exported DXF with Hebrew labels in a commercial CAD product; screenshot. No device involved. | open |

One more line in scope uses the word for a go-live permit rather than a wire shape: `services/capture_lease.py` (`:65`),
`GO_LIVE_PERMITTED = False`, whose comment lists "WisKey consumer unverified" among the reasons. It is the owner's switch
and is tracked by the capture-lease change request, not here.

## 6. Lines that match the search but are not assumptions

They use `unverified` / `unproven` as a **value**, and stay as they are:

| What | Where | Lines |
|---|---|---|
| Status `unverified` of a Frigate change row (the write was accepted, the read-back did not confirm it), and the places that treat it like `applied` | `services/frigate_control_svc.py` (9), `services/frigate_native_svc.py` (11), `services/frigate_config_svc.py` (3), `services/frigate_auto_profile.py` (2) | 25 |
| Verdict `unknown_unverified` of an NVR encoding batch and its mapping | `services/nvr_batch.py` | 4 |
| "The unverified streams" of a batch, re-checked read-only | `services/nvr_verify.py` (2), `routers/nvr_batch.py` (1) | 3 |
| An NVR write whose read-back failed is "audited as unverified" (review 03:F01) | `services/nvr_write.py` | 2 |

The verdict `channel_map_unproven` in `services/recorders/hikvision.py` (`:273`) is counted with the assumption notes
because it is the search's 38th line, but it is a run-time verdict too: the recording state is withheld when the
working-status document does not cover every online channel. Nothing to close.

## Outside this register

The same search over the whole backend returns 258 lines; the other areas (access control and WisKey, tickets and
messaging, energy, transit) were outside finding 03:F28 and are not listed. If a register is wanted for them, it is a
separate task per area with the owner of that area.
