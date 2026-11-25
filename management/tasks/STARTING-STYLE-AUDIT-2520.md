# STARTING-STYLE-AUDIT-2520 — Every @starting-style entrance audited for the two sw-dialog faults

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
- **R-STARTING-STYLE-AUDIT-2520-1 / AT-STARTING-STYLE-AUDIT-2520-1:** Every @starting-style entrance applies (placed after the rule it starts from) and never fades a layer that holds text; the unit-starting-style-audit-2520 checker keeps it so.

## Deliverables
- Branch pilot/STARTING-STYLE-AUDIT-2520, change note docs/changes/STARTING-STYLE-AUDIT-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
