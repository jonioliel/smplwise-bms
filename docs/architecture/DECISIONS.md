# Initial decisions and open proofs

| ID | Decision | Status / evidence gate |
|---|---|---|
| ADR-001 | Add-on app, external go2rtc, thin HA bridge | Product direction; exact process/library versions after T008 |
| ADR-002 | Reuse-first legacy migration | Binding; implementation choice per module after T001–T006 |
| ADR-003 | Immutable source plans + normalized geometry + versioned placements | Binding; contracts are initial design |
| ADR-004 | Internal UTC instants, per-source time adapters, IANA display timezone | Binding; source semantics proven in lab |
| ADR-005 | No source credentials/control in browser; authorized WebRTC data path permitted | Binding; principal/media policy in T011 |
| ADR-006 | Playback strategy selected by evidence | OPEN: RTSP session / bounded clip / remux; no transparent hot-swap assumption. Lab 2026-09-14: go2rtc API persists streams; NVR download by file only; direction in ADR-013 |
| ADR-007 | Plan AI proposes geometry; deterministic renderer owns style | Binding; human publish gate |
| ADR-008 | Initial single-node durable store and bounded job queues | Proposed; avoid unnecessary distributed architecture |
| ADR-009 | Four main modes, shared UI, original design assets preserved | Binding; no separate card UI fork |
| ADR-010 | Codex aliases resolved locally; dispatcher optional | Binding; resolved in MODEL_POLICY.json (Claude Code session) |
| ADR-011 | Browser media path: add-on relays go2rtc signalling, per-camera authorization, WebRTC/MSE | Approved 2026-09-14; evidence gate T015/T017 ([ADR-011](ADR-011-browser-media-path.md)) |
| ADR-012 | Identity via Supervisor Ingress headers + thin bridge integration | Approved 2026-09-14; evidence gate T081/T083 ([ADR-012](ADR-012-identity-via-ingress-and-bridge.md)) |
| ADR-013 | Playback: go2rtc session pool from NVR RTSP playback, export by file | Approved direction; ADR-006 closes after T006 ([ADR-013](ADR-013-playback-engine-and-go2rtc-pool.md)) |
| ADR-014 | Monorepo = add-on repository; local Supervisor build first, GHCR images before pilot | Approved 2026-09-14 ([ADR-014](ADR-014-repository-and-deployment.md)) |
| ADR-015 | Pilot contract lock: boundaries confirmed, generated API inventory as the contract of record, error model, identifier and time rules, schema 0001–0006, bridge protocol | Proposed 2026-09-16 for owner sign-off (T008) ([ADR-015](ADR-015-pilot-contract-lock.md)) |
| ADR-009 note | Sidebar shows the boards' six flat entries (Overview · Sites · Cameras · Events · Playback · Settings); routes and permissions keep the four modes | Recorded deviation 2026-09-14 after the owner rejected v1/v2 for not matching the boards; the design assets win visually, the mode model stays. Owner sign-off pending with the v3 review board (T007) |
| Owner decision 2026-09-22 | T003 (golden traces from the legacy add-on) and T004 (characterization diff legacy vs. new) are excluded from G0: "the new part has already proved itself; this stage is not needed". Six test rounds on the owner's installation replace the legacy comparison; `docs/legacy/KNOWN_QUIRKS.md`, the migration dry run and the rollout / rollback runbook (T070) stand. Time-mapping mismatches, if any surface, are bugs against the NVR wall clock (chapter 20), never a fixed hour shift. | Recorded 2026-09-22; cards BLOCKED with the decision as blocker; V1 release package known limit 8 |
| ADR-016 (CR-003) | Plan Studio: a versioned geometry layer (walls, openings, objects, circuits, levels, connectors) on the existing plan versions, rendered inside the existing map canvas on every map surface (live floor map, editor, history map, event page, the Lovelace card); live things stay map anchors and library objects are their physical bodies; local detection before any AI; three.js 3D as an on-demand chunk inside the map screen; DWG through a converter process and IFC through an own writer (IfcOpenShell for import) as phases 7-8 | Owner-approved 2026-09-23; design docs/architecture/PLAN_STUDIO_DESIGN_HE.md; docs/changes/CR-003-PLAN-STUDIO.md; tasks T084-T090, T065 |

Each implementation ADR must include context, alternatives, chosen behavior, impact on API/schema/permissions/UX, test evidence and rollback. No open assumption becomes supported solely because it appears in this table.

## ADR amendment: HA identity / independent VMS authorization (v1.1)
HA is the sole human identity provider. VMS stores role/group/scope bindings and defaults to deny. No admin/group writes back to HA. Installation is an HA Add-on plus a separately installed thin bridge. The bridge's identity and user-context operation support ships in Pilot, while extended cards remain Beta. Scoped ordinary HA users are supported without changing HA privileges. See CR-001 and security specification.
