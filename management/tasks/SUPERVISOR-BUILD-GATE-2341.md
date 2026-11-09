# SUPERVISOR-BUILD-GATE-2341 — Release gate proves the add-on image builds the way the Supervisor builds it

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
- **R-SUPERVISOR-BUILD-GATE-2341-1 / AT-SUPERVISOR-BUILD-GATE-2341-1:** Release checks validate the add-on build files (base image by tag, Dockerfile syntax, arch and labels), so a broken build like 2.31.0 or 2.33.2 is caught before release.

## Deliverables
- Change record docs/changes/SUPERVISOR-BUILD-GATE-2341.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
