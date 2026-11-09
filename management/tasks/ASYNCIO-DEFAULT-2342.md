# ASYNCIO-DEFAULT-2342 — The server runs on asyncio and h11 by default (uvloop and httptools opt-in)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-ASYNCIO-DEFAULT-2342-1 / AT-ASYNCIO-DEFAULT-2342-1:** The server runs on the standard asyncio and h11 components by default (a suspected native crash source is off); a Diagnostics setting turns the fast components back on after a restart.

## Deliverables
- Change record docs/changes/ASYNCIO-DEFAULT-2342.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
