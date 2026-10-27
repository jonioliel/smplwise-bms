# WISKEYA06-297 — WisKey A06 (T06, W-031, board r152): identity source + role + scope -> admission, working-state mapping (fakes)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "deep",
  "review": "deep",
  "effort": "high",
  "escalation": "Door-access admission: any gap found becomes a strict xfail and a lead question, never a silent product change."
}
```

## Acceptance
- **R-WISKEYA06-1 / AT-WISKEYA06-1:** Tests only on fakes, no product code: the live-RBAC identity source on the signed emergency command; EMROLE rows (security-manager grant at a building, revoke, expiry, local identity) on features/start; door / native-write / people-CSV work states never read as done; docs/changes/WISKEYA06-297.md; no migration.

## Deliverables
- Tests: smplwise_vms/backend/tests/test_wiskeya06_297.py
- Docs: docs/changes/WISKEYA06-297.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
