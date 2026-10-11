# WXD11 — WisKey CR-033: Door-path gate T1..T26 on fakes

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BACKLOG

**Owner role:** backend | **Hardware:** False

**Dependencies:** WXD0, WXD1, WXD2, WXD3, WXD4, WXD5A, WXD5B, WXD6, WXD7, WXD7R, WXD8, WXD9, WXD10A, WXD10B

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "deep",
  "effort": "medium",
  "model": "sonnet+opus",
  "estimate_hours": 3,
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R247 / AT263:** Door-path gate T1..T26 on fakes (CR-033, plan slice WXD11), built and tested on fakes and fixtures only; entry gate: -. Nothing here authorises a live door test, key action or release without a separate owner approval.

## Deliverables
- Implementation and tests on fakes in an isolated branch (pilot/WXD-... or pilot/WXH-... per wave)
- Change request: docs/changes/WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md and CR-033 / CR-034 (branch pilot/WISKEY-CRs)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
