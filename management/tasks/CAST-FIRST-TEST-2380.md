# CAST-FIRST-TEST-2380 — Display D4: first physical cast test and phase-2 decision memo

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BLOCKED

**Owner role:** engineering | **Hardware:** True

**Dependencies:** T104, POLISH4-WP5-MEDIA-2370

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
- **R-CAST-FIRST-TEST-2380-1 / AT-CAST-FIRST-TEST-2380-1:** The cast runbook is updated and one camera is cast to one lab TV in a joint test, phase-1 findings are fixed and a memo decides phase 2 (wall mosaic / carousel).

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
A device action needs the owner's explicit approval (question Q9: approve one camera to one lab TV in a joint session, or later).
