# NOTICE-BOARD-106 — Building notice board with TV screens (CR-NOTICE106) and the 2.18.0 overhaul

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
- **R-NOTICE-BOARD-106-1 / AT-NOTICE-BOARD-106-1:** A building notice board with notices, audiences, push and TV boards exists (module off by default); the 2.18.0 overhaul adds the notices page parity with the approved mock-up, writing notices from the settings, status chips, promo / info slides and building photo, screen saver and logo layouts, a permanent TV link and push on publish.

## Deliverables
- docs/changes/CR-NOTICE106.md and the NOTICE*-295 change records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
