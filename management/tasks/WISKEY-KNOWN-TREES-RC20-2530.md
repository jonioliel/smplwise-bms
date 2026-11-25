# WISKEY-KNOWN-TREES-RC20-2530 — Arx recognises the published WisKey rc.20 / rc.19 / rc.17 trees by exact digest

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
- **R-WISKEY-KNOWN-TREES-RC20-2530-1 / AT-WISKEY-KNOWN-TREES-RC20-2530-1:** services/wiskey_known_trees.json labels the published rc.20 managed + manual, rc.19 managed + manual and rc.17 manual trees by their exact wiskey-posix-tree-sha256.v1 digests; any other tree stays unknown; the shipped bundle stays rc.10.

## Deliverables
- Branch pilot/WISKEY-KNOWN-TREES-RC20-2530, change note docs/changes/WISKEY-KNOWN-TREES-RC20-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
