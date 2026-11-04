# POLISH4-WP2-LIVEINV-2370 — Polish round 4, WP2: live and investigation screens

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
- **R-POLISH4-WP2-LIVEINV-2370-1 / AT-POLISH4-WP2-LIVEINV-2370-1:** Live, investigation and video-domain screens use the video tokens (overlays, HUD, record-mode legend) with no backend or shared change.

## Deliverables
- Change record docs/changes/pilot-POLISH4-WP2-LIVEINV-2370.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
