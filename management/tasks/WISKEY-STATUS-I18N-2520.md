# WISKEY-STATUS-I18N-2520 — 'מצב WisKey' in the page language

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
- **R-WISKEY-STATUS-I18N-2520-1 / AT-WISKEY-STATUS-I18N-2520-1:** The WisKey feature-status reasons carry params and a frontend reason-code catalogue renders them in Hebrew and English; every backend reason code has both.

## Deliverables
- Branch pilot/WISKEY-STATUS-I18N-2520, change note docs/changes/WISKEY-STATUS-I18N-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
