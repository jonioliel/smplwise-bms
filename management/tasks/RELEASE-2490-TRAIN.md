# RELEASE-2490-TRAIN — RELEASE-2490-TRAIN - the 2.49.0 train

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-RELEASE-2490-TRAIN-1 / AT-RELEASE-2490-TRAIN-1:** The 2.49.0 train on release/2490-train passes ONE release gate with targeted re-runs, then is tagged, pushed and installed in the lab after the owner pre-approval.

## Deliverables
- Train merges, release commit, runner build, release gate, tag and lab install after a green gate

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
