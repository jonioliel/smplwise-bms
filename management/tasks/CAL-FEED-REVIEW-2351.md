# CAL-FEED-REVIEW-2351 — Security review of the outgoing iCal feed; remote switch, busy-only, 365-day expiry

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
- **R-CAL-FEED-REVIEW-2351-1 / AT-CAL-FEED-REVIEW-2351-1:** The outgoing iCal feed route is reviewed; a feed can be opened to remote access per feed (off by default, administrator or all-calendars manager, from inside the network, after a confirmation), a remote-open feed shows busy only, new links expire after a configurable period (default 365 days) and can be renewed (migration 0193).

## Deliverables
- Change record docs/changes/CAL-FEED-REVIEW-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
