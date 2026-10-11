# SEC - the security screens polish (Design ADR) - 2026-10-10

Branch `pilot/SEC-screens-polish`, from `pilot/DU1-design-unification` (c151ae20, the unified token layer). The pass raises the
security area's screens - the alarm, the live tiles / wall / camera / saved views, the events centre, the notification centre with
its door confirmation, the recorder health cards and the recorders card, camera health - to one design level: hierarchy, clarity
under stress (what is armed, what is open, what needs attention), motion on state changes (reduced-motion safe), list and card
views, the mandatory states, Hebrew RTL, keyboard focus, phone / tablet / desktop, light and dark, the four skins.

Invariants kept: no behaviour, API or confirmation logic changed (the alarm keypad, the door release and its in-app confirmation
are what they were); the floors / areas grouping of the zones stays; clean operator screens (no new hint copy); no platform
branding; only `--sw-*` tokens (the lint `tests/unit-token-lint.spec.ts` passes, three files left its allow list); the skins
(`design/skins/*`) were not touched - every surface reads the glass tokens (`--sw-glass-sheen`, `--sw-glass-blur`,
`--sw-highlight`), so classic draws nothing new and Domus / Tesla / Bubble dress it without a rule.

## 1. Decisions

| Screen | Before | After |
|---|---|---|
| Alarm - state card | a tone bar; armed on a literal `#6d28d9`; no motion | one tone per state (bar, shield ring, a 4 % wash): disarmed = success, armed = accent, partial = purple, pending = warning, triggered = danger (filled shield, pulsing ring; still under reduced motion); a once-only *state-in* motion of the shield and the label when the panel's state changes; the sent-command line carries a status dot |
| Alarm - zones | a cards grid per area, one area per row; filter chips as dark pills; a text line for "nothing matches" | filter chips with counts (amber / red / purple badges), a **cards / list** switch (`sw.alarm.zones.view`, per browser), the areas packed side by side on a wide screen, open / fault / bypassed cards with a tone wash and a tinted icon square, a dense list row per zone with a logical tone bar at the start edge; the filtered-empty state is the shared panel with "הצג הכל" |
| Alarm - keypad | thumb `#fff`, flat keys | thumb / keys / inputs on tokens, hover and press feedback (scale under motion only), focus rings on every control, clear / back keys quieter than the digits |
| Camera tile | mouse-only; the live dot static; off tiles a grey box | a keyboard control (`tabindex`, `role=button`, Enter / Space), a focus ring, the hover lift token, a breathing live dot, a dashed ring on offline / forbidden / unknown tiles, HUD text on the on-video tokens |
| Live wall | no focus rings on the layout segments / kiosk | focus rings, hover washes, the footer links styled |
| Live overview | rows clickable with the mouse only | the recent events and site rows are keyboard links with hover / focus; the critical attention title in the danger text |
| Camera | HUD stamps in literal white; the quality chip's text on the on-video token | on-video tokens; the quality chip's text inverse (it sits on the accent); press / focus states on the round, zoom, joystick and transport controls |
| Saved views | `#1e293b` / `#cbd5e1` glyph colours | video-bg / on-video tokens; the camera chips' dots on tokens |
| Events centre | the ingest line in a literal brown on warning | a bordered status strip on the warning tokens; type dots with a soft ring; the phone KPI turns amber while events wait; focus / hover on the range segments and window rows; the demo thumbnail styled inline (it sits in the table's shadow root) |
| Notification centre | the `--nt-*` knobs declared iOS literals (`#ff9f0a`, `#d70015`, `#007aff`) in two scheme blocks | the knobs read the product's state tokens (`--sw-product-*`, never the bridged `--dv-*`, so no cycle): one amber, one red, one blue in every skin and scheme; the toast on the toast tokens; the snapshot frame on the video family; the empty state a ring + one line; focus rings on the sheet's controls; the door release button weightier with a hover edge; reduced motion stops the pop-in of the dialog and the toast |
| Recorder health | cards with a coloured border only; "טוען…" / a red line | a tone bar and a 5 % wash per card, the warning / error values coloured, dashed unknown dots, the shared loading / error panels (with retry) |
| Recorders card (Settings) | `var(--sw-text-secondary, #5b6573)` (a token that never existed) | a tone bar per recorder (online / error / pending restart / disabled), tokens, focus on the rename field |
| Camera health | an empty grey box for an offline camera | a glyph in the placeholder; state words on the `-text` tokens; the filter chips' dots on tokens |

## 2. Evidence

`docs/design/evidence/security-polish/before/` (the branch base c151ae20) and `.../after/` (this branch), by
`frontend/tests/evidence-security-polish.spec.ts`: `<screen>-<skin>-<scheme>-<width>.png` for alarm, alarm-list, alarm-keypad,
live, wall, camera, views, events, events-drawer, health, notify, notify-detail, notify-door (classic light + dark at 1440 and 390;
Domus / Tesla / Bubble light + dark at 1440 on alarm, wall, events, notify) and recorders (classic light + dark, a mocked backend).
Demo mode, fixed clock, `?design=a&look=performance:full`. The spec also checks: no horizontal overflow at 390, the keypad is
reachable from the keyboard and keeps focus inside, and nothing on the alarm screen loops under reduced motion.

## 3. Not done / next

- The hint copy of the alarm ("אפשר לסגור, או לעקוף חיישן לפני הדריכה.", the unpaired-controls note) and of the events centre
  (the ingest strip's explanation of inferred events) was left as it is: changing copy is outside a polish pass and several specs
  assert it. A follow-up can shorten it under the clean-operator-screens rule.
- The floor map's camera markers (`explore-floor-map.ts`, drawn on the plan canvas) were not touched: they belong to the map
  canvas layer (`map/`), which the lint allow-lists on purpose.
- WisKey (the entry centre) is its own area with its own embed; it was not part of this pass.
- The `--nt-*` knob names stay (the settings tab reads them); only their values moved to tokens. Folding the names away is the
  next step of DU1 §4.
