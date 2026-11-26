# STALE-FIXTURE-SPECS-2530 — The four stale fixture specs into the gate (media players live, WisKey people / editor / capture) and the media leave-group fix

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
- **R-STALE-FIXTURE-SPECS-2530-1 / AT-STALE-FIXTURE-SPECS-2530-1:** evidence-media-players-live, evidence-wiskey-people, evidence-wiskey-editor and evidence-wiskey-capture run in the gate's fixture lane and pass; a media player still grouped elsewhere is not reported as having left the group.

## Deliverables
- Branch pilot/STALE-FIXTURE-SPECS-2530, change note docs/changes/STALE-FIXTURE-SPECS-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
