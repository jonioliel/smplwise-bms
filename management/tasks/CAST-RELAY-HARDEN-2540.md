# CAST-RELAY-HARDEN-2540 — Cast relay socket bounds, a cast ends when its user loses access, NVR undo checks the device first

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
- **R-CAST-RELAY-HARDEN-2540-1 / AT-CAST-RELAY-HARDEN-2540-1:** The cast relay caps connections (32 / 8 per address), times out sockets and cuts a slow-loris request at its deadline; a running cast ends with access_lost when the starter or camera loses access; the generic NVR undo answers 409 changed_since / already_rolled_back unless forced.

## Deliverables
- Branch pilot/CAST-RELAY-HARDEN-2540, change note docs/changes/CAST-RELAY-HARDEN-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
