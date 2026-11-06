# WisKey activation ladder - joint session runbook (generic)

Card: WISKEY-ACTIVATION-RUNBOOK-0411 (WisKey integration plan T19). Written 2026-11-06 for 2.40.5 by V1-REMAINING-2406.

**Status: NOT_RUN.** This is the repository copy of the activation ladder: generic, with no lab address, serial number, station count,
backup path or version-specific "tomorrow" wording. The owner's session sheet for a dated joint session (Hebrew, with the lab's own
numbers) stays in the private handoff package and is written from this file. Nothing in this document was run against an installation.

Every screen name, setting key, status row, reason code and check named here is checked against the code by
`smplwise_vms/backend/tests/test_wiskey_activation_runbook.py` (the machine-readable block in section 13): a renamed key, label or
route fails that test, so the runbook cannot drift from the build silently.

## 1. Rules of the session

- The owner runs the session; every step that writes anything starts only after the step's approval wording is typed in the chat
  (for example `מאשר: שיוך דלתות`). A general approval, or an approval of "the whole ladder", is not enough.
- Each step builds on the one before and the session may stop after any step, without a reason.
- No door is opened, no window rule or programme is created, no emergency or door automation is switched on, and no talk or listen
  session is opened, unless the step says so AND a separate, explicit approval names the one station or door and a person stands there.
- No HA password or token is typed in the chat. Read-only checks use the owner's own long-lived token without printing it; browser
  clicks are the owner's.
- No secret, lab address, serial number or token goes into the chat or the record sheet.
- If the screen differs from what is written here, the screen decides; record the difference.

## 2. Before the ladder (gate: 2.1 - 2.4 ticked)

2.1 **Full HA backup** `[owner]` - approval `מאשר: גיבוי מלא של HA`. HA › Settings › System › Backups › create a full backup; store the
encryption key / emergency kit in the password manager; check the date, a plausible size, and that the Arx add-on is listed; download it.

2.2 **Arx backup** `[owner]` - approval `מאשר: גיבוי Arx`. Arx › הגדרות › גיבוי ושחזור › "צור גיבוי" with a backup password (12
characters or more, kept in the password manager); check the time, the size and the "מוצפן" mark; download it.

2.3 **Record the versions** `[together]`: the add-on version, the bridge version (pairing line "גשר Arx בתשתית המערכת", or הגדרות › גשר Arx, "מצומד"), the WisKey component
version and how many WisKey entries loaded. Reload every open Arx tab after an add-on update.

2.4 **Checks before the first step** `[together]` (written in the chat):
- The managed install switch `wiskey.auto_install` is off. Status row "התקנה ועדכון מנוהלים של WisKey" says why (`policy_b`). If the
  switch shows on: stop.
- The bridge key was not rotated: pairing line "החלפת מפתח הגשר" (the rotation switch is `bridge.key_rotation`). Do not press the
  key-rotation button during the session.
- The stations screen shows Arx's own screen, not the embedded WisKey panel (הגדרות › מתגי מסכי כניסה), so the station drawer exists.
- Tell other users that settings will change for a few minutes.

**Where the state is read during the ladder.** הגדרות › מתגי מסכי כניסה (`#/system/diagnostics?tab=access-control`), block
"חיבור Arx ל-WisKey" (one line per pairing fact) and the list "מצב WisKey" under it: one row per WisKey feature, state פעיל / כבוי /
חסום / לא ידוע, and for every row that is not on, its reasons and how to fix them. Each step below names the rows and reason codes to
watch. The add-on log is the second source; its lines are quoted where they matter.

## 3. Step 1 - door map (`door_map`)

- **Turns on:** nothing in WisKey. An intercom door opens from Arx only after it is mapped to a station and a relay; until then every
  door path says "הדלת לא משויכת לתחנה".
- **Screen:** הגדרות › הקמה (`#/system/setup`), card "שיוך דלתות".
  1. Rows with an unambiguous suggestion: check the number is what the owner expects, then "אישור N הצעות חד-משמעיות".
  2. Rows without a suggestion: in "בחירת ממסר" pick only a relay the owner KNOWS belongs to that door; when unsure, leave it unmapped
     and record it.
  3. Do not touch "מיקום תחנות" or "פריטים שפותחים דלתות". Do not open a door to test.
- **Writes:** the Arx database only (the door map) and one audit row `intercom.door.mapped` per door. Nothing is sent to a door, a
  station or HA.
- **Expected status:** status row "פתיחת דלת מ־Arx" loses reason `doors_unmapped` (or its count drops); the lock screens no longer say
  "הדלת לא משויכת לתחנה" for the mapped doors.
