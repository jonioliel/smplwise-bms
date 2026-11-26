# LAB-2540-RUNBOOKS — Lab acceptance plan for 2.54, bridge-key rotation unblock plan, WisKey rc.20 lab install runbook

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
- **R-LAB-2540-RUNBOOKS-1 / AT-LAB-2540-RUNBOOKS-1:** docs/operations holds the 2.54 lab acceptance plan, the bridge rotation unblock plan and the WisKey rc.20 lab install runbook (Hebrew, plans only, nothing run).

## Deliverables
- Branch chore/LAB-2540-RUNBOOKS, change note docs/changes/LAB-2540-RUNBOOKS.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
