# HOME-SCROLL-2-2530 — The home screen fits low screens too (one more squeeze step for every direction and view, default info style)

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
- **R-HOME-SCROLL-2-2530-1 / AT-HOME-SCROLL-2-2530-1:** In the default info style the home screen does not scroll the page at 1366x768, 1280x800, 1024x768 or 1180x820 in any direction or view; evidence-home-screen.spec.ts checks it.

## Deliverables
- Branch pilot/HOME-SCROLL-2-2530, change note docs/changes/HOME-SCROLL-2-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
