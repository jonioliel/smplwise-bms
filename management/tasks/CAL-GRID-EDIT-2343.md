# CAL-GRID-EDIT-2343 — Outlook-style editing on the calendar grid

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
- **R-CAL-GRID-EDIT-2343-1 / AT-CAL-GRID-EDIT-2343-1:** Drag across free time to create (quick-create popover), drag an event to move it, drag its edge to resize, peek card, keyboard and long-press support and undo after move / resize / delete; moving an approved booking in an approval room becomes a request (per-calendar setting); editing by dragging can be limited to "create only" (migration 0191).

## Deliverables
- Change record docs/changes/CAL-GRID-EDIT-2343.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
