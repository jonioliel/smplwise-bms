# Installation capabilities (NN1 P0 contract + P1 backend)

Status: P1 (backend) implemented on `pilot/nn1-p1-capabilities`; P2 (frontend shell) implemented on `pilot/nn1-p2-shell` (section 4a). Plan: `private/nn1/PLAN.md` (not in Git).
Predecessor: `docs/operations/NVR_LESS_MODE.md` (the binary mode this generalises; still valid).

## 1. Owner decisions (2026-10-03, binding)

| # | Decision |
|---|---|
| D1 | Generalise the binary `installation_mode` into a **derived** capability set exposed on `/me`. No migration, no stored flag, no new permission. |
| D2 | **An NVR without go2rtc is not a supported installation.** The setup wizard never reaches "ready" and says why in operator language (no infrastructure branding). There is no degraded "snapshot grid" mode. |
| D3 | Without an NVR the investigate area stays hidden. A Home Assistant events list is a **future** option only (not built). |
| D4 | Changing the NVR / go2rtc connection keeps "restart required" (background work is chosen at start-up). |
| D5 | When an NVR is removed, camera rows stay (disabled from use, invisible), history intact; they return when an NVR is added again. |
| D6 | No per-area hide switch. Hiding follows what the installation has. |
| D7 | No new go2rtc writes. Only streams in the `smplwise_` namespace belong to this product. |
| D8 | NVR connection settings will move from the add-on options into Arx settings (NN4). The capability derivation reads the connection through one function each (`capabilities.nvr_host`, `capabilities.go2rtc_url`), so NN4 changes those two functions and nothing else. `config.yaml` options are untouched by NN1. |

## 2. The capability set

`smplwise_vms/backend/smplwise/capabilities.py`, `resolve(settings) -> Capabilities` (frozen dataclass). Computed on every
call from the connection settings; **configured, not reachable**: a go2rtc or Home Assistant that is down is a health fact
(`/health/report`), never a capability change, so the navigation never flickers.

| Capability | Meaning (derivation) |
|---|---|
| `nvr` | An NVR host is configured (`nvr_host()`; the developer placeholder host counts, as it does for `mode = full`). |
| `go2rtc` | A go2rtc address is configured (`go2rtc_url()`). |
| `ha` | Home Assistant connection configured (`ha_url` and token). |
| `live_video` | `go2rtc` AND a live source: a recorder with live, WisKey credentials, or Home Assistant (opted-in HA cameras). |
| `playback` | `go2rtc` AND a recorder whose adapter declares `playback != none`. |
| `events_recorder` | A recorder whose adapter declares `events != none` (Hikvision alertStream). |
| `events_ha` | `ha` (HA security events are recorded with `source = ha`; not shown in the event centre yet, D3). |
| `ha_cameras_still` | `ha`. |
| `ha_cameras_live` | `ha` AND `go2rtc` (per-camera opt-in by an administrator stays a separate, stored choice). |
| `supported` / `unsupported_reason` | `false` / `nvr_without_go2rtc` when `nvr` AND NOT `go2rtc` (D2); otherwise `true` / `null`. |
| `recorders[]` | One entry today: `{id: "nvr-1", vendor: "hikvision", live, playback, events, write_encodings}` from the adapter's `RecorderCapabilities`. |

`mode.installation_mode()` is a thin wrapper: `ha_only` = no `nvr` capability. `mode.describe()`, `ensure_nvr()` and the
`mode` field everywhere are unchanged (compatibility for the shell of today and `tests/test_nvr_less.py`).

### 2.1 The four installations

| | A: no NVR, no go2rtc | B: no NVR, go2rtc | C: NVR, no go2rtc | D: NVR + go2rtc |
|---|---|---|---|---|
| `mode` | `ha_only` | `ha_only` | `full` | `full` |
| `supported` | yes | yes | **no** (`nvr_without_go2rtc`) | yes |
| `live_video` | no | if WisKey or HA configured | no | yes |
| `playback` | no | no | no | yes |
| `events_recorder` | no | no | yes | yes |
| Wizard | NVR + camera `not_applicable`; go2rtc optional | NVR + camera `not_applicable`; go2rtc real step | go2rtc `failed`, `ready` never true, reason shown | all six steps |
| Health go2rtc check | `off` | probed | `error` once the NVR is connected (credentials); `warn` while the NVR itself is still unconfigured | probed |
| Summary pill | (HA is the product) | (HA is the product) | `error` item `go2rtc` once the NVR is connected | as before |

## 3. API (P1)

All fields are additive; nothing was removed or renamed.

