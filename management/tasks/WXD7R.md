# WXD7R — WisKey CR-033: Owner-approved inventory read on the installation

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BACKLOG

**Owner role:** backend | **Hardware:** False

**Dependencies:** WXD7

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "model": "sonnet",
  "estimate_hours": 0.5,
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R242 / AT258:** Owner-approved inventory read on the installation (CR-033, plan slice WXD7R), built and tested on fakes and fixtures only; entry gate: owner approval (read of the Arx database only). Nothing here authorises a live door test, key action or release without a separate owner approval.

## Deliverables
- Implementation and tests on fakes in an isolated branch (pilot/WXD-... or pilot/WXH-... per wave)
- Change request: docs/changes/WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md and CR-033 / CR-034 (branch pilot/WISKEY-CRs)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
