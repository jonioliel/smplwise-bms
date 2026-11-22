# LAB-V5-WISKEY-WRITE-2490 — Real WisKey write through the system, including a disabled test card (V5)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** engineering | **Hardware:** True

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
- **R-LAB-V5-WISKEY-WRITE-2490-1 / AT-LAB-V5-WISKEY-WRITE-2490-1:** Real WisKey write through the system, including a disabled test card (V5): create a test person without a credential at an internal station, edit, switch off and on, add a disabled test card, delete at the end; no door can open; the owner picks the station and watches (about 30 minutes).

## Deliverables
- Owner-run lab step with a redacted result recorded in docs/changes/

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
