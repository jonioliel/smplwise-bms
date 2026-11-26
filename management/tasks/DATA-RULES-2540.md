# DATA-RULES-2540 — Backend data rules: billing cycle change, automatic drafts, generator battery system, generator mute

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
- **R-DATA-RULES-2540-1 / AT-DATA-RULES-2540-1:** A billing-cycle change after sealed bills leaves no unbilled gap (or is refused clearly); automatic drafts survive the draft retention and water drafts are announced; a 24 V battery is judged as 24 V; a critical generator mute needs generator.manage, lasts at most 4 h and can be ended.

## Deliverables
- Branch pilot/DATA-RULES-2540, change note docs/changes/DATA-RULES-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
