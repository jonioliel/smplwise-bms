# MEDIA-POLISH-2331 — Media and doors polish (wave 3)

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
- **R-MEDIA-POLISH-2331-1 / AT-MEDIA-POLISH-2331-1:** The players page fits the window with only its cards scrolling, the casting table lines up, door cards name each switch and the remote editor keeps save / cancel on screen.

## Deliverables
- Change record docs/changes/MEDIA-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
