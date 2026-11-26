# LEGACY-IMPORT-UI-2550 — The legacy import screen on Settings > Backup and restore (T070)

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
- **R-LEGACY-IMPORT-UI-2550-1 / AT-LEGACY-IMPORT-UI-2550-1:** A system administrator chooses a legacy file, reads the grouped and paged dry-run report, applies with the typed word after the backup-first line, sees honest 409 refusals and the result; the backup list names the auto-pre-legacy-import kind.

## Deliverables
- Branch pilot/LEGACY-IMPORT-UI-2550, change note docs/changes/LEGACY-IMPORT-UI-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
