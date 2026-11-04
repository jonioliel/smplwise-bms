# WISKEY-ADDENDUM-GAPS-0411 — WisKey gaps found while building 2.38.2 - 2.40.0 (addendum for the WisKey team)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BLOCKED

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
- **R-WISKEY-ADDENDUM-GAPS-0411-1 / AT-WISKEY-ADDENDUM-GAPS-0411-1:** Every WisKey gap recorded by the 2.38.2 - 2.40.0 branches (door technical, live validation, people, profiles, schedules, station maintenance, access diagnostics, conflicts, event cursor, installer, operations, messaging queue, managed install) reaches the WisKey team, and each answer is recorded against the Arx card it unblocks.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Owner: forward the addendum to the WisKey team; then waiting for WisKey's answers.
