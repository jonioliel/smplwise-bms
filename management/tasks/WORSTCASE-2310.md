# WORSTCASE-2310 — Worst-case data on the main screens: long names, empty states, huge counts, no scrolling

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
- **R-WORSTCASE-2310-1 / AT-WORSTCASE-2310-1:** Screens with extreme data stay in their cards: long area and cover names end in an ellipsis and keep their kind visible, five-digit counts widen their own row, temperatures and stale times give way last with the full value in a tooltip, the large weather widget shrinks its temperature to fit, the side rail active marker no longer counts as overflow.

## Deliverables
- Code and tests in git history of pilot/WORSTCASE-2310

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
