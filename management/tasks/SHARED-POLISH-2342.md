# SHARED-POLISH-2342 — Shared-layer proposals of the design-polish round

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
- **R-SHARED-POLISH-2342-1 / AT-SHARED-POLISH-2342-1:** One technical-details disclosure, a common settings kit, centred empty states, a failure tone for media-page messages, opt-in content-sized dialogs and keyboard-focusable table rows.

## Deliverables
- Change record docs/changes/SHARED-POLISH-2342.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
