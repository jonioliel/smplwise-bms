# Changelog

## 2.8.0 (unreleased) - technician privacy notice n2
- Privacy notice for external technicians, version n2 (he/en/ar/ru; the vendor attests he told the technician); Arabic and Russian notice and code message - ar/ru technicians no longer receive the English message. A stale page posting `notice_version` n1 is refused (422 `notice_ack`) and must re-read the view. The audit of the notice carries `acknowledged_for`.
- Feature stays OFF (`GO_LIVE_PERMITTED` False). Owner sign-off of the wording is required before go-live.
- English/Hebrew: no migration; no frontend change.

## 0.1.0-dev.1 — 2026-09-14 (first application segment)
- Add-on skeleton (`repository.yaml`, `smplwise_vms/`): Ingress-only FastAPI backend, SQLite in /data with
  versioned migrations, identity from Supervisor headers with a trusted-proxy check, explicit bootstrap of
  the first VMS administrator, scoped roles/bindings with default deny and audited denials.
- Catalogue API and UI: sites → buildings → floors (create, rename, delete with conflict handling).
- Plan import: PDF/PNG/JPG with content sniffing, page previews, rotation/crop, draft → published
  versions; originals immutable; the owner's real plans rendered locally.
- Map editor: draggable pins with normalized coordinates, numeric properties, add/remove cameras,
  undo/redo, optimistic revisions; viewer map with raster backgrounds and floating camera cards.
- Read-only NVR camera discovery (channels, online state, track ids, stream evidence).
- 17 backend tests, 129 fixture UI checks and a live-backend evidence run; UI restyled to the boards (v3).
- Not yet: live video, playback/timeline, events, HA bridge, groups UI, Supervisor build verified on HA.

## 1.1.0-planning — 2026-09-14
- Mandatory HA Add-on confirmed and separated from HA integration/cards distribution.
- HA-authenticated users, VMS groups/scoped roles, admin separation, revocation and HA permission intersection specified.
- Added T076–T083, R151–R166 and AT151–AT166; updated dependencies and pilot release gates.
- Added copy-ready Codex prompt, identity contracts and detailed security requirements.
- Retained original visual assets and archived unchanged v1.0 PDF/DOCX print edition; consolidated v1.1 master is Markdown.
- No live application or hardware tests performed.

# Changelog

## 1.0.0-planning — 2026-09-14
- 39 Hebrew specification chapters, 32 screen definitions and original three concept boards.
- 75 staged tasks linked to 150 requirements and 150 planned acceptance tests.
- Five archived legacy specifications, clearly separated from the missing actual source audit.
- Initial contract schemas/examples, design source manifest, bootstrap/prompt policies and project management tools.
- No VMS application implementation, live hardware validation, automatic Codex controller or production deployment included.