- **Rollback (R1):** "ביטול שיוך" beside the door (audited `intercom.door.unmapped`).
- **Approval:** `מאשר: שיוך דלתות`.

## 4. Step 2 - media provider (`provider`)

- **Turns on:** Arx's direct, signed join to WisKey: one setting, `access.station_media_provider` from `local` (default) to `auto`.
  Almost every advanced feature rides on it (door windows layer 2, emergency, door automations, verified CSV import, direct people
  writes, template send, relay map), but **each of them keeps its own switch, off**, so this change alone opens and sends nothing.
- **Precondition:** step 3 is read only and does not depend on this step; it may run first. If it is red (key rotated, WisKey refused),
  do not switch to `auto`: the join would not come up. Go to the decision of step 3.
- **Screen:** הגדרות › מתגי מסכי כניסה (`#/system/diagnostics?tab=access-control`), row "מקור הווידאו והדיבור" (shown while
  "וידאו ודיבור במסך התחנות" is not off) › "WisKey (וידאו ודיבור)" › save. The row already says what WisKey mode still lacks (for
  example "WisKey לא מפרסם פקודות דיבור ל-Arx").
- **Writes:** one Arx setting. Since WISKEY-JOIN-LIVE-2382 the join starts at runtime, without an add-on restart.
- **Expected status:** pairing line "מקור הווידאו והדיבור" is no longer `provider_local`; status row "החיבור הישיר ל־WisKey (גילוי, זהות
  שירות)" loses `provider_local` and `join_not_started` (a moment of `join_starting` is normal). The add-on log shows
  `wiskey direct join installed (access.station_media_provider = auto, key signs); the direct path is used while its socket
  authenticates` - proof that the key signs, **not** that WisKey accepts it (step 3). A missing line means the key cannot sign: do not
  fix it here, go to step 3.
- **Watch after the step:** `authentication_failed` on one station for more than 300 s; a person save that fails (`not_sent`); log lines
  `direct connection refused a frame / ended`. Whether people writes move from the classic channel to the direct path once the join is
  verified is UNKNOWN until checked: do not edit real people before that is known.
- **Rollback (R-b):** the same row back to "Arx (וידאו בלבד)" (`local`); everything returns to the classic channel.
- **Approval:** `מאשר: מקור מדיה WisKey`.

## 5. Step 3 - signed pairing check (`pairing_check`)

- **Turns on:** nothing. It is the first proof that WisKey accepts Arx's signature, and it reads directly from WisKey which media and
  talk commands it publishes, regardless of the service-channel list. This is the most useful result for the WisKey team.
- **Screen:** the same tab, block "חיבור Arx ל-WisKey" › "בדוק חיבור חתום" (system administrator; one connection, the signed reads
  `direct/capabilities` and `direct/time`, at most once per five seconds, audited by result code only). Press once.
- **Writes:** one audit row; nothing in WisKey, HA or a station.
- **Expected status:** pairing line "מפתח הצימוד" תקין (with an 8-character fingerprint, never the key); "WisKey מקבל את המפתח" תקין
  (`accepted`); "חוזה הגילוי (פקודות מדיה ודיבור)" says how many of the six media and talk commands WisKey publishes - record N and
  the missing ones. Status row "החיבור הישיר ל־WisKey (גילוי, זהות שירות)" loses `not_proven`.
- **Reading the result:**

| Result | Meaning | Action |
|---|---|---|
| key ok, accepted, N = 6 | the direct path publishes the media commands; only the service-channel list blocks | record and send to WisKey; talk is still not available |
| key ok, accepted, N < 6 | WisKey does not publish some commands | send WisKey the missing list |
| `key_rotated` or `refused` | the signed path is off | **stop.** Re-pair is a separate decision (it removes and re-adds the SMPLWISE Bridge integration in HA); it needs the HA backup of 2.1 and its own approval |
| `unreachable` / `probe_unknown` | the check did not reach WisKey or did not finish | one more check, no more; record the code |

- **Rollback:** none (read only). After a re-pair: R3, or re-adding the integration with the previous code if it was kept.
- **Approval:** `מאשר: בדיקת חיבור חתום`; a re-pair needs `מאשר: צימוד מחדש`.

## 6. Step 4 - station video and talk (`video_talk`)

- **Turns on:** live video in the station drawer (`access.station_media` = `video`), then the talk button (`video_talk`). With the
  provider on `local`, video comes from Arx's own source (go2rtc pulls from the station), not through WisKey.
