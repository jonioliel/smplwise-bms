# Schedules: more actions (scripts, alarm scripts, every capability the integration really offers)

Owner request 2026-10-04: "In schedules (תזמונים) add support for scheduling alarm scripts and any component the integration actually
supports." Follow-up the same day: a system administrator must be able to acknowledge ("אשר כתקין") a sensitive schedule created outside
Arx and the "content not fully displayed" warning, bound to the schedule's content. Branch `pilot/schedules-more-actions`. The contract
delta is `docs/architecture/SCHEDULER_API.md` §14; the screen design stays `docs/design/schedules-parity.md` (rows 33-36).

## What changed for the person

| Before | After |
|---|---|
| A schedule that runs a script showed "סקריפט, ללא התקן" and the banner "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי" | The script is shown by its friendly name and area ("הפעלת סקריפט · שגרת בוקר"), editable, runnable now; its variables are fields in the slot panel |
| Only lights, switches, covers, climate, fans, alarm panels, locks and door-layer items | Plus scripts, scenes, helpers (input_boolean / input_number / input_select), humidifiers, vacuums, cover tilt, climate swing and humidity |
| The action list of a device was the class's full list | Only what that entity reports it can do (feature bits / attributes); a value is offered only inside the entity's own range and options |
| Disarming could be scheduled (with the lowering confirmation) | Still schedulable with the explicit confirmation ("נטרול אזעקה בתזמונים: מותר (ניתן להגביל)"); a system administrator may restrict it; a disarm that needs a code is never schedulable (owner decision 1, 2026-10-04) |
| - | A script that disarms / unlocks / opens a door is schedulable only once a system administrator marks it "מותר בתזמונים" (bound to its content; owner decision 2) |
| - | Sirens, media players (multimedia rules), `number` / `select` values (owner decision 3) |
| An action whose device disappeared made the schedule read-only ("original platform") | The schedule stays editable (to fix it); the card shows "פעולה לא תקפה", "run now" is refused with the reason, a fired run is recorded at once as not confirmed and the administrators are told |
| The review chips could only be removed by changing the schedule | A system administrator marks "אשר כתקין" (the chip becomes a muted "אושר", with "בטל אישור"); it comes back by itself when the content changes |

## Decisions taken (and why)

1. **One written form for scripts.** Arx writes `script.turn_on` + `entity_id` + `variables` (the bridge can check the domain and the
   entity like every other action). The platform card's form (`script.<object_id>` without an entity) is read as the same action and
   rewritten in the canonical form only when the slot is saved through Arx; nothing changes in the platform until then.
2. **Capabilities are discovered, never invented.** A service added in this change needs positive evidence (the feature bit or an
   attribute that proves it). The original services keep the old behaviour on an entity that reports no bits at all (the mirror stores 0
   when the platform reports nothing), so nothing that worked yesterday is refused today; when bits ARE reported, a missing bit refuses
   (e.g. a gate that reports open / close only no longer offers "stop" and "position").
3. **The whitelist stays explicit.** Every new service is in the add-on's allow-list, the bridge's `ACTION_ARGS` (0.6.1) and the execute
   allow-list it must stay inside; `tests/test_schedules_more_actions.py::EXPECTED_SERVICES` fails when one is added or removed without
   being listed. Not added (on purpose): notifications, `automation.*`, anything with free-form data. (Sirens, media players and `number` /
   `select` were left out at first; the owner's decision 3 added them on `pilot/schedules-followup`, SCHEDULER_API.md §15.3.)
4. **Scripts are judged like running them by hand.** The rights are automations' run rules (script.run at every device the script drives,
   control there, the same grant manual control needs for each sensitive step), so an alarm script that disarms needs `alarm.disarm` at
   that panel and the remote channel refuses it where it refuses manual disarming. A script whose content Arx cannot read (the automations
   mirror has no config for it) is treated as sensitive and needs the script permission installation-wide.
5. **Run-time revalidation is honest about what it can do.** The platform runs a schedule at its time, whatever Arx thinks; Arx cannot
   veto that run. What Arx does: refuses "run now" on an invalid action, records a fired run of an invalid action at once as not
   confirmed (with the reason) and audits / signals it, and shows the problem on the card, the drawer and the review list.
6. **The acknowledgement lives in the settings table** (`schedules.acks`, bound to the schedule's revision) - no migration was needed, so
   0059 was not used. Any content change brings the warning back (also a change made through Arx: the person who edits a sensitive
   schedule becomes its owner of record anyway, which clears `no_owner_sensitive`).
7. **Setting name.** The coordinator's brief said `scheduler.allow_disarm`; the setting is `schedules.allow_disarm` to sit with every other
   schedules setting (`schedules.enabled`, `schedules.classes` ...).

## Owner decisions taken (2026-10-04; built on `pilot/schedules-followup`, contract SCHEDULER_API.md §15)

1. Direct disarm in schedules: **(ג) allowed as before, with explicit confirmation only.** `schedules.allow_disarm` now defaults to allowed; the
   setting stays so a system administrator can restrict it (audited; lifting the restriction asks for the typed word). The disarm grant at the panel,
   the sensitive permission, the editor's confirmation, the remote channel's refusal, no code ever stored and "a disarm that needs a code is never
   schedulable" all stay. Card text: "נטרול אזעקה בתזמונים: מותר (ניתן להגביל)". No stored value is migrated or overwritten.
2. A script that disarms or unlocks (alarm scripts included): **(ב) only when a system administrator marks that script "מותר בתזמונים".** Per script,
   system administrators only, audited with who / when, bound to the script's content hash (a changed script loses the mark by itself, like
   "אשר כתקין"); enforced on create / edit / copy / split / restore and at "run now"; the picker lists an unmarked script disabled with the reason; the
   settings page has the list "סקריפטים שמנטרלים או פותחים". Built choice (recorded): a script whose content Arx cannot read needs the mark too (it might
   disarm); its mark cannot lapse on a change Arx cannot see.
3. Sirens and media players: **"add everything".** Sirens as a sensitive class (the device's own tones / duration / volume bits only), media players
   under the multimedia rules (approved and visible devices only, what the player reports, the multimedia permissions at its anchor, the volume
   ceiling, hidden sources never offered), and `number` / `select` values from the entity's own range and options (configuration entities never).
4. The acknowledgement after an edit made in Arx: **keep (א)** - any content change brings the warning back.

## Not built (and why)

- Script variables of kinds the schedules do not model (entity / area / device pickers, templates): such a variable is not offered; a
  required one makes the script unschedulable with the reason.
- Live verification: everything ran against the fake scheduler and the fake bridge; nothing touched a real system or a real alarm.
