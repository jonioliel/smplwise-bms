# FRIGATE-FORBIDDEN-2341 — Refused Frigate credentials: one health item instead of a flooded log

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
- **R-FRIGATE-FORBIDDEN-2341-1 / AT-FRIGATE-FORBIDDEN-2341-1:** Refused Frigate credentials no longer flood the log: Arx backs off up to 30 minutes, logs once per change and shows the exact fix step in Hebrew on the recorder health card.

## Deliverables
- Change record docs/changes/FRIGATE-FORBIDDEN-2341.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
