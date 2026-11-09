# SOAK-DBGROWTH-2412 — Soak findings: event facets from per-day counts, write-lock holds off notify.faults and /health

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

**Owner role:** backend | **Hardware:** False

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
- **R-SOAK-DBGROWTH-2412-1 / AT-SOAK-DBGROWTH-2412-1:** From the 17.7 h soak of 2.40.7: GET /events/facets reads per-day counts (migration 0210 events_facet_days, kept by triggers) with the same numbers; the notify.faults camera tick walks the open-alert index; GET /health runs on a read connection; no write-lock hold grows with the events table; regression tests cover each.

## Deliverables
- Fix, migration 0210 and regression tests on fix/SOAK-DBGROWTH-2412
- Change record docs/changes/SOAK-DBGROWTH-2412.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
