# BRIDGE-STALE-DISCOVERY-2383 — Fix: a stale discovery no longer puts an old pairing code back into the bridge (bridge 0.10.3)

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
- **R-BRIDGE-STALE-DISCOVERY-2383-1 / AT-BRIDGE-STALE-DISCOVERY-2383-1:** After a re-pair and after every home-system restart the bridge keeps the current pairing code; refused bridge pushes are visible in the WisKey connection block; no bridge key rotation starts while WisKey is installed.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
