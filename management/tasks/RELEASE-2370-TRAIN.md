# RELEASE-2370-TRAIN — Release train 2.37.0 (polish round 4, transit check, unlock reason)

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
- **R-RELEASE-2370-TRAIN-1 / AT-RELEASE-2370-TRAIN-1:** Release 2.37.0 = 2.36.0 plus polish round 4 packages WP1-WP8, the transit check and the unlock reason is gated on the runner, merged to main and tagged v2.37.0.

## Deliverables
- Version commit, runner gate record, tag v2.37.0

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
