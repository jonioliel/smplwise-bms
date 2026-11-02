# EVENTS-POLISH-2331 — Event centre polish (Security > Investigate > Events)

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
- **R-EVENTS-POLISH-2331-1 / AT-EVENTS-POLISH-2331-1:** The event centre side panel actions stay in view, the list scrolls in its own box, event names are Hebrew and technical details sit in a collapsible section; Up / Down move between events and Esc closes the panel.

## Deliverables
- Change record docs/changes/EVENTS-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
