# HOME-PERMS-WARN-2550 — Home permissions page: a warning when a category shows the whole site's data; the home electricity bill gate (D-11)

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
- **R-HOME-PERMS-WARN-2550-1 / AT-HOME-PERMS-WARN-2550-1:** A person's home-interface card warns when a chosen category shows the whole site's data; the home-only electricity bill routes need the bills category and the person's electricity-bill selection; the room list says it is a display filter.

## Deliverables
- Branch pilot/HOME-PERMS-WARN-2550, change note docs/changes/HOME-PERMS-WARN-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
