# PRE-GATE-2360 — Runner checks before the 2.36.0 release gate

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
- **R-PRE-GATE-2360-1 / AT-PRE-GATE-2360-1:** The 2.36.0 train is checked on the runner before its gate (drawer above the phone bar, GDrive diagnose and drawer specs).

## Deliverables
- Change record docs/changes/PRE-GATE-2360.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
