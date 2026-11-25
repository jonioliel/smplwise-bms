# DESIGN-LITERALS-2510 — Tokenise the 2.50 train's design literals; the wizard 'same for all' is a switch

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
- **R-DESIGN-LITERALS-2510-1 / AT-DESIGN-LITERALS-2510-1:** The 2.50 train's colour / px literals become tokens and the design ratchet is lowered (color-literal 1984, px-literal 25509, hand-switch 160 after the merge); before / after captures recorded.

## Deliverables
- Branch pilot/DESIGN-LITERALS-2510, change note docs/changes/DESIGN-LITERALS-2510.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
