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
| Disarming could be scheduled (with the lowering confirmation) | Not schedulable unless a system administrator allows it in הגדרות › תזמונים with the typed word "אפשר נטרול"; a disarm that needs a code is never schedulable |
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
   being listed. Not added (on purpose): sirens, media players (the multimedia screens own them), `number` / `select` (often device
   configuration), notifications, `automation.*`, anything with free-form data.
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

## Owner decisions pending (recorded, not guessed)

1. Direct disarm in schedules - the built default is (א):
   - (א) Off by default; a system administrator may switch it on with the typed word; audited (built).
   - (ב) Never schedulable, no setting at all.
   - (ג) Allowed like before, with the lowering confirmation only.
2. A script that disarms (or unlocks) - the built default is (א):
   - (א) An ordinary script: allowed with the same rights as running it by hand, the lowering confirmation and the sensitive permission (built).
   - (ב) Allowed only when a system administrator marks that script "מותר בתזמונים" (not built; about half a day).
   - (ג) Follows the disarm setting of question 1.
3. Sirens and media players as schedule actions:
   - (א) Leave them out (current).
   - (ב) Add sirens as a sensitive class.
   - (ג) Add media players through the multimedia rules.
4. The acknowledgement after an edit made in Arx:
   - (א) Any content change brings the warning back (built).
   - (ב) An edit made in Arx keeps the acknowledgement; only a change outside Arx brings it back.

## Not built (and why)

- An administrator's per-script "allowed in schedules" mark: an owner question (2 above), not guessed.
- `number` / `select` / `siren` / `media_player` actions: see decision 3.
- Script variables of kinds the schedules do not model (entity / area / device pickers, templates): such a variable is not offered; a
  required one makes the script unschedulable with the reason.
- Live verification: everything ran against the fake scheduler and the fake bridge; nothing touched a real system or a real alarm.
