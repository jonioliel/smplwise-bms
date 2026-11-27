# HOME-FIT-FOLLOWUPS-2550 — Home screen fit: growth above the screen packed at once, a building switch without an overflow frame; the picker test

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** REVIEW

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
- **R-HOME-FIT-FOLLOWUPS-2550-1 / AT-HOME-FIT-FOLLOWUPS-2550-1:** The home screen packs itself in the same frame when the page area above it grows, a building switch shows no frame of overflow, and the settings direction picker test no longer fails under load; evidence-home-screen and evidence-multibuilding-home-2330 pass.

## Deliverables
- Branch pilot/HOME-FIT-FOLLOWUPS-2550, change note docs/changes/HOME-FIT-FOLLOWUPS-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
