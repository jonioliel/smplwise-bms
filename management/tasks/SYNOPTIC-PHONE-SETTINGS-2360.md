# SYNOPTIC-PHONE-SETTINGS-2360 — Phone synoptic map: light and summary-line settings

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-SYNOPTIC-PHONE-SETTINGS-2360-1 / AT-SYNOPTIC-PHONE-SETTINGS-2360-1:** Two settings next to the phone synoptic view: "תאורה בטלפון" (small bar - default, segments, number only) and "שורת סיכום בטלפון" (info button - default, a line under the board, off).

## Deliverables
- Change record docs/changes/SYNOPTIC-PHONE-SETTINGS-2360.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
