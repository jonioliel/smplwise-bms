# SETTINGS-INTERCOM-CARDS-2401 — "Entrance screen switches" settings tab as folding cards (two tabs or one list as options)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-SETTINGS-INTERCOM-CARDS-2401-1 / AT-SETTINGS-INTERCOM-CARDS-2401-1:** The tab fits 1366x768 without page scroll as folding cards with saved-value summaries, one open card remembered per user; a tab-layout setting switches to two tabs or one list.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
