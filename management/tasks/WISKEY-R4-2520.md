# WISKEY-R4-2520 — sync/station_v1 with a request id (row R4, master id B7)

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
- **R-WISKEY-R4-2520-1 / AT-WISKEY-R4-2520-1:** Arx sends sync/station_v1 with a request id and holds the result on UNKNOWN until a status read settles it (owner 25.11 Q4).

## Deliverables
- Branch pilot/WISKEY-R4-2520, change note docs/changes/WISKEY-R4-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
