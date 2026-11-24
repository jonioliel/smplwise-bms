# LAB-V0-ROLE-2490 — Lab test account gets the lab system-admin role (owner action)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BLOCKED

**Owner role:** owner | **Hardware:** True

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
- **R-LAB-V0-ROLE-2490-1 / AT-LAB-V0-ROLE-2490-1:** Lab test account gets the lab system-admin role (owner action): the owner gives the lab test account the system-admin role on the lab only, so lab checks 3, 5, 6 and 7 do not need file downloads.

## Deliverables
- Owner-run lab step with a redacted result recorded in docs/changes/

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Owner action on the lab installation: assign the lab system-admin role to the lab test account (Arx agents do not change HA users or roles).
