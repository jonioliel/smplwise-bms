# WISKEY-R3-2520 — stations/relay_inventory_v1 as a read-only consumer (row R3, WISKEY-RELAY-INV-2520)

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
- **R-WISKEY-R3-2520-1 / AT-WISKEY-R3-2520-1:** Arx reads WisKey stations/relay_inventory_v1 read-only next to the relay map; no write path.

## Deliverables
- Branch pilot/WISKEY-R3-2520, change note docs/changes/WISKEY-R3-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
