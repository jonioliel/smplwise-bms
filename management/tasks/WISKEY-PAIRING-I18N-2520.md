# WISKEY-PAIRING-I18N-2520 — The pairing lines of 'חיבור Arx ל-WisKey' in the page language

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
- **R-WISKEY-PAIRING-I18N-2520-1 / AT-WISKEY-PAIRING-I18N-2520-1:** The WisKey pairing card's lines carry fix_code / params / step codes and render in Hebrew and English from a frontend catalogue.

## Deliverables
- Branch pilot/WISKEY-PAIRING-I18N-2520, change note docs/changes/WISKEY-PAIRING-I18N-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
