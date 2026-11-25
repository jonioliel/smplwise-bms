# HOME-SCROLL-FIX-2530 — Direction b of the home screen without a page scroll (the widget column fits the viewport)

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
- **R-HOME-SCROLL-FIX-2530-1 / AT-HOME-SCROLL-FIX-2530-1:** The home screen of direction b (cards and tiles views) does not scroll the page at 1440x900 or 1366x768: the widget column has its own fit step (tokens only); evidence-home-screen.spec.ts checks it.

## Deliverables
- Branch pilot/HOME-SCROLL-FIX-2530, change note docs/changes/HOME-SCROLL-FIX-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
