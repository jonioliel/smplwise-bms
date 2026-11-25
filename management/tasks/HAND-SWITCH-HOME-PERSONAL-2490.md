# HAND-SWITCH-HOME-PERSONAL-2490 — Switches in the home "personal" card, after the home panel edit

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
- **R-HAND-SWITCH-HOME-PERSONAL-2490-1 / AT-HAND-SWITCH-HOME-PERSONAL-2490-1:** Switches in the home "personal" card, after the home panel edit: the personal card of the home interface uses the new switches after the home panel edit lands, so the same file is not edited twice.

## Deliverables
- Branch pilot/HAND-SWITCH-HOME-PERSONAL-2490, change note docs/changes/HAND-SWITCH-HOME-PERSONAL-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
