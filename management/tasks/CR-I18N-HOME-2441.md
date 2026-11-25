# CR-I18N-HOME-2441 — CR-I18N-HOME-2441 - the home interface's texts on the shared i18n core

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R-CR-I18N-HOME-2441-1 / AT-CR-I18N-HOME-2441-1:** Delivered as recorded in docs/changes/CR-I18N-HOME-2441.md: the home interface's texts on the shared i18n core

## Deliverables
- Change note docs/changes/CR-I18N-HOME-2441.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
