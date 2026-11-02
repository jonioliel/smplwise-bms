# POLISH4-WP8-SETMOD-2370 — Polish round 4, WP8: settings (modules) and the transit check button

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-POLISH4-WP8-SETMOD-2370-1 / AT-POLISH4-WP8-SETMOD-2370-1:** The modules settings (notifications, notices, public transport, voice announcements, infrastructure, access-control segments) are polished; the owner-approved addition is a transit "בדוק עכשיו" button backed by POST /api/v1/transit/check (system.configure, audited, one check per 30 s per installation).

## Deliverables
- Change record docs/changes/POLISH4-WP8-SETMOD-2370.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
