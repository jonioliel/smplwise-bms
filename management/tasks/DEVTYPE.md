# DEVTYPE — Manual device type from Settings (switch/outlet/light/boiler/tap) and 2FA note removal

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R274 / AT290:** Manual device type from Settings (switch/outlet/light/boiler/tap) and 2FA note removal: merged into 2.4.4 and the tier-L release gate of 2.4.4 passes with no red result.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/DEVTYPE-settings)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
