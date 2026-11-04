# BRIDGE-UPDATE-LISTENER-2401 — Bridge 0.10.4: update listener and config-flow reload no longer combine (home system 2026.12)

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
- **R-BRIDGE-UPDATE-LISTENER-2401-1 / AT-BRIDGE-UPDATE-LISTENER-2401-1:** Bridge 0.10.4 updates its pairing through the supported path, so a re-pair is applied without waiting for the next home-system restart from version 2026.12; the deprecation warning stops after the restart that follows the copy.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
