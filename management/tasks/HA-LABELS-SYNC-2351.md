# HA-LABELS-SYNC-2351 — Home-system labels synced into Arx (read-only) for the mapping assistant

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-HA-LABELS-SYNC-2351-1 / AT-HA-LABELS-SYNC-2351-1:** Area labels are read from the home system (nothing is written back) and used by the mapping assistant label rules and questions; the status card says how many areas carry a label and where a label points to another building (migration 0192).

## Deliverables
- Change record docs/changes/HA-LABELS-SYNC-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
