# SHARED-CHECKBOX-2480 — Shared checkbox component for the checkboxes that remain checkboxes

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
- **R-SHARED-CHECKBOX-2480-1 / AT-SHARED-CHECKBOX-2480-1:** Shared checkbox component for the checkboxes that remain checkboxes: one shared checkbox component gives the remaining checkboxes a uniform look; focus, RTL and pixel baselines are covered.

## Deliverables
- Branch pilot/SHARED-CHECKBOX-2480, change note docs/changes/SHARED-CHECKBOX-2480.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
