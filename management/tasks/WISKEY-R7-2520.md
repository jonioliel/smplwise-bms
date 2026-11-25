# WISKEY-R7-2520 — Direct transport v2 with kid and direct/pairing_status_v2 (row R7, WISKEY-DIRECT-V2-2520)

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
- **R-WISKEY-R7-2520-1 / AT-WISKEY-R7-2520-1:** Direct transport v2 with key id and pairing_status_v2 (owner 25.11 Q3: one current pairing); generated wire types match.

## Deliverables
- Branch pilot/WISKEY-R7-2520, change note docs/changes/WISKEY-R7-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
