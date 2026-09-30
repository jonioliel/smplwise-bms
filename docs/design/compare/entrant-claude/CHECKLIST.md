# CHECKLIST — self-assessment against COMPARISON_TASK_HE.md §5 (entrant-claude, three skins, after the round-2 iOS judge)

Scores 1–5, one line of reasoning each, with the board to check. In brackets: the round-1 judge
(`docs/design/compare/JUDGE_REPORT_HE.md`, all skins) and, for iOS, the round-2 blind judge
(`docs/design/compare/JUDGE_IOS_REPORT_HE.md`, Claude 44 vs Astra 42). Where a judge scored lower than the previous
self-score, the fix is named. R1 reads "fidelity to the skin's own direction" for skins 2 and 3.

| # | Criterion | Domus | iOS | Tesla | Reasoning / evidence |
|---|---|---|---|---|---|
| R1 | Direction fidelity | 4 [4] | 4→**5?** [4 · r2 4] | 5 [4] | iOS after round 2: floating translucent rail (radius 28, 12px off the edge, shadow-2), floating pill bottom bar, 14/22/28/32 radii, one warm "on" tint on card / row / list row, floors as grouped lists and two-column KPI tiles on the phone (`renders/ios/home-1440-dark.png`, `home-390-light.png`, `foundations-shape.png`). Honest self-score: 4.5 — the shell now reads as iOS from every board; what still keeps it from an unambiguous 5 is Heebo instead of a system face and cards that are still "our" room cards on the desktop. Domus / Tesla unchanged. |
| R2 | Consistency across screens | 5 [5] | 5 [5 · r2 5] | 5 [5] | One structure file for all skins; the same rail, corner, view switch, floor button, section header, tile, row, badge, dot and camera chip in every screen and mode. iOS "on" is now the same tint + filled icon on home, area and list (judge r2 item 5). |
| R3 | RTL | 5 [3] | 5 [3 · **r2 3**] | 5 [3] | **Fixed (r2 blocker):** every directional glyph is logical — `dir:'fwd'` points to the inline-end, `dir:'back'` to the inline-start, flipped by `:dir()`; "פרטים", "ללא שיוך", section headers, list rows and "עוד" all point with the reading direction in RTL and in the 8 LTR mirrors (`renders/ios/home-1440-dark.png` vs `renders/ios/mirrors/home-1440-light-ltr.png`). Sliders fill from the inline-start in both directions and the thumb is centred on the fill end in LTR too. **The build fails** on any violation (`src/rtl-check.mjs`, 127 boards, 0 issues; negative test on a deliberately broken copy: 11 issues caught). |
| R4 | Dark + contrast | 5 [5] | 5 [5 · r2 5] | 5 [4] | Re-run after the fixes: `contrast-report-{domus,ios,tesla}.json` = 72 / 68 / 68 pairs, **0 below target**, min 3.05 / 3.41 / 3.36 (the 3:1 indicator pairs). |
| R5 | Phone + touch targets | 5 [4] | 5 [4 · **r2 4**] | 5 [4] | **Fixed (r2):** the widgets are a two-column grid on the phone — no card is cut, "כבה הכל בבניין" is always visible as a full-width action row (`renders/<skin>/home-390-*.png`); the floor facts line never orphans a number (name + action on line 1, facts whole on line 2); the wall has a grouped control panel (quality · count in a two-row grid · columns) and the tabs row is full width so no label is cut (`renders/<skin>/wall-390-*.png`). Targets stay ≥ 44 (rows 44–52, bar items 44, count cells 40 inside a 52 row). |
| R6 | State coverage | 5 [4] | 5 [4 · r2 5] | 5 [4] | Unchanged: 5 area states in context, 7 camera tile states, component states rest/hover/active/focus/disabled. Camera placeholders lost the floating rectangle that read as a bug (judge r2 item 6). |
| R7 | Implementability vs token contract | 5 [4] | 5 [4 · r2 5] | 5 [4] | 224 identical names per skin, `node contract-check.mjs` 0 missing; no literal `font-size` in product boards; skin rules **18 / 49 / 49** (≤ 50). The phone compositions of iOS use the contract's `--sw-kpi-compact-*` knobs; new radii are tokens. Skin rules sit last in the cascade — the layering the product will use under `[data-skin=…]`. |
| R8 | Restraint and clarity | 5 [4] | 5 [4 · **r2 4**] | 5 [4] | **Fixed (r2):** no hint lines on operator screens — "ללא התקנים באזור: …" and "צילומים מתרעננים כל דקה" removed, the "רזולוציה" column removed from the camera list, the "נתוני הדגמה" badge removed from the component sheet. Confirmations stay one question + count + one caveat + two buttons. |
| R9 | Originality within constraints | 4 [4] | 3 [3 · r2 4] | 4 [4] | Unchanged: skin layer with counted rules, room cards with ambient chips, three list modes, `-text` state companions, the optional-widget home variant; the iOS phone composition is a rewrite of a familiar pattern, not an invention. |
| R10 | Export completeness | 5 [4] | 5 [4 · r2 5] | 5 [4] | JSON + combined + light + dark CSS per skin, saved contrast reports, TOKEN_MAP, RATIONALE, SKINS, this checklist, 42–43 boards per skin incl. mirrors, list, kpi / panel variants; the reading-direction check is part of the build. |

**Totals (self): Domus 48 / 50 · iOS 48 / 50 (R1 counted as 4) · Tesla 49 / 50.** Judge: round 1 41 / 40 / 40; round 2
iOS 44 (blind, vs Astra 42). The self-score above the round-2 judge is tied to the four items he named as fixable
(R1 shell identity, R3 chevrons, R5 phone home + wall, R8 hints); the items are visible in the boards listed.

Honest weak points that remain (vs the judge's list): R1 — the iOS desktop home is still a grid of room cards, the
"looks like iOS" gain is strongest on the phone and in the shell; R9 — iOS stays the least original skin by nature; the
`home-panel` variant still shows both the facts row and the KPI strip (judge r2 item 8, left for the owner's decision
on direction ב); the 1440×900 home overflows by 9px because the ambient chips now wrap instead of being cut.

Constraint check (§3), all skins: 1 RTL + full LTR mirrors + automatic reading-direction check ✓ · 2 rail, no top bar ✓
· 3 44px ✓ · 4 no paragraphs/badges/hints on operator screens ✓ · 5 no platform names ✓ ("תשתית המערכת" once, in an
error state) and no engineering terms ✓ (resolution column gone) · 6 permission-driven visibility ✓ (read-only board) ·
7 WisKey in the rail, frame untouched ✓ · 8 cheap wall ✓ · 9 light+dark, contrast (saved report, 0 below target),
fallback, reduced-motion ✓ · 10 geometry not mirrored, no copied code ✓ (Astra / DomusUI: ideas only).

Not done from the judges' lists: the temperature dial and illustrated camera placeholders (the placeholder is now a
clean sky / horizon / ground band with a vignette, not an illustration), plus the component families that still have no
sheet example (live-player, schedule grid/bar, case picker, share members, remote sessions, CSP reports, floor iso) —
listed under "מה פתוח" in `RATIONALE_HE.md`.
