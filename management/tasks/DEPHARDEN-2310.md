# DEPHARDEN-2310 — Worker dev tooling hardened; add-on base image pinned by digest (pin reverted in 2.31.1)

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
- **R-DEPHARDEN-2310-1 / AT-DEPHARDEN-2310-1:** Worker dev tooling is hardened and the add-on base image digests are pinned (DEPAUDIT-2310 M3, L2). The digest pin broke the Supervisor build and was reverted to the tag in 2.31.1 (see ADDON-IMAGE-BUILD-FIXES-2311).

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
