# WALL-PHONE-TOOLBAR-2401 — Phone camera wall: one row of icon keys, two rows of full labels as a setting

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** frontend | **Hardware:** False

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
- **R-WALL-PHONE-TOOLBAR-2401-1 / AT-WALL-PHONE-TOOLBAR-2401-1:** On a phone the camera-wall toolbar is one row of icon keys (at most 56 px, touch-sized, no sideways scroll, full name on a long press, as the tooltip and as the accessible name); two rows of full labels are an installation setting; no label is ever truncated.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
