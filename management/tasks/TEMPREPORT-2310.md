# TEMPREPORT-2310 — Temperature report: security review and hardening of the report link and WhatsApp send

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
- **R-TEMPREPORT-2310-1 / AT-TEMPREPORT-2310-1:** Temperature report links: separate switches for system users and for names in shared PDFs (off by default), revocation when a WhatsApp number changes, no caching of the link answer.

## Deliverables
- Code and tests in git history of pilot/TEMPREPORT-2310

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
