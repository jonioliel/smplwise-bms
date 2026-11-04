# WALL-ANSWERS-2400 — Wall displays: owner answers 18-20 (open-foldable setting, portrait health chip once, kiosk header on a phone)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-WALL-ANSWERS-2400-1 / AT-WALL-ANSWERS-2400-1:** An open foldable behaves as a wall tablet or as a phone by an installation setting; the portrait wall shows the health chip once; the kiosk header on a phone keeps its height; the desktop wall flag has its own column (migration 0204).

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
