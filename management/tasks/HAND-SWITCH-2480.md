# HAND-SWITCH-2480 — On/off checkboxes become switches (about 160 places in 80 files), including the terms (I agree) checkboxes

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
- **R-HAND-SWITCH-2480-1 / AT-HAND-SWITCH-2480-1:** On/off checkboxes become switches (about 160 places in 80 files), including the terms (I agree) checkboxes: checkboxes that act as on/off switches become 32x18 switches as on the comparison page (152 before/after pairs), and the I agree terms checkboxes become switches too; RTL, phone and pixel baselines refreshed on the runner.

## Deliverables
- Branch pilot/HAND-SWITCH-2480, change note docs/changes/HAND-SWITCH-2480.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
