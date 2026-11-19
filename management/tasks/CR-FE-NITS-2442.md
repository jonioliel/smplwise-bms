# CR-FE-NITS-2442 — CR-FE-NITS-2442: Code-review batch 16.11, wave 3B, frontend chain step FE-4. Contract: the FE-4 row of private/code-review-2026-11-13/MASTER_PLAN.md section 3.5 (named there pilot/CR-FE-NITS-2436), findings 06:NOOP-1, 06:STORE-1, 06:RTL-1, ...

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
- **R-CR-FE-NITS-2442-1 / AT-CR-FE-NITS-2442-1:** Delivered as recorded in docs/changes/CR-FE-NITS-2442.md: Code-review batch 16.11, wave 3B, frontend chain step FE-4. Contract: the FE-4 row of private/code-review-2026-11-13/MASTER_PLAN.md section 3.5 (named there pilot/CR-FE-NITS-2436), findings 06:NOOP-1, 06:STORE-1, 06:RTL-1, ...

## Deliverables
- Change note docs/changes/CR-FE-NITS-2442.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
