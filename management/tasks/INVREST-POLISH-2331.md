# INVREST-POLISH-2331 — Investigation leftovers polish (cases, one case, exports, event page)

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
- **R-INVREST-POLISH-2331-1 / AT-INVREST-POLISH-2331-1:** The cases list fits the window with status filters and a count, a case page has two scrolling columns, exports are grouped and the event page shows Hebrew event names.

## Deliverables
- Change record docs/changes/INVREST-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
