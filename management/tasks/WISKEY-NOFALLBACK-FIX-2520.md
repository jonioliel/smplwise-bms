# WISKEY-NOFALLBACK-FIX-2520 — No classic people write after a v2 refusal at connect / discovery (WB-01); self-healing discovery (WB-03)

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
- **R-WISKEY-NOFALLBACK-FIX-2520-1 / AT-WISKEY-NOFALLBACK-FIX-2520-1:** After a direct-v2 refusal at connect or discovery no classic people write is sent; the discovery is re-read with backoff.

## Deliverables
- Branch pilot/WISKEY-NOFALLBACK-FIX-2520, change note docs/changes/WISKEY-NOFALLBACK-FIX-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
