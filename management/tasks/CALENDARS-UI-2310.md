# CALENDARS-UI-2310 — Calendars UI: booking calendars, approvals, maintenance calendar, resident view, sync settings (owner answers 30.10)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-CALENDARS-UI-2310-1 / AT-CALENDARS-UI-2310-1:** Calendars: month, week and day views, a rooms timeline, booking, approvals (contested requests; displacing needs the calendar manager), maintenance, calendar management, settings and connections and a resident flow on the phone; every owner decision is a setting (module off by default).

## Deliverables
- Code and tests in git history of pilot/CALENDARS-UI-2310

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
