# RELEASE-2520-TRAIN — RELEASE-2520-TRAIN - the 2.52.0 train

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-RELEASE-2520-TRAIN-1 / AT-RELEASE-2520-TRAIN-1:** The 2.52.0 train on release/2520-train passes ONE release gate with targeted re-runs, then is tagged, pushed and installed in the lab only after the owner's approval (publish and the bridge 0.10.9 HA Core restart are not pre-approved).

## Deliverables
- Train merges, release commit, runner build, release gate, tag and lab install after the owner's approval

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
