# LOBBY-STYLES-2290 — Lobby screen styles (Gallery, Concierge, Stone, Lumen, Axis, Prism, Ink and Sign)

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
- **R-LOBBY-STYLES-2290-1 / AT-LOBBY-STYLES-2290-1:** Three luxury lobby styles (Gallery, Concierge, Stone) with a day and a night building photo, three hi-tech styles (Lumen, Axis, Prism) and the Ink and Sign board styles for maintenance areas are selectable; nothing changes until an administrator chooses one.

## Deliverables
- Lobby style code and specs in the v2.29.0 tree

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
