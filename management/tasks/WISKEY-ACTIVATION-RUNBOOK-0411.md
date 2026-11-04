# WISKEY-ACTIVATION-RUNBOOK-0411 — WisKey T19: activation runbook for the 04.11 joint session

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
- **R-WISKEY-ACTIVATION-RUNBOOK-0411-1 / AT-WISKEY-ACTIVATION-RUNBOOK-0411-1:** An ordered activation ladder (door map, provider, pairing check, video_talk, listen, live validation, door windows / emergency) with the screen, expected status line, rollback and approval wording per step.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
