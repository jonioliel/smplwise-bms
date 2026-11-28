# FIX-GATE-2570 — Second deep review gate trust fixes CD2-01, CD2-03, CD2-09, CD2-10, SA2-05 a: process-level failures carry their files, all-skipped processes fail, requirements and pins checked, nightly arm64 base check

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** release | **Hardware:** False

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
- **R-FIX-GATE-2570-1 / AT-FIX-GATE-2570-1:** Second deep review gate trust fixes CD2-01, CD2-03, CD2-09, CD2-10, SA2-05 a: process-level failures carry their files, all-skipped processes fail, requirements and pins checked, nightly arm64 base check; merged into the 2.57.0 train, change note docs/changes/FIX-GATE-2570.md.

## Deliverables
- Branch pilot/FIX-GATE-2570, change note docs/changes/FIX-GATE-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
