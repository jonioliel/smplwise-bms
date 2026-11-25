# PHONE-SKIP-DESKTOP-SHOTS-2490 — The phone test run skips desktop-size screenshots, file by file

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
- **R-PHONE-SKIP-DESKTOP-SHOTS-2490-1 / AT-PHONE-SKIP-DESKTOP-SHOTS-2490-1:** The phone test run skips desktop-size screenshots, file by file: the phone project skips the screenshots that are desktop-size only, decided per file, so tests are less flaky and faster.

## Deliverables
- Branch pilot/PHONE-SKIP-DESKTOP-SHOTS-2490, change note docs/changes/PHONE-SKIP-DESKTOP-SHOTS-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
