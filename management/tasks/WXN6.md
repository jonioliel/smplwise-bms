# WXN6 — WisKey native screens S6-S10: stations and doors, people, events, schedules, status and groups

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** frontend | **Hardware:** False

**Dependencies:** WXN34, WXN5

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "large",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval.",
  "estimate_hours": 29
}
```

## Acceptance
- **R300 / AT316:** WisKey native screens S6-S10: stations and doors, people, events, schedules, status and groups: built and verified on fakes and fixtures; no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
