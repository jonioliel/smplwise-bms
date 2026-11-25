# HOME-INTERFACE-NEXT-2490 — Home interface next phase: rest screen, night mode, takeover, scenes, favourites

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

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
- **R-HOME-INTERFACE-NEXT-2490-1 / AT-HOME-INTERFACE-NEXT-2490-1:** Home interface next phase: rest screen, night mode, takeover, scenes, favourites: the home interface gets a rest screen, night mode, the new-notice rule, tablet dimming, screen takeover, scene editing rights, favourites ordering and the post-scene suggestion as decided.

## Deliverables
- change note docs/changes/HOME-INTERFACE-NEXT-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
