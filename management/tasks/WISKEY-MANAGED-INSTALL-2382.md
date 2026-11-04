# WISKEY-MANAGED-INSTALL-2382 — WisKey A-c: Arx-managed install and upgrade (owner-started, policy B)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-WISKEY-MANAGED-INSTALL-2382-1 / AT-WISKEY-MANAGED-INSTALL-2382-1:** An owner-started managed install / upgrade path behind wiskey.managed.enabled with typed confirmation, adoption of a manual install, stop / swap / start / compare / rollback.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
