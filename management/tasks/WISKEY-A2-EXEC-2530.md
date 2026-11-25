# WISKEY-A2-EXEC-2530 — WisKey A2 schedule execution: status only (operations status / pending / review reads), off by default

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
- **R-WISKEY-A2-EXEC-2530-1 / AT-WISKEY-A2-EXEC-2530-1:** With the switch on (default off, system administrators) the schedule library shows the signed read-only status of a WisKey schedule job; decide / execute / preview / cancel are refused before any byte is sent; Arx never approves or executes.

## Deliverables
- Branch pilot/WISKEY-A2-EXEC-2530, change note docs/changes/WISKEY-A2-EXEC-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
