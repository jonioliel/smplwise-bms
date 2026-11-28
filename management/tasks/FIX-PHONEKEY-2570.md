# FIX-PHONEKEY-2570 — Second deep review SA2-01, SA2-02: phone key registration in the Android app, the phone prompt shows the signed payload (app 2.1.0)

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
- **R-FIX-PHONEKEY-2570-1 / AT-FIX-PHONEKEY-2570-1:** Second deep review SA2-01, SA2-02: phone key registration in the Android app, the phone prompt shows the signed payload (app 2.1.0); merged into the 2.57.0 train, change note docs/changes/FIX-PHONEKEY-2570.md.

## Deliverables
- Branch pilot/FIX-PHONEKEY-2570, change note docs/changes/FIX-PHONEKEY-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
