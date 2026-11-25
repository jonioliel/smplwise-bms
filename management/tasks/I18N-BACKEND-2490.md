# I18N-BACKEND-2490 — Server texts in the user's interface language (setup wizard, readiness, error envelope)

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
- **R-I18N-BACKEND-2490-1 / AT-I18N-BACKEND-2490-1:** Server texts in the user's interface language: the setup wizard, readiness and the error envelope answer in the reader's language through the smplwise/i18n.py Msg catalogue.

## Deliverables
- Branch pilot/I18N-BACKEND-2490, change note docs/changes/I18N-BACKEND-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
