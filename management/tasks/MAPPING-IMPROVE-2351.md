# MAPPING-IMPROVE-2351 — Mapping: floors without a level asked about; auto-insert in the background

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-MAPPING-IMPROVE-2351-1 / AT-MAPPING-IMPROVE-2351-1:** Home-system floors with no level are asked about and the answers are kept with each mapping version; new names are mapped automatically in the background after every change and at start-up, adding only what the stored rules place without a question; confirming a few areas creates no unneeded buildings or floors.

## Deliverables
- Change record docs/changes/MAPPING-IMPROVE-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
