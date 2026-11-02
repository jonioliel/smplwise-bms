# CALCONNECT-2330 — External calendar connections: iCal subscription, Google Calendar, Microsoft 365 / Outlook

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
- **R-CALCONNECT-2330-1 / AT-CALCONNECT-2330-1:** An iCal subscription (read-only), Google Calendar or Microsoft 365 / Outlook can be bound to an Arx calendar; synchronisation runs only while the calendars module and calendar sync are on; outgoing iCal feeds are off by default and need their own switch (setup guide docs/operations/CALENDAR_CONNECT_SETUP.md). Real-provider connections are NOT_RUN.

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
