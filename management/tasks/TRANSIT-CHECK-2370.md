# TRANSIT-CHECK-2370 — Transit settings: "בדוק עכשיו" check button and route (owner-approved addition, 02.11 evening)

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
- **R-TRANSIT-CHECK-2370-1 / AT-TRANSIT-CHECK-2370-1:** POST /api/v1/transit/check asks the transit source once per configured stop (system.configure on the read connection, audited as transit.check, one check per 30 s per installation with 429 transit_check_rate_limited, skipped no_stops without a call) and the settings screen has a "בדוק עכשיו" button; the route answers the same locally and remotely.

## Deliverables
- routers/transit.py, services/transit/poller.py check_once, the settings button, tests (WP8 branch)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
