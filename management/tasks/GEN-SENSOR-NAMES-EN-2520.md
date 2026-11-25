# GEN-SENSOR-NAMES-EN-2520 — Generator sensor names in English (server) and in the page language (routing + sensor mapping)

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
- **R-GEN-SENSOR-NAMES-EN-2520-1 / AT-GEN-SENSOR-NAMES-EN-2520-1:** Generator sensor names have an English form (needs_en, label_en, labels_en, additive) and the CSV headers follow the page language; Hebrew unchanged.

## Deliverables
- Branch pilot/GEN-SENSOR-NAMES-EN-2520, change note docs/changes/GEN-SENSOR-NAMES-EN-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
