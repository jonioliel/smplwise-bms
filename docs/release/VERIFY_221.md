# Verification 2.2.1 (VERIFY_221)

Date: 2026-10-06. Runner: the Ubuntu test machine (16 cores), via `private/runner/run_smart.py`. Base: origin/main f0b42dd0.
The release gate was NOT run. Nothing was fixed on the verified branches.

> Taken into 2.2.1 (integ/221) as a gate note. Only this document was taken: the artifacts and logs it names under
> `docs/release/verify-221-artifacts/` stay on `pilot/verify-221` (fd7698be). The stale Linux pixel baselines it reports (section 2a)
> were regenerated in `pilot/pixel-baselines` (f5856031), merged first into 2.2.1; the gate result is in `2.2.1-INTEGRATION-NOTES.md`.
Another agent used the same runner at the same time (a backend shard of another branch), so "alone" runs were not on an idle machine (load 3-5).

## English

### 1. pilot/gaps-220 (d1bdd7ee) - PASS

Backend (pytest, one run): 120 passed, 0 failed. test_announcements 19, test_second_factor 23, test_backup 8, test_frigate_control 27, test_frigate_api 37, test_frigate_join 6.

Playwright (desktop, tablet, mobile): 107 passed, 0 failed, 4 skipped.

| spec | desktop | tablet | mobile |
|---|---|---|---|
| unit-second-factor-admin-ui | 3 pass | 3 pass | 3 pass |
| evidence-frigate-control | 13 pass | 13 pass | 13 pass |
| evidence-frigate-review | 12 pass | 11 pass, 1 skip | 12 pass |
| evidence-announcements | 3 pass | 3 pass | 3 pass |
| evidence-plan-package | 3 pass, 1 skip | 3 pass, 1 skip | 3 pass, 1 skip |
| evidence-second-factor | 2 pass | 2 pass | 2 pass |

Skips are by design: `evidence-plan-package` "live: export and re-import" (needs a live backend) on all three projects; `evidence-frigate-review` "layout guard: four skins" skips on tablet ("two projects are enough").

### 2. pilot/flaky-fixes (25ce3e07)

`--sw-repeat` is a backend (pytest) option only; for Playwright `--repeat-each` was used. Load: 12 busy-loop processes (`timeout 1500 sh -c 'while :; do :; done'`, each with its own timeout, stopped by PID afterwards) on top of the other agent's work, load average 10-19.

a) Pixel specs with the Linux baselines, 5 repeats each, `--workers=1`:

| spec | alone | under load |
|---|---|---|
| evidence-design-foundation "classic is pixel-stable: map" [mobile] | 0 of 5 passed (388 px differ, every repeat) | 0 of 5 passed (388 px, every repeat) |
| pixel-nvr-encoding-batch (all projects, 8 tests x 5 repeats) | 25 passed, 15 failed, 20 skipped (tablet) | 25 passed, 15 failed, 20 skipped |

pixel-nvr-encoding-batch detail (same alone and under load): desktop classic 0/5, desktop domus 0/5, desktop tesla 0/5 (425, 535, 713 differing pixels, the same number in every repeat); desktop bubble 5/5; mobile classic, domus, tesla, bubble 20/20.

These are NOT load flakes. Results are identical alone and under load, the differing-pixel count never varies between repeats, and the same failures occur on origin/main f0b42dd0 (main: foundation map [mobile] 2 of 2 failed with 388 px; nvr batch desktop classic, domus, tesla failed, only bubble passed). So the `settlePage` change did not alter the outcome either way: the committed Linux baselines do not match what the current code renders on the runner.
- foundation map [mobile]: in the baseline the "layers" and "3D" buttons of the map header sit against the inline edge (x about 12 px); in the render they are about 15 px further in. Only these two buttons differ.
- nvr batch [desktop]: the differing pixels are the top-bar tab labels; the dialog and table are identical.
Artefacts (actual / expected / diff PNGs): `docs/release/verify-221-artifacts/foundation-map-mobile/` and `.../nvr-batch-desktop/`. Logs: `.../logs/`.
Suggested diagnosis (not verified): the Linux baselines (last updated 2026-10-04) are stale against a later layout change, or a font difference on the runner. Not a timing problem. Needs a decision: regenerate the baselines after a visual review, or find the layout change.

