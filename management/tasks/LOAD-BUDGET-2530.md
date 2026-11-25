# LOAD-BUDGET-2530 — A written resource budget 2.53 and an automated load run that fails above it (T068)

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
- **R-LOAD-BUDGET-2530-1 / AT-LOAD-BUDGET-2530-1:** docs/operations/RESOURCE_BUDGET.md carries the 2.53 budget; tests/soak/load_budget.py judges a run against load_budget.json (exit 0 within, 1 over, 2 incomplete) and the 14 h soak runbook exists.

## Deliverables
- Branch pilot/LOAD-BUDGET-2530, change note docs/changes/LOAD-BUDGET-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
