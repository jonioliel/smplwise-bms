# TKFIX255 — Service management 2.5.5: table menus open above the table (no clipping), settings lists refresh after changes, one-row bulk delete drops the row

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R335 / AT351:** Service management 2.5.5: table and card menus are top-layer overlays; the table shows no vertical bar with few rows; settings lists refresh; fakes only (integ/255).

## Deliverables
- Implementation and regression tests on pilot/FIX-table-menus-255
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
