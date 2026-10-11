# WXD5A — WisKey CR-033: Bridge 0.8.1 execute block for WisKey doors (admin setting)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BACKLOG

**Owner role:** backend | **Hardware:** False

**Dependencies:** WXD4

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "deep",
  "review": "deep",
  "effort": "medium",
  "model": "opus",
  "estimate_hours": 4,
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R238 / AT254:** Bridge 0.8.1 execute block for WisKey doors (admin setting) (CR-033, plan slice WXD5A), built and tested on fakes and fixtures only; entry gate: release order: WXD4 must be released first. Nothing here authorises a live door test, key action or release without a separate owner approval.

## Deliverables
- Implementation and tests on fakes in an isolated branch (pilot/WXD-... or pilot/WXH-... per wave)
- Change request: docs/changes/WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md and CR-033 / CR-034 (branch pilot/WISKEY-CRs)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
