# DEPAUDIT-2310 — Dependency, licence and secrets audit refreshed for v2.29.0

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
- **R-DEPAUDIT-2310-1 / AT-DEPAUDIT-2310-1:** docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md is refreshed for v2.29.0 (inventory, licences, vulnerability and secrets scans) with findings H1, M1-M3, L1-L7 and the owner and counsel decisions recorded; the Heebo font licence text ships next to the UI fonts.

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
