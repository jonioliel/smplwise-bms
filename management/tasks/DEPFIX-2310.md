# DEPFIX-2310 — Dependency security fixes: Pillow 13, paramiko 5, format-restricted image decodes

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
- **R-DEPFIX-2310-1 / AT-DEPFIX-2310-1:** pillow 13.0.0 and paramiko 5.1.0 replace the vulnerable versions; untrusted image uploads decode only the expected formats and an MPO phone photo is accepted as its first frame (DEPAUDIT-2310 H1, M1, M2).

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
