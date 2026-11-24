# LAB-V4-FRIGATE-2490 — Frigate live test parts a and b (V4)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** BLOCKED

**Owner role:** engineering | **Hardware:** True

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
- **R-LAB-V4-FRIGATE-2490-1 / AT-LAB-V4-FRIGATE-2490-1:** Frigate live test parts a and b (V4): part a (read-only cameras, events and recordings through the system) and part b (move a motorised camera to a saved position and back, special lab build) are NOT run.

## Deliverables
- Owner-run lab step with a redacted result recorded in docs/changes/

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Owner 22.11 (Q39, Q40): not now. Part b also needs a motorised camera and a special lab build with PTZ on.