- **Screen:** the same tab, row "וידאו ודיבור במסך התחנות" › "וידאו" › save. Then open ONE station drawer in the stations screen for
  30 seconds, close it, then a second one. Never open many at once.
- **Writes:** one Arx setting.
- **Expected status:** a moving picture within about 5 seconds; closing releases the `smplwise_` stream (read-only check: 0 consumers).
  Status rows "וידאו של עמדה דרך WisKey" and "דיבור דו־כיווני עם עמדה" lose `media_off` (and `media_no_talk` after "וידאו ודיבור");
  while WisKey does not list its media commands they keep `feed_not_listed` / `feed_no_talk` - that is the WisKey gap, not a failure of
  the step. The drawer then names the reason talk is missing (for example "WisKey לא מפרסם פקודות דיבור ל-Arx").
- **Talk itself:** if the drawer ever offers talk, **stop before pressing.** Opening talk plays the owner's voice at a real station: it
  needs a separate approval naming one station, a person who knows and stands there, the microphone muted on the first press and
  "ניתוק" ready. Do not use the talk button of the embedded WisKey panel to test.
- **Rollback:** the row back to "וידאו" or "כבוי" (the still picture and the classic panel return).
- **Approval:** `מאשר: וידאו עמדות`; then `מאשר: ניסיון דיבור` for "וידאו ודיבור"; a real talk needs `מאשר: פתיחת דיבור בעמדה <שם>`.

## 7. Step 5 - listen to a station (`listen`)

