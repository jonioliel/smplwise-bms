# WISKEY-SCHED-READS-2520 — WisKey's signed schedule inspection jobs (wiskey-schedule-reads.v1), adopted explicitly

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-WISKEY-SCHED-READS-2520-1 / AT-WISKEY-SCHED-READS-2520-1:** Arx starts and follows WisKey's signed schedule inspection jobs (wiskey-schedule-reads.v1) with a start / status cycle; schedule execution stays for 2.53 (owner 25.11 Q2).

## Deliverables
- Branch pilot/WISKEY-SCHED-READS-2520, change note docs/changes/WISKEY-SCHED-READS-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
