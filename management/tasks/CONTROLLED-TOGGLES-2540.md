# CONTROLLED-TOGGLES-2540 — Every switch that saves at once is a controlled sw-toggle

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
- **R-CONTROLLED-TOGGLES-2540-1 / AT-CONTROLLED-TOGGLES-2540-1:** A refused save of a save-at-once switch (schedules, tickets settings, module settings, system settings, security and integration cards) leaves the switch where it was; an accepted save moves it.

## Deliverables
- Branch pilot/CONTROLLED-TOGGLES-2540, change note docs/changes/CONTROLLED-TOGGLES-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
