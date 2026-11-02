# ADDON-IMAGE-BUILD-FIXES-2311 — Add-on image build fixes in 2.31.1 and 2.33.3

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
- **R-ADDON-IMAGE-BUILD-FIXES-2311-1 / AT-ADDON-IMAGE-BUILD-FIXES-2311-1:** The add-on image builds the way the Supervisor builds it: 2.31.1 references the base image by its tag again (the 2.31.0 digest pin made the build fail with "pip: not found"), 2.33.3 fixes the broken Dockerfile line of 2.33.2.

## Deliverables
- Release commits fe36a8a30 and the 2.33.3 Dockerfile fix on release/2333-train

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
