# FLAKY-S12-PIXEL-2412 — Flaky pixel test: CR-036 S12 phone cards render 15-23 px taller under gate load (quarantined until 2026-11-16)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** READY

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
- **R-FLAKY-S12-PIXEL-2412-1 / AT-FLAKY-S12-PIXEL-2412-1:** The cause of the taller s12 display / parity cards on the phone under gate load is found (the diff images of a failing run are kept), the spec waits for the settled state or the product is fixed, the quarantine entry `[mobile] pixel: CR-036 S12` is removed with gate_quarantine.py remove, and the spec passes in two full gates.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
