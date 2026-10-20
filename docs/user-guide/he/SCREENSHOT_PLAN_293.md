# Screenshot plan for the 2.9.x guide chapters (pilot/GUIDE-293)

Not a guide page (the file name does not end in `_HE.md`, so `scripts/build_guide.py` ignores it). Every row matches a `[צילום חסר ...]` marker in a chapter.
Capture AFTER 2.9.2 is released, on a test installation with demo data (fake sensors, fake door system, fake WhatsApp). Rules from `README_HE.md` apply:
redact addresses, host names and ids; replace people and site names with the generic ones; mark demo shots with the "צילום מהדגמה" caption. Default
viewports: desktop 1440 and phone 390; light theme unless stated. Save under `img/` as `<id>-<state>[-phone][-dark].png` and replace the marker with
`![...](img/....png)` plus the caption line.

Roles: SA = system_admin, SiteA = site_admin, Op = operator, V = viewer, DM = tickets department manager (`tickets.manage`), AM = manager of all departments,
CV = viewer of a request without `tickets.costs.view`.

| ID | Chapter | Screen / route | State to prepare | Role | Viewports / themes |
|---|---|---|---|---|---|
| S293-01 | 46 | Tickets › overview `#/tickets/overview` | all cards with data (handled per handler, opened vs closed 14 d, waiting for my approval, RFQ by stage, department comparison) | AM | 1440 light; 390 light (handler table form) |
| S293-02 | 46 | overview, "Payments" card | rows in all three groups (late, next two weeks, approved demand), "show all" | DM with cost permission | 1440 light |
| S293-03 | 46 | overview, same card | manager without the cost permission (counts only, no amounts) | DM without costs | 1440 light |
| S293-04 | 46 | Settings › notifications (the three new manager alerts, off) + Settings › service management › display › manager overview (hour, threshold) | default state | SA | 1440 light |
| S293-05 | 46 | request edit dialog, location picker open; timeline row "location changed from ... to ..." | a request with a changed location | DM | 1440 light |
| S293-06 | 46 | table view toolbar with "monthly report" + the report dialog | dates and grouping chosen | DM | 1440 light |
| S293-07 | 46 | vendor page, note card with the "ask the manager" switch, before and after sending | vendor portal link of a demo RFQ work order | vendor (public page) | 390 light and dark |
| S293-08 | 46 | request drawer with the "waiting for the manager: question" warning line; the board card with the waiting reason | after a question | DM | 1440 light |
| S293-09 | 46 | vendor page thread with the dashed "System" bubble; the manager's thread dialog | an automatic reminder in the thread | vendor / DM | 390; 1440 |
| S293-10 | 46 | vendor area, manager side: technician-request card grouped by vendor company | at least two companies (needs the vendor-area flags ON in the test installation) | SA | 1440 light |
| S293-11 | 46 | Settings › service management › general, "Notifications by department and digest" | matrix on, three departments, all three cell values, one department's channel override | SA | 1440 light |
| S293-12 | 46 | notification center, a digest notification folded and opened | digest on, fake clock past the digest hour | DM | 1440; 390 |
| S293-13 | 46 | Settings › general, "Working hours" card | on; short Friday; holidays; one department "own hours" open | SA | 1440 light and dark |
| S293-14 | 46 | board SLA cell and overview overdue count with the calendar on | calendar on, requests across closing time | DM | 1440 light |
| S293-15 | 46 | Settings › service management › "Automatic opening" list | kill switch on, 2-3 rules, one with the "limit reached today" chip | SA | 1440 light |
| S293-16 | 46 | rule editor with the "test" (dry run) answer | a fake alert source active | SA | 1440; 390 |
| S293-17 | 46 | a request opened by a rule: author "System", system note with the alert data | after the rule fired | DM | 1440 light |
| S293-18 | 46 | work order › Costs tab › "Instalment payments" | approved award with a schedule; rows paid, awaiting payment, late, due soon; "mark paid" | DM with costs | 1440 light |
| S293-19 | 46 | confirmation dialog of "mark paid" | - | DM with costs | 1440 light |
| S293-20 | 46 | same tab for a viewer without the cost permission | dates and status only | CV | 1440 light |
| S293-21 | 46 | Settings › service management › locations › edit, "plan area (optional)" picker open | rooms on readable floors only | SA | 1440 light |
| S293-22 | 46 | request at a linked location with "show on map" and the map it opens; same request for a user who may not read that floor (no link) | linked room | DM / restricted user | 1440; 390 |
| S293-23 | 46 | RFQ detail and board card with "show on map" (2.9.2) | RFQ location linked to a room | DM | 1440 light |
| S293-E1 | 44 | Infrastructure › Elevators, 24 h history opened by long press, and the visible history button | - | V | 1440; 390 |
| S293-E2 | 44 | Elevators in page edit mode ("new elevator", "done", add card) vs normal view | - | SiteA | 1440 light |
| S293-E3 | 44 | elevator edit dialog with "show travelling when not on standby and without a fault" | option on | SA | 1440 light |
| S293-E4 | 44 | card in "Travelling" state + numbers row; the home widget with it | option on, fake sensors idle | V | 1440 light and dark |
| S293-E5 | 44 | history strip with an "unknown" gap after an add-on stop | simulated stop > 1 min | V | 1440 light |
| S293-T1 | 48 | Infrastructure › Temperatures, unit cards | units: ok, warning, alarm, offline; a climate unit with setpoint; a unit with the door open | Op | 1440 light and dark; 390 light |
| S293-T2 | 48 | unit detail: chart 24 h, band, door and defrost bands, statistics, alert log | - | Op | 1440; 390 |
| S293-T3 | 48 | mute menu and acknowledge | - | Op | 1440 light |
| S293-T4 | 48 | defrost: "learning" state; learned windows with confirm / reject | fake history with a repeating rise | SiteA | 1440 light |
| S293-T5 | 48 | add-unit wizard, source step (sensors list and climate list with live values) | - | SiteA | 1440 light; 390 |
| S293-T6 | 48 | wizard steps: band ("follow the setpoint"), door sensor, defrost mode, per-unit overrides | - | SiteA | 1440 light |
| S293-T7 | 48 | Settings › Infrastructure › Temperatures: defaults and alert routing | defaults | SA | 1440 light and dark |
| S293-T8 | 48 | Temperatures tab empty (manager sees add; viewer: tab absent) | no units | SiteA / V | 1440 light |
| S293-T9 | 48 | report dialog with the live paper preview, Hebrew and English | two units, 7 days | SiteA | 1440 light |
| S293-T10 | 48 | page of the generated PDF | real render in the installed image (not the fake renderer) | SiteA | page image |
| S293-T11 | 48 | WhatsApp dialog: recipients with "no confirmed number" warning, schedule, vendors disabled "coming soon" | fake WhatsApp | SiteA | 1440 light |
| S293-T12 | 48 | the text summary as received (only with a consenting test account) | - | - | phone |
| S293-X1 | 49 | External access, off state | feature off (the only reachable state while locked) | SA | 1440; 390 light |
| S293-X2 | 49 | list with grants in several states | fake door system, test installation only (feature cannot be on in a normal one) | SA | 1440 light and dark; 390 |
| S293-X3 | 49 | "revocations not yet proven" banner | one grant revoking | SA | 1440 light |
| S293-X4 | 49 | drawer, pending approval, ladder and proposed doors | - | SA | 1440; 390 |
| S293-X5 | 49 | "review and approve" dialog with the exact code message preview | - | SA | 1440 light |
| S293-X6 | 49 | drawer, "unknown" with known / unknown / what Arx does now | - | SA | 1440 light |
| S293-X7 | 49 | drawer, "revoking" (ladder) and the "person not found" variant | - | SA | 1440 light |
| S293-X8 | 49 | drawer, "active - change pending" and "widening requested" | - | SA | 1440 light |
| S293-X9 | 49 | "manual confirmation that the person does not exist" dialog | - | SA | 1440 light |
| S293-X10 | 49 | "This week in external access" card and the full digest | - | SA | 1440; 390 |
| S293-X11 | 49 | "External access rules" panel with the locked extended-identity row | - | SA | 1440 light and dark |
| S293-X12 | 49 | directory person card, "Identity in WisKey" (created by Arx; name gap with push-name button) | - | SA | 1440 light; 390 |
| S293-P1 | 86 | public-page settings card with the privacy contact and link fields (+ validation error) | - | SA | 1440 light; 390 |
| S293-P2 | 86 | vendor arrival page with notice n2 naming the organisation | test installation only (feature locked) | vendor | 390 light |
| S293-N1 | 85 | Settings › notifications: new manager rows and temperature rows | after 2.9.2 | SA | 1440 light |

Also after capture: add the new pages to `screens.json` if the capture scripts should regenerate them, run `python scripts/build_guide.py`, and re-check the
2.9.2 chapters (13, 48, parts of 46 and 44) against the final 2.9.2 release notes. Chapter 49 describes the unreleased `pilot/SHAREDID-293` branch; update it from its release notes when it ships.
