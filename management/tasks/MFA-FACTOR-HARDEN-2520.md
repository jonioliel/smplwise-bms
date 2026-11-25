# MFA-FACTOR-HARDEN-2520 — Second factor hardening after the 2.51 review (owner 25.11: N-1, N-5, N-6)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-MFA-FACTOR-HARDEN-2520-1 / AT-MFA-FACTOR-HARDEN-2520-1:** Every factor added from outside needs a fresh sign-in (5 minutes) even with step-up off; an administrator's reset from outside needs a fresh sign-in; the user gets a content-free notice on factor removal, new recovery codes and a recovery-code sign-in (owner answers 25.11, all a).

## Deliverables
- Branch pilot/MFA-FACTOR-HARDEN-2520, change note docs/changes/MFA-FACTOR-HARDEN-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
