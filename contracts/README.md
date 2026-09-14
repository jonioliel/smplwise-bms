# Contract pack — design, not an application server

JSON Schema draft 2020-12 files define initial plan, anchors, session and action envelopes. Examples are synthetic and contain no real plan, camera or credentials. `openapi.core-design.json` is an explicitly limited core subset; remaining resources and concrete upload/response payloads must be finalized at G0. Empty flexible objects do not constitute a validated application implementation.

Schema validation checks shape only. Domain tests must check room polygon topology, uniqueness, source-hash match, geometric transforms, approval provenance, chronological order, supported source behavior and server authorization. AI cannot set `human_approved` as authority; that flag is server-owned. `allowed_action_id` maps to an approved server definition and receives separate argument validation. Client data never grants permission.

Coordinate space is immutable original-source normalized top-left, before viewport transforms. Inverting a source rotation/crop and migrating published anchors must be tested explicitly. `field_of_view_degrees` is illustrative unless calibrated. API datetimes are UTC instants, local display timezone is external context. Missing/estimated media anchors remain explicit.

## v1.1 identity and RBAC
`ha-identity` and `rbac-binding` schemas plus examples define minimal read-only HA identity data and server-owned VMS scoped grants. `access-api.design.json` contains proposed VMS routes, not implemented or existing HA endpoints. `role-catalog.design.json` and `authorization-scenarios.design.json` are expected policy fixtures, not a deployed authorizer or evidence of tests passing. Read docs/security/HA_IDENTITY_RBAC_HE.md.
