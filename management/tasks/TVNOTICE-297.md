# TVNOTICE-297 — TV notice board V2 design and the owner answers of 27.10

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
- **R-TVNOTICE-297-1 / AT-TVNOTICE-297-1:** The notice board TV page follows the approved V2 mock-up (96 px header with the tenant and SmplWise logos, weather under the date, fixed bus area per layout); the "updated" line has two wordings (place and time - the default - or time and board name), an idle board can show the logos, and the one-row header survives very long names.

## Deliverables
- docs/changes/TVNOTICE-297-GAPS.md, TVNOTICE2-297.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
