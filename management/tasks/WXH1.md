# WXH1 — WisKey CR-034: Bridge multi-key verifier and rotate service

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BLOCKED

**Owner role:** backend | **Hardware:** False

**Dependencies:** WXH0

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "deep",
  "review": "deep",
  "effort": "large",
  "model": "opus",
  "estimate_hours": 10,
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R251 / AT267:** Bridge multi-key verifier and rotate service (CR-034, plan slice WXH1), built and tested on fakes and fixtures only; entry gate: WisKey answers to question 31 before merge. Nothing here authorises a live door test, key action or release without a separate owner approval.

## Deliverables
- Implementation and tests on fakes in an isolated branch (pilot/WXD-... or pilot/WXH-... per wave)
- Change request: docs/changes/WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md and CR-033 / CR-034 (branch pilot/WISKEY-CRs)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
