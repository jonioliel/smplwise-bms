# A11Y-POLISHED-2342 — Accessibility pass over the screens polished on 31.10 and 01.11

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
- **R-A11Y-POLISHED-2342-1 / AT-A11Y-POLISHED-2342-1:** Escape closes popovers and only the top dialog, every form field has a screen-reader name, arrow keys work in tab rows, save results are announced and light-mode status text meets 4.5:1.

## Deliverables
- Change record docs/changes/A11Y-POLISHED-2342.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
