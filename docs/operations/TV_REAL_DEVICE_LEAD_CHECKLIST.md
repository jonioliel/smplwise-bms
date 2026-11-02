# Real-TV session - lead's checklist (before / after)

Companion to `docs/operations/TV_REAL_DEVICE_RUNBOOK_HE.md` (the owner's Hebrew runbook; section 5 there is the result table, all rows
NOT_RUN until filled). This page is for the lead who runs the matching specs on the runner around the session. Documents only: nothing
here was run when it was written.

## 0. Ground rules

- The page under test must contain TV-FIT-2380 (`pilot/TV-FIT-2380`) and, for the two settings in the API, TV-SETTINGS-2380
  (`pilot/TV-SETTINGS-2380`). Record the commit SHA of the add-on build the TV loaded.
- Runner only (the workstation runs no browser). If `run_smart.py` reports busy: poll at most every 2 minutes for up to 30 minutes, then NOT_RUN.
  Never stop another job or a gate. Push the branch first; the runner sees origin only.
- Do not use "copy link" in Settings to get the TV link: today it issues a new link and revokes the old one (every paired TV disconnects).
  Use the owner's existing link, or a separate throwaway board that is deleted afterwards. Never write a board token, an address or a serial into chat, commits, logs or fixtures.
- Real-device evidence stays in `private-evidence/real-tv-session-<date>/` (gitignored); copy into `tests/fixtures/` only after redaction and review.

Command shape (from the checkout, Node 24 on PATH):

```
env PYTHONIOENCODING=utf-8 MSYS_NO_PATHCONV=1 python private/runner/run_smart.py preview <branch> <spec> [<spec> ...] --workers=1 --machine runner --project=desktop
```

(The pixel and layout specs skip every project except `desktop`; check `run_smart.py --help` text if the extra flag is not forwarded.)
Backend: targeted single-process pytest, e.g. `smplwise_vms/backend/tests/test_notice_tvsettings_2380.py`.

## 1. BEFORE the session - baseline (all should be green; record real totals, not "should pass")

| # | Spec | Where | What it guards |
|---|---|---|---|
| 1 | `frontend/tests/unit-tv-fit-2380.spec.ts` | unit config, `--workers=1` | chip fit, drop order, safe-margin parsing, logo-by-area, Hebrew date vs ICU |
| 2 | `unit-notice-tv-logic.spec.ts`, `unit-tvopt-295.spec.ts`, `unit-tvnotice2-297.spec.ts`, `unit-noticesaver-295.spec.ts` | unit | remote keys, header / updated / saver options, night dim |
| 3 | `unit-boardv2-297.spec.ts`, `unit-lobbystyles-2300.spec.ts`, `unit-noticeskins-2300.spec.ts` | unit | design choices and lobby styles |
| 4 | `pixel-notice-tv-portrait-chips.spec.ts` | runner, desktop | 13 designs in portrait: every chip drawn, time whole, nothing over the status line, landscape two rows only when needed, `drop`, safe margin, crest logo, Hebrew date without `ca-hebrew` |
| 5 | `pixel-notice-tv-mock.spec.ts`, `pixel-bustimes-295.spec.ts` | runner, desktop | mock-up parity and the default footer (baselines generated on the runner; if missing the pixel step skips itself - report as NOT_RUN, not as pass) |
| 6 | `notice-tv-saver-295.spec.ts`, `notice-tv-header-295.spec.ts`, `notice-tv-header-worst-297.spec.ts`, `notice-tv-tvnotice2-297.spec.ts`, `notice-tv-bustimes-295.spec.ts`, `notice-tv-slides-295.spec.ts` | runner, desktop | savers, header layouts, worst-case header, idle board, bus times, slides |
| 7 | `layout-noticeboard-skins-2300.spec.ts`, `layout-noticeboard-hitech-2300.spec.ts`, `layout-noticeboard-luxury-2300.spec.ts`, `layout-noticeboard-v2-297.spec.ts`, `layout-bustimes-overlap-295.spec.ts` | runner, desktop | lobby-style, V2 and bus-area layouts |
| 8 | `smplwise_vms/backend/tests/test_notice_tvsettings_2380.py`, `test_notice_boardv2_297.py` | pytest, single process | `portrait_chips` / `safe_margin` validation, audit, feed |
| 9 | `npx tsc --noEmit` in `frontend/` | workstation | types |

If a spec is already red before the session, fix or quarantine it first (ticket + expiry): findings from the TV are only readable against a green baseline.

## 2. DURING the session (lead at the PC, owner at the TV)

- Fill the result table (section 5 of the Hebrew runbook) live; never PASS without a check, never invent a value.
- Test hooks the owner uses in the address (before the `#`, joined with `&`): `?safe=<0..5, halves ok>`, `?design=<classic|v2|ink|sign|lumen|axis|prism|gallery|concierge|stone>`,
  `?saver=<off|wash|cycle|wave|ambient>`, `?theme=<day|night>`, `?chips=<rows|drop>`, `?logos=<a|b|c>`, `?header=<a|b|c>`. Nothing is saved on the server by these.
- Optional, owner's call only: if the device allows remote debugging (read only), note whether `#cv` has class `tf` (the page fell back from CSS `zoom` to `transform: scale`).
- Part B (first camera cast, D4) starts only after the owner's exact written consent in chat (`מאשר בדיקה פיזית - [device] - כיבוי: א/ב`); stop rules are in the
  Hebrew runbook part B and `docs/operations/CAST_FIRST_PHYSICAL_TEST_RUNBOOK.md`. Device actions are the owner's; the lead issues only the API steps of that runbook, once each.

## 3. AFTER the session - turn findings into evidence

1. Triage each FAIL: overscan value, a clipped element, a jank / compatibility finding, a text-size finding. Open a fix task per cluster (fixes go on the TV-FIT branch / the follow-up after 2.37.0, not in the session).
2. Reproduce every geometry finding in a browser spec before fixing it: a viewport that matches the TV (1920x1080, 1280x720, 3840x2160, 1080x1920), `?safe=<measured>`, the same design and notice set; an overscan finding becomes an assertion that every edge element sits inside the safe inset. A finding that cannot be reproduced stays as a real-device note in the evidence folder.
3. Re-run section 1 after each fix slice and compare totals with the baseline. Regenerate pixel baselines only on the runner, review the diff, commit them in the same branch.
4. Record the owner's decisions in the change document: the recommended `?safe=` per device and orientation (the default `safe_margin` stays 0 until the owner decides), the portrait chip behaviour (open question Q3: rows vs drop), zoom support, and whether the Hebrew date came from the browser or from the computed fallback.
5. Update `management/` (D2 row) through the single agent that owns it, then `python scripts/project_status.py --write`.

Report in English: SHAs, real totals (run / passed / failed / skipped), NOT_RUN list with the reason, and anything for the owner.
