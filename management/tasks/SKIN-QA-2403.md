# SKIN-QA-2403 — The 2.40.1 / 2.40.2 surfaces in every skin, light and dark: fallback tag, phone toolbar, intercom settings cards

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** frontend | **Hardware:** False

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
- **R-SKIN-QA-2403-1 / AT-SKIN-QA-2403-1:** In every picker skin in light and dark the fallback tag, the phone wall toolbar and the intercom settings cards meet contrast (4.5:1 text, 3:1 large text, icons and focus rings), 44 px touch targets, the no-scroll fit at 1440x900 / 1366x768 and RTL placement; the tag never covers another overlay.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
