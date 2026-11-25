# I18N-SETTINGS-KEYWORDS-2490 — English: add English search keywords to the settings search

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
- **R-I18N-SETTINGS-KEYWORDS-2490-1 / AT-I18N-SETTINGS-KEYWORDS-2490-1:** English: add English search keywords to the settings search: settings search keywords exist in English so an English search finds settings, not only labels.

## Deliverables
- Branch pilot/I18N-EN-2490, change note docs/changes/I18N-SETTINGS-KEYWORDS-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
