# DOCS-ONBOARDING-2530 — Getting started checklist, a real Settings > Support tab and the operator guide (T071)

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
- **R-DOCS-ONBOARDING-2530-1 / AT-DOCS-ONBOARDING-2530-1:** A fresh installation shows the getting-started checklist (wizard + readiness checks) to system configurators until hidden; an existing installation stays off; Settings > General > Support shows versions, the redacted log export and how to report a problem; guide chapter 71 he + en.

## Deliverables
- Branch pilot/DOCS-ONBOARDING-2530, change note docs/changes/DOCS-ONBOARDING-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
