# WISKEY-R2-2520 — WisKey system status page UI ('מערכת האינטרקום'), row R2

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
- **R-WISKEY-R2-2520-1 / AT-WISKEY-R2-2520-1:** The access-control settings get the intercom-system status segment fed by slice 1; phone layout labelled; Linux pixel baselines refreshed on the runner.

## Deliverables
- Branch pilot/WISKEY-R2-2520, change note docs/changes/WISKEY-R2-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
