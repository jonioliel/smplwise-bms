# NOTICE-TV-LASTSEEN-2530 — The TV board feed no longer writes "last seen" inside the request

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
- **R-NOTICE-TV-LASTSEEN-2530-1 / AT-NOTICE-TV-LASTSEEN-2530-1:** GET /notices/display/<slug> never begins a write transaction; last_seen_at is written by one background pass a minute for all boards and at shutdown, never backwards.

## Deliverables
- Branch pilot/NOTICE-TV-LASTSEEN-2530, change note docs/changes/NOTICE-TV-LASTSEEN-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
