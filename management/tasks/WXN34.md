# WXN34 — WisKey native screens S3+S4: new permissions, station and field filtering, adapter and read channel

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** WXN01, WXD2, WXD3

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval.",
  "estimate_hours": 15
}
```

## Acceptance
- **R298 / AT314:** WisKey native screens S3+S4: new permissions, station and field filtering, adapter and read channel: built and verified on fakes and fixtures; no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
