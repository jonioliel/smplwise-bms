# ADR019-L14-OBSERVE-2500 — ADR-019 L14 step 1: observing base model and SW_REQUEST_STRICT=1 in the backend test settings

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-ADR019-L14-OBSERVE-2500-1 / AT-ADR019-L14-OBSERVE-2500-1:** ADR-019 L14 step 1: the observing request-body base model (records unknown keys) and SW_REQUEST_STRICT=1 in the backend test settings, so the tolerant web-UI models can adopt it family by family; no model flips to forbid in this row.

## Deliverables
- Branch pilot/ADR019-L14-OBSERVE-2500, change note docs/changes/ADR019-L14-OBSERVE-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
