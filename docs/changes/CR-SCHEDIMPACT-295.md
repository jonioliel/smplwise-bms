# SCHEDIMPACT-295 - an Arx-only person's schedules go through the run fences (Fable review 4, finding V-02)

Status: built on `pilot/SCHEDIMPACT-295` (cut from `origin/main` @ dd67a56f0), not merged, not released. Source finding:
`private/planning/FABLE_REVIEW_4_2026-10-21.md` question 17 / V-02 (medium, pre-existing since 2.6.4). Task card: SCHEDIMPACT-295 (opened on
`pilot/EXTID-295`; this branch does not repeat the card - see "Integration" below).

## 1. The finding

The `schedules` feature of the service identity is a basic-mode feature: the bridge item it is judged by is the schedule op (`add`, `edit`,
`copy`, `run`, `enable`, ...), never the actions inside the schedule. A local (Arx-only) person holding `schedule.manage` could therefore
schedule `script.turn_on` / `scene.turn_on` of any script the schedule view classes as "ordinary" (one that switches a relay or a template
switch) - and the Scheduler component then runs it - under the service user, with neither the runnable allowlist nor the bridge's impact
check: the reach the extended-mode run fences were built to bound. The bridge's schedule handler checked only the service user's entity
policy for the payload's entities; `schedule_ops.mark_script` is required only for scripts that disarm / unlock / are not understood.

Found while fixing it (same class, same fix): the never-list pairs other than scripts / scenes - `lock.unlock`, `lock.open`,
`alarm_arm_custom_bypass` - were reachable the same way (a local person may not call them directly in the basic mode, but could schedule
them when they also held the sensitive schedule permission).

## 2. The rule (both sides, independently)

For a LOCAL principal only - a Home Assistant user's schedules, and `mark_script`, are unchanged - every action of the content an op makes run
is judged:

| Content judged | Add-on (`services/schedule_identity.py`, called from `schedule_ops`) | Bridge (`schedule_fence.py`, from `schedule_service`) |
|---|---|---|
| create / split / restore (`add`) | the draft | the payload's validated actions |
| update (`edit` with slots) | the draft | the payload's validated actions |
| `edit` keeping the slots (dates / days only) | - (the add-on sends it only from a split follow-up, judged at the split) | the CURRENT content (switch attributes) |
| copy | the copied content | the CURRENT content |
| enable (of a disabled schedule), run now | the CURRENT content (whole schedule) | the CURRENT content |
| disable, delete / remove, purge | not judged (they stop things) | not judged |

1. An action whose (domain, service) pair is on the never-list of the current mode (`service_identity.never_list`) is refused
   `service_identity_refused`. In the basic mode - the only mode a build without the go-live permit can run - this refuses every script,
   scene, door unlock / open and arming with the bypass set in a local person's schedule.
