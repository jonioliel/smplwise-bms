# CAL-ATTENDEES-2343 — Named attendees of calendar entries

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
- **R-CAL-ATTENDEES-2343-1 / AT-CAL-ATTENDEES-2343-1:** Calendar entries have named attendees (Arx users, residents and external guests stored encrypted) with in-app notices, guest notices on the configured channel, RSVP, count-only privacy for viewers and settings per installation and per calendar (migration 0190). Guest messages to real recipients are NOT_RUN.

## Deliverables
- Change record docs/changes/CAL-ATTENDEES-2343.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
