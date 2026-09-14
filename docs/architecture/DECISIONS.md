# Initial decisions and open proofs

| ID | Decision | Status / evidence gate |
|---|---|---|
| ADR-001 | Add-on app, external go2rtc, thin HA bridge | Product direction; exact process/library versions after T008 |
| ADR-002 | Reuse-first legacy migration | Binding; implementation choice per module after T001–T006 |
| ADR-003 | Immutable source plans + normalized geometry + versioned placements | Binding; contracts are initial design |
| ADR-004 | Internal UTC instants, per-source time adapters, IANA display timezone | Binding; source semantics proven in lab |
| ADR-005 | No source credentials/control in browser; authorized WebRTC data path permitted | Binding; principal/media policy in T011 |
| ADR-006 | Playback strategy selected by evidence | OPEN: RTSP session / bounded clip / remux; no transparent hot-swap assumption |
| ADR-007 | Plan AI proposes geometry; deterministic renderer owns style | Binding; human publish gate |
| ADR-008 | Initial single-node durable store and bounded job queues | Proposed; avoid unnecessary distributed architecture |
| ADR-009 | Four main modes, shared UI, original design assets preserved | Binding; no separate card UI fork |
| ADR-010 | Codex aliases resolved locally; dispatcher optional | Binding; not an installed controller |

Each implementation ADR must include context, alternatives, chosen behavior, impact on API/schema/permissions/UX, test evidence and rollback. No open assumption becomes supported solely because it appears in this table.

## ADR amendment: HA identity / independent VMS authorization (v1.1)
HA is the sole human identity provider. VMS stores role/group/scope bindings and defaults to deny. No admin/group writes back to HA. Installation is an HA Add-on plus a separately installed thin bridge. The bridge's identity and user-context operation support ships in Pilot, while extended cards remain Beta. Scoped ordinary HA users are supported without changing HA privileges. See CR-001 and security specification.
