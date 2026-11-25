# OVERLAY-FADE-2520 — The overlays show their texts at full contrast from the first frame

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
- **R-OVERLAY-FADE-2520-1 / AT-OVERLAY-FADE-2520-1:** Overlay entrances (sheet, user menu, notification centre, calendar pop-over / toast, area quick sheet, keyframe entrances) only move; the unit-overlay-fade-2520 checker keeps every text at full contrast from the first frame.

## Deliverables
- Branch pilot/OVERLAY-FADE-2520, change note docs/changes/OVERLAY-FADE-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
