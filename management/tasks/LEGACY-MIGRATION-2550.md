# LEGACY-MIGRATION-2550 — Import from the legacy NVR add-on 1.5.27: reader, dry run, apply (T070, software part)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-LEGACY-MIGRATION-2550-1 / AT-LEGACY-MIGRATION-2550-1:** A copy of the legacy add-on's files is read without its secrets, a dry run lists every legacy element with an action and writes nothing, and an apply bound to the dry run's digest writes a project backup first and then only empty camera aliases, idempotently and audited.

## Deliverables
- Branch pilot/LEGACY-MIGRATION-2550, change note docs/changes/LEGACY-MIGRATION-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