- `GET /me` → `capabilities: {nvr, go2rtc, ha, live_video, playback, events_recorder, events_ha, ha_cameras_still,
  ha_cameras_live, supported, unsupported_reason, recorders?}`. The booleans are for every signed-in caller; `recorders`
  only when the caller holds `system.configure` or any `nvr.*` permission at some scope (same predicate as the shell's
  `canReadNvrConfig`). Never a host, serial number, MAC address or credential.
- `GET /health` → the same `capabilities` block (same recorder rule) + `installation: {supported, reason, message, action}`.
- `GET /health/report` (system.configure) → `capabilities` (with recorders) + `installation`; go2rtc check per section 2.1
  (`meta.required = true` in installation C).
- `GET /health/summary` → in installation C with a connected NVR, item `{id: "go2rtc", status: "error"}` in operator wording.
- `GET /setup/state` (system.configure) → `capabilities` + `installation`; `ready = all required steps done AND supported`.
  The go2rtc step keeps its problem code `media_not_configured`; in installation C its message/action explain the
  unsupported installation. Wizard wording no longer names the infrastructure (no "Home Assistant › Add-ons ›
  Configuration" in the go2rtc text).

### 3.1 Route rule

Hidden is not unprotected. Every route keeps its own identity and permission check FIRST (401 / audited 403), then
`mode.ensure_nvr` (409 `nvr_not_configured`, unchanged), then `capabilities.ensure_capability(settings, name)`:
409 `capability_unavailable`, `details: {capability, reason}` (`reason = media_not_configured` for go2rtc-backed
capabilities). Never a 5xx for a missing capability.

| Route | Checks after the permission | Before NN1 (no go2rtc) |
|---|---|---|
| `GET /media/streams` | `go2rtc` | 503 `media_not_configured` |
| `POST /media/streams/sync` | `ensure_nvr`, `live_video` | 503 `media_not_configured` |
| `POST /playback/sessions` | `ensure_nvr`, `playback` | 503 `media_not_configured` |
| `POST /playback/groups` | `ensure_nvr`, `playback` | 503 `media_not_configured` |
| `GET /media/live/{camera}` | `ensure_nvr` (answers 200 with `media_configured: false`, unchanged) | unchanged |

WebSockets keep their close codes (`4503` without go2rtc).

## 4. Screen contract for P2

The frontend reads `capabilities` from `/me` into the session store (`session.capabilities`, `cap(name)`) and replaced `NVR_LESS` / `isNvrHref` with one table
`href -> required capability`. Hide when an area has no meaningful content; never an operator-screen empty state that
tells the user to configure something (the "how to add it" text lives in Settings › connections only).

| Area | Required capability | Notes |
|---|---|---|
| Live overview, all cameras, saved views, wall, kiosk | `nvr` (and `supported`) | Installation C is unsupported: the shell shows the existing neutral panel pointing at Settings › connections; no snapshot grid (D2). Installation B with a WisKey / HA live source: a sources list is a P2 design question, not decided here. |
| Camera page, camera health | `nvr` | |
| Investigate: events, reviews, rules, search, cases, exports, recordings | `events_recorder` | Hidden without an NVR (D3). |
| Investigate: playback, sync, historical map | `playback` | |
| Camera settings (CR-020), NVR notify, storage | `nvr` | |
| Floor map camera layer / picker / anchors | `nvr` | Leftover camera rows are not drawn without an NVR (D5). |
| Device camera card (HA camera) | `ha_cameras_still`; live with `ha_cameras_live` + opt-in | Already gated by `go2rtc_url` in `device_cameras.py`. |
| WisKey station video | `go2rtc` | |
| Settings › connections | always | NVR card neutral without `nvr`; go2rtc card says "required" in installation C. |
| Alarm, automations, notifications, multimedia, schedules, backup | always | P0 audit: no direct NVR or go2rtc call (section 5). |
| Demo / preview (no backend) | all true | As `NVR_LESS = false` today. |

## 4a. P2 as built (`pilot/nn1-p2-shell`)

Code: `frontend/src/api/capabilities.ts` (type, `resolveCapabilities`, fallbacks), `frontend/src/shell/nav-capabilities.ts` (the one table
`route -> needs`, `needs` = a capability or `supported`), `session.capabilities` / `cap()` / `installationSupported()` in `api/session.ts`.
Without a backend (demo) everything is on; a backend that sends no block is read through `mode` (`ha_only` = no NVR).

| Route | Needs | A | B | C | D |
|---|---|---|---|---|---|
| Live overview, all cameras, saved views, kiosk wall | `nvr`, `supported` | panel "no NVR" | panel "no NVR" | panel "needs a media server" | screen |
| Camera page | `nvr` | panel | panel | screen (the player opens no socket without `live_video`) | screen |
| Events, reviews, rules, search, cases, exports, event detail | `events_recorder` | panel | panel | screen | screen |
| Playback, synchronised playback, historical map | `playback` | panel | panel | panel "needs a media server" | screen |
| Camera health, camera settings (CR-020) | `nvr` | panel | panel | screen | screen |
| Everything else (alarm, automations, notifications, media, schedules, backup, map, settings) | none | screen | screen | screen | screen |

Navigation (rail, tab rows, phone bar, start screen) uses the same table: a page the installation cannot serve is not offered, a section with
no page left disappears, and the security area opens on its first remaining page. Other consumers: camera picker and camera card (leftover NVR
rows are not offered / drawn without an NVR, D5; HA live only with `ha_cameras_live`), plan editor (camera tool, layer and anchors), floor map (as
before), live player, WisKey station stills (`go2rtc`), notification matrix (recorder sources hidden without an NVR), wizard (unsupported
notice, never ready), health tab (unsupported notice), connections page (go2rtc "required" in C).

Deliberate limits: the storage tab stays (it hosts the local disk guard; its NVR parts were already hidden by the NVR-less mode); installation B
with a WisKey / HA live source has no sources list yet (design question, still open); the "no NVR" panel keeps its earlier wording, which tells the
operator how to add an NVR (an existing spec asserts it) - NN4 moves that text when the connection moves into Arx settings; a recorder whose
adapter lacks events would show the "no NVR" panel for the event screens (single vendor today).

Evidence: `docs/design/evidence/nn1-p2/` (fake data only), specs `tests/unit-capabilities.spec.ts`, `tests/evidence-nn1-p2.spec.ts`
(mock layer `tests/nn1-p2-mocks.ts`: four installations x HA connected / down / not configured).

## 5. P0 audit (2026-10-03, code-level)

Method: grep of every service and router for direct NVR (`services/nvr*`, ISAPI) and go2rtc (`Go2rtc(`, `go2rtc_url`) use,
plus the table-driven route sweep of `tests/test_installation_capabilities.py` across the four installations. The Chromium walk of every
shell route per installation (the NVR_LESS_MODE method) was **not run**: Playwright is not run on the workstation and the
shell is P2 work; it belongs to the P2 evidence.

| Feature | Finding |
|---|---|
| Alarm (CR-010), automations, notifications (CR-018), multimedia, schedules | No direct NVR / go2rtc call; they use stored events, thumbnails and HA. Unaffected by the capability set. |
| Device camera card (`camera_cards.py`, `routers/device_cameras.py`) | HA live gated by `go2rtc_url`; stills via HA. Correct in all four installations. |
| HA camera streams (`ha_camera_streams.py`) | 409 `media_not_configured` without go2rtc (already a clean 4xx); writes only `smplwise_ha_*`. |
| Media / playback routes | Four routes answered 503 without go2rtc; now 409 `capability_unavailable` (section 3.1). |
| Intercom station snapshot (`routers/access_control.py`) | Answers 503 `media_not_configured` when WisKey credentials exist but go2rtc does not (asserted by `tests/test_intercom.py`). A configuration gap, not a capability gate; left unchanged in P1 (follow-up, see section 6). |
| Background work | `autosync.run_once` already skips the go2rtc stream sync without go2rtc (`streams_last_error = media_not_configured`, excluded from the wizard and, since NN1, superseded in the summary by the "not supported" item). |

## 6. Not built / later

- P2 leftovers: see section 4a.
- HA events in the event centre (D3: future option only).
- Intercom snapshot 503 → 409 (small follow-up; needs a change to an existing intercom test).
- Multi-recorder (`recorders[]` with more than one entry), recorder credentials and vendor adapters: P4-P6, migrations 0052+.
- Runtime re-resolution without restart (D4 keeps restart).
- D5 needs no backend change in P1: nothing deletes or rewrites camera rows when the NVR host disappears, and the NVR routes
  answer 409. Making leftover rows invisible is done in P2 (map layer / camera lists hidden without `nvr`); a server-side
  filter of `GET /cameras` was deliberately not added (it would change a local read that backup / restore and the
  shell rely on) and is a P4 data-hygiene question.

## 7. Tests

`smplwise_vms/backend/tests/test_installation_capabilities.py` (the plan called it `test_capabilities.py`; that name already
holds the T045 per-camera capability tests, so the new file has its own name): the pure derivation for 4 installations x HA (none / configured but down /
connected); `/me`, `/health`, `/health/report`, `/health/summary`, `/setup/state` per installation; capabilities stable when
devices go down; recorder detail by permission; "never ready" guard; a table-driven route sweep per installation (2xx / 4xx /
409, never 5xx, gated answers under 2 s); 401 and audited 403 before 409 on every capability-gated route.
`tests/test_nvr_less.py` is unchanged and green.
