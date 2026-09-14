# Packaging and identity boundaries — v1.1

Primary product: **Home Assistant Add-on/App**, installed through a Supervisor app/add-on repository. Required: image/config.yaml, Ingress, persistent /data, health checks, logs, versioned migrations, backup/restore and rollback. A dev container is useful but is not an acceptable substitute for the HA Add-on deliverable.

External go2rtc remains an independently installed, explicitly configured and tested service. Do not depend on the internal managed HA go2rtc instance. Ingress HTTP/WS reachability and actual browser media transport are separate tests.

Thin HA integration is a separate artifact. Its authenticated identity directory and user-context action bridge are required in Pilot; richer Lovelace cards can ship later (T056). HACS may distribute integration/cards, not the Supervisor Add-on. A monorepo can hold source for all artifacts; installation and release steps remain explicit.

Normal HA users must be able to enter the VMS through the tested ingress path. Plan `panel_admin: false`, but never use it as access control: it only affects the menu. No standalone unauthenticated API port. Restrict ingress to the trusted Supervisor proxy and validate service-to-service traffic independently.

HA is the source of human identities. Local role/group/scope assignments only affect VMS. No separate password database or automatic HA-admin promotion. The admin-only HA user-list command is accessed only by an authorized backend/bridge; never demand HA-admin privileges from operators.

Read `../security/HA_IDENTITY_RBAC_HE.md` for normative access rules and source references. A non-admin HA user becoming a VMS floor editor is a mandatory release test.
