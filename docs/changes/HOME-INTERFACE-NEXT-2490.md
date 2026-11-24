# HOME-INTERFACE-NEXT-2490 (branch pilot/HOME-NEXT-2500) - home interface next phase: the remaining owner answer (Q72)

Branch `pilot/HOME-NEXT-2500`, based on `origin/pilot/HOME-WALL-NIGHT-2500` c0fb81e2e (itself from `main` 619f94d04, v2.47.0) because
the remaining item lives in the same wall-panel settings, policy block and settings tab that branch adds. Owner answers of 22.11 night
(`private/planning/questions_all_open_2026-11-22.html`, "הממשק הביתי, השלב הבא", Q70-Q79; all = the recommendation).

## Which answer is built where

| Q | Answer (recommendation) | Built in |
|---|---|---|
| Q70 | rest screen on by default after 2 minutes, first touch only wakes | `pilot/HOME-WALL-NIGHT-2500` |
| Q71 | night mode 23:00-06:00, editable | `pilot/HOME-WALL-NIGHT-2500` |
| **Q72** | **no "קראתי" on a shared wall panel; a notice is marked "new" for 48 hours** | **this branch** |
| Q73 | tablet night = dim the screen only | `pilot/HOME-WALL-NIGHT-2500` |
| Q74 | takeover for the alarm and an urgent notice, door call first | `pilot/HOME-WALL-NIGHT-2500` |
| Q75 | scenes editable by whoever holds scene management | `pilot/HOME-FAVORITES-2500` |
| Q76 | air-conditioner "hold" left out | `pilot/HOME-FAVORITES-2500` (nothing to remove; pinned by a test) |
| Q77 | favourites: long-press drag on the tablet, arrows stay | `pilot/HOME-FAVORITES-2500` |
| Q78 | a missing row keeps my order, the gap is "+ הוסף" | `pilot/HOME-FAVORITES-2500` |
| Q79 | a suggestion dialog after a scene, confirmed with the usual code | `pilot/HOME-FAVORITES-2500` |

So the only item not covered by the two existing branches was Q72. This branch builds it, with a setting.

## What changed (Q72)

A wall panel (the per-person policy `kiosk`, HOME-SIMPLE-2420) is a screen the whole home shares: a "קראתי" pressed there marked the
notice read for the panel's account, so the next person in the family saw nothing new. Now:

* **On a wall panel** the notice board has no "קראתי" button (the sheet shows only "סגור"; the action is refused there even if called),
  and "new" means "published less than 48 hours ago" - whatever the panel's account read. The "חדשות" filter, the "חדש" badge, the
  highlighted card, the header count, the room screen's notices chip and the more-hub tile line all follow that rule. With nothing new the
  header says "אין הודעות חדשות" (never "קראת את כל ההודעות" on a shared screen). A notice with no publish / start time is never "new" on a
  shared screen; one dated ahead of the clock is.
* **On a person's own screen** nothing changed: new = not read by me, with "קראתי".
* **Setting** (installation, `home.wall_notice_new`, rbac.assign, audited as the other wall keys): "כמה זמן הודעה מסומנת «חדש»" in
  משתמשים והרשאות › ממשק ביתי › מסכי קיר, in the "השתלטות על המסך" card: יממה / **יומיים** (default) / 3 ימים / שבוע / לפי «קראתי»
  (= the 2.48 behaviour: the panel's own "read"). The note under it explains the chosen mode.
* **The urgent-notice takeover** (HOME-WALL-NIGHT-2500, Q74) now uses the same "new" window (it was a fixed 48 hours); in "לפי «קראתי»"
  mode it keeps 48 hours. The takeover option's note says "כל עוד היא חדשה" instead of "ב-48 השעות הראשונות".

### Files

* `frontend/src/home/wall-notice-logic.ts` (new, pure): `noticeNewHours`, `sharedNewHours`, `noticeAt`, `isNewNotice`.
* `frontend/src/home/home-notices.ts`: the board, the sheet, the more tile and the chip line use `isNew(h, n)`; no "קראתי" on a wall panel.
* `frontend/src/home/wall-rest-logic.ts`: `WallSettings.noticeNewH`, `urgentFreshMs()`, `takeoverFor(..., freshMs)`; `home-wall-rest.ts` passes it.
* `frontend/src/home/sw-home-admin.ts`: the setting row (`sw-segmented`, `data-wall-notice-new`).
* `frontend/src/i18n/lang/en/i18n/msg/home.ts`: 8 English texts added, 1 replaced (the takeover note).
* Backend: `services/home_interface.py` `INSTALL_VALUES["wall_notice_new"] = ("48", "24", "72", "168", "read")`, the policy's
  `wall.notice_new_h` (0 = "read"); `routers/home_interface.py` `InstallBody.wall_notice_new`; `wire/home_interface.py`
  `HomeWallSettings.notice_new_h`, `HomeInstallSettings.wall_notice_new`; the generated `wire-home-interface.ts` / `wire-me.ts`.
  No migration (a `settings` row); an unknown stored value reads as the default; an older client ignores the new field; a 2.48 server
  (no `notice_new_h`) gives the panel the owner's default, 48 hours.

## Tests

RESULTS_PLACEHOLDER

## Known limits

* The window is per installation, not per panel (as the other wall settings).
* "New" is by the notice's publish time; a notice edited later is not "new" again (the board has no edit time on its wire).
* Nothing marks a notice read for the family from the wall (Q72 option "«קראתי» מסמן לכל הבית" was not chosen).

## Rollback

Revert the branch commits. The `home.wall_notice_new` row stays in `settings` and is ignored by older code.
