# RELEASE-2380-TRAIN — Release train 2.38.0 (display and mobile server; features off by default)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** RELEASE-2370-TRAIN

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
- **R-RELEASE-2380-TRAIN-1 / AT-RELEASE-2380-TRAIN-1:** Release 2.38.0 carries the display and mobile-server work packages with every feature off by default and bilingual release notes, is gated on the runner and tagged v2.38.0; the app builds ship on their own track.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
