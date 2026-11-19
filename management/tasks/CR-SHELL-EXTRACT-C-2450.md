# CR-SHELL-EXTRACT-C-2450 — Shell extraction part C: the floating-window history management and the "your permissions were updated" notice out of sw-app.ts

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

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
- **R-CR-SHELL-EXTRACT-C-2450-1 / AT-CR-SHELL-EXTRACT-C-2450-1:** The floating-window history management and the "your permissions were updated" notice move out of sw-app.ts into their own controllers, behaviour unchanged, with the shell unit and navigation specs and a change note.

## Deliverables
- Two controllers, shell specs, change note

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
