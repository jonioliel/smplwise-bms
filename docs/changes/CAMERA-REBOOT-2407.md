# CAMERA-REBOOT-2407 - reboot one camera through its NVR (legacy parity P09)

Branch `pilot/CAMERA-REBOOT-2407` (from `origin/main` @ a4652fda5, v2.40.5). No version bump, no merge, no tag, no runner gate.
Code and tests only: no NVR, camera, go2rtc or Home Assistant device was contacted (fake NVR via `httpx.MockTransport` only).

## Owner decision (2026-11-07)

Arx gets "reboot a camera", behind a sensitive permission. This closes the gap the legacy parity report lists as
**P09 Camera (IPC) reboot through the NVR - missing** (`docs/legacy/PARITY_REPORT.md` and `docs/changes/T070-T006-2406.md`, on the
branch `docs/T070-T006-2406`, not yet on main). When that branch lands, P09 in `docs/legacy/PARITY_MAP.json` moves from `missing` to
`same` with the evidence below (not edited here: the file is not on main).

## Legacy behaviour (read-only source: `hikvision_nvr` v1.5.27, `app/main.py`)

```python
@app.post("/api/nvr/cameras/{channel_id}/reboot")
async def camera_reboot(channel_id: str, _=Depends(require_tech)):
    path = f"/ISAPI/ContentMgmt/InputProxy/channels/{channel_id}/reboot"
    r = await get_client().get(path)
```

- One request, to the **NVR** (never to the camera directly): `GET /ISAPI/ContentMgmt/InputProxy/channels/{channel}/reboot`. The NVR
  proxies the reboot to the IP camera behind that channel; the camera's own address and credentials stay on the NVR.
- Guarded only by the add-on's "tech" PIN; a browser `confirm('לאתחל את המצלמה?')`; no audit, no rate limit.

## Arx behaviour

### API

| Route | Who | What |
|---|---|---|
| `GET /api/v1/cameras/{camera_id}/reboot` | whoever sees the camera live (`video.live`, camera scope) | `{camera_id, supported, permitted, writes_enabled, can_reboot, reason, cooldown_s, recorder_id}`; `reason` is one of `not_supported` / `no_permission` / `writes_off` / `cooldown` / null. Nothing is sent to a device. |
| `POST /api/v1/cameras/{camera_id}/reboot` body `{"confirm": true}` | `nvr.camera.reboot` | 201 `{id, kind: "camera_reboot", target, status: "applied", note, created_at, camera_id, cooldown_s}` |

Guards of the POST, in order (the NVR reboot pattern of `POST /nvr/reboot` plus the NVR-writes switch of
`PATCH /recorders/{id}/writes`):

1. **Permission**: the new sensitive permission `nvr.camera.reboot` ("NVR: הפעלה מחדש של מצלמה") at installation scope AND on the
   camera's own chain (T055 camera scope) - 403, audited by `require`. Built-in: `system_admin` only; listed in
   `sensitive_permissions_not_implied` (never implied, a custom role must name it). `nvr.system.reboot` does NOT grant it.
2. The camera exists and has an NVR channel (404 / 409 `no_channel`).
3. **Vendor**: Hikvision ISAPI only. **Provision-ISR: unsupported** - 409 `camera_reboot_not_supported` before any request. Its API
   (`docs/integrations/provision-isr/API_STUDY.md`) has only a whole-device `Reboot`, listed as never-from-Arx; no per-channel camera
   reboot was found. Frigate / other vendors: the same refusal.
4. **NVR-writes switch** ("אפשר שינויי הגדרות ב־NVR", `services/nvr_write_switch.effective`) must be on for the camera's recorder -
   409 `nvr_writes_off` otherwise. A Hikvision recorder that was never switched keeps the vendor default (on, as shipped since CR-020 S2).
5. **Confirmation**: `confirm` must be the JSON literal `true` (strict model: `"yes"`, `1` refused) - 422 `confirm_required`.
6. **Rate limit**: one reboot per camera every 300 s (a camera takes 1-2 minutes to come back; counted from accepted or in-flight
   commands) and at most 3 reboot attempts per user per 10 minutes - 429 `rate_limited` with `retry_after_s` and `scope`
   (`camera` / `user`). Counted from the NVR change log, so it survives a restart and holds across workers.

Every refusal after the permission check, and every outcome, is an audit row `nvr.write` (`resource_type: camera`,
`details.kind: camera_reboot`). The command is a row of the NVR change log (`nvr_changes`, `kind: camera_reboot`, `camera_id`, no
"before" document - it cannot be rolled back), reserved as `sending` under the write lock before the device call (a racing second
request sees it and is rate limited), then `applied` or `failed` with the error code.

### The request (`smplwise/services/camera_reboot.py`)

- Same shape as the legacy add-on: `GET /ISAPI/ContentMgmt/InputProxy/channels/{channel}/reboot` through the camera's own recorder
  (multi-NVR: `recorder_scope.camera_settings`).
- The Hikvision ISAPI documentation lists **PUT** for this resource. When the device's answer proves the GET was NOT executed
  (HTTP 405, or an ISAPI `notSupport` / `methodNotAllowed` / `invalidOperation` refusal) exactly ONE `PUT` follows. Nothing else is ever
  retried: a credential refusal (401/403 without such a sub-status), a timeout or any other answer is recorded as `failed` and reported.
  Which method the owner's NVR accepts is recorded in the audit row (`details.method`) - see the LAB step.

### UI (camera screen, "הגדרות מצלמה" accordion)

