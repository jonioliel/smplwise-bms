# MULTI-BUILDING-FILTER-2520 — Multi-building filter follow-up: the filter setting names the home interface lists; phone building control row

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
- **R-MULTI-BUILDING-FILTER-2520-1 / AT-MULTI-BUILDING-FILTER-2520-1:** The building filter setting row names the home interface lists too, and on a phone the building control takes its own row under the tabs; before / after evidence captured.

## Deliverables
- Branch pilot/MULTI-BUILDING-FILTER-2520, change note docs/changes/MULTI-BUILDING-FILTER-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
