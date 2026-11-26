# HOME-SPEC-STABLE-2540 — The release gate's home screen spec is stable

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
- **R-HOME-SPEC-STABLE-2540-1 / AT-HOME-SPEC-STABLE-2540-1:** evidence-home-screen.spec.ts passes run after run on the runner: the fit is polled before measuring, the edit-mode drag never starts from a scrolled point, and the developer-only state push leaves after its commit.

## Deliverables
- Branch pilot/HOME-SPEC-STABLE-2540, change note docs/changes/HOME-SPEC-STABLE-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
