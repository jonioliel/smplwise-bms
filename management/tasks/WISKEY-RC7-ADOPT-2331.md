# WISKEY-RC7-ADOPT-2331 — WisKey Mac rc.7 adoption with auto-install policy B (the owner's switch)

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
- **R-WISKEY-RC7-ADOPT-2331-1 / AT-WISKEY-RC7-ADOPT-2331-1:** The Arx side of the WisKey rc.7 adoption is built on fakes: installer guards before any component write, the generation fence as a publication fence only, the relay map native adapter with post-approval sync behind the owner's switch, and (policy B) the owner's auto-install switch on the existing authorized writer with switch and Core runtime checks before the native writer; wiskey.auto_install stays OFF and no code path turns it on.

## Deliverables
- docs/changes/WISKEY-RC7-ADOPT-2331.md and the branch code and tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
