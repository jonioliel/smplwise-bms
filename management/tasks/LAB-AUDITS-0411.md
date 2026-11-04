# LAB-AUDITS-0411 — Read-only lab audits of 04.11: logs and faults, station and camera video, door events and station users

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** qa | **Hardware:** False

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
- **R-LAB-AUDITS-0411-1 / AT-LAB-AUDITS-0411-1:** Read-only audits of the lab (no write, service call, restart, door or talk action) record findings by severity with redacted evidence, and each finding has an owner (Arx fix, WisKey ask or owner action).

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
