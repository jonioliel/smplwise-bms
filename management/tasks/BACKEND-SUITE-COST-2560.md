# BACKEND-SUITE-COST-2560 — Backend suite cost: route-analysis cache (tests only), faster DB copy, read-time WisKey timeout

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
- **R-BACKEND-SUITE-COST-2560-1 / AT-BACKEND-SUITE-COST-2560-1:** Backend suite cost: route-analysis cache (tests only), faster DB copy, read-time WisKey timeout; merged into the 2.56.0 train, change note docs/changes/BACKEND-SUITE-COST-2560.md.

## Deliverables
- Branch pilot/BACKEND-SUITE-COST-2560, change note docs/changes/BACKEND-SUITE-COST-2560.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
