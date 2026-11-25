# SCREENS-FIX-B2-2520 — Public-ticket draft bound to its link; calendar pending items carry their revision

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
- **R-SCREENS-FIX-B2-2520-1 / AT-SCREENS-FIX-B2-2520-1:** A public-ticket draft is bound to its link (hash) and a queued send goes only to its own link; /me/calendar pending items carry `revision` (additive), used by the home withdraw.

## Deliverables
- Branch pilot/SCREENS-FIX-B2-2520, change note docs/changes/SCREENS-FIX-B2-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
