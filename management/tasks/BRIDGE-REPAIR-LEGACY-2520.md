# BRIDGE-REPAIR-LEGACY-2520 — A bridge re-pair holds on every key-store format; the bridge's own services fenced

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
- **R-BRIDGE-REPAIR-LEGACY-2520-1 / AT-BRIDGE-REPAIR-LEGACY-2520-1:** A legacy untagged key store counts as a re-pair (WB-02) and the bridge's own signed services sit behind the PairingFence (WB-07); native_keyset.py unchanged.

## Deliverables
- Branch pilot/BRIDGE-REPAIR-LEGACY-2520, change note docs/changes/BRIDGE-REPAIR-LEGACY-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
