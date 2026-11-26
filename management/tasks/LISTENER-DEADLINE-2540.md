# LISTENER-DEADLINE-2540 — Notice-board and Provision push listeners get the whole-request deadline; the NVR change log offers revert anyway

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
- **R-LISTENER-DEADLINE-2540-1 / AT-LISTENER-DEADLINE-2540-1:** The notice-board and Provision push listeners close a request that does not finish within its deadline; after changed_since the NVR change log offers 'revert anyway' behind a cancel-first confirmation and a forced undo records the document it overwrote.

## Deliverables
- Branch pilot/LISTENER-DEADLINE-2540, change note docs/changes/LISTENER-DEADLINE-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
