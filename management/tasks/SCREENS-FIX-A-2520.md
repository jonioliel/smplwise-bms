# SCREENS-FIX-A-2520 — The high findings of the deep screens review (SCR-01, SCR-06, SCR-07)

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
- **R-SCREENS-FIX-A-2520-1 / AT-SCREENS-FIX-A-2520-1:** The emergency door sheet retries (SCR-01); the home alarm reloads on every device, re-reads every 15 s and states its arm / disarm honestly (SCR-06); an Arx-only user cannot remove themselves or the last administrator (SCR-07).

## Deliverables
- Branch pilot/SCREENS-FIX-A-2520, change note docs/changes/SCREENS-FIX-A-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
