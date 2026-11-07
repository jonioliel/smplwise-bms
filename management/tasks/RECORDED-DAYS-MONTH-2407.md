# RECORDED-DAYS-MONTH-2407 — Recordings: month view of the days with recordings (legacy monthly calendar parity)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** SC12

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
- **R-RECORDED-DAYS-MONTH-2407-1 / AT-RECORDED-DAYS-MONTH-2407-1:** The playback screen offers a month view beside the date field: the days of a local month (installation IANA zone) with any recording of the camera are marked, future days are disabled, a tapped day opens that day; Hebrew, RTL, no scrolling inside the card, phone bottom sheet. Backend GET /api/v1/cameras/{id}/recordings/days?month=YYYY-MM is read-only on the recorder (Hikvision dailyDistribution, fallback derived from the bounded recording search with honest partial coverage; Provision-ISR SearchRecordDate), uses the camera's own recorder (multi-NVR), is cached (60 s current month, 1 h past) and bounded, and never asks the device for a future month.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
