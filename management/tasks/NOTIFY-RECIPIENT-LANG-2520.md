# NOTIFY-RECIPIENT-LANG-2520 — Notifications go out in each recipient's language

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
- **R-NOTIFY-RECIPIENT-LANG-2520-1 / AT-NOTIFY-RECIPIENT-LANG-2520-1:** Web push, e-mail and the phone app render a notification in the recipient's interface language (e-mail: the language of the users owning the address, Hebrew otherwise); WhatsApp unchanged; a Hebrew recipient gets the same bytes as before.

## Deliverables
- Branch pilot/NOTIFY-RECIPIENT-LANG-2520, change note docs/changes/NOTIFY-RECIPIENT-LANG-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
