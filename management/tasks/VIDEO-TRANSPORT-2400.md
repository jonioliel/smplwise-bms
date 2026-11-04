# VIDEO-TRANSPORT-2400 — Live video: one transport decision executed by every player; personal choice in My account; stalled-picture recovery

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
- **R-VIDEO-TRANSPORT-2400-1 / AT-VIDEO-TRANSPORT-2400-1:** The installation's transport setting is honoured on every surface and channel (remote access and the phone included); only automatic tries more than one way; a per-user choice under My account > Video beats it; a frozen MSE picture reconnects on MSE; station video plays both profiles over either transport.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
