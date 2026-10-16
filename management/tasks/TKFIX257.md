# TKFIX257 — Service management 2.5.7: vendor page quote / payment-request card and light/dark setting (migration 0085), deep-review security hardening (migration 0086), expand-arrow fix

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R337 / AT353:** Service management 2.5.7: quote / payment card and vendor page theme (0085), security hardening (0086), expand-arrow fix; fakes only (integ/257).

## Deliverables
- Implementation and regression tests on pilot/TK260-expand-nav, pilot/TK257-259-vendor-page, pilot/TK251A-deep-review-fixes
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
