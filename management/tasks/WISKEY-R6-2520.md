# WISKEY-R6-2520 — B8 visits/record_external_v1 on WisKey rc.19 external-visits-v1 (row R6)

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
- **R-WISKEY-R6-2520-1 / AT-WISKEY-R6-2520-1:** Arx's external-visit consumer follows WisKey rc.19's external-visits-v1 contract, the ended visit status labelled end to end.

## Deliverables
- Branch pilot/WISKEY-R6-2520, change note docs/changes/WISKEY-R6-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
