# WISKEY-OPS-ANSWERS-2400 — WisKey operations: owner answers 04.11 (maintenance role, permission label, deploy warning, talk reasons)

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
- **R-WISKEY-OPS-ANSWERS-2400-1 / AT-WISKEY-OPS-ANSWERS-2400-1:** Station maintenance stays with system administrators and its permission text says what it covers; schedule deployment warns while WisKey station writes are off; no-talk reasons name WisKey when WisKey is the cause.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
