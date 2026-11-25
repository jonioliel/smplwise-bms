# CR-I18N-ELECTRICITY-2443 — CR-I18N-ELECTRICITY-2443 - electricity: the remainder of the i18n row (08:F11) and the shared customer form (08:F25)

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
- **R-CR-I18N-ELECTRICITY-2443-1 / AT-CR-I18N-ELECTRICITY-2443-1:** Delivered as recorded in docs/changes/CR-I18N-ELECTRICITY-2443.md: electricity: the remainder of the i18n row (08:F11) and the shared customer form (08:F25)

## Deliverables
- Change note docs/changes/CR-I18N-ELECTRICITY-2443.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
