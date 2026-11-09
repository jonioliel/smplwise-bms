# WISKEY-RC4-2310 — WisKey rc.4 adoption + rc.5 host check (deadline fix, migration 0186, relay-by-door fix)

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
- **R-WISKEY-RC4-2310-1 / AT-WISKEY-RC4-2310-1:** The WisKey rc.4 owner30 contribution and the rc.5 host check (one absolute deadline before the live wrapper selection, installed-client migration, a door relay is WisKey's physical relay in every station grant) are adopted on a branch with fakes only; auto-install stays off.

## Deliverables
- Code, tests and change records on pilot/WISKEY-RC4-2310 (docs/changes/WISKEY-RC4-ADOPTION-2310.md)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
