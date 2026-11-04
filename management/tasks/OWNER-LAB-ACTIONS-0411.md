# OWNER-LAB-ACTIONS-0411 — Owner lab actions after 04.11

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BLOCKED

**Owner role:** release | **Hardware:** False

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
- **R-OWNER-LAB-ACTIONS-0411-1 / AT-OWNER-LAB-ACTIONS-0411-1:** The owner's open lab steps are done and recorded: full backup, 2.40.0 then 2.40.1 installed (one home-system restart for bridge 0.10.4), the video test plan, the two panoramic cameras' sub stream, the door contact check, station users and groups, the WisKey addendum forwarded, the next joint session date.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Owner actions on the lab installation and devices (Arx has no write permission for them).
