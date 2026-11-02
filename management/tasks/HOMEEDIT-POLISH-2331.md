# HOMEEDIT-POLISH-2331 — Home editing screens polish (wave 3)

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
- **R-HOMEEDIT-POLISH-2331-1 / AT-HOMEEDIT-POLISH-2331-1:** The home edit panel is grouped, widget rows are wells, keys and fields are 44 px on a phone and a triggered alarm shows on the phone ambient bar.

## Deliverables
- Change record docs/changes/HOMEEDIT-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
