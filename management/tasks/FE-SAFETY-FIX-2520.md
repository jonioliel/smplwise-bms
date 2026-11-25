# FE-SAFETY-FIX-2520 — Push subscriptions end with the sign-in; Enter confirms only on the confirm button

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
- **R-FE-SAFETY-FIX-2520-1 / AT-FE-SAFETY-FIX-2520-1:** A push registration is tied to its sign-in and deleted on sign-out, revoke, sign-out everywhere and administrator actions, audited (FC-02); Enter confirms a dialog only on the confirm button (FC-04).

## Deliverables
- Branch pilot/FE-SAFETY-FIX-2520, change note docs/changes/FE-SAFETY-FIX-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
