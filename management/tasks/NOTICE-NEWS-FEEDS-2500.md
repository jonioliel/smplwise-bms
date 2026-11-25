# NOTICE-NEWS-FEEDS-2500 — Notice board news feeds: compressed bodies, the Calcalist address, source health

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
- **R-NOTICE-NEWS-FEEDS-2500-1 / AT-NOTICE-NEWS-FEEDS-2500-1:** Notice board news feeds read compressed bodies, use the current Calcalist address and report per-source health; the SSRF guard keeps refusing private addresses.

## Deliverables
- Branch pilot/NOTICE-NEWS-FEEDS-2500, change note docs/changes/NOTICE-NEWS-FEEDS-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
