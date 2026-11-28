# FIX-CALENDAR-2570 — Second deep review calendar fixes CU2-01..CU2-03, CU2-12, CU2-13, CU2-30, SA2-06: windowed full re-sync, series identity, own-connection bindings, sync lease, settings merge and revision

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
- **R-FIX-CALENDAR-2570-1 / AT-FIX-CALENDAR-2570-1:** Second deep review calendar fixes CU2-01..CU2-03, CU2-12, CU2-13, CU2-30, SA2-06: windowed full re-sync, series identity, own-connection bindings, sync lease, settings merge and revision; merged into the 2.57.0 train, change note docs/changes/FIX-CALENDAR-2570.md.

## Deliverables
- Branch pilot/FIX-CALENDAR-2570, change note docs/changes/FIX-CALENDAR-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
