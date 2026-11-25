# WISKEY-NOFALLBACK-2-2530 — No transport switch after a v2 refusal in the capture lease and the grant engine (WB-01, same root)

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
- **R-WISKEY-NOFALLBACK-2-2530-1 / AT-WISKEY-NOFALLBACK-2-2530-1:** After a direct-v2 refusal the capture lease message is refused not_sent (wiskey_direct_v2_refused) and the grant engine people write is refused not_sent; v1 keys unchanged.

## Deliverables
- Branch pilot/WISKEY-NOFALLBACK-2-2530, change note docs/changes/WISKEY-NOFALLBACK-2-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
