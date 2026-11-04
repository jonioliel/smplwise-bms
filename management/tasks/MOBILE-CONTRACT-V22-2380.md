# MOBILE-CONTRACT-V22-2380 — Mobile M2: presence contract v2.2 (sensor shapes, intervals defaults, key-rotation proof)

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
- **R-MOBILE-CONTRACT-V22-2380-1 / AT-MOBILE-CONTRACT-V22-2380-1:** docs/api/mobile-presence-contract.md reaches v2.2 and the server validates it: sensor value shapes (MOBILE214 proposal), battery-unknown, confidence / proximity, intervals_s defaults, location_auth values and the K-5 key-rotation proof (K-6 / K-7 attestation stay deferred), with tests.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
