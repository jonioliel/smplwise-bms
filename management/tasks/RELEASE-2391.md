# RELEASE-2391 — Release 2.39.1: the Arx bridge keeps its pairing after a re-pair and after restarts

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
- **R-RELEASE-2391-1 / AT-RELEASE-2391-1:** Release 2.39.1 = 2.39.0 plus BRIDGE-STALE-DISCOVERY-2383, gated on the runner, merged to main and tagged v2.39.1.

## Deliverables
- Version commit, runner gate record, tag v2.39.1

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
