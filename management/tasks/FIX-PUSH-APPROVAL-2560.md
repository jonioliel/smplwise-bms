# FIX-PUSH-APPROVAL-2560 — Final review fixes SA-01, SA-02, FE-06: push approval, off-box backup local-only, step-up sheet

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
- **R-FIX-PUSH-APPROVAL-2560-1 / AT-FIX-PUSH-APPROVAL-2560-1:** Final review fixes SA-01, SA-02, FE-06: push approval, off-box backup local-only, step-up sheet; merged into the 2.56.0 train, change note docs/changes/FIX-PUSH-APPROVAL-2560.md.

## Deliverables
- Branch pilot/FIX-PUSH-APPROVAL-2560, change note docs/changes/FIX-PUSH-APPROVAL-2560.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
