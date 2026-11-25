# RELEASE-2510-TRAIN — RELEASE-2510-TRAIN - the 2.51.0 train (the second-factor release)

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
- **R-RELEASE-2510-TRAIN-1 / AT-RELEASE-2510-TRAIN-1:** The 2.51.0 train on release/2510-train (docs/changes/RELEASE-2510-TRAIN.md section 1) passes the release gate, is tagged v2.51.0 after the owner's approval, published and installed in the lab with a passing read-only probe.

## Deliverables
- Train merges, release commit, runner build, release gate with targeted re-runs, tag, #addon refresh and lab install

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
