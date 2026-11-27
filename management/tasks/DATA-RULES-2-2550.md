# DATA-RULES-2-2550 — Data rules part 2: the generator battery system choice, the billing gap warning, reopening a period after a person's draft expires

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
- **R-DATA-RULES-2-2550-1 / AT-DATA-RULES-2-2550-1:** The generator settings offer Automatic / 12 V / 24 V for the starter battery; an account's status carries billing_gaps and the page warns per gap; a period whose person-made draft expired is reopened for the automatic bill without a second bill.

## Deliverables
- Branch pilot/DATA-RULES-2-2550, change note docs/changes/DATA-RULES-2-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
