# WISKEY-R5-2520 — Listen gate on the last negotiated signed discovery (row R5, WisKey C4)

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
- **R-WISKEY-R5-2520-1 / AT-WISKEY-R5-2520-1:** A listen session is offered and opened only when the last negotiated signed discovery offers listening; otherwise it is refused before talk_open with an honest reason.

## Deliverables
- Branch pilot/WISKEY-R5-2520, change note docs/changes/WISKEY-R5-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
