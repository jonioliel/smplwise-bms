# POLISH4-WP4-HOME-2370 — Polish round 4, WP4: home and devices

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
- **R-POLISH4-WP4-HOME-2370-1 / AT-POLISH4-WP4-HOME-2370-1:** The home and devices screens are polished (survey defects D2, D24, D25, D26; owner answers Q5a, Q6a); the home edit drawer, the area presence line and the xs widget are untouched.

## Deliverables
- Change record docs/changes/POLISH4-WP4-HOME-2370.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
