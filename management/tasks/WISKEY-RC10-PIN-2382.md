# WISKEY-RC10-PIN-2382 — WisKey T2: command contract re-pinned to 2.0.1-rc.10

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
- **R-WISKEY-RC10-PIN-2382-1 / AT-WISKEY-RC10-PIN-2382-1:** The WisKey command catalogue and contract diff are re-pinned to rc.10, including the new installation, W10 and messaging rows.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