- **Turns on:** listening to a station's audio in Arx's own drawer, `access.station_listen` = `probe` (a shared session with the owner,
  the unknown descriptor accepted) or `on` (needs the descriptor's listen capability).
- **Expected outcome today:** "unavailable". WisKey publishes no audio channel from a station outside a call, so status row "האזנה
  לעמדה בלי שיחה" keeps `listen_no_downlink` (card WISKEY-LISTEN-2410 waits for WisKey); only `listen_off` goes away. The step records
  that, nothing more.
- **Screen:** the same tab, row "האזנה לעמדה" (shown while the media row is not off) › "ניסיון (סשן משותף)" › save.
- **Writes:** one Arx setting. A listen session would be a microphone session from the station: AGENTS.md requires a task-specific
  authorization, the people at the station informed, and nothing recorded or sent to the station. Do not open one in this ladder.
- **Rollback:** the row back to "כבויה".
- **Approval:** `מאשר: האזנה לעמדה (ניסיון)`.

## 8. Step 6 - station acceptance run (`live_validation`)

- **Turns on:** nothing. A read-only acceptance run per station through WisKey's native `live_validation` feature and Arx's own paths.
- **Screen:** הגדרות › מתגי מסכי כניסה › card "בדיקת קבלה לעמדות" › its own page (`#/system/wiskey-validation`). First "בדוק" on ONE
  station; then, if it is clean, "בדוק את כל העמדות". "עצור" stops between checks.
- **Checks per station, in order:** `identity`, `door_capabilities`, `door_read`, `media_arx`, `media_wiskey`, `talk` (whether talk is
  available and why not - no talk session, no microphone), `events`, `clock`. Each ends עבר / נכשל / לא נתמך ב-WisKey / לא הורץ; an
  unknown WisKey outcome is נכשל, never עבר.
- **Writes:** the run and its results in the Arx database (codes, numbers and times only) and audit rows. The CSV export is the
  installer's acceptance record.
- **The door pulse is not part of this ladder.** It is a physical open of one door: a system administrator on a local session, the
  station's name typed, a witness named, one per station per run, never in "run all". It needs its own approval naming the door.
- **Rollback:** none (read only).
- **Approval:** `מאשר: בדיקת קבלה לעמדה אחת`; then `מאשר: בדיקת קבלה לכל העמדות`.

## 9. Step 7 - door windows and emergency (`door_windows_emergency`)

- **Turns on:** the door-windows screen only: `doors.windows.enabled` shows the "חלונות פתיחה" tab. With no rule nothing is sent.
  Creating a rule (written to the station over the direct join) is out of scope.
- **Screen:** `#/wiskey/door-windows` › "הגדרות חלונות וחירום" › "חלונות פתיחה פעילים" › save.
- **Stays off:** emergency open (`doors.emergency.enabled`, `doors.emergency.open_enabled`) - a safety action, look at the screen and its
  status row only; door automations (`doors.automation_open`, הגדרות › הקמה); emergency LOCK does not exist (WisKey reports
  `emergency_secure_unsupported_v1`, card WISKEY-EMERGENCY-LOCK-2410). Switching any of them on is a separate decision with the physical
  presence it needs.
- **Writes:** one Arx switch.
- **Expected status:** status row "חלונות דלת" loses `windows_off`; "פתיחת חירום" keeps `emergency_off`; "נעילת חירום" keeps
  `lock_unsupported`; "פתיחת דלת מאוטומציה" keeps `automation_off`.
- **Rollback:** the same switch off.
- **Approval:** `מאשר: הדלקת חלונות דלת בלי כללים`.

## 10. Never, in any step

- No door opened; no window rule or programme created; no emergency or door automation switched on.
- `wiskey.auto_install` is not switched on (it cannot be).
- No key rotation from the bridge-key card.
- No station credentials re-entered in WisKey, unless one station stays `authentication_failed` for more than 300 s, and then only for
  it, with its own approval.
- No lock setting changed on a station; no write to the NVR, go2rtc (outside Arx's own `smplwise_` streams) or HA users.

## 11. Rollback levels

Stop at once when: a before / after snapshot differs; the WisKey component fails to load; the managed install switch shows on; a station
stays `authentication_failed` for more than 300 s after an Arx change; a person write fails; anything not written here happens.

| Level | When | How | Restores | Loses |
|---|---|---|---|---|
| R0 | a step that wrote nothing | stop | - | - |
| R-b | after step 2, any doubt | provider back to `local` (step 2 rollback); media back to "וידאו" | every channel back to classic | - |
| R1 | a wrong door mapping | "ביטול שיוך" | the door map only | - |
| R2 | damage inside Arx | Arx › גיבוי ושחזור › the backup of 2.2 › restore (replace mode, type `RESTORE`, the backup password); approval `מאשר: שחזור גיבוי Arx` | the Arx database | Arx changes since the backup |
| R3 | HA does not start, or the WisKey component / bridge is broken (for example after a re-pair) | HA › Backups › the backup of 2.1 › full restore; approval `מאשר: שחזור גיבוי HA` | HA, add-ons (Arx included), components | every HA and add-on change since the backup |
| R4 | the WisKey component version itself is suspected | the owner restores the previous WisKey component from its own upgrade backup, HA stopped; approval `מאשר: החזרת WisKey לגרסה הקודמת` | the WisKey component | the newer component |

After any restore: HA up, Arx open and the bridge "מצומד", the WisKey entries loaded, a snapshot compared with the baseline; record what
was restored and what was lost; no more tests that day.

## 12. Record sheet

```
add-on before / after: ___ / ___   bridge: ___   WisKey component: ___ (entries loaded ___)
HA backup: created ___ size ___ downloaded ___ key kept ___     Arx backup: created ___ encrypted ___ downloaded ___
1 door map: mapped ___ of ___ ; left unmapped ___ (why)
2 provider before ___ after ___ ; "direct join installed" line ___
3 signed check: key ___ accepted ___ discovery N of 6 ___ missing ___
4 video: stations checked ___ works ___ ; talk reason (exact text) ___
5 listen: status row reasons ___
6 acceptance run: station ___ result per check ___ ; all stations ___ ; CSV kept ___
7 door windows on ___ ; emergency / automations still off ___
authentication_failed seen (station / time, no address): ___
managed install switch off: ___
final: provider ___ station_media ___ station_listen ___ doors.windows.enabled ___
rollback used: ___ (level, step)
```

## 13. Machine-readable ladder

The test reads this block. Keys: `settings` (setting keys the step reads or writes), `feature_rows` / `reason_codes` (the "מצב WisKey"
rows and reasons of `services/wiskey_feature_status.py`), `pairing_lines` (the lines of `services/wiskey_pairing.py`), `checks` (the
acceptance checks of `services/wiskey_live_validation.py`), `ui_labels` (Hebrew strings that must exist in `frontend/src`).

```json activation-ladder
{
  "schema": "arx-activation-ladder/1",
  "card": "WISKEY-ACTIVATION-RUNBOOK-0411",
  "preflight": {
    "settings": ["wiskey.auto_install", "bridge.key_rotation"],
    "feature_rows": ["managed_install"],
    "reason_codes": ["policy_b"],
    "pairing_lines": ["rotation", "bridge"],
    "ui_labels": ["גיבוי ושחזור", "חיבור Arx ל-WisKey", "מצב WisKey"],
    "approval": ["מאשר: גיבוי מלא של HA", "מאשר: גיבוי Arx"]
  },
  "steps": [
    {
      "id": "door_map",
      "route": "#/system/setup",
      "settings": [],
      "feature_rows": ["door_release"],
      "reason_codes": ["doors_unmapped"],
      "pairing_lines": [],
      "checks": [],
      "ui_labels": ["שיוך דלתות", "בחירת ממסר", "ביטול שיוך", "הדלת לא משויכת לתחנה"],
      "writes": "Arx database only (door map) + audit intercom.door.mapped",
      "physical": false,
      "approval": ["מאשר: שיוך דלתות"],
      "rollback": "R1: ביטול שיוך"
    },
    {
      "id": "provider",
      "route": "#/system/diagnostics?tab=access-control",
      "settings": ["access.station_media_provider"],
      "feature_rows": ["direct_api"],
      "reason_codes": ["provider_local", "join_not_started", "join_starting"],
      "pairing_lines": ["provider"],
      "checks": [],
      "ui_labels": ["מקור הווידאו והדיבור", "WisKey (וידאו ודיבור)", "Arx (וידאו בלבד)", "WisKey לא מפרסם פקודות דיבור ל-Arx"],
      "writes": "one Arx setting",
      "physical": false,
      "approval": ["מאשר: מקור מדיה WisKey"],
      "rollback": "R-b: provider back to local"
    },
    {
      "id": "pairing_check",
      "route": "#/system/diagnostics?tab=access-control",
      "settings": [],
      "feature_rows": ["direct_api"],
      "reason_codes": ["not_proven", "refused", "key_rotated", "probe_unknown"],
      "pairing_lines": ["key", "acceptance", "discovery"],
      "checks": [],
      "ui_labels": ["בדוק חיבור חתום"],
      "writes": "one audit row",
      "physical": false,
      "approval": ["מאשר: בדיקת חיבור חתום", "מאשר: צימוד מחדש"],
      "rollback": "none (read only); after a re-pair R3"
    },
    {
      "id": "video_talk",
      "route": "#/system/diagnostics?tab=access-control",
      "settings": ["access.station_media"],
      "feature_rows": ["w10_video", "w10_talk"],
      "reason_codes": ["media_off", "media_no_talk", "feed_not_listed", "feed_no_talk"],
      "pairing_lines": [],
      "checks": [],
      "ui_labels": ["וידאו ודיבור במסך התחנות", "וידאו ודיבור"],
      "writes": "one Arx setting",
      "physical": false,
      "approval": ["מאשר: וידאו עמדות", "מאשר: ניסיון דיבור", "מאשר: פתיחת דיבור בעמדה <שם>"],
      "rollback": "row back to video or off"
    },
    {
      "id": "listen",
      "route": "#/system/diagnostics?tab=access-control",
      "settings": ["access.station_listen"],
      "feature_rows": ["listen"],
      "reason_codes": ["listen_off", "listen_no_downlink"],
      "pairing_lines": [],
      "checks": [],
      "ui_labels": ["האזנה לעמדה", "ניסיון (סשן משותף)", "כבויה"],
      "writes": "one Arx setting",
      "physical": false,
      "approval": ["מאשר: האזנה לעמדה (ניסיון)"],
      "rollback": "row back to off"
    },
    {
      "id": "live_validation",
      "route": "#/system/wiskey-validation",
      "settings": [],
      "feature_rows": [],
      "reason_codes": [],
      "pairing_lines": [],
      "checks": ["identity", "door_capabilities", "door_read", "media_arx", "media_wiskey", "talk", "events", "clock"],
      "ui_labels": ["בדיקת קבלה לעמדות", "בדוק את כל העמדות", "עצור"],
      "writes": "the run and its results in the Arx database + audit",
      "physical": false,
      "approval": ["מאשר: בדיקת קבלה לעמדה אחת", "מאשר: בדיקת קבלה לכל העמדות"],
      "rollback": "none (read only)"
    },
    {
      "id": "door_windows_emergency",
      "route": "#/wiskey/door-windows",
      "settings": ["doors.windows.enabled", "doors.emergency.enabled", "doors.emergency.open_enabled", "doors.automation_open"],
      "feature_rows": ["door_windows", "emergency_open", "emergency_lock", "door_automations"],
      "reason_codes": ["windows_off", "emergency_off", "lock_unsupported", "automation_off"],
      "pairing_lines": [],
      "checks": [],
      "ui_labels": ["הגדרות חלונות וחירום", "חלונות פתיחה פעילים", "חלונות פתיחה"],
      "writes": "one Arx switch (doors.windows.enabled)",
      "physical": false,
      "approval": ["מאשר: הדלקת חלונות דלת בלי כללים"],
      "rollback": "the same switch off"
    }
  ]
}
```
