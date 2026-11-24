# DOOR-WINDOW-TERM-2510 - "door window" in the role, permission and notification English

Target 2.51. Follow-up of DOOR-BLOCKS-I18N-2510, open question 1: the English word for "חלון פתיחה" is "door window"
(the frontend's feature name, `default_names.door_window`, the door preview). DOOR-BLOCKS-I18N-2510 left "opening window"
in three backend catalogues outside its screens; this change finishes the term. English only: every Hebrew text is
byte-identical (the diff touches the English half of each tuple only; a script compared every Hebrew literal of the three files with the base: identical), no key, setting, migration, wire model or API
shape changes, no look change.

## What changed

* `smplwise_vms/backend/smplwise/rbac_text.py` (role names):
  * `role.door_windows_manager` "Manage opening windows" -> "Manage door windows"
  * `role.door_windows_guard` "Stop an opening window" -> "Stop a door window"
* `smplwise_vms/backend/smplwise/services/rbac_admin_text.py` (permission descriptions):
  * `perm.access.windows.manage` "Access control: manage door opening windows (scheduled opening hours)" ->
    "Access control: manage door windows (scheduled opening hours)" ("opening hours" stays: it is the hours, not the window)
  * `perm.access.windows.cancel` "Access control: stop an active opening window and confirm ..." ->
    "Access control: stop an active door window and confirm ..."
* `smplwise_vms/backend/smplwise/services/notify_policy_text.py` (notification event names):
  * `notify.label.door.relock_unconfirmed` "Door window: return to normal not confirmed"
  * `notify.label.door.window_not_started` "Door window did not start"
  * `notify.label.door.window_overridden` "Door window stopped manually"
  * `notify.label.door.windows.simulated` "Door window by event (demo mode)"
* `smplwise_vms/backend/tests/test_wiskey_door_overrides.py`
  (`test_door_blocks_i18n_2510_every_text_has_a_key_and_no_hebrew_literal_is_left`): pins the eight texts (Hebrew and
  English) and asserts that no English text in the whole backend catalogue says "opening window".

Checked and left alone:
* `frontend/src/i18n/lang/en/**`: no "opening window" left (DOOR-BLOCKS-I18N-2510 already changed `msg/system-a.ts`);
  the frontend does not translate these role / permission / event names itself (they come from the backend catalogue).
* `smplwise_vms/www/assets/*.js`: built bundle, regenerated at release.
* `smplwise_vms/integration/hikvision_intercom/frontend/panel.js`: the separate intercom integration's own sentence
  ("throughout the opening window"), not this product's catalogue.
* `docs/` (CR-039 and the user guides): Hebrew, or historical English; not changed.

## Tests

Run on the PC, one file at a time, with the repository venv:

* `tests/test_wiskey_door_overrides.py` (24 tests, incl. the extended pin): PASS (pytest exit 0)
* `tests/test_i18n_backend_2490.py`: PASS (exit 0)
* `tests/test_i18n_backend_2490b.py`: PASS (exit 0)
* `tests/test_i18n_backend_2490c.py`: PASS (exit 0)
* `tests/test_doorwin2_roles.py`: PASS (exit 0)
* `ruff check` (the gate's F rules) on the three changed `smplwise/` files: PASS. The test file has two F findings (lines 527, 562) that exist unchanged at the base a1c39fd04; the gate lints `smplwise/` only

No frontend file changed, so no tsc / runner job (NOT_RUN, not needed). Full backend suite and Playwright: NOT_RUN
(the release gate covers them).
