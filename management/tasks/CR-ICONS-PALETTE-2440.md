# CR-ICONS-PALETTE-2440 — CR-ICONS-PALETTE-2440: Code-review batch 16.11, frontend wave 2. Contract: the pilot/CR-ICONS-PALETTE-2436 row of private/code-review-2026-11-13/MASTER_PLAN.md (D15 = 08:F08 + 07:F22, and 08:F12 step 1). Base: origin/release/2437-train (2.43.7 train).

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
- **R-CR-ICONS-PALETTE-2440-1 / AT-CR-ICONS-PALETTE-2440-1:** Delivered as recorded in docs/changes/CR-ICONS-PALETTE-2440.md: Code-review batch 16.11, frontend wave 2. Contract: the pilot/CR-ICONS-PALETTE-2436 row of private/code-review-2026-11-13/MASTER_PLAN.md (D15 = 08:F08 + 07:F22, and 08:F12 step 1). Base: origin/release/2437-train (2.43.7 train).

## Deliverables
- Change note docs/changes/CR-ICONS-PALETTE-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
