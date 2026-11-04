# WISKEY-LAB-ACTIVATION-0411 — WisKey activation on the lab installation (04.11 joint session)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-WISKEY-LAB-ACTIVATION-0411-1 / AT-WISKEY-LAB-ACTIVATION-0411-1:** On the lab installation the WisKey link is paired and verified, the station media provider is WisKey, the direct join runs, and talk, listen, live validation and door windows are exercised step by step from the activation runbook with the owner.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
