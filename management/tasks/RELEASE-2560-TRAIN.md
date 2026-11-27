# RELEASE-2560-TRAIN — RELEASE-2560-TRAIN - the 2.56.0 train

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-RELEASE-2560-TRAIN-1 / AT-RELEASE-2560-TRAIN-1:** The 2.56.0 train on release/2560-train (cut from release/2550-train) passes ONE release gate with targeted re-runs, then is tagged, pushed and installed in the lab only after the owner's approval.

## Deliverables
- Train merges, version bump, draft changelog, PC checks; the UI rebuild, the release gate and the tag are the lead's

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
