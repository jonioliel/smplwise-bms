# POLISH4-WP1-SHARED-2370 — Polish round 4, WP1: shared stage 2 and the shell pill

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-POLISH4-WP1-SHARED-2370-1 / AT-POLISH4-WP1-SHARED-2370-1:** The shared layer gets its stage 2 (shell pill note, bare state panel, one settings key look, drawer footer-end, solid sheet, --sw-well); new variants are opt-in and the settings key is the one deliberate look change.

## Deliverables
- Change record docs/changes/POLISH4-WP1-SHARED-2370.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
