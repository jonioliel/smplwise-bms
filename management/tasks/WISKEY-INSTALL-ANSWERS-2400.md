# WISKEY-INSTALL-ANSWERS-2400 — WisKey managed install: owner answers 04.11 (access-control settings group, start-up install switch, kept runs)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-WISKEY-INSTALL-ANSWERS-2400-1 / AT-WISKEY-INSTALL-ANSWERS-2400-1:** Settings have an access-control group with the installer row; a start-up install switch (off, system administrator, typed confirmation) and a kept-runs count exist; every start-up attempt stops before any change while the platform image cannot be verified.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
