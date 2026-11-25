# SCREENS-FIX-B-2520 — High findings of the deep screens review (2.52)

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
- **R-SCREENS-FIX-B-2520-1 / AT-SCREENS-FIX-B-2520-1:** The public ticket page (ar / ru packs), the home calendar, the resident calendars and booking logic, and the investigation playback day are fixed as the review found.

## Deliverables
- Branch pilot/SCREENS-FIX-B-2520, change note docs/changes/SCREENS-FIX-B-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
