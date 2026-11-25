# WISKEY-BRIDGE-KEYSET-2520 — Bridge 0.10.9: smplwise_bridge.native_keyset, the key-set binding WisKey direct v2 needs

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
- **R-WISKEY-BRIDGE-KEYSET-2520-1 / AT-WISKEY-BRIDGE-KEYSET-2520-1:** Bridge 0.10.9 adds native_keyset (and refuses the old pairing at once on a re-pair); both bridge copies and the version pins agree; install only after the owner approves one HA Core restart (owner 25.11 Q7, Q8).

## Deliverables
- Branch pilot/WISKEY-BRIDGE-KEYSET-2520, change note docs/changes/WISKEY-BRIDGE-KEYSET-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
