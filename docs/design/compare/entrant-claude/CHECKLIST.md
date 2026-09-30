# CHECKLIST — self-assessment against COMPARISON_TASK_HE.md §5 (entrant-claude, three skins)

Scores 1–5, one line of reasoning each. Honest: where a skin falls short, it is written here. R1 reads "fidelity to
the skin's own direction" for skins 2 and 3.

| # | Criterion | Domus | iOS | Tesla | Reasoning |
|---|---|---|---|---|---|
| R1 | Direction fidelity | 4 | 4 | 4 | Domus: blooms, three glass levels, floating rail, 44px titles, warm/cool/green glows; the structure now departs from today's grid (room screen, building view). iOS: grouped inset lists with hairlines, opaque cards on `#f2f2f7` / true black, 34px title, segmented + 51×31 switch, filled icon squares, spring motion. Tesla: black canvas, 1px rules, no shadow/blur, one cold accent, 48px/500 titles, 72px numerals, inverted segmented. Not 5 anywhere: Domus canvas is gradient-only (no wallpaper); iOS keeps Heebo (no SF-like face) and its dark home is a grey-card layout that needs the orange fills to be read as iOS in one second; Tesla's phone boards are less "in-car" than the desktop. |
| R2 | Consistency across screens | 5 | 5 | 5 | One structure file for all skins: the same rail, corner, view switch, floor button, section header, tile, row, badge and dot in every screen and mode; a skin cannot change one screen without changing all. |
| R3 | RTL | 4 | 4 | 4 | All CSS logical; numbers/IDs isolated LTR; chevrons mirror; the "on" edge rule (Tesla) and the active rail bar sit at the start edge; LTR mirror shown for rail, bottom bar, tabs, segmented, toggle. Not 5: LTR mirrors of full boards are not rendered. |
| R4 | Dark + contrast | 5 | 5 | 5 | Dark designed per skin (blue-black + softer blooms / true black + elevated greys / pure black + light grey); 72 · 68 · 68 computed pairs per skin, all ≥ 4.5:1 (text) / ≥ 3:1 (indicators, toggle track, accent, focus), composited over the real canvas; solid fallback per level (already opaque in skins 2–3). |
| R5 | Phone + touch targets | 4 | 4 | 4 | 390 boards for all 6 screen×mode combinations; bottom bar; 44px targets (list-row controls, room power, floor button); widgets as a snap row; one-column area; two-column wall; list rows collapse to name+state / control. Not 5: the view switch drops its icons on the phone; long list boards scroll (by design). |
| R6 | State coverage | 4 | 4 | 4 | Area states board (loading · empty · error · unavailable domain + device · read-only) in the new structure; camera tile ×7; list rows: on / off / unavailable / offline camera; component sheet states. Not 5: no pending row in the list boards (tile only), no stale tile inside the 16-wall itself. |
| R7 | Implementability vs token contract | 5 | 5 | 5 | Same 203 names in every skin, full light+dark values, one TOKEN_MAP; base CSS has no literal colour/radius/shadow/blur; skin rules are counted (16 / 40 / 46) and bounded to material, "on" shape, rail and controls; `derive()` refuses unknown names. |
| R8 | Restraint and clarity | 4 | 4 | 5 | No paragraphs on operator screens; row = thing + state + control; empty domains are one quiet chip line; confirmation unchanged. Domus/iOS not 5: the home carries widgets + facts + room cards and fits 900px only with ~20px to spare. Tesla's whitespace makes the same content read calmer. |
| R9 | Originality within constraints | 4 | 3 | 4 | Own answers: skin layer with counted rules, room cards with ambient chips, three list modes, `-text` state companions, one-accent "on" for Tesla. iOS is by nature the least original (it is meant to feel like the platform); Domus/Tesla add their own moves (floating glass rail; inverted segmented, monochrome toggle). |
| R10 | Export completeness | 5 | 5 | 5 | JSON + CSS per skin (+ light/dark split for Domus), one TOKEN_MAP, RATIONALE, SKINS, this checklist; boards open from disk; contrast check per skin ends with a count below target (0 / 0 / 0). |

**Totals (self): Domus 44 / 50 · iOS 43 / 50 · Tesla 45 / 50**

Constraint check (§3), all skins: 1 RTL ✓ · 2 rail, no top bar ✓ · 3 44px ✓ · 4 no paragraphs/badges ✓ · 5 no platform names ✓ ("תשתית המערכת" once, in an error state) · 6 permission-driven visibility ✓ (read-only board) · 7 WisKey in the rail, frame untouched ✓ · 8 cheap wall ✓ · 9 light+dark, contrast, fallback, reduced-motion ✓ · 10 geometry not mirrored, no copied code ✓ (DomusUI: structure ideas only).

Not done: nothing from §1 or from the round-1a feedback. Known gaps are under "מה פתוח" in `RATIONALE_HE.md`.
