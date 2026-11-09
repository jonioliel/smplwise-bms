# SMALL-UI-BUGS-2343 — Tickets table width at 1440 and 1280 px; settings tab duplication

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
- **R-SMALL-UI-BUGS-2343-1 / AT-SMALL-UI-BUGS-2343-1:** The tickets table fits 1440 and 1280 px without sideways scrolling and settings pages with their own tabs no longer repeat them in the sidebar.

## Deliverables
- Change record docs/changes/SMALL-UI-BUGS-2343.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
