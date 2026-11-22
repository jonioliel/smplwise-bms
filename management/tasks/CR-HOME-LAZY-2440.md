# CR-HOME-LAZY-2440 — CR-HOME-LAZY-2440 - the home screen's on-demand parts out of the entry chunk (review 06:BUNDLE-1 home side, 07:F4 d)

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
- **R-CR-HOME-LAZY-2440-1 / AT-CR-HOME-LAZY-2440-1:** Delivered as recorded in docs/changes/CR-HOME-LAZY-2440.md: the home screen's on-demand parts out of the entry chunk (review 06:BUNDLE-1 home side, 07:F4 d)

## Deliverables
- Change note docs/changes/CR-HOME-LAZY-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
