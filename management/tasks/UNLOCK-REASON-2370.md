# UNLOCK-REASON-2370 — Say why a lock cannot be opened: one unlock_reason rule behind can_unlock

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-UNLOCK-REASON-2370-1 / AT-UNLOCK-REASON-2370-1:** can_unlock is unlock_reason == ok, one function in door_authority behind GET /devices/items?kind=locks and GET /ha/entities/{id}, with the reasons ok, no_permission, door_not_mapped, alarm_managed, not_placed, wall_profile and no_control (codes only); the locks panel, map card, door grants tab and effective permissions word the reason; unmapped doors are summarised and a read-only door-map item joins the readiness check.

## Deliverables
- Change record docs/changes/UNLOCK-REASON-2370.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
