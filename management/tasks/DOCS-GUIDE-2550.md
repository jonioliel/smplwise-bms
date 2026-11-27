# DOCS-GUIDE-2550 — The user documentation brought up to 2.53, 2.54 and 2.55

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** REVIEW

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
- **R-DOCS-GUIDE-2550-1 / AT-DOCS-GUIDE-2550-1:** The Hebrew guide has a what's-new page for 2.53-2.55 and updated pages for the changed screens, DOCS.md / DOCS_HE.md describe the new settings, GUIDE_ALL_HE.html is regenerated, and test_docs_settings_2550 checks the documented settings exist.

## Deliverables
- Branch pilot/DOCS-GUIDE-2550, change note docs/changes/DOCS-GUIDE-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
