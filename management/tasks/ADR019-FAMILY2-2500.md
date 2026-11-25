# ADR019-FAMILY2-2500 — ADR-019 Step 1 family 2: presence and mobile field-error envelope

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
- **R-ADR019-FAMILY2-2500-1 / AT-ADR019-FAMILY2-2500-1:** ADR-019 decision D1 for family 2 (presence 35, mobile 1): field errors carry the canonical details fields / problems; statuses, codes and user messages unchanged; pixel-neutral.

## Deliverables
- Branch pilot/ADR019-FAMILY2-2500, change note docs/changes/ADR019-FAMILY2-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