b) preview `unit-devices-tiles.spec.ts:116` [mobile] under load (a temporary `playwright.verify.config.ts` on the runner with `video` and `trace` set to retain-on-failure, removed afterwards): 30 runs of the test (inside a 120-test selection, 2 workers, load 18) all passed; then the whole file 15 times on mobile: 165 passed, 30 skipped, 0 failed. 45 runs of test 116, no failure, so no trace or video exists. The real cause was NOT found; it did not reproduce on this runner.

### 3. pilot/frigate-addon-option (85cd7559) - PASS
- `test_frigate_addon_option.py` (config.yaml option, run.sh mapping, OPTION_TYPES) together with test_self_update, test_self_update_s3, test_self_update_s3_fixes, test_provision_push_addon, test_mobile_options: 113 passed, 0 failed.
- `tsc --noEmit`: ok.

### Cleanup
Only processes started here were stopped (the 12 busy loops, by PID). The temporary config file was removed from the runner worktree.

## עברית

תאריך: 2026-10-06. הרצה על שרת הריצה (אובונטו) דרך run_smart. שער השחרור לא הורץ. לא תוקן דבר בענפים שנבדקו. סוכן אחר עבד על אותו שרת במקביל.

1. pilot/gaps-220 (d1bdd7ee): עבר. צד שרת: 120 עברו, 0 נכשלו (announcements 19, second_factor 23, backup 8, frigate_control 27, frigate_api 37, frigate_join 6). Playwright בשולחן עבודה, טאבלט ונייד: 107 עברו, 0 נכשלו, 4 דולגו בכוונה (הבדיקה החיה של ייצוא/ייבוא חבילת תוכנית בשלושת המסכים, ובדיקת ארבעת העיצובים של מסך הסקירה בטאבלט). הפירוט בטבלה באנגלית.
2. pilot/flaky-fixes (25ce3e07): האפשרות `--sw-repeat` קיימת רק בצד שרת; ב-Playwright השתמשתי ב-`--repeat-each`.
   - בדיקות הפיקסל נכשלות באופן קבוע ולא בגלל עומס: מפה בנייד 0 מתוך 5 לבד ו-0 מתוך 5 תחת עומס (388 פיקסלים בכל חזרה). חבילת הקידוד: בשולחן עבודה classic, domus ו-tesla נכשלו בכל חזרה (425, 535, 713 פיקסלים, אותו מספר בכל ריצה); bubble ונייד עברו (25 עברו, 15 נכשלו, 20 דולגו בטאבלט). אותם כשלונות בדיוק ב-main (f0b42dd0), כלומר התיקון settlePage לא שינה את התוצאה, ובסיסי הפיקסל של לינוקס אינם תואמים למה שהקוד מצייר. במפה כפתורי "שכבות" ו-3D מוזזים כ-15 פיקסלים; בחבילת הקידוד ההבדל הוא בטקסט לשוניות הסרגל העליון. אבחנה לא מאומתת: בסיסים ישנים (מ-4.10) מול שינוי פריסה, או הבדל גופן. נדרשת החלטה: ליצור בסיסים מחדש אחרי סקירה חזותית, או לאתר את שינוי הפריסה.
   - unit-devices-tiles:116 בנייד: 45 ריצות תחת עומס (30 ועוד 15 בתוך הקובץ המלא), כולן עברו. לא שוחזר, ולכן אין trace או וידאו; הסיבה האמיתית לא נמצאה.
3. pilot/frigate-addon-option (85cd7559): עבר. בדיקות האופציה ו-run.sh יחד עם self_update, provision_push_addon ו-mobile_options: 113 עברו; tsc תקין.
