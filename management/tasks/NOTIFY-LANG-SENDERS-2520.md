# NOTIFY-LANG-SENDERS-2520 — The senders around the notification pipeline speak the recipient's language

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
- **R-NOTIFY-LANG-SENDERS-2520-1 / AT-NOTIFY-LANG-SENDERS-2520-1:** Calendar attendee notices and insights delivery render in the recipient's language (the _i18n param overlay); Hebrew unchanged.

## Deliverables
- Branch pilot/NOTIFY-LANG-SENDERS-2520, change note docs/changes/NOTIFY-LANG-SENDERS-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
