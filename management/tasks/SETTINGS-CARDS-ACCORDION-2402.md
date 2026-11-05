# SETTINGS-CARDS-ACCORDION-2402 — Intercom settings cards: "cards opening in place" as a fourth layout

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** frontend | **Hardware:** False

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
- **R-SETTINGS-CARDS-ACCORDION-2402-1 / AT-SETTINGS-CARDS-ACCORDION-2402-1:** access.settings_layout accepts accordion besides cards, tabs and list (system.configure, audited, a corrupt value reads as cards); in accordion each card opens under its own header, one at a time, the page may scroll vertically but never sideways; the default (cards) keeps its 2.40.1 fit.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