2. An action that runs a script / scene / automation (by its service domain or its entity's domain) must be `script.turn_on` + `script.<id>`
   or `scene.turn_on` + `scene.<id>` (on the bridge's attribute path, `script.<object id>` as a service is judged as that script). An
   automation, `script.turn_off` / `toggle`, a service of another domain aimed at a script, a malformed or templated service: refused.
3. Extended mode: each such item must be on the add-on's runnable allowlist (403 `service_identity_not_runnable`); the add-on sends it only
   when the bridge reported its extended copy on (503 `service_identity_extended_bridge_off`), lists the item in its copy of the allowlist
   (503 `service_identity_runnable_bridge_missing`) and announced the schedule fences in its signed directory push (`schedule_fences: true`;
   else 503 `service_identity_schedule_bridge_outdated`). The bridge applies its own allowlist (`service_identity_not_runnable`) and
   `runnable.impact_refusal` (every step, one nested level, the closed step list, covers, the service user's entity policy) - the same
   function the direct run uses, so the V-01 rule (pilot/EXTID-295) applies to schedules as soon as both branches are merged.
4. Fail closed: switch attributes the bridge cannot read in the documented V-LIVE shape (`entities` + `actions`) answer
   `schedule_content_unverifiable`; an exception inside the fence is the same refusal; the impact check's own failures are `impact_unknown_item`.

Audit: every add-on refusal is an `identity.service_identity.refused` row (feature `schedules`, the op, a reason among
`schedule_never_local`, `schedule_run_shape`, `schedule_action_unknown`, `not_runnable`, `bridge_extended_off`, `bridge_runnable_missing`,
`bridge_without_schedule_fences`) plus the route's own `schedule.*` denied row; an allowed extended run item writes
`identity.service_identity.extended` with `entity_ids`. Bridge answers carry the closed code only (`schedule_fence.REFUSAL_CODES`).

New state: `bridge.schedule_fences` (the bridge's last report) - runtime state, in `backup.SETTINGS_KEEP` (an archive's "true" never stands
in for the live report).

## 3. Known limits (recorded, not hidden)

- On the bridge's existing-content path the switch attributes list every action ENTITY but only the first action SERVICE of each slot, so the
  bridge cannot tell `lock.lock` from `lock.unlock` in a later action of an existing schedule; the add-on (which reads the full content) refuses
  it, and every script / scene / automation entity is caught by the bridge whatever its position.
- The basic-mode refusal of doors and bypass arming in schedules is new behaviour for local persons who hold the sensitive schedule permission
  (owner decision, section 6 question 1).
- Bridge version: the bridge changed but this branch does NOT bump it (pilot/EXTID-295 takes 0.9.6 and edits the same version pins in about
  twelve test files). The add-on gates on the `schedule_fences` capability, not on a version, so an installation running a bridge without the
  fences simply refuses script / scene schedules of local persons (fail closed). At integration the bridge takes the next version (0.9.7 after
  EXTID-295's 0.9.6) and one Home Assistant restart.
- The CR-USR2 13.6 default-policy refusal (EXTID-295, `service_identity_policy_default` in `screen()`) applies to extended-only ITEMS; a
  schedule's item is its op, a basic item, so that refusal does not reach a scheduled script. After the merge the fence should also refuse
  while the service user's policy is the default one (a one-line follow-up in `schedule_fence.schedule_refusal` and
  `schedule_identity.check`; not done here because the function lives only on pilot/EXTID-295).
- The schedule editor still offers scripts / scenes to a local person; the server refuses them. Hiding them in the UI is a follow-up.

## 4. Tests (fakes only)

- `smplwise_vms/backend/tests/test_schedimpact_295_bridge.py` (28): basic mode refuses script / scene / door / bypass in `add` and `edit`,
  and `enable` / `run` / `copy` / days-only `edit` of an existing script schedule; unreadable attributes; extended mode: unlisted item,
  a listed script reaching a door, a nested unlisted script, an unlocking scene, the V-01 crafted step (`impact_step_unknown` with the V-01 fix,
  `impact_target_unresolved` without it - refused either way), the service user's entity policy, unjudgeable shapes (automation,
  `script.turn_off`, templates), a script named as its own service, a fence that cannot judge; unchanged: stopping ops, plain schedules,
  Home Assistant users; the closed code list; the handler wiring and the directory push key (structural); both bridge copies byte-identical.
- `smplwise_vms/backend/tests/test_schedimpact_295_addon.py` (17): basic mode via the API (create of a relay script, a plain script, a scene -
  403, audited, nothing sent; enable / run / copy / update of a Home Assistant user's script schedule - 403); doors / bypass refused by the
  check; extended mode (permit patched for the test): add-on allowlist, bridge list, bridge extended copy, fences capability, and the
  allowed case sent on behalf with its audit row; shapes; the directory push; the backup key; every write op calls the check.

## 5. Integration

- Merge after `pilot/EXTID-295` (owner decision 6 of 2026-10-21: the fix after the extended-identity permit). Expected conflicts: none in code
  (new modules; `__init__.py` touches only the schedule handler, one import line and one key on the first line of the directory push dict);
  `test_bridge_*` version pins only if the bridge version is bumped at integration (section 3).
- Then: bump the bridge to the next version in `const.py`, `manifest.json`, `www/smplwise-card.js` and the version pins; set the SCHEDIMPACT-295
  card (management/tasks.json, exists on pilot/EXTID-295) to its new status with this branch's evidence; add the release-notes lines below.

Release notes (bilingual, for the release that ships it):
- **English:** Arx-only users' schedules now go through the same fences as a direct run: in the basic mode a script, scene, door unlock or
  arming with bypass cannot be scheduled, copied, enabled or run by an Arx-only user; in the extended mode only items on both runnable
  allowlists that pass the bridge's impact check (bridge with schedule fences required). Home Assistant users' schedules are unchanged.
- **עברית:** התזמונים של משתמשי Arx עוברים עכשיו את אותן גדרות כמו הרצה ישירה: במצב הבסיסי משתמש Arx אינו יכול לתזמן, להעתיק, להפעיל או
  להריץ סקריפט, סצנה, פתיחת מנעול או דריכה עם עקיפה; במצב המורחב - רק פריטים שבשתי רשימות ההרצה ועוברים את בדיקת ההשפעות ברכיב החיבור
  (נדרש רכיב חיבור עם גדרות התזמונים). תזמונים של משתמשי תשתית המערכת לא השתנו.

## 6. For the owner (decisions, numbered)

1. Doors / bypass arming in an Arx-only person's schedule in the basic mode: (a) refused, as built (consistent with the never-list);
   (b) allowed as before (remove one rule; scripts / scenes stay fenced).
2. The binding text: `docs/security/HA_IDENTITY_RBAC_HE.md` 1.2 (on pilot/EXTID-295) section 4 item 7 names V-02 a medium residual risk with
   this ticket. Once merged, the document owner replaces it with: "תזמונים: משתמש Arx מתזמן סקריפט / סצנה רק במצב המורחב, רק מפריט שבשתי
   רשימות ההרצה ועובר את בדיקת ההשפעות ברכיב החיבור (גם בהעתקה, הפעלה והרצה); במצב הבסיסי - ולתמיד לפתיחת מנעול ודריכה עם עקיפה במצב
   הבסיסי - נדחה. (סקירה 4, V-02, נסגר ב-SCHEDIMPACT-295)". This branch does not edit the binding document.
