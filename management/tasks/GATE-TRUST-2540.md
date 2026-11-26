# GATE-TRUST-2540 — The release gate's green can be trusted (lint lane tree, count-drop reference, coverage anchor, build stamp)

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
- **R-GATE-TRUST-2540-1 / AT-GATE-TRUST-2540-1:** The blocking backend lint lane lints the gated worktree; the count-drop baseline follows the newest green full run with per-lane thresholds; a targeted --after run needs a coverage anchor; release_check compares www/build-stamp.json with the sources from 2.54.0.

## Deliverables
- Branch pilot/GATE-TRUST-2540, change note docs/changes/GATE-TRUST-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