- A new row **"הפעלה מחדש של המצלמה"** for users who read NVR settings (`canReadNvrConfig`); the state is read from the GET route.
- Button "הפעל מחדש את המצלמה…" (danger). Disabled with the reason in words (and as its tooltip) when the permission is missing, NVR
  changes are off, or the camera was just restarted ("אפשר לנסות שוב בעוד N דק׳"). Hidden for a recorder type without the action.
- The press opens the sensitive confirmation dialog (camera name and channel, "1-2 minutes without live video and recording, other
  cameras and the NVR keep working, the action is logged"); "הפעל מחדש" sends once, never retried. Success / refusal is one line in
  words - no error code, permission name or device path on the face.
- Hebrew and English (`frontend/src/i18n/camera-reboot.ts`, follows the document language; a unit test holds key / placeholder parity).

## Files

| File | Change |
|---|---|
| `smplwise_vms/backend/smplwise/services/camera_reboot.py` | new: guards, rate limit, request, change log + audit |
| `smplwise_vms/backend/smplwise/routers/nvr_write.py` | `GET` / `POST /cameras/{id}/reboot`; `nvr.camera.reboot` in `NVR_PERMISSIONS` (the change log is readable by its holder) |
| `smplwise_vms/backend/smplwise/routers/recorders.py` | `nvr.camera.reboot` in `READ_PERMISSIONS` |
| `smplwise_vms/backend/smplwise/routers/access.py` | permission label |
| `smplwise_vms/backend/smplwise/roles.json` | `system_admin` + `sensitive_permissions_not_implied` |
| `frontend/src/api/nvr.ts` | `cameraRebootState`, `rebootCamera` |
| `frontend/src/i18n/camera-reboot.ts`, `frontend/src/screens/camera-reboot-logic.ts` | new: words (he/en), pure view / error rules |
| `frontend/src/screens/live-camera.ts` | the accordion row, button, dialog |
| tests | `smplwise_vms/backend/tests/test_camera_reboot_2407.py` (9), `frontend/tests/unit-camera-reboot-2407.spec.ts` (6) |
| `management/tasks.json`, `requirements.json`, `test_catalog.json` + regenerated views | task card `CAMERA-REBOOT-2407`, `R-` / `AT-CAMERA-REBOOT-2407-1` (catalog status NOT_RUN) |

`contracts/API_INVENTORY.md` and the add-on CHANGELOG are regenerated / written at the release that carries this branch (as for every
train). No migration: `nvr_changes.camera_id` exists since 0050; `sending` is a new value of the free-text `status` column.

## Tests (Windows workstation, `.venv` Python 3.12, Node 24.21.0)

All against fakes; run on 2026-11-07 on the branch before the commit.

| Command (from `smplwise_vms/backend` / `frontend`) | Outcome |
|---|---|
| `pytest tests/test_camera_reboot_2407.py` | **9 passed** |
| `pytest` on 18 related files (`test_camera_reboot_2407`, `test_access_permissions_wxperm`, `test_ha_users`, `test_multi_nvr`, `test_nvr_cameras_settings`, `test_nvr_connection`, `test_nvr_h264_bulk_2341`, `test_nvr_less`, `test_nvr_stream_batch_rbac`, `test_nvr_stream_write`, `test_nvr_system`, `test_nvr_write`, `test_rbac`, `test_rbac_camera_scope`, `test_rbac_groups`, `test_rbac_matrix`, `test_readiness_96`, `test_recorder_adapter_write`) | **491 passed, 1 failed**: `test_nvr_less.py::test_nvr_routes_answer_409_nvr_not_configured[GET /api/v1/nvr/system]` - the wall-clock bound only (6.6 s against 5 s, the right 409 answer); a route this branch does not touch. On a standalone rerun the same timing assertion failed for other, also untouched routes (`/nvr/notify`, `/nvr/reboot`, `/cameras/{id}/osd`): workstation load, not a regression |
| `SW_TEST_TIME_FACTOR=3 pytest tests/test_nvr_less.py tests/test_camera_reboot_2407.py` (the conftest's documented knob for a busy machine) | **63 passed** |
| `npx playwright test -c playwright.unit.config.ts tests/unit-camera-reboot-2407.spec.ts` | **6 passed** |
| `npx tsc --noEmit` | clean (exit 0) |
| `python scripts/project_status.py --write` | PASS (452 tasks, 561 requirements; registry check only) |

## NOT_RUN

- **LAB-CAMERA-REBOOT-2407 - owner-approved reboot of ONE lab camera: NOT_RUN.** Needs the owner's explicit, task-specific approval
  (a physical action on a real device). Procedure when approved: pick one non-critical Hikvision camera with the owner; confirm the
  NVR-writes switch of its recorder is on; press "הפעל מחדש את המצלמה…" as a holder of `nvr.camera.reboot`; record (redacted) the
  audit row's `details.method` (GET or PUT), the change-log row, the time until the channel is online again (channel status) and that
  live video returns; press again at once and confirm the 429 cooldown line. If the NVR refuses both methods, record the ISAPI
  sub-status and stop (no further attempts).
- Desktop / mobile / RTL screenshots of the new accordion row and dialog: NOT_RUN (no runner gate in this task).
- The full backend suite and the full frontend unit suite: NOT_RUN (a related subset was run, listed above).

## Rollback

Revert the branch's commit. The permission disappears from `roles.json`; a custom role that named it keeps an unknown permission string
that grants nothing. Change-log rows of kind `camera_reboot` stay as history.
