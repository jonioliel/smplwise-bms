# LOWS-BRIDGE-GATE-2550 — The open low findings of the bridge (WB-) and the gate tooling (TR-) of the 2.52 deep review; bridge 0.10.10

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
- **R-LOWS-BRIDGE-GATE-2550-1 / AT-LOWS-BRIDGE-GATE-2550-1:** Bridge 0.10.10 (Persister.control rollback, rate-limited service-grant read, leftover swap folders swept) in both byte-identical copies; the gate tooling fixes TR-10, TR-12, TR-13, TR-14 and TR-08 (part) in the repository copies, installed on the runner only by the lead.

## Deliverables
- Branch pilot/LOWS-BRIDGE-GATE-2550, change note docs/changes/LOWS-BRIDGE-GATE-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
