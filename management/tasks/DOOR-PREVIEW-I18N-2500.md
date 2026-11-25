# DOOR-PREVIEW-I18N-2500 — The door hand-over preview in the reader's language

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
- **R-DOOR-PREVIEW-I18N-2500-1 / AT-DOOR-PREVIEW-I18N-2500-1:** The door hand-over preview answers in the reader's language (Hebrew and English at least), with tests.

## Deliverables
- Branch pilot/DOOR-PREVIEW-I18N-2500, change note docs/changes/DOOR-PREVIEW-I18N-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
