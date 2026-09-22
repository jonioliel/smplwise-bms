# ADR-015 — Pilot contract lock (boundaries, API, identifiers, schema, errors)

Status: proposed 2026-09-16 for owner sign-off (closes the T008 gate) · Applies from add-on 0.1.21.

## Context

The planning kit asked to lock the system boundaries and the API contracts before parallel work
(T008). Since then the product has been built as one add-on with a thin bridge integration, and the
contracts were shaped by working code rather than by the design-time OpenAPI subset in `contracts/`. This
ADR records what is now locked, how changes are made, and what stays open.

## Decision

### Boundaries (confirmed)

| Component | Owns | Never does |
|---|---|---|
| **SMPLWISE VMS add-on** (FastAPI + Lit UI, Ingress only) | the SQLite database under `/data`, plan files, event pictures, exports, backups; every authorization decision; the media relay to go2rtc; NVR reads | write to the NVR configuration, create HA users or change HA permissions, touch go2rtc streams outside the `smplwise_` prefix |
| **Bridge integration** `smplwise_bridge` (shipped inside the add-on image, copied into `custom_components`) | running allow-listed HA services in the calling user's identity, pushing the HA user directory to the add-on | store VMS data, decide permissions |
| **go2rtc** (external add-on) | RTSP → WebRTC / MSE for live and playback | authentication of browsers (the add-on relays and authorizes) |
| **Hikvision NVR** | recordings, alerts, device time | — (read-only from our side) |

Reuse from the legacy add-on stays limited to the behaviours in `docs/legacy/REUSE_MATRIX.md`; no legacy
code is linked or copied (see the secrets and licence audit).

### API

- Base path `/api/v1`; JSON; identity from the Supervisor Ingress headers behind a trusted-proxy check;
  developer identity only with `SW_DEV_USER` outside Home Assistant.
- The route table is generated into [`contracts/API_INVENTORY.md`](../../contracts/API_INVENTORY.md)
  by `scripts/api_inventory.py` (105 HTTP routes at 0.1.21; 186 at 0.1.81, every addition additive under the rule below, plus the websocket routes `/media/live/{camera_id}/ws`,
  `/playback/sessions/{session_id}/ws`, `/events/ws`, `/ha/ws`). The generated file is the contract of record; the design-time
  `contracts/openapi.core-design.json` stays as history.
- Compatibility rule for the pilot: additive changes (new routes, new optional fields) are allowed in any
  version; a removed or renamed route or field, or a changed meaning, requires a new ADR entry and a
  changelog line, and the UI shipped in the same image is the only supported client.
- Errors: `ApiError` → `{code, user_message (Hebrew), details, retryable, correlation_id}`; HTTP status
  carries the class (401/403 identity and scope, 404 not found, 409 conflict incl. `stale_revision` with the
  current revision, 422 validation, 503 dependency unavailable). Refused actions are audited with the
  same correlation id.
- Optimistic concurrency: `revision` on anchors, zones, plan versions and settings; a stale revision is
  refused with 409, never merged silently.

### Identifiers and time

- Ids are 16-hex strings from `db.new_id()`; stable across backup and restore; camera ids stay bound to
  the recorder channel through the registry. HA user ids are those of Home Assistant.
- Instants are UTC ISO-8601 with `Z` in every API payload; the display time zone is the product
  setting `time.zone`; device times are converted by the per-source adapters (ADR-004).
- Plan coordinates are normalized (0–1, origin top-left) on the immutable source page after rotation
  and crop; bearings are 0° up, clockwise (design contract §ו).

### Schema

- Migrations `0001_init` … `0006_zones` are the locked pilot schema; by 0.1.81 the chain runs to `0017_labels_ha_notify`
  (0007–0017 added tables and nullable columns only - cases, bundles, signing keys, NVR changes, plan versions, catalog
  images, anchor coverage, HA notify labels - so a backend of any 0.1.x still opens a newer database, which the
  rollback runbook in `docs/release/RELEASE_PACKAGE_V1.md` §5 relies on). New tables and columns arrive as
  new numbered migrations; existing columns are never repurposed. A backup written before an upgrade
  (`auto-pre-upgrade-*`) is the rollback path (ADR-014, T036); backups from a newer schema are refused.
- Permission revision (`settings.permission_revision`) bumps on every binding change and on an access
  restore; relays re-check it.

### Bridge protocol

- Add-on ↔ integration messages are HMAC-SHA256 signed (`ts.nonce.signature` over canonical JSON) with a
  60-second window and a nonce cache; the shared secret lives in the add-on database and is excluded
  from backups. Directory pushes and action results are the only message kinds; version negotiation is
  by the integration's `version` field.

## Alternatives considered

- Locking the design-time OpenAPI subset as-is: rejected, it predates the identity, media and events
  decisions and would have forced a rewrite of working, tested endpoints.
- A separate integration repository for the bridge: rejected in ADR-014 (single repository, shipped in
  the image, installed by the add-on).

## Consequences

- Parallel work (other agents or contributors) can rely on the inventory, the error model and the
  identifier rules without reading the routers.
- Every endpoint change must regenerate the inventory (`python scripts/api_inventory.py`) in the same
  commit; the test `tests/test_version.py` already guards version drift, an inventory drift check can be
  added the same way.

## Open

- Event windows, cases and rules are pilot-shape only (see T047 / T049 / T052); their payloads may still
  change before Beta and are marked so in the changelog when they do.
- Multi-recorder identifiers (T058) will add a recorder prefix to camera ids; the change will be a
  migration with a compatibility view.
