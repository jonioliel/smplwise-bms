# LOOK-POLISH-2331 — Look and branding settings polish (wave 2, part A)

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
- **R-LOOK-POLISH-2331-1 / AT-LOOK-POLISH-2331-1:** The logo settings have keyboard-friendly tabs and an unsaved-changes mark and the wall-screen users list, empty state and drawer are reorganised into clear sections.

## Deliverables
- Change record docs/changes/LOOK-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
