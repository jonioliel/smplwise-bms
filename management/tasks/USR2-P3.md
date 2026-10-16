# USR2-P3 — USR2 phase P3: the service identity - Arx-only users act in Home Assistant through ONE non-administrator HA user under a per-feature allow-list enforced by the add-on and the bridge (0.9.0); behind security.local_identity (off)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "deep",
  "effort": "high",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. A security review of the bridge's service-identity screen before the bridge 0.9.0 ships. No live HA contact."
}
```

## Acceptance
- **R-USR2-3 / AT-USR2-3:** A local principal's Home Assistant action carries the configured service identity (32-hex, never an HA or Arx administrator) plus on_behalf_of {kind: local, user_id: the session's principal, feature}; both sides refuse every feature / service / item outside the allow-list (devices.control, alarm arm/disarm under the PIN rules, media, cast, schedules); automations writes and runs are refused (automation_write_requires_ha_identity); doors, the area write and the stream source stay refused; the bridge refuses a non-service user_id with on_behalf_of, the service id acting as itself, an l_ id as user_id and an administrator service user; activity rows name the person; the settings card explains in Hebrew what is missing; with the switch off nothing changes for anyone.
- **R-USR2-4 / AT-USR2-4:** Against the owner's Home Assistant: an HA administrator creates the non-admin service user, sets its id in the bridge options flow (bridge 0.9.0) and in Arx; a local user switches a light, arms / disarms under the PIN rules, casts, plays media and edits a schedule; the activity log shows the person; HA's own logbook shows the service user.

## Deliverables
- custom_components/smplwise_bridge/service_identity.py (+ mirror), bridge 0.9.0 (const / manifest / card / options flow / strings), services/service_identity.py, routers/service_identity.py, the allow-listed path in routers/ha.py, routers/alarm.py, services/device_bulk.py, media_commands.py, media_query.py, cast_sessions.py, schedule_ops.py / schedules.py, the automations refusal, device_activity attribution, frontend screens/system-service-identity.ts on pilot/USR2-P3 (builds on USR2-P1, still in REVIEW)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
