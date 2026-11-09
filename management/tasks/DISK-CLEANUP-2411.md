# DISK-CLEANUP-2411 — Workstation disk-cleanup script after a release (dry run first)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** REVIEW

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
- **R-DISK-CLEANUP-2411-1 / AT-DISK-CLEANUP-2411-1:** scripts/disk_cleanup.ps1 lists what it would remove (merged clean worktrees, test temp caches, old session temp) and removes only when asked; junctions are unlinked before any removal; nothing outside those classes is touched.

## Deliverables
- scripts/disk_cleanup.ps1 (merged)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
