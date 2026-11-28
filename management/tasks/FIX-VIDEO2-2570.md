# FIX-VIDEO2-2570 — Second deep review video / devices fixes VD2-02, VD2-04, VD2-06..VD2-11: detect listen outside the lock, recordings across the repeated hour, schedule actions across midnight, smart partial write, saved views keep hidden cameras, per-recorder review marks

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

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
- **R-FIX-VIDEO2-2570-1 / AT-FIX-VIDEO2-2570-1:** Second deep review video / devices fixes VD2-02, VD2-04, VD2-06..VD2-11: detect listen outside the lock, recordings across the repeated hour, schedule actions across midnight, smart partial write, saved views keep hidden cameras, per-recorder review marks; merged into the 2.57.0 train, change note docs/changes/FIX-VIDEO2-2570.md.

## Deliverables
- Branch pilot/FIX-VIDEO2-2570, change note docs/changes/FIX-VIDEO2-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
