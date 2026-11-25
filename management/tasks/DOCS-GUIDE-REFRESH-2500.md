# DOCS-GUIDE-REFRESH-2500 — User documentation brought up to 2.40.0 .. 2.48.0 and the 2.49.0 train

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
- **R-DOCS-GUIDE-REFRESH-2500-1 / AT-DOCS-GUIDE-REFRESH-2500-1:** The user guide (Hebrew and English) covers the changes of 2.40.0 to 2.49.0; GUIDE_ALL_HE.html rebuilt and build_guide.py --check up to date.

## Deliverables
- Branch pilot/DOCS-GUIDE-REFRESH-2500, change note docs/changes/DOCS-GUIDE-REFRESH-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
