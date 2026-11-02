# APP-TEAM-R11-2380 — Mobile M1: app-team R11 package (documents only)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BACKLOG

**Owner role:** docs | **Hardware:** False

**Dependencies:** T103

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
- **R-APP-TEAM-R11-2380-1 / AT-APP-TEAM-R11-2380-1:** One consolidated R11 package goes to the app teams (Hebrew prompt, attachments list, a BUILT / NOT_RUN / BLOCKED table per open item), and the untracked mobile handoff documents (iOS and Android addenda, employee notice draft, brand folder) are committed after a secrets read; the owner sends it.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
