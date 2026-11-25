# WISKEY-VISITS-ENDED-FILTER-2520 — The visit list's ended status filter, offered only when WisKey supports it

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
- **R-WISKEY-VISITS-ENDED-FILTER-2520-1 / AT-WISKEY-VISITS-ENDED-FILTER-2520-1:** The ended filter is offered only when discovery lists visits/record_external_v1; the home push reason / message are nullable on the wire.

## Deliverables
- Branch pilot/WISKEY-VISITS-ENDED-FILTER-2520, change note docs/changes/WISKEY-VISITS-ENDED-FILTER-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
