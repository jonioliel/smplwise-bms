# CR-TK-SQL-2440 — CR-TK-SQL-2440: Code review 2026-11-13, wave 3A backend. Findings 01:F-14 (store-layer helpers and query builders copied) and 01:F-10 (run-time schema probes and "old database" shims). Plan row: pilot/CR-TK-SQL-2436 in ...

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R-CR-TK-SQL-2440-1 / AT-CR-TK-SQL-2440-1:** Delivered as recorded in docs/changes/CR-TK-SQL-2440.md: Code review 2026-11-13, wave 3A backend. Findings 01:F-14 (store-layer helpers and query builders copied) and 01:F-10 (run-time schema probes and "old database" shims). Plan row: pilot/CR-TK-SQL-2436 in ...

## Deliverables
- Change note docs/changes/CR-TK-SQL-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
