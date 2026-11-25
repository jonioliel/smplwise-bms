# WISKEY-RESYNC-2520 — WisKey resync reply (24.11): Arx adoption plan and slice 1 (system/status_v1, jobs/status_v1)

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
- **R-WISKEY-RESYNC-2520-1 / AT-WISKEY-RESYNC-2520-1:** The WisKey 24.11 resync reply is turned into an adoption plan (rows R1-R8) and slice 1 consumes system/status_v1 and jobs/status_v1; relay_inventory and station_sync_v1 channels in use, none reserved.

## Deliverables
- Branch pilot/WISKEY-RESYNC-2520, change note docs/changes/WISKEY-RESYNC-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
