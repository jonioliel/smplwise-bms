# TREE-HIDE-UNASSIGNED-2331 — Hide "ללא שיוך" from the building tree

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
- **R-TREE-HIDE-UNASSIGNED-2331-1 / AT-TREE-HIDE-UNASSIGNED-2331-1:** The unassigned row of the building tree can be hidden (always shown by default, only while editing, or never) from the home-screen options or on the row itself, with undo; counts do not change.

## Deliverables
- Change record docs/changes/TREE-HIDE-UNASSIGNED-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
