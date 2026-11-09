# HOME-DEVICES-LOAD-2342 — Faster home and devices screens: lazy screens, settings in two queries, shared requests

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
- **R-HOME-DEVICES-LOAD-2342-1 / AT-HOME-DEVICES-LOAD-2342-1:** Each screen loads on demand (home and devices open 33-44% faster), settings are read in 2 queries instead of hundreds and identical requests are shared.

## Deliverables
- Change record docs/changes/PERF-HOME-DEVICES-2342.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
