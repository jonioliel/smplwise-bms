# DB-CONN-POOL-2343 — Reuse SQLite connections between requests

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-DB-CONN-POOL-2343-1 / AT-DB-CONN-POOL-2343-1:** Database connections are reused between requests (settings read 2.6x faster); the add-on option db_conn_pool turns it off.

## Deliverables
- Change record docs/changes/DB-CONN-POOL-2343.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
