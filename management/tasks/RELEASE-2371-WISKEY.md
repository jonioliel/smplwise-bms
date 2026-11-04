# RELEASE-2371-WISKEY — Release 2.37.1: WisKey alignment (rc.39 native component, one restart decision, readiness, station still)

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
- **R-RELEASE-2371-WISKEY-1 / AT-RELEASE-2371-WISKEY-1:** Release 2.37.1 = 2.37.0 plus the WisKey chain (rc.4 / relay map / relay export / rc.7 adoption with auto-install policy B, S4 Core runtime observer with bridge 0.10.2, S5 pre-merge, S6 release prep), gated on the runner, merged to main and tagged v2.37.1.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
