# WXG0 — WisKey CR-034: Merge WX3 gate tool to main

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BLOCKED

**Owner role:** backend | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "model": "sonnet",
  "estimate_hours": 1,
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R248 / AT264:** Merge WX3 gate tool to main (CR-034, plan slice WXG0), built and tested on fakes and fixtures only; entry gate: -. Nothing here authorises a live door test, key action or release without a separate owner approval.

## Deliverables
- Implementation and tests on fakes in an isolated branch (pilot/WXD-... or pilot/WXH-... per wave)
- Change request: docs/changes/WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md and CR-033 / CR-034 (branch pilot/WISKEY-CRs)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Excluded - OBSOLETE by owner decision 2026-11-07, relayed by the lead; no written answers file: superseded: the WX3 gate tool checks a WisKey SOURCE folder under the 2026-10-05 rule "WisKey packages nothing"; since WISKEY-MANAGED-INSTALL-2382 Arx installs a WisKey-built bundle checked byte-exact against its MANAGED_MANIFEST.json behind the Core provenance gate, which takes the tool's place (answer to question 1 of docs/changes/V1-REMAINING-2406.md). Not to be worked; the card is kept.
