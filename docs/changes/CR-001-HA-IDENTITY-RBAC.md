# CR-001 — HA identities, scoped VMS roles, mandatory Add-on
**Status:** User requirement incorporated into planning v1.1; not implemented.
**Request:** Confirm HA Add-on distribution; import HA users; assign users to local permission groups and editor/site-manager roles without granting global administration.
**Decision:** HA authenticates. VMS authorizes VMS resources with scoped roles. HA-backed resource actions additionally require the user's own HA permissions. No HA auth writes, password copies or blanket service-token impersonation.
**Pilot impact:** T076–T081/T083 are P0. Authentication bridge moved to Pilot; full Lovelace wrappers stay Beta. T082 is advanced delegation in V1. Pilot release is blocked until scoped ordinary-user access is tested.
**Unchanged:** legacy-first, external go2rtc, map-first UI, UTC/DST, design references and no production changes without authorization.
**Print edition:** v1.0 PDF/DOCX archived unchanged; v1.1 consolidated Markdown and security supplement are canonical.
