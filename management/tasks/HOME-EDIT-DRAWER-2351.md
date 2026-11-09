# HOME-EDIT-DRAWER-2351 — Home screen edit mode in a drawer

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-HOME-EDIT-DRAWER-2351-1 / AT-HOME-EDIT-DRAWER-2351-1:** Home screen settings and the selected card settings share one drawer (side from 1200 px, bottom sheet on tablets and phones) with save and cancel always in view; a closed drawer gives its width back to the preview (a setting keeps the column reserved).

## Deliverables
- Change record docs/changes/HOME-EDIT-DRAWER-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
