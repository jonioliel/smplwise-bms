# DEVICES-POLISH-2331 — Layout editor, device controls and automations screen polish

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
- **R-DEVICES-POLISH-2331-1 / AT-DEVICES-POLISH-2331-1:** The layout editor panel is grouped, device controls share one control look, a cover tilt sits apart from its position, and the automations screen loads with the shape of its list.

## Deliverables
- Change record docs/changes/DEVICES-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
