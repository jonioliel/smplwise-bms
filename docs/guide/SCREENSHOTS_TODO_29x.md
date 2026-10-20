# Screenshots still to take for the 2.9.3 guide chapters (pilot/GUIDE-29X-295)

Not a guide page. Every row matches a `[צילום חסר S29X-NN]` marker in a Hebrew chapter under `docs/user-guide/he/`. The older `[צילום חסר S293-NN]` markers
(2.9.0 - 2.9.2: tickets, elevators, temperature phase 1-2, external access, privacy) are listed in `docs/user-guide/he/SCREENSHOT_PLAN_293.md`; they are still open too.

No screenshot was taken for this task (the runner was busy, gates pending). Capture later, on a **test installation with demo data** (fake sensors, fake door system, fake
messaging account), never on the owner's live system.

## Rules (from `docs/user-guide/he/README_HE.md`)

- Redact addresses, host names and ids; replace people and site names with the generic ones ("דייר 1", "האתר", "בניין א", "קומה 0", "אזור 1"). No lab IPs, serials, MACs or secrets.
- Mark demo shots with the caption "צילום מהדגמה". Never name Home Assistant / HA / Ingress / Companion in a caption outside the settings chapters.
- Default viewports: desktop 1440 and phone 390; light theme unless a row says dark. Save under `docs/user-guide/he/img/` as `<id>-<state>[-phone][-dark].png`, replace the marker with
  `![...](img/....png)` plus the caption line, add the entry to `screens.json`, then regenerate `GUIDE_ALL_HE.html` with `scripts/build_guide.py`.
- Hebrew UI only; Arabic and Russian are not captured (they need a native review first).
- Roles: SA = system_admin, SiteA = site_admin, Op = operator, V = viewer.

## Checklist

| ID | Chapter | Route / screen | State to prepare | Role | Viewports / themes |
|---|---|---|---|---|---|
| S29X-01 | 48 | `#/infra/temperature` | demo units across two areas and two floors; one unit with an early-warning chip, one "in maintenance", one escalated, one with an open service request, one sensor with a weak battery; KPI "בעיות חיישן" > 0; an area header collapsed | Op | 1440 light; 390 light |
| S29X-02 | 48 | unit detail drawer | health panel, door insight (recovery median), duty-cycle bars (needs a demo power sensor), comparison with two other units | Op | 1440 light; 390 light |
| S29X-03 | 48 | "תחזוקה" dialog + the "בתחזוקה עד ..." chip | reason filled, 60 minutes | Op | 1440 light |
| S29X-04 | 48 | "פתיחת קריאת שירות" dialog from a unit | a department chosen, chart attachment ticked, then the same on a phone (no horizontal overflow) | Op | 1440 light; 390 light |
| S29X-05 | 48 | report dialog, "סוג הדוח" = HACCP | previous month selected, live preview visible | SiteA | 1440 light |
| S29X-06 | 48 | Settings > Infrastructure > Temperatures | the new groups (prediction, sensor health and cooling alerts, maintenance and escalation, card grouping, widget) and the escalation chain editor | SA | 1440 light |
| S29X-07 | 48 | home screen with the temperature widget | combined card, and a card per unit | Op | 1440 light |
| S29X-08 | 49 | `#/wiskey/external`, "בקשת גישה" dialog | empty form | SA | 1440 light + dark; 390 light |
| S29X-09 | 49 | same dialog | new person, three doors, dates and hour windows, the right column "מסלול אישור" with the message preview and the notice tick | SA | 1440 light |
| S29X-10 | 49 | same dialog | requester with request-only rights: "עמדות ללא הרשאה (N)" expanded, "אני מאשר עכשיו" blocked with its reason | Op with `tickets.manage` + `tickets.external` | 1440 light |
| S29X-11 | 49 | `#/wiskey/external?drift=1` | the drift side panel plus the dialog with three kinds (name, scope, missing) and the buttons; **only when `pilot/GRANTSMIN-295` is merged** | SA | 1440 light + dark; 390 light |
| S29X-12 | 49 | external-access toolbar | "ייצוא CSV" button, the "הקובץ ירד (N שורות)" toast, and the "אפשר לייצא פעם בדקה." message; **only when `pilot/GRANTSMIN-295` is merged** | SA | 1440 light |
| S29X-13 | 44 | home screen with the generator widget | four states: on mains (standby), running (on generator), fault, two generators | Op | 1440 light + dark; 390 light |
| S29X-14 | 44 | home screen edit mode; personal home settings | the generator row (on, size, label); a user with `screen.personalize` choosing on / size | SA; user | 1440 light |
| S29X-15 | 44 | `#/infra/elevators` | three cards: waiting (doors open), in operation (doors closed), and one with a linked door sensor reporting "open" during operation | Op | 1440 light |
| S29X-16 | 80 | Settings > General > Tabs | the new cards for multimedia, infrastructure (+ generator and electricity page rows) and service requests, beside the existing ones | SA | 1440 light; 390 light |
| S29X-17 | 80 | infrastructure tab row and generator page row | before and after reordering (generator before temperatures; generator pages reordered) | SA | 1440 light |
| S29X-18 | 46 | Settings > service management > permissions | the `tickets.directory` row and the `tickets_directory` role in "who may do what"; **only when `pilot/SMALL-294` is merged** | SA | 1440 light |
| S29X-19 | 46 | Settings > service management > display | the "מצלמה חיה בתמונות" row off and on; **only when `pilot/CAMVF-295` is merged** (reuse candidates: its `docs/design/evidence/camera-viewfinder/settings-off-*.png`) | SA | 1440 light; 390 light |
| S29X-20 | 46 | request drawer > photos | the two tiles, live preview, review state, and the "no camera permission" line; Chromium with a fake media device; **only when `pilot/CAMVF-295` is merged** (reuse candidates: `on-tiles-*`, `live-*`, `review-*`, `denied-*` in the same folder) | Op | 1440 light; 390 light |
| S29X-21 | 85 | Settings > Infrastructure > Temperatures > alert routing | the "תקינות חיישן ויחידה" row and the escalation chain editor | SA | 1440 light |

## Existing evidence that may be reused as "demo" shots after a redaction review

These were produced on the runner against mocked backends (no real devices) by the feature branches; check each against the redaction rules before copying into `img/`:
`docs/design/evidence/` folders of temperature phase 3 (grouped grid, detail panels, maintenance, comparison, ticket dialog, HACCP report), the generator home widget
(mains light/dark, running, fault, two, none), tabset-293 (editor and rows), accessreq-293 (request dialog), grantsmin-295 (drift and CSV) and camera-viewfinder.
Re-capture instead of reusing when the final UI differs.

## Not capturable

- Anything that needs a real door system, real WhatsApp delivery, a real generator controller, a real elevator or a real refrigeration sensor: keep these chapters marked as demo.
- Real devices for the live camera (Android, iOS, phone app): not captured and not verified.
