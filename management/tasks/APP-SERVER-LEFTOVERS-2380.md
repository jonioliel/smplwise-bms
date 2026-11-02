# APP-SERVER-LEFTOVERS-2380 — Mobile M3: brand-logo API for the apps; quiet-window hold narrowed to phone and browser push

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-APP-SERVER-LEFTOVERS-2380-1 / AT-APP-SERVER-LEFTOVERS-2380-1:** A read-only, public-safe brand-logo API (/api/v1/brand/...) serves the apps, and the quiet-window hold applies to phone and browser push only; the employee notice text for the phone-side Wi-Fi match is handed to M1.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
