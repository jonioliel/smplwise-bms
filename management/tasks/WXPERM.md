# WXPERM — access.doors.open: a door-only permission for any role; access.release kept as its legacy name

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** backend | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R308 / AT324:** access.doors.open: a door-only permission for any role; access.release kept as its legacy name: built on fakes / mocked backends and fixtures (pilot/WXPERM @ ca5514f6); no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/WXPERM)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
